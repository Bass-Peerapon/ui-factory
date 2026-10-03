package pipeline

import (
	"context"
	"encoding/json/v2"
	"fmt"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/Bass-Peerapon/ui-factory/services/api/internal/doc"
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/hub"
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/llm"
)

// fillConcurrency bounds parallel Gemini calls (free tier rate limits are low).
const fillConcurrency = 4

type FillResult struct {
	Filled   int
	Total    int
	Duration time.Duration
	Failures []string
}

func (f FillResult) Summary() string {
	if f.Total == 0 {
		return "ไม่มี skeleton ให้เติม"
	}
	s := fmt.Sprintf("เติมเนื้อหา %d/%d elements ด้วย Gemini ใน %.1f วินาที", f.Filled, f.Total, f.Duration.Seconds())
	if len(f.Failures) > 0 {
		s += "\nส่วนที่ทำไม่ได้ (ยังเป็น skeleton):\n- " + strings.Join(f.Failures, "\n- ")
	}
	return s
}

type fillGroup struct {
	block string   // top-level element id
	ids   []string // skeleton elements in the block's subtree
}

func skeletonGroups(s *doc.Spec) []fillGroup {
	isSkeleton := func(id string) bool { sk, _ := s.Elements[id].Props["skeleton"].(bool); return sk }
	var groups []fillGroup
	if isSkeleton(s.Root) {
		groups = append(groups, fillGroup{block: s.Root, ids: []string{s.Root}})
	}
	for _, top := range s.Elements[s.Root].Children {
		ids := slices.DeleteFunc(s.Subtree(top), func(id string) bool { return s.Elements[id] == nil || !isSkeleton(id) })
		if len(ids) > 0 {
			groups = append(groups, fillGroup{block: top, ids: ids})
		}
	}
	return groups
}

const fillSystem = `You write realistic mock content for UI components of a web page prototype.
Rules:
- Write in %s. Use natural, specific copy for the product in the brief (brand names, prices, numbers, names of people). No lorem ipsum, no placeholders like "…".
- Keep copy concise like a real website: headlines up to 10 words, descriptions up to 25 words.
- Keep a consistent brand and tone across the whole page.
- Return exactly one JSON object keyed by element id; each value is that element's props and must match the schema.`

var localeName = map[string]string{"th": "Thai (ภาษาไทย)", "en": "English"}

// fill replaces skeleton props in a frame block by block, in parallel, streaming each block as a patch.
func (r *Runner) fill(ctx context.Context, s *hub.Session, t *hub.Turn, frameID string) (FillResult, error) {
	s.UpdateTurn(t, frameID, "fill")
	start := time.Now()
	p, _ := s.Doc()
	spec, err := p.SpecOf(frameID)
	if err != nil {
		return FillResult{}, err
	}
	frame := p.Frames[frameID]
	groups := skeletonGroups(spec)
	res := FillResult{}
	for _, g := range groups {
		res.Total += len(g.ids)
	}
	if res.Total == 0 {
		return res, nil
	}

	var outline []string
	for _, id := range spec.Elements[spec.Root].Children {
		outline = append(outline, spec.Elements[id].Type)
	}
	brief := frame.Brief
	if brief == "" {
		brief = frame.Name
	}
	system := fmt.Sprintf(fillSystem, localeName[p.Locale])

	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, fillConcurrency)
	for _, g := range groups {
		wg.Go(func() {
			select {
			case sem <- struct{}{}:
			case <-ctx.Done():
				return
			}
			defer func() { <-sem }()
			filled, failures := r.fillGroup(ctx, s, frameID, spec, g, system, brief, outline)
			mu.Lock()
			res.Filled += filled
			res.Failures = append(res.Failures, failures...)
			mu.Unlock()
		})
	}
	wg.Wait()
	res.Duration = time.Since(start)
	if err := context.Cause(ctx); ctx.Err() != nil {
		return res, err
	}
	return res, nil
}

func (r *Runner) fillGroup(ctx context.Context, s *hub.Session, frameID string, spec *doc.Spec, g fillGroup,
	system, brief string, outline []string) (int, []string) {
	pending := slices.Clone(g.ids)
	valid := map[string]map[string]any{}
	lastErr := map[string]string{}

	for attempt := 0; attempt < max(r.MaxRetries, 1) && len(pending) > 0; attempt++ {
		props := map[string]any{}
		var elements []map[string]any
		for _, id := range pending {
			el := spec.Elements[id]
			props[id] = r.Cat.ContentSchema(el.Type)
			item := map[string]any{"id": id, "type": el.Type, "description": r.Cat.Get(el.Type).Description}
			if loc, ok := spec.Locate(id); ok {
				item["parent"] = spec.Elements[loc.ParentID].Type
				if loc.Slot != "" {
					item["slot"] = loc.Slot
				}
			}
			if msg, ok := lastErr[id]; ok {
				item["previous_error"] = msg
			}
			elements = append(elements, item)
		}
		prompt, _ := json.Marshal(map[string]any{
			"brief":        brief,
			"page_outline": outline,
			"block":        spec.Elements[g.block].Type,
			"elements":     elements,
		})
		out, err := r.Model.GenerateJSON(ctx, llm.JSONRequest{
			System: system,
			Prompt: string(prompt),
			Schema: map[string]any{"type": "object", "properties": props, "required": pending},
			Fast:   g.block == spec.Root,
		})
		if err != nil {
			if ctx.Err() != nil {
				return 0, nil
			}
			for _, id := range pending {
				lastErr[id] = err.Error()
			}
			continue
		}
		var got map[string]map[string]any
		if err := json.Unmarshal([]byte(out), &got); err != nil {
			for _, id := range pending {
				lastErr[id] = "response was not valid JSON: " + err.Error()
			}
			continue
		}
		var still []string
		for _, id := range pending {
			pr, ok := got[id]
			if !ok {
				lastErr[id] = "missing in response"
				still = append(still, id)
				continue
			}
			delete(pr, "skeleton")
			if err := r.Cat.ValidateProps(spec.Elements[id].Type, pr); err != nil {
				lastErr[id] = err.Error()
				still = append(still, id)
				continue
			}
			valid[id] = pr
		}
		pending = still
	}

	if len(valid) > 0 && ctx.Err() == nil {
		err := s.Mutate(ctx, hub.MutateOpts{}, func(p *doc.Project) error {
			for id, pr := range valid {
				if err := doc.UpdateProps(r.Cat, p, frameID, id, pr, true); err != nil {
					return err
				}
			}
			return nil
		})
		if err != nil {
			return 0, []string{fmt.Sprintf("%s: %v", spec.Elements[g.block].Type, err)}
		}
	}
	var failures []string
	for _, id := range pending {
		failures = append(failures, fmt.Sprintf("%s (%s) หลังลอง %d ครั้ง: %s", spec.Elements[id].Type, id, r.MaxRetries, truncate(lastErr[id], 160)))
	}
	return len(valid), failures
}
