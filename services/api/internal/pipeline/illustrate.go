package pipeline

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"slices"
	"strings"
	"sync"

	"github.com/Bass-Peerapon/ui-factory/services/api/internal/doc"
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/hub"
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/llm"
)

const (
	// maxImagesPerFrame bounds cost and time: about 9 seconds and one request per photo,
	// three at a time, so a full page adds roughly 25 seconds.
	maxImagesPerFrame  = 7
	illustrateParallel = 3
)

// imageJob is one photo slot: a top-level prop (item < 0) or one item of a list prop.
type imageJob struct {
	frameID, elementID string
	list               string // list prop holding the item, e.g. "items" of a Gallery
	item               int
	alt, aspect        string
}

// imageJobs lists the empty photo slots of a frame in page order.
func imageJobs(frameID string, sp *doc.Spec) []imageJob {
	if sp == nil || sp.Elements[sp.Root] == nil {
		return nil
	}
	var jobs []imageJob
	str := func(m map[string]any, k string) string { v, _ := m[k].(string); return strings.TrimSpace(v) }
	for _, id := range sp.Elements[sp.Root].Children {
		el := sp.Elements[id]
		if el == nil || el.Props["skeleton"] == true {
			continue
		}
		switch el.Type {
		case "Hero":
			if v := str(el.Props, "variant"); v != "editorial" && str(el.Props, "imageAlt") != "" && str(el.Props, "image") == "" {
				aspect := "16:9"
				if v == "split" {
					aspect = "4:3"
				}
				jobs = append(jobs, imageJob{frameID: frameID, elementID: id, item: -1, alt: str(el.Props, "imageAlt"), aspect: aspect})
			}
		case "ImageText":
			if str(el.Props, "imageAlt") != "" && str(el.Props, "image") == "" {
				jobs = append(jobs, imageJob{frameID: frameID, elementID: id, item: -1, alt: str(el.Props, "imageAlt"), aspect: "4:3"})
			}
		case "Gallery":
			items, _ := el.Props["items"].([]any)
			for i, it := range items {
				m, _ := it.(map[string]any)
				if m != nil && str(m, "caption") != "" && str(m, "image") == "" {
					aspect := "4:3"
					if i == 0 {
						aspect = "3:4" // the gallery's tall lead tile
					}
					jobs = append(jobs, imageJob{frameID: frameID, elementID: id, list: "items", item: i, alt: str(m, "caption"), aspect: aspect})
				}
			}
		}
	}
	return jobs[:min(len(jobs), maxImagesPerFrame)]
}

// photoPrompt keeps photos specific to the business and away from the generic stock look that
// impeccable's craft floor rejects ("real imagery or none").
func photoPrompt(brief, facts, artDirection, alt string, others []string) string {
	var b strings.Builder
	b.WriteString("Editorial documentary photograph for the website of this business.\n")
	fmt.Fprintf(&b, "Business: %s\n", strings.TrimSpace(brief))
	if facts != "" {
		fmt.Fprintf(&b, "Facts: %s\n", truncate(facts, 600))
	}
	fmt.Fprintf(&b, "The shot: %s\n", alt)
	if artDirection != "" {
		fmt.Fprintf(&b, "Art direction: %s\n", artDirection)
	}
	if len(others) > 0 {
		fmt.Fprintf(&b, "Other photos on the same page: %s. Make this one clearly different in subject, distance and framing.\n", strings.Join(others, "; "))
	}
	b.WriteString("Real place and real people doing the actual work, candid, natural light, believable local setting, " +
		"one clear subject with honest detail. Not a stock photo: no posing at the camera, no floating objects, no glossy CGI, " +
		"no text, lettering, signage, logos, watermark or border.")
	return b.String()
}

// illustrate draws photos for the empty image slots of the frames. Failures leave the described
// placeholder in place and are only reported.
func (r *Runner) illustrate(ctx context.Context, s *hub.Session, t *hub.Turn, frameIDs []string, step int) (drawn int, failures []string) {
	if r.Images == nil || r.ImageStore == nil {
		return 0, nil
	}
	p, _ := s.Doc()
	var jobs []imageJob
	for _, id := range frameIDs {
		if f := p.Frames[id]; f != nil {
			jobs = append(jobs, imageJobs(id, f.Spec)...)
		}
	}
	if len(jobs) == 0 {
		return 0, nil
	}
	art := r.artDirection(p)
	s.Step(t, step, fmt.Sprintf("0/%d ภาพ", len(jobs)))

	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, illustrateParallel)
	disabled := false
	for _, j := range jobs {
		wg.Go(func() {
			select {
			case sem <- struct{}{}:
			case <-ctx.Done():
				return
			}
			defer func() { <-sem }()
			mu.Lock()
			skip := disabled
			mu.Unlock()
			if skip {
				return
			}
			f := p.Frames[j.frameID]
			data, mime, err := r.Images.GenerateImage(ctx, photoPrompt(f.Brief, f.Facts, art, j.alt, otherShots(jobs, j)), j.aspect)
			if err == nil {
				var url string
				if url, err = r.ImageStore.Save(data, mime); err == nil {
					err = s.Mutate(ctx, hub.MutateOpts{}, func(p *doc.Project) error { return setImage(r, p, j, url) })
				}
			}
			mu.Lock()
			defer mu.Unlock()
			switch {
			case errors.Is(err, llm.ErrNoImageModel):
				disabled = true
			case err != nil && ctx.Err() == nil:
				slog.Warn("image failed", "frame", j.frameID, "element", j.elementID, "err", err)
				failures = append(failures, truncate(err.Error(), 120))
			case err == nil:
				drawn++
				s.Step(t, step, fmt.Sprintf("%d/%d ภาพ", drawn, len(jobs)))
			}
		})
	}
	wg.Wait()
	return drawn, failures
}

// otherShots lists the other photos of the same frame so the model varies subject and framing.
func otherShots(jobs []imageJob, self imageJob) []string {
	var out []string
	for _, j := range jobs {
		if j.frameID == self.frameID && j != self {
			out = append(out, j.alt)
		}
	}
	return out
}

func setImage(r *Runner, p *doc.Project, j imageJob, url string) error {
	sp, err := p.SpecOf(j.frameID)
	if err != nil {
		return err
	}
	el := sp.Elements[j.elementID]
	if el == nil {
		return nil // removed while the photo was drawn
	}
	if j.item < 0 {
		return doc.UpdateProps(r.Cat, p, j.frameID, j.elementID, map[string]any{"image": url}, false)
	}
	list, _ := el.Props[j.list].([]any)
	if j.item >= len(list) {
		return nil
	}
	list = slices.Clone(list)
	item, _ := list[j.item].(map[string]any)
	item = maps.Clone(item)
	item["image"] = url
	list[j.item] = item
	return doc.UpdateProps(r.Cat, p, j.frameID, j.elementID, map[string]any{j.list: list}, false)
}

// artDirection describes the project's design system so photos share its mood and palette.
func (r *Runner) artDirection(p *doc.Project) string {
	id := fmt.Sprint(p.Theme["designSystem"])
	for _, d := range r.Cat.DesignSystems {
		if d.ID == id {
			return fmt.Sprintf("%s (%s); colors that sit with primary %v on background %v", d.Summary, d.Category, p.Theme["primary"], p.Theme["background"])
		}
	}
	return ""
}

func imagesSummary(drawn int, failures []string) string {
	if drawn == 0 && len(failures) == 0 {
		return ""
	}
	s := fmt.Sprintf("สร้างภาพ %d ภาพด้วย Gemini", drawn)
	if len(failures) > 0 {
		s += fmt.Sprintf(" (ไม่สำเร็จ %d ภาพ ยังเป็นภาพตัวอย่างพร้อมคำบรรยาย)", len(failures))
	}
	return s
}
