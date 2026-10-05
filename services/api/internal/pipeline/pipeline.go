// Package pipeline runs one agent turn: Router, Brief, Structure (Jev), Fill (Gemini) and Edit (adk-go tools).
package pipeline

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"unicode/utf8"

	"github.com/Bass-Peerapon/ui-factory/services/api/internal/catalog"
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/composer"
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/doc"
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/hub"
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/llm"
)

type Runner struct {
	Cat        *catalog.Catalog
	Composer   *composer.Client
	Model      llm.Model
	MaxRetries int
}

// Comment is a note pinned on one element; a turn with comments only edits those elements.
type Comment struct {
	ElementID string `json:"elementId"`
	Text      string `json:"text"`
}

type ChatRequest struct {
	Text      string    `json:"text"`
	FrameID   string    `json:"frameId"`
	ElementID string    `json:"elementId"`
	Wireframe bool      `json:"wireframe"`
	Comments  []Comment `json:"comments"`
	// Brief holds the clarify-form answers (pageType, platform, designSystem, density, tone).
	Brief     map[string]string `json:"brief"`
	SkipBrief bool              `json:"skipBrief"`
	// DisplayText replaces Text in the chat bubble (e.g. a summary of form answers).
	DisplayText string `json:"displayText"`
}

// briefThreshold is the Jev probability above which a request is specific enough to build without asking.
const briefThreshold = 0.6

type reply struct {
	text string
	meta map[string]any
}

// Chat starts a turn for a user message and returns its id; work continues in the background.
func (r *Runner) Chat(ctx context.Context, s *hub.Session, req ChatRequest) (string, error) {
	req.Text = strings.TrimSpace(req.Text)
	if req.Text == "" && len(req.Comments) == 0 {
		return "", errors.New("ข้อความว่าง")
	}
	if len(req.Comments) > 0 && req.Text == "" {
		req.Text = commentsText(req.Comments)
	}
	t, tctx, err := s.BeginTurn(ctx, req.FrameID, "route", "AI: "+truncate(req.Text, 40))
	if err != nil {
		return "", err
	}
	var meta map[string]any
	if len(req.Comments) > 0 {
		meta = map[string]any{"kind": "comments", "comments": req.Comments, "frameId": req.FrameID}
	}
	s.AddMessageMeta(ctx, "user", cmp.Or(req.DisplayText, req.Text), t.ID, meta)
	go r.run(tctx, s, t, func(ctx context.Context) (reply, error) { return r.dispatch(ctx, s, t, req) })
	return t.ID, nil
}

// Fill starts a turn that fills every skeleton element of a frame (Wireframe mode, Components panel).
func (r *Runner) Fill(ctx context.Context, s *hub.Session, frameID string) (string, error) {
	p, _ := s.Doc()
	var frames []string
	if frameID == "" { // fill every frame that still has skeletons
		for _, id := range p.FrameOrder {
			if sp := p.Frames[id].Spec; sp != nil && len(skeletonGroups(sp)) > 0 {
				frames = append(frames, id)
			}
		}
	} else if _, err := p.SpecOf(frameID); err != nil {
		return "", err
	} else {
		frames = []string{frameID}
	}
	if len(frames) == 0 {
		return "", errors.New("ไม่มี skeleton ให้เติม")
	}
	t, tctx, err := s.BeginTurn(ctx, frameID, "fill", "AI: Fill")
	if err != nil {
		return "", err
	}
	go r.run(tctx, s, t, func(ctx context.Context) (reply, error) {
		s.Plan(t, "เติมเนื้อหาด้วย Gemini", "ตรวจคุณภาพ")
		res, err := r.fillFrames(ctx, s, t, frames, 0)
		if err != nil {
			return reply{}, err
		}
		s.Step(t, 1, res.QualityDetail())
		return reply{text: res.Summary()}, nil
	})
	return t.ID, nil
}

func (r *Runner) run(ctx context.Context, s *hub.Session, t *hub.Turn, work func(context.Context) (reply, error)) {
	bg := context.WithoutCancel(ctx)
	status := "done"
	var out reply
	func() {
		defer func() {
			if v := recover(); v != nil {
				slog.Error("turn panic", "panic", v)
				status, out = "error", reply{text: fmt.Sprintf("เกิดข้อผิดพลาดภายใน: %v", v)}
			}
		}()
		var err error
		out, err = work(ctx)
		switch {
		case errors.Is(context.Cause(ctx), hub.ErrStopped):
			status, out = "stopped", reply{text: "หยุดแล้ว และย้อนกลับไปสถานะก่อนเริ่มคำสั่งนี้"}
		case err != nil:
			slog.Error("turn failed", "turn", t.ID, "err", err)
			status, out = "error", reply{text: "ทำไม่สำเร็จ: " + err.Error()}
		}
	}()
	s.EndTurn(bg, t, status)
	if out.text != "" {
		s.AddMessageMeta(bg, "assistant", out.text, t.ID, out.meta)
	}
}

func (r *Runner) dispatch(ctx context.Context, s *hub.Session, t *hub.Turn, req ChatRequest) (reply, error) {
	p, _ := s.Doc()
	frame := p.Frames[req.FrameID]
	hasContent := frame != nil && frame.Spec != nil

	if len(req.Comments) > 0 {
		if !hasContent {
			return reply{}, errors.New("คอมเมนต์ต้องอยู่บนเฟรมที่มีเนื้อหา")
		}
		s.Plan(t, "อ่านคอมเมนต์", "แก้เฉพาะจุดที่คอมเมนต์")
		return r.edit(ctx, s, t, req, "edit_selection")
	}

	s.Plan(t, "เข้าใจคำสั่ง")
	intent := ""
	if req.Brief != nil {
		intent = cmp.Or(req.Brief["intent"], "new_page") // answered form: the route was decided before asking
	} else {
		selection := "nothing"
		switch {
		case hasContent && req.ElementID != "" && frame.Spec.Elements[req.ElementID] != nil:
			selection = frame.Spec.Elements[req.ElementID].Type + " element"
		case hasContent:
			selection = "the whole page " + frame.Name
		}
		in := composer.RouteInput{Prompt: req.Text, Selection: selection, FrameHasContent: hasContent}
		if hasContent {
			in.CurrentPage = cmp.Or(frame.Brief, frame.Name)
		}
		route, err := r.Composer.Route(ctx, in)
		if err != nil {
			return reply{}, err
		}
		conf := -1.0
		if route.Confidence != nil {
			conf = *route.Confidence
		}
		slog.Info("route", "intent", route.Intent, "confidence", conf, "ms", route.MS, "composer", route.Composer)
		intent = route.Intent
		if intent == "edit_selection" && !hasContent {
			intent = "new_page" // nothing to edit yet
		}
	}

	switch intent {
	case "new_page", "new_flow":
		b, ask, err := r.brief(ctx, s, req, intent)
		if err != nil {
			return reply{}, err
		}
		if ask != nil {
			return *ask, nil
		}
		if intent == "new_flow" {
			return r.newFlow(ctx, s, t, req, b)
		}
		return r.newPage(ctx, s, t, req, frame, b)
	case "set_theme", "edit_selection":
		s.Plan(t, "เข้าใจคำสั่ง", "แก้ไขด้วย agent")
		s.Step(t, 1, "")
		return r.edit(ctx, s, t, req, intent)
	default:
		return reply{}, fmt.Errorf("unknown intent %q", intent)
	}
}

// pageBrief is what the clarify step settled on.
type pageBrief struct {
	device  string
	context string // appended to composer and fill prompts
	applied []string
}

// brief returns the settled brief, or a form reply when the request is too vague to build.
func (r *Runner) brief(ctx context.Context, s *hub.Session, req ChatRequest, intent string) (pageBrief, *reply, error) {
	answers := req.Brief
	auto := false
	if answers == nil {
		if req.SkipBrief {
			return pageBrief{}, nil, nil
		}
		b, err := r.Composer.Brief(ctx, req.Text)
		if err != nil {
			slog.Warn("brief failed, building without it", "err", err)
			return pageBrief{}, nil, nil
		}
		defaults := map[string]string{"intent": intent}
		for k, v := range b.Answers {
			defaults[k] = v.Value
		}
		p, _ := s.Doc()
		if ds := fmt.Sprint(p.Theme["designSystem"]); !isDefaultDS(ds) {
			defaults["designSystem"] = ds // the user already picked one; keep it as the default
		}
		if b.Sufficient < briefThreshold {
			return pageBrief{}, &reply{
				text: "ขอรายละเอียดอีกนิดก่อนเริ่ม ค่าที่เลือกไว้คือคำแนะนำ กดสร้างได้เลยถ้าเห็นด้วย",
				meta: map[string]any{"kind": "brief", "prompt": req.Text, "frameId": req.FrameID, "defaults": defaults, "sufficient": b.Sufficient},
			}, nil
		}
		answers, auto = defaults, true
	}

	out := pageBrief{device: answers["platform"]}
	var ctxParts []string
	if v := answers["pageType"]; v != "" {
		ctxParts = append(ctxParts, "page type: "+v)
	}
	if v := answers["tone"]; v != "" {
		ctxParts = append(ctxParts, "tone: "+v)
	}
	out.context = strings.Join(ctxParts, ", ")

	// Apply the design system: always when the user answered the form, and on auto only while the
	// project still uses the default system.
	p, _ := s.Doc()
	ds := answers["designSystem"]
	cur := fmt.Sprint(p.Theme["designSystem"])
	if ds != "" && ds != cur && (!auto || isDefaultDS(cur)) {
		tokens := map[string]any{}
		if d := answers["density"]; d != "" {
			tokens["density"] = d
		}
		if err := s.Mutate(ctx, hub.MutateOpts{}, func(p *doc.Project) error { return doc.SetTheme(r.Cat, p, ds, tokens) }); err == nil {
			out.applied = append(out.applied, "design system "+ds)
		}
	} else if d := answers["density"]; d != "" && d != fmt.Sprint(p.Theme["density"]) && !auto {
		_ = s.Mutate(ctx, hub.MutateOpts{}, func(p *doc.Project) error {
			return doc.SetTheme(r.Cat, p, "", map[string]any{"density": d})
		})
	}
	return out, nil, nil
}

func isDefaultDS(id string) bool {
	return id == "" || id == "<nil>" || id == "shadcn" || id == "neutral"
}

func (b pageBrief) prompt(text string) string {
	if b.context == "" {
		return text
	}
	return text + "\n(" + b.context + ")"
}

func (r *Runner) newPage(ctx context.Context, s *hub.Session, t *hub.Turn, req ChatRequest, selected *doc.Frame, b pageBrief) (reply, error) {
	s.Plan(t, "เข้าใจคำสั่ง", "วางโครงด้วย Jev", "เติมเนื้อหาด้วย Gemini", "ตรวจคุณภาพ")
	frameID := ""
	err := s.Mutate(ctx, hub.MutateOpts{}, func(p *doc.Project) error {
		if selected != nil && selected.Spec == nil && (b.device == "" || b.device == selected.Device) {
			frameID = selected.ID
		} else {
			device := cmp.Or(b.device, "desktop")
			if selected != nil && b.device == "" {
				device = selected.Device
			}
			id, err := doc.CreateFrame(p, truncate(req.Text, 28), device)
			if err != nil {
				return err
			}
			frameID = id
		}
		p.Frames[frameID].Brief = b.prompt(req.Text)
		return nil
	})
	if err != nil {
		return reply{}, err
	}
	s.UpdateTurn(t, frameID, "structure")
	s.Step(t, 1, "")

	st, err := r.structure(ctx, s, frameID, b.prompt(req.Text))
	if err != nil {
		return reply{}, err
	}
	head := st.summary(r.Composer.Mode)
	if len(b.applied) > 0 {
		head += "\nใช้ " + strings.Join(b.applied, ", ") + " ตามที่แนะนำ"
	}
	if req.Wireframe {
		return reply{text: head + "\nWireframe mode: กด Fill เมื่อพร้อมให้ AI เติมเนื้อหา"}, nil
	}
	s.Step(t, 2, "")
	res, err := r.fillFrames(ctx, s, t, []string{frameID}, 2)
	if err != nil {
		return reply{}, err
	}
	s.Step(t, 3, res.QualityDetail())
	return r.withNext(s, frameID, head+"\n"+res.Summary()), nil
}

type structureResult struct {
	blocks, elements, ms, evals int
	stop                        string
}

func (st structureResult) summary(mode string) string {
	return fmt.Sprintf("วางโครง %d blocks, %d elements ด้วย %s ใน %.1f วินาที (%d evaluations, %s)",
		st.blocks, st.elements, mode, float64(st.ms)/1000, st.evals, st.stop)
}

// structure streams composer snapshots into a frame.
func (r *Runner) structure(ctx context.Context, s *hub.Session, frameID, prompt string) (structureResult, error) {
	var final *doc.Spec
	var res structureResult
	for ev, err := range r.Composer.Structure(ctx, prompt) {
		if err != nil {
			return res, err
		}
		if ev.Spec == nil {
			res.stop = ev.StopReason
			continue
		}
		if err := doc.ValidateSpec(r.Cat, ev.Spec); err != nil {
			return res, fmt.Errorf("composer returned an invalid spec: %w", err)
		}
		if err := s.Mutate(ctx, hub.MutateOpts{}, func(p *doc.Project) error {
			p.Frames[frameID].Spec = ev.Spec
			return nil
		}); err != nil {
			return res, err
		}
		final = ev.Spec
		if ev.Type == "complete" {
			res.stop, res.ms, res.evals = ev.StopReason, ev.MS, ev.Evaluations
		}
	}
	if final == nil {
		return res, fmt.Errorf("วางโครงไม่ได้ (composer stopReason=%s)", res.stop)
	}
	res.blocks, res.elements = len(final.Elements[final.Root].Children), len(final.Elements)
	return res, nil
}

// newFlow builds every screen of a flow pattern side by side and wires their buttons together.
func (r *Runner) newFlow(ctx context.Context, s *hub.Session, t *hub.Turn, req ChatRequest, b pageBrief) (reply, error) {
	s.Plan(t, "เข้าใจคำสั่ง", "วางแผน flow", "วางโครงทุกหน้า", "เชื่อมปุ่มข้ามหน้า", "เติมเนื้อหาด้วย Gemini", "ตรวจคุณภาพ")
	s.UpdateTurn(t, "", "plan")
	s.Step(t, 1, "")
	plan, err := r.Composer.Plan(ctx, b.prompt(req.Text))
	if err != nil {
		return reply{}, err
	}
	if len(plan.Pages) == 0 {
		return reply{}, errors.New("วางแผน flow ไม่ได้")
	}
	device := cmp.Or(b.device, plan.Device, "desktop")
	flowLabel := plan.Pattern
	keyToFrame := map[string]string{}
	var frameIDs []string
	if err := s.Mutate(ctx, hub.MutateOpts{}, func(p *doc.Project) error {
		for i, pg := range plan.Pages {
			id, err := doc.CreateFrame(p, fmt.Sprintf("%d. %s", i+1, pg.Name), device)
			if err != nil {
				return err
			}
			p.Frames[id].Brief, p.Frames[id].Flow = b.prompt(pg.Brief), flowLabel
			keyToFrame[pg.Key] = id
			frameIDs = append(frameIDs, id)
		}
		return nil
	}); err != nil {
		return reply{}, err
	}
	s.Step(t, 2, fmt.Sprintf("%d หน้า", len(plan.Pages)))

	// Jev composes in under a second, so all pages are structured in parallel.
	var wg sync.WaitGroup
	var mu sync.Mutex
	var structErrs []error
	for i, pg := range plan.Pages {
		wg.Go(func() {
			if _, err := r.structure(ctx, s, frameIDs[i], b.prompt(pg.Brief)); err != nil {
				mu.Lock()
				structErrs = append(structErrs, fmt.Errorf("%s: %w", pg.Name, err))
				mu.Unlock()
			}
		})
	}
	wg.Wait()
	if ctx.Err() != nil {
		return reply{}, context.Cause(ctx)
	}
	if len(structErrs) == len(plan.Pages) {
		return reply{}, errors.Join(structErrs...)
	}

	s.Step(t, 3, "")
	var linked []string
	_ = s.Mutate(ctx, hub.MutateOpts{}, func(p *doc.Project) error {
		for _, l := range plan.Links {
			from, to := keyToFrame[l[0]], keyToFrame[l[1]]
			sp := p.Frames[from].Spec
			if sp == nil || to == "" {
				continue
			}
			if btn := sp.FirstButton(); btn != "" && doc.SetNavigation(r.Cat, p, from, btn, to) == nil {
				linked = append(linked, p.Frames[from].Name+" → "+p.Frames[to].Name)
			}
		}
		return nil
	})

	head := fmt.Sprintf("สร้าง flow %s %d หน้า (%s) ด้วย Jev", plan.Pattern, len(plan.Pages), device)
	if len(linked) > 0 {
		head += "\nเชื่อมปุ่ม: " + strings.Join(linked, ", ")
	}
	for _, e := range structErrs {
		head += "\nวางโครงไม่สำเร็จ: " + e.Error()
	}
	if req.Wireframe {
		return reply{text: head + "\nWireframe mode: กด Fill ทั้งหมด เมื่อพร้อม"}, nil
	}
	s.Step(t, 4, "")
	res, err := r.fillFrames(ctx, s, t, frameIDs, 4)
	if err != nil {
		return reply{}, err
	}
	s.Step(t, 5, res.QualityDetail())
	out := r.withNext(s, frameIDs[0], head+"\n"+res.Summary())
	out.meta["next"] = append([]map[string]any{{"label": "เปิด Prototype ของ flow", "action": "prototype", "frameId": frameIDs[0]}},
		out.meta["next"].([]map[string]any)...)
	return out, nil
}

// fillFrames fills several frames concurrently and reports progress on the given step.
func (r *Runner) fillFrames(ctx context.Context, s *hub.Session, t *hub.Turn, frameIDs []string, step int) (FillResult, error) {
	var total FillResult
	var mu sync.Mutex
	var wg sync.WaitGroup
	var firstErr error
	progress := func(done, all int) { s.Step(t, step, fmt.Sprintf("%d/%d blocks", done, all)) }
	tracker := &fillProgress{report: progress}
	for _, id := range frameIDs {
		wg.Go(func() {
			res, err := r.fill(ctx, s, t, id, len(frameIDs) == 1, tracker)
			mu.Lock()
			defer mu.Unlock()
			if err != nil && firstErr == nil {
				firstErr = err
			}
			total.Filled += res.Filled
			total.Total += res.Total
			total.Polished += res.Polished
			total.Failures = append(total.Failures, res.Failures...)
			total.Duration = max(total.Duration, res.Duration)
		})
	}
	wg.Wait()
	return total, firstErr
}

type fillProgress struct {
	mu          sync.Mutex
	done, total int
	report      func(done, total int)
}

func (f *fillProgress) add(total, done int) {
	f.mu.Lock()
	f.total += total
	f.done += done
	d, a := f.done, f.total
	f.mu.Unlock()
	f.report(d, a)
}

func commentsText(cs []Comment) string {
	parts := make([]string, len(cs))
	for i, c := range cs {
		parts[i] = fmt.Sprintf("%d. %s", i+1, c.Text)
	}
	return strings.Join(parts, "\n")
}

func truncate(s string, n int) string {
	s = strings.Join(strings.Fields(s), " ")
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	return string([]rune(s)[:n]) + "…"
}
