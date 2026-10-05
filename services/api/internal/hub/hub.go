// Package hub keeps the live state of each open project: the document, its version,
// SSE subscribers and the running agent turn. Every mutation is diffed into an RFC 6902 patch.
package hub

import (
	"context"
	"encoding/json/v2"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"
	"uuid"

	"github.com/wI2L/jsondiff"

	"github.com/Bass-Peerapon/ui-factory/services/api/internal/catalog"
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/doc"
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/store"
)

type Event struct {
	Name string
	Data any
}

type Hub struct {
	store *store.Store
	cat   *catalog.Catalog

	mu       sync.Mutex
	sessions map[string]*Session
}

func New(st *store.Store, cat *catalog.Catalog) *Hub {
	return &Hub{store: st, cat: cat, sessions: map[string]*Session{}}
}

func (h *Hub) Store() *store.Store       { return h.store }
func (h *Hub) Catalog() *catalog.Catalog { return h.cat }

// Session returns the live session of a project, loading it from SQLite on first use.
func (h *Hub) Session(ctx context.Context, id string) (*Session, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if s, ok := h.sessions[id]; ok {
		return s, nil
	}
	p, v, err := h.store.LoadProject(ctx, id)
	if err != nil {
		return nil, err
	}
	s := &Session{ID: id, hub: h, doc: p, version: v, subs: map[chan Event]struct{}{}}
	h.sessions[id] = s
	return s, nil
}

// CreateProject stores a new project with one frame.
func (h *Hub) CreateProject(ctx context.Context, name string, seed *doc.Spec) (*doc.Project, error) {
	p := &doc.Project{
		ID:     uuid.NewV7().String(),
		Name:   name,
		Locale: "th",
		Theme:  h.cat.ThemePresets["neutral"],
		Frames: map[string]*doc.Frame{},
	}
	fid, err := doc.CreateFrame(p, "Home", "desktop")
	if err != nil {
		return nil, err
	}
	p.Frames[fid].Spec = seed
	if seed != nil {
		if title, ok := seed.Elements[seed.Root].Props["title"].(string); ok {
			p.Frames[fid].Brief = "landing page: " + title
		}
	}
	if err := h.store.SaveProject(ctx, p, 1); err != nil {
		return nil, err
	}
	return p, nil
}

type TurnState struct {
	ID      string `json:"id"`
	FrameID string `json:"frameId"`
	Status  string `json:"status"`
	Phase   string `json:"phase"`
	// Steps is the visible plan (Step N/M in the editor).
	Steps []Step `json:"steps"`
}

type Step struct {
	Label  string `json:"label"`
	Status string `json:"status"` // pending | active | done | skipped
	Detail string `json:"detail,omitempty"`
}

type Turn struct {
	TurnState
	cancel context.CancelCauseFunc
	done   chan struct{}
	pre    *doc.Project
}

type Session struct {
	ID  string
	hub *Hub

	mu      sync.Mutex
	doc     *doc.Project
	version int
	subs    map[chan Event]struct{}
	turn    *Turn
}

// Doc returns a deep copy of the document and its version.
func (s *Session) Doc() (*doc.Project, int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.doc.Clone(), s.version
}

func (s *Session) Subscribe() (<-chan Event, func()) {
	ch := make(chan Event, 512)
	s.mu.Lock()
	s.subs[ch] = struct{}{}
	snapshot := Event{"doc", map[string]any{"version": s.version, "doc": s.doc}}
	ch <- snapshot
	if s.turn != nil {
		ch <- Event{"turn", s.turn.TurnState}
	}
	s.mu.Unlock()
	return ch, func() {
		s.mu.Lock()
		delete(s.subs, ch)
		s.mu.Unlock()
	}
}

func (s *Session) broadcastLocked(e Event) {
	for ch := range s.subs {
		select {
		case ch <- e:
		default:
			// Slow client: drop it; EventSource reconnects and receives a fresh doc.
			delete(s.subs, ch)
			close(ch)
		}
	}
}

func (s *Session) Broadcast(name string, data any) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.broadcastLocked(Event{name, data})
}

// ErrNoChange is returned by a mutation function to skip the update.
var ErrNoChange = errors.New("no change")

type MutateOpts struct {
	// Snapshot pushes the pre-change document onto the undo stack.
	Snapshot bool
	Label    string
}

// Mutate applies fn to a copy of the document, persists it and broadcasts the diff.
func (s *Session) Mutate(ctx context.Context, opts MutateOpts, fn func(p *doc.Project) error) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	next := s.doc.Clone()
	if err := fn(next); err != nil {
		if errors.Is(err, ErrNoChange) {
			return nil
		}
		return err
	}
	return s.commitLocked(ctx, next, opts)
}

func (s *Session) commitLocked(ctx context.Context, next *doc.Project, opts MutateOpts) error {
	before, err := json.Marshal(s.doc)
	if err != nil {
		return err
	}
	after, err := json.Marshal(next)
	if err != nil {
		return err
	}
	patch, err := jsondiff.CompareJSON(before, after)
	if err != nil {
		return fmt.Errorf("diff: %w", err)
	}
	if len(patch) == 0 {
		return nil
	}
	if opts.Snapshot {
		if err := s.hub.store.PushSnapshot(ctx, s.ID, opts.Label, s.doc); err != nil {
			return err
		}
	}
	if err := s.hub.store.SaveProject(ctx, next, s.version+1); err != nil {
		return err
	}
	s.doc = next
	s.version++
	s.broadcastLocked(Event{"patch", map[string]any{"version": s.version, "ops": patch}})
	return nil
}

// Undo restores the latest snapshot.
func (s *Session) Undo(ctx context.Context) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.turn != nil {
		return "", errors.New("AI กำลังทำงานอยู่ กด Stop ก่อน")
	}
	prev, label, err := s.hub.store.PopSnapshot(ctx, s.ID)
	if err != nil {
		return "", err
	}
	return label, s.commitLocked(ctx, prev, MutateOpts{})
}

func (s *Session) AddMessage(ctx context.Context, role, text, turnID string) store.Message {
	return s.AddMessageMeta(ctx, role, text, turnID, nil)
}

func (s *Session) AddMessageMeta(ctx context.Context, role, text, turnID string, meta map[string]any) store.Message {
	m := store.Message{ID: uuid.NewV7().String(), Role: role, Text: text, TurnID: turnID, Meta: meta, CreatedAt: time.Now().UTC()}
	if err := s.hub.store.AddMessage(ctx, s.ID, m); err != nil {
		slog.Error("save message", "err", err)
	}
	s.Broadcast("message", m)
	return m
}

// --- turns -------------------------------------------------------------------

var ErrBusy = errors.New("AI กำลังทำงานกับโปรเจกต์นี้อยู่ รอให้เสร็จหรือกด Stop")

// BeginTurn locks the project for one agent turn and snapshots the document for undo and rollback.
func (s *Session) BeginTurn(ctx context.Context, frameID, phase, label string) (*Turn, context.Context, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.turn != nil {
		return nil, nil, ErrBusy
	}
	if err := s.hub.store.PushSnapshot(ctx, s.ID, label, s.doc); err != nil {
		return nil, nil, err
	}
	tctx, cancel := context.WithCancelCause(context.WithoutCancel(ctx))
	t := &Turn{
		TurnState: TurnState{ID: uuid.NewV7().String(), FrameID: frameID, Status: "running", Phase: phase},
		cancel:    cancel,
		done:      make(chan struct{}),
		pre:       s.doc.Clone(),
	}
	s.turn = t
	s.broadcastLocked(Event{"turn", t.TurnState})
	return t, tctx, nil
}

// UpdateTurn changes the locked frame or the phase shown in the UI.
func (s *Session) UpdateTurn(t *Turn, frameID, phase string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.turn != t {
		return
	}
	if frameID != "" {
		t.FrameID = frameID
	}
	if phase != "" {
		t.Phase = phase
	}
	s.broadcastLocked(Event{"turn", t.TurnState})
}

// Plan replaces the turn's visible steps; the first one becomes active.
func (s *Session) Plan(t *Turn, labels ...string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.turn != t {
		return
	}
	t.Steps = make([]Step, len(labels))
	for i, l := range labels {
		t.Steps[i] = Step{Label: l, Status: "pending"}
	}
	if len(t.Steps) > 0 {
		t.Steps[0].Status = "active"
	}
	s.broadcastLocked(Event{"turn", t.TurnState})
}

// Step marks step i active (earlier steps done) and sets its detail text.
func (s *Session) Step(t *Turn, i int, detail string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.turn != t || i < 0 || i >= len(t.Steps) {
		return
	}
	for j := range t.Steps {
		switch {
		case j < i && t.Steps[j].Status != "skipped":
			t.Steps[j].Status = "done"
		case j == i:
			t.Steps[j].Status = "active"
			t.Steps[j].Detail = detail
		}
	}
	s.broadcastLocked(Event{"turn", t.TurnState})
}

// EndTurn releases the lock. A turn without changes drops its undo snapshot.
func (s *Session) EndTurn(ctx context.Context, t *Turn, status string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.turn != t {
		return
	}
	s.turn = nil
	t.Status = status
	if status == "done" {
		for i := range t.Steps {
			if t.Steps[i].Status != "skipped" {
				t.Steps[i].Status = "done"
			}
		}
	}
	t.cancel(nil)
	close(t.done)
	if sameDoc(t.pre, s.doc) {
		if _, _, err := s.hub.store.PopSnapshot(ctx, s.ID); err != nil {
			slog.Warn("drop empty snapshot", "err", err)
		}
	}
	s.broadcastLocked(Event{"turn", t.TurnState})
}

var ErrStopped = errors.New("stopped by user")

// StopTurn cancels the running turn, waits for it to finish and rolls back to the pre-turn document.
func (s *Session) StopTurn(ctx context.Context) error {
	s.mu.Lock()
	t := s.turn
	s.mu.Unlock()
	if t == nil {
		return nil
	}
	t.cancel(ErrStopped)
	select {
	case <-t.done:
	case <-time.After(15 * time.Second):
		return errors.New("turn did not stop in time")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if sameDoc(t.pre, s.doc) {
		return nil // EndTurn already dropped the unused snapshot
	}
	if err := s.commitLocked(ctx, t.pre, MutateOpts{}); err != nil {
		return err
	}
	// The pre-turn snapshot now equals the current doc; drop it so undo goes further back.
	_, _, _ = s.hub.store.PopSnapshot(ctx, s.ID)
	return nil
}

func (s *Session) Turn() *TurnState {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.turn == nil {
		return nil
	}
	ts := s.turn.TurnState
	return &ts
}

// FrameLocked reports whether the running turn owns the frame.
func (s *Session) FrameLocked(frameID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.turn != nil && (s.turn.FrameID == "" || s.turn.FrameID == frameID)
}

// History returns the last n chat messages in order.
func (s *Session) History(ctx context.Context, n int) ([]store.Message, error) {
	return s.hub.store.Messages(ctx, s.ID, n)
}

func (s *Session) Versions(ctx context.Context) ([]store.Snapshot, error) {
	return s.hub.store.Snapshots(ctx, s.ID)
}

// Restore makes a snapshot the current document. The current state is snapshotted first, so a
// restore is itself undoable and the history keeps every version.
func (s *Session) Restore(ctx context.Context, id int64) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.turn != nil {
		return ErrBusy
	}
	p, err := s.hub.store.Snapshot(ctx, s.ID, id)
	if err != nil {
		return err
	}
	return s.commitLocked(ctx, p, MutateOpts{Snapshot: true, Label: fmt.Sprintf("restore #%d", id)})
}

// sameDoc compares documents; json/v2 map order is random unless Deterministic is set.
func sameDoc(a, b *doc.Project) bool {
	x, err1 := json.Marshal(a, json.Deterministic(true))
	y, err2 := json.Marshal(b, json.Deterministic(true))
	return err1 == nil && err2 == nil && string(x) == string(y)
}
