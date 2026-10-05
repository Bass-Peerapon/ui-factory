// Package httpapi exposes the REST + SSE API used by the editor.
package httpapi

import (
	"context"
	"encoding/json/v2"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/Bass-Peerapon/ui-factory/services/api/internal/doc"
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/hub"
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/pipeline"
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/store"
)

type Server struct {
	Hub         *hub.Hub
	Runner      *pipeline.Runner
	FixturesDir string
	ComposerURL string
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.health)
	mux.HandleFunc("GET /api/projects", s.listProjects)
	mux.HandleFunc("POST /api/projects", s.createProject)
	mux.HandleFunc("GET /api/projects/{id}", s.getProject)
	mux.HandleFunc("GET /api/projects/{id}/events", s.events)
	mux.HandleFunc("GET /api/projects/{id}/export", s.export)
	mux.HandleFunc("POST /api/projects/{id}/chat", s.chat)
	mux.HandleFunc("POST /api/projects/{id}/fill", s.fill)
	mux.HandleFunc("POST /api/projects/{id}/stop", s.stop)
	mux.HandleFunc("POST /api/projects/{id}/undo", s.undo)
	mux.HandleFunc("POST /api/projects/{id}/ops", s.op)
	mux.HandleFunc("GET /api/projects/{id}/versions", s.versions)
	mux.HandleFunc("POST /api/projects/{id}/versions/{vid}/restore", s.restore)
	return cors(mux)
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.MarshalWrite(w, v); err != nil {
		slog.Error("write json", "err", err)
	}
}

func writeErr(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

func decode(r *http.Request, v any) error {
	if err := json.UnmarshalRead(r.Body, v); err != nil {
		return fmt.Errorf("invalid JSON body: %w", err)
	}
	return nil
}

func (s *Server) session(w http.ResponseWriter, r *http.Request) *hub.Session {
	sess, err := s.Hub.Session(r.Context(), r.PathValue("id"))
	if errors.Is(err, store.ErrNotFound) {
		writeErr(w, http.StatusNotFound, errors.New("project not found"))
		return nil
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return nil
	}
	return sess
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	composer := "down"
	if req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.ComposerURL+"/health", nil); err == nil {
		if res, err := http.DefaultClient.Do(req); err == nil {
			res.Body.Close()
			composer = "up"
		}
	}
	writeJSON(w, http.StatusOK, map[string]string{"api": "up", "composer": composer, "composerMode": s.Runner.Composer.Mode})
}

func (s *Server) listProjects(w http.ResponseWriter, r *http.Request) {
	list, err := s.Hub.Store().ListProjects(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

// createProject makes a project; the very first one is seeded with the hand-written fixture.
func (s *Server) createProject(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
		Seed string `json:"seed"`
	}
	if err := decode(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	list, err := s.Hub.Store().ListProjects(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if body.Seed == "" && len(list) == 0 {
		body.Seed = "coffee-landing"
	}
	var seed *doc.Spec
	if body.Seed != "" {
		b, err := os.ReadFile(filepath.Join(s.FixturesDir, filepath.Base(body.Seed)+".json"))
		if err != nil {
			writeErr(w, http.StatusBadRequest, fmt.Errorf("seed %q: %w", body.Seed, err))
			return
		}
		seed = new(doc.Spec)
		if err := json.Unmarshal(b, seed); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		if err := doc.ValidateSpec(s.Hub.Catalog(), seed); err != nil {
			writeErr(w, http.StatusUnprocessableEntity, err)
			return
		}
	}
	if body.Name == "" {
		body.Name = "Untitled"
	}
	p, err := s.Hub.CreateProject(r.Context(), body.Name, seed)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"doc": p})
}

func (s *Server) getProject(w http.ResponseWriter, r *http.Request) {
	sess := s.session(w, r)
	if sess == nil {
		return
	}
	p, v := sess.Doc()
	msgs, err := sess.History(r.Context(), 200)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"doc": p, "version": v, "messages": msgs, "turn": sess.Turn()})
}

func (s *Server) export(w http.ResponseWriter, r *http.Request) {
	sess := s.session(w, r)
	if sess == nil {
		return
	}
	p, _ := sess.Doc()
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s.json"`, p.ID))
	writeJSON(w, http.StatusOK, map[string]any{"format": "ui-factory/v1", "exportedAt": time.Now().UTC(), "project": p})
}

// events streams doc, patch, message and turn events over SSE.
func (s *Server) events(w http.ResponseWriter, r *http.Request) {
	sess := s.session(w, r)
	if sess == nil {
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeErr(w, http.StatusInternalServerError, errors.New("streaming unsupported"))
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	ch, unsubscribe := sess.Subscribe()
	defer unsubscribe()
	ping := time.Tick(20 * time.Second)
	for {
		select {
		case <-r.Context().Done():
			return
		case <-ping:
			fmt.Fprint(w, ": ping\n\n")
			flusher.Flush()
		case ev, ok := <-ch:
			if !ok {
				return
			}
			data, err := json.Marshal(ev.Data)
			if err != nil {
				slog.Error("marshal event", "err", err)
				continue
			}
			fmt.Fprintf(w, "event: %s\ndata: %s\n\n", ev.Name, data)
			flusher.Flush()
		}
	}
}

func (s *Server) chat(w http.ResponseWriter, r *http.Request) {
	sess := s.session(w, r)
	if sess == nil {
		return
	}
	var req pipeline.ChatRequest
	if err := decode(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	id, err := s.Runner.Chat(r.Context(), sess, req)
	if errors.Is(err, hub.ErrBusy) {
		writeErr(w, http.StatusConflict, err)
		return
	}
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]string{"turnId": id})
}

func (s *Server) fill(w http.ResponseWriter, r *http.Request) {
	sess := s.session(w, r)
	if sess == nil {
		return
	}
	var body struct {
		FrameID string `json:"frameId"`
	}
	if err := decode(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	id, err := s.Runner.Fill(r.Context(), sess, body.FrameID)
	if errors.Is(err, hub.ErrBusy) {
		writeErr(w, http.StatusConflict, err)
		return
	}
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]string{"turnId": id})
}

func (s *Server) stop(w http.ResponseWriter, r *http.Request) {
	sess := s.session(w, r)
	if sess == nil {
		return
	}
	if err := sess.StopTurn(r.Context()); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) undo(w http.ResponseWriter, r *http.Request) {
	sess := s.session(w, r)
	if sess == nil {
		return
	}
	label, err := sess.Undo(r.Context())
	if errors.Is(err, store.ErrNotFound) {
		writeErr(w, http.StatusConflict, errors.New("ไม่มีประวัติให้ย้อนกลับ"))
		return
	}
	if err != nil {
		writeErr(w, http.StatusConflict, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"undone": label})
}

type opRequest struct {
	Op   string `json:"op"`
	Args struct {
		FrameID  string         `json:"frameId"`
		ID       string         `json:"id"`
		Type     string         `json:"type"`
		ParentID string         `json:"parentId"`
		Slot     *string        `json:"slot"`
		Index    *int           `json:"index"`
		AfterID  *string        `json:"afterId"`
		Props    map[string]any `json:"props"`
		Replace  bool           `json:"replace"`
		Skeleton bool           `json:"skeleton"`
		Preset   string         `json:"preset"`
		Tokens   map[string]any `json:"tokens"`
		Name     *string        `json:"name"`
		Device   *string        `json:"device"`
		X        *float64       `json:"x"`
		Y        *float64       `json:"y"`
		Locale   string         `json:"locale"`
		Target   *string        `json:"target"`
	} `json:"args"`
}

func deref(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

// op applies a manual editor operation. Everything except frame dragging is undoable.
func (s *Server) op(w http.ResponseWriter, r *http.Request) {
	sess := s.session(w, r)
	if sess == nil {
		return
	}
	var req opRequest
	if err := decode(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	a := req.Args
	cat := s.Hub.Catalog()
	projectLevel := a.FrameID == "" || req.Op == "set_theme" || req.Op == "set_locale" || req.Op == "create_frame" || req.Op == "duplicate_frame"
	if (projectLevel && sess.Turn() != nil) || (!projectLevel && sess.FrameLocked(a.FrameID)) {
		writeErr(w, http.StatusConflict, errors.New("เฟรมนี้ถูกล็อกระหว่างที่ AI ทำงาน"))
		return
	}
	positionOnly := req.Op == "update_frame" && a.Name == nil && a.Device == nil
	var result any
	err := sess.Mutate(r.Context(), hub.MutateOpts{Snapshot: !positionOnly, Label: req.Op}, func(p *doc.Project) error {
		switch req.Op {
		case "add_node":
			id, err := doc.AddNode(cat, p, doc.AddArgs{FrameID: a.FrameID, Type: a.Type, ParentID: a.ParentID,
				Slot: deref(a.Slot), Index: a.Index, AfterID: deref(a.AfterID), Props: a.Props, Skeleton: a.Skeleton})
			result = id
			return err
		case "update_props":
			return doc.UpdateProps(cat, p, a.FrameID, a.ID, a.Props, a.Replace)
		case "move_node":
			idx := 0
			if a.Index != nil {
				idx = *a.Index
			}
			return doc.MoveNode(cat, p, a.FrameID, a.ID, a.ParentID, deref(a.Slot), idx)
		case "remove_node":
			return doc.RemoveNode(p, a.FrameID, a.ID)
		case "set_theme":
			return doc.SetTheme(cat, p, a.Preset, a.Tokens)
		case "set_locale":
			return doc.SetLocale(p, a.Locale)
		case "create_frame":
			id, err := doc.CreateFrame(p, deref(a.Name), deref(a.Device))
			result = id
			return err
		case "update_frame":
			return doc.UpdateFrame(p, a.FrameID, doc.FrameUpdate{Name: a.Name, Device: a.Device, X: a.X, Y: a.Y})
		case "duplicate_frame":
			id, err := doc.DuplicateFrame(p, a.FrameID, deref(a.Device))
			result = id
			return err
		case "delete_frame":
			return doc.DeleteFrame(p, a.FrameID)
		case "set_navigation":
			return doc.SetNavigation(cat, p, a.FrameID, a.ID, deref(a.Target))
		default:
			return fmt.Errorf("unknown op %q", req.Op)
		}
	})
	if err != nil {
		writeErr(w, http.StatusUnprocessableEntity, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "result": result})
}

func (s *Server) versions(w http.ResponseWriter, r *http.Request) {
	sess := s.session(w, r)
	if sess == nil {
		return
	}
	list, err := sess.Versions(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) restore(w http.ResponseWriter, r *http.Request) {
	sess := s.session(w, r)
	if sess == nil {
		return
	}
	vid, err := strconv.ParseInt(r.PathValue("vid"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, errors.New("invalid version id"))
		return
	}
	switch err := sess.Restore(r.Context(), vid); {
	case errors.Is(err, store.ErrNotFound):
		writeErr(w, http.StatusNotFound, errors.New("version not found"))
	case errors.Is(err, hub.ErrBusy):
		writeErr(w, http.StatusConflict, err)
	case err != nil:
		writeErr(w, http.StatusInternalServerError, err)
	default:
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	}
}
