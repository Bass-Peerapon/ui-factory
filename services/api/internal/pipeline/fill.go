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
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/lint"
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/llm"
)

// fillConcurrency bounds parallel Gemini calls (free tier rate limits are low).
const fillConcurrency = 4

type FillResult struct {
	Filled   int
	Total    int
	Polished int // elements rewritten after the quality check
	Duration time.Duration
	Failures []string
}

func (f FillResult) QualityDetail() string {
	if f.Polished == 0 {
		return "ผ่าน"
	}
	return fmt.Sprintf("เขียนใหม่ %d จุด", f.Polished)
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

// fillSystem carries the writing and craft rules. The craft part is adapted from open-design's
// craft/anti-ai-slop.md, color.md and typography.md (Apache-2.0); see THIRD_PARTY_NOTICES.md.
const fillSystem = `You write the content of UI components for a realistic product prototype.

Writing rules:
- Write in %s. Natural, idiomatic copy a local designer would ship; keep brand names as they are.
- Be specific to the brief: concrete product details, believable names, prices and numbers (e.g. "1,240 orders this month").
  Never use vague superlatives or invented hype metrics ("10x faster", "99.9%%", "อันดับ 1 ของประเทศ").
- No filler ("lorem ipsum", "feature one", "ข้อความตัวอย่าง", "…"), no emoji.
- Stay inside the length budgets (characters per prop) given in the request. Headlines short and confident.
- Buttons use specific verbs ("จองคิวตัดผม", "Start tracking"), not generic ones ("คลิกที่นี่", "Get started").
- In a block's actions, exactly one Button may use variant "default"; the rest use "outline" or "ghost".
- Pick icons that match the meaning of each item.
- Vary the copy between sections: do not repeat the same headline pattern or phrase on one page.

%s

Return exactly one JSON object keyed by element id; each value is that element's props and must match the schema.`

var localeName = map[string]string{"th": "Thai (ภาษาไทย)", "en": "English"}

// fill replaces skeleton props in a frame block by block, in parallel, streaming each block as a patch.
func (r *Runner) fill(ctx context.Context, s *hub.Session, t *hub.Turn, frameID string, lock bool, progress *fillProgress) (FillResult, error) {
	if lock {
		s.UpdateTurn(t, frameID, "fill")
	} else {
		s.UpdateTurn(t, "", "fill")
	}
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
	if progress != nil {
		progress.add(len(groups), 0)
	}

	var outline []string
	for _, id := range spec.Elements[spec.Root].Children {
		outline = append(outline, spec.Elements[id].Type)
	}
	brief := frame.Brief
	if brief == "" {
		brief = frame.Name
	}
	guide := r.Cat.DesignGuide(fmt.Sprint(p.Theme["designSystem"]))
	if guide == "" {
		guide = "Design system: neutral, restrained; one accent color used only for the primary action."
	}
	system := fmt.Sprintf(fillSystem, localeName[p.Locale], guide)

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
			filled, polished, failures := r.fillGroup(ctx, s, frameID, spec, g, system, brief, outline)
			mu.Lock()
			res.Filled += filled
			res.Polished += polished
			res.Failures = append(res.Failures, failures...)
			mu.Unlock()
			if progress != nil {
				progress.add(0, 1)
			}
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
	system, brief string, outline []string) (int, int, []string) {
	pending := slices.Clone(g.ids)
	valid := map[string]map[string]any{}
	fallback := map[string]map[string]any{}
	lastErr := map[string]string{}
	polished := map[string]bool{}

	for attempt := 0; attempt < max(r.MaxRetries, 1) && len(pending) > 0; attempt++ {
		props := map[string]any{}
		var elements []map[string]any
		for _, id := range pending {
			el := spec.Elements[id]
			props[id] = r.Cat.ContentSchema(el.Type)
			item := map[string]any{"id": id, "type": el.Type, "description": r.Cat.Get(el.Type).Description}
			if v, ok := el.Props["variant"]; ok {
				item["layout_variant"] = v
			}
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
			"length_budgets": lint.Budgets,
			"brief":          brief,
			"page_outline":   outline,
			"block":          spec.Elements[g.block].Type,
			"elements":       elements,
		})
		out, err := r.Model.GenerateJSON(ctx, llm.JSONRequest{
			System: system,
			Prompt: string(prompt),
			Schema: map[string]any{"type": "object", "properties": props, "required": pending},
			Fast:   g.block == spec.Root,
		})
		if err != nil {
			if ctx.Err() != nil {
				return 0, 0, nil
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
			if v, ok := spec.Elements[id].Props["variant"]; ok {
				pr["variant"] = v // the composer chose the layout; content fill must not change it
			}
			if err := r.Cat.ValidateProps(spec.Elements[id].Type, pr); err != nil {
				lastErr[id] = err.Error()
				still = append(still, id)
				continue
			}
			if findings := lint.Props(pr); len(findings) > 0 && attempt < max(r.MaxRetries, 1)-1 {
				// Schema-valid but sloppy: keep it as a fallback and ask for a better version.
				fallback[id] = pr
				polished[id] = true
				lastErr[id] = "quality check failed: " + joinFindings(findings)
				still = append(still, id)
				continue
			}
			valid[id] = pr
			delete(fallback, id)
		}
		pending = still
	}

	// Elements that only failed the quality check still beat a skeleton.
	for id, pr := range fallback {
		valid[id] = pr
		pending = slices.DeleteFunc(pending, func(p string) bool { return p == id })
	}
	if len(valid) > 0 && ctx.Err() == nil {
		err := s.Mutate(ctx, hub.MutateOpts{}, func(p *doc.Project) error {
			for id, pr := range valid {
				if err := doc.UpdateProps(r.Cat, p, frameID, id, pr, true); err != nil {
					return err
				}
			}
			demotePrimaryButtons(p.Frames[frameID].Spec, g.block)
			return nil
		})
		if err != nil {
			return 0, 0, []string{fmt.Sprintf("%s: %v", spec.Elements[g.block].Type, err)}
		}
	}
	var failures []string
	for _, id := range pending {
		failures = append(failures, fmt.Sprintf("%s (%s) หลังลอง %d ครั้ง: %s", spec.Elements[id].Type, id, r.MaxRetries, truncate(lastErr[id], 160)))
	}
	return len(valid), len(polished), failures
}

func joinFindings(fs []lint.Finding) string {
	parts := make([]string, len(fs))
	for i, f := range fs {
		parts[i] = f.String()
	}
	return strings.Join(parts, "; ")
}

// demotePrimaryButtons keeps at most one solid Button per slot of the block.
func demotePrimaryButtons(s *doc.Spec, block string) {
	el := s.Elements[block]
	if el == nil {
		return
	}
	typeOf := func(id string) string { return s.Elements[id].Type }
	variantOf := func(id string) string { v, _ := s.Elements[id].Props["variant"].(string); return v }
	for _, ids := range el.Slots {
		for _, id := range lint.PrimaryButtons(ids, typeOf, variantOf) {
			s.Elements[id].Props["variant"] = "outline"
		}
	}
}
