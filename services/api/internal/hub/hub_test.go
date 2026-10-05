package hub

import (
	"context"
	"encoding/json/v2"
	"path/filepath"
	"testing"
	"time"

	"github.com/Bass-Peerapon/ui-factory/services/api/internal/catalog"
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/doc"
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/store"
)

func newSession(t *testing.T) (*Session, *catalog.Catalog) {
	t.Helper()
	st, err := store.Open(filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	cat, err := catalog.Load()
	if err != nil {
		t.Fatal(err)
	}
	h := New(st, cat)
	p, err := h.CreateProject(t.Context(), "t", nil)
	if err != nil {
		t.Fatal(err)
	}
	s, err := h.Session(t.Context(), p.ID)
	if err != nil {
		t.Fatal(err)
	}
	return s, cat
}

func TestMutateBroadcastsPatchAndUndo(t *testing.T) {
	s, cat := newSession(t)
	ch, unsubscribe := s.Subscribe()
	defer unsubscribe()
	if ev := <-ch; ev.Name != "doc" {
		t.Fatalf("first event should be doc, got %s", ev.Name)
	}
	err := s.Mutate(t.Context(), MutateOpts{Snapshot: true, Label: "theme"}, func(p *doc.Project) error {
		return doc.SetTheme(cat, p, "friendly", nil)
	})
	if err != nil {
		t.Fatal(err)
	}
	ev := <-ch
	if ev.Name != "patch" {
		t.Fatalf("expected patch, got %s", ev.Name)
	}
	b, _ := json.Marshal(ev.Data)
	t.Logf("patch: %s", b)
	if p, v := s.Doc(); p.Theme["primary"] != "#ea580c" || v != 2 {
		t.Fatalf("theme not applied: %v v=%d", p.Theme["primary"], v)
	}
	label, err := s.Undo(t.Context())
	if err != nil || label != "theme" {
		t.Fatalf("undo: %q %v", label, err)
	}
	if p, _ := s.Doc(); p.Theme["primary"] != "#111111" {
		t.Fatal("undo did not restore the theme")
	}
	if _, err := s.Undo(t.Context()); err == nil {
		t.Fatal("undo stack should be empty")
	}
}

func TestStopRollsBack(t *testing.T) {
	s, cat := newSession(t)
	turn, ctx, err := s.BeginTurn(t.Context(), "", "edit", "AI")
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := s.BeginTurn(t.Context(), "", "edit", "AI"); err != ErrBusy {
		t.Fatalf("second turn should be busy, got %v", err)
	}
	go func() {
		_ = s.Mutate(ctx, MutateOpts{}, func(p *doc.Project) error { return doc.SetTheme(cat, p, "luxury", nil) })
		<-ctx.Done()
		s.EndTurn(context.WithoutCancel(ctx), turn, "stopped")
	}()
	deadline := time.Now().Add(5 * time.Second)
	for {
		if p, _ := s.Doc(); p.Theme["primary"] == "#c6a15b" {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("turn mutation never applied")
		}
		time.Sleep(5 * time.Millisecond)
	}
	if err := s.StopTurn(t.Context()); err != nil {
		t.Fatal(err)
	}
	if p, _ := s.Doc(); p.Theme["primary"] != "#111111" {
		t.Fatal("stop should roll back the turn")
	}
	if s.Turn() != nil {
		t.Fatal("turn should be cleared")
	}
	if _, err := s.Undo(t.Context()); err == nil {
		t.Fatal("rolled-back turn should leave no undo entry")
	}
}
