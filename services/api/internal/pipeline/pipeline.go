// Package pipeline runs one agent turn: Router, Structure (Jev), Fill (Gemini) and Edit (adk-go tools).
package pipeline

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
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

type ChatRequest struct {
	Text      string `json:"text"`
	FrameID   string `json:"frameId"`
	ElementID string `json:"elementId"`
	Wireframe bool   `json:"wireframe"`
}

// Chat starts a turn for a user message and returns its id; work continues in the background.
func (r *Runner) Chat(ctx context.Context, s *hub.Session, req ChatRequest) (string, error) {
	req.Text = strings.TrimSpace(req.Text)
	if req.Text == "" {
		return "", errors.New("ข้อความว่าง")
	}
	t, tctx, err := s.BeginTurn(ctx, req.FrameID, "route", "AI: "+truncate(req.Text, 40))
	if err != nil {
		return "", err
	}
	s.AddMessage(ctx, "user", req.Text, t.ID)
	go r.run(tctx, s, t, func(ctx context.Context) (string, error) { return r.dispatch(ctx, s, t, req) })
	return t.ID, nil
}

// Fill starts a turn that fills every skeleton element of a frame (Wireframe mode, Components panel).
func (r *Runner) Fill(ctx context.Context, s *hub.Session, frameID string) (string, error) {
	p, _ := s.Doc()
	if _, err := p.SpecOf(frameID); err != nil {
		return "", err
	}
	t, tctx, err := s.BeginTurn(ctx, frameID, "fill", "AI: Fill")
	if err != nil {
		return "", err
	}
	go r.run(tctx, s, t, func(ctx context.Context) (string, error) {
		res, err := r.fill(ctx, s, t, frameID)
		if err != nil {
			return "", err
		}
		return res.Summary(), nil
	})
	return t.ID, nil
}

func (r *Runner) run(ctx context.Context, s *hub.Session, t *hub.Turn, work func(context.Context) (string, error)) {
	bg := context.WithoutCancel(ctx)
	status, reply := "done", ""
	func() {
		defer func() {
			if v := recover(); v != nil {
				slog.Error("turn panic", "panic", v)
				status, reply = "error", fmt.Sprintf("เกิดข้อผิดพลาดภายใน: %v", v)
			}
		}()
		var err error
		reply, err = work(ctx)
		switch {
		case errors.Is(context.Cause(ctx), hub.ErrStopped):
			status, reply = "stopped", "หยุดแล้ว และย้อนกลับไปสถานะก่อนเริ่มคำสั่งนี้"
		case err != nil:
			slog.Error("turn failed", "turn", t.ID, "err", err)
			status, reply = "error", "ทำไม่สำเร็จ: "+err.Error()
		}
	}()
	s.EndTurn(bg, t, status)
	if reply != "" {
		s.AddMessage(bg, "assistant", reply, t.ID)
	}
}

func (r *Runner) dispatch(ctx context.Context, s *hub.Session, t *hub.Turn, req ChatRequest) (string, error) {
	p, _ := s.Doc()
	frame := p.Frames[req.FrameID]
	hasContent := frame != nil && frame.Spec != nil

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
		return "", err
	}
	conf := -1.0
	if route.Confidence != nil {
		conf = *route.Confidence
	}
	slog.Info("route", "intent", route.Intent, "confidence", conf, "ms", route.MS, "composer", route.Composer)

	intent := route.Intent
	if intent == "edit_selection" && !hasContent {
		intent = "new_page" // nothing to edit yet
	}
	switch intent {
	case "new_page":
		return r.newPage(ctx, s, t, req, frame)
	case "set_theme", "edit_selection":
		return r.edit(ctx, s, t, req, intent)
	default:
		return "", fmt.Errorf("unknown intent %q", route.Intent)
	}
}

func (r *Runner) newPage(ctx context.Context, s *hub.Session, t *hub.Turn, req ChatRequest, selected *doc.Frame) (string, error) {
	frameID := ""
	err := s.Mutate(ctx, hub.MutateOpts{}, func(p *doc.Project) error {
		if selected != nil && selected.Spec == nil {
			frameID = selected.ID
		} else {
			device := "desktop"
			if selected != nil {
				device = selected.Device
			}
			id, err := doc.CreateFrame(p, truncate(req.Text, 28), device)
			if err != nil {
				return err
			}
			frameID = id
		}
		p.Frames[frameID].Brief = req.Text
		return nil
	})
	if err != nil {
		return "", err
	}
	s.UpdateTurn(t, frameID, "structure")

	var final *doc.Spec
	var stop string
	var ms, evals int
	for ev, err := range r.Composer.Structure(ctx, req.Text) {
		if err != nil {
			return "", err
		}
		if ev.Spec == nil {
			stop = ev.StopReason
			continue
		}
		if err := doc.ValidateSpec(r.Cat, ev.Spec); err != nil {
			return "", fmt.Errorf("composer returned an invalid spec: %w", err)
		}
		if err := s.Mutate(ctx, hub.MutateOpts{}, func(p *doc.Project) error {
			p.Frames[frameID].Spec = ev.Spec
			return nil
		}); err != nil {
			return "", err
		}
		final = ev.Spec
		if ev.Type == "complete" {
			stop, ms, evals = ev.StopReason, ev.MS, ev.Evaluations
		}
	}
	if final == nil {
		return "", fmt.Errorf("วางโครงไม่ได้ (composer stopReason=%s)", stop)
	}
	blocks := len(final.Elements[final.Root].Children)
	head := fmt.Sprintf("วางโครง %d blocks, %d elements ด้วย %s ใน %.1f วินาที (%d evaluations, %s)",
		blocks, len(final.Elements), r.Composer.Mode, float64(ms)/1000, evals, stop)
	if req.Wireframe {
		return head + "\nWireframe mode: กด Fill เมื่อพร้อมให้ AI เติมเนื้อหา", nil
	}
	res, err := r.fill(ctx, s, t, frameID)
	if err != nil {
		return "", err
	}
	return head + "\n" + res.Summary(), nil
}

func truncate(s string, n int) string {
	s = strings.Join(strings.Fields(s), " ")
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	return string([]rune(s)[:n]) + "…"
}
