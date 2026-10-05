// Package store persists projects, undo snapshots and chat history in SQLite.
package store

import (
	"context"
	"database/sql"
	"encoding/json/v2"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"

	"github.com/Bass-Peerapon/ui-factory/services/api/internal/doc"
)

type Store struct{ db *sql.DB }

type ProjectSummary struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Message struct {
	ID     string `json:"id"`
	Role   string `json:"role"`
	Text   string `json:"text"`
	TurnID string `json:"turnId,omitempty"`
	// Meta carries structured extras: a brief form, next-step suggestions, comment targets.
	Meta      map[string]any `json:"meta,omitempty"`
	CreatedAt time.Time      `json:"createdAt"`
}

type Snapshot struct {
	ID        int64     `json:"id"`
	Label     string    `json:"label"`
	CreatedAt time.Time `json:"createdAt"`
}

var ErrNotFound = errors.New("not found")

const schema = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  doc TEXT NOT NULL,
  version INTEGER NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  label TEXT NOT NULL,
  doc TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS snapshots_project ON snapshots(project_id, id);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  role TEXT NOT NULL,
  text TEXT NOT NULL,
  turn_id TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_project ON messages(project_id, created_at);
`

// maxSnapshots bounds the undo history per project.
const maxSnapshots = 100

func Open(path string) (*Store, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", path+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)")
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(schema); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}
	// v2: message metadata. ALTER fails harmlessly when the column already exists.
	_, _ = db.Exec(`ALTER TABLE messages ADD COLUMN meta TEXT NOT NULL DEFAULT '{}'`)
	return &Store{db: db}, nil
}

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) ListProjects(ctx context.Context) ([]ProjectSummary, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, name, updated_at FROM projects ORDER BY updated_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []ProjectSummary{}
	for rows.Next() {
		var p ProjectSummary
		if err := rows.Scan(&p.ID, &p.Name, &p.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) SaveProject(ctx context.Context, p *doc.Project, version int) error {
	b, err := json.Marshal(p)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, `
INSERT INTO projects (id, name, doc, version, updated_at) VALUES (?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET name = excluded.name, doc = excluded.doc, version = excluded.version, updated_at = excluded.updated_at`,
		p.ID, p.Name, string(b), version, time.Now().UTC())
	return err
}

func (s *Store) LoadProject(ctx context.Context, id string) (*doc.Project, int, error) {
	var raw string
	var version int
	err := s.db.QueryRowContext(ctx, `SELECT doc, version FROM projects WHERE id = ?`, id).Scan(&raw, &version)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, 0, ErrNotFound
	}
	if err != nil {
		return nil, 0, err
	}
	var p doc.Project
	if err := json.Unmarshal([]byte(raw), &p); err != nil {
		return nil, 0, err
	}
	return &p, version, nil
}

// PushSnapshot records the document state before a change, for undo.
func (s *Store) PushSnapshot(ctx context.Context, projectID, label string, p *doc.Project) error {
	b, err := json.Marshal(p)
	if err != nil {
		return err
	}
	if _, err := s.db.ExecContext(ctx, `INSERT INTO snapshots (project_id, label, doc, created_at) VALUES (?, ?, ?, ?)`,
		projectID, label, string(b), time.Now().UTC()); err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, `DELETE FROM snapshots WHERE project_id = ? AND id NOT IN
  (SELECT id FROM snapshots WHERE project_id = ? ORDER BY id DESC LIMIT ?)`, projectID, projectID, maxSnapshots)
	return err
}

// PopSnapshot removes and returns the latest snapshot.
func (s *Store) PopSnapshot(ctx context.Context, projectID string) (*doc.Project, string, error) {
	var id int64
	var label, raw string
	err := s.db.QueryRowContext(ctx, `SELECT id, label, doc FROM snapshots WHERE project_id = ? ORDER BY id DESC LIMIT 1`, projectID).
		Scan(&id, &label, &raw)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, "", ErrNotFound
	}
	if err != nil {
		return nil, "", err
	}
	if _, err := s.db.ExecContext(ctx, `DELETE FROM snapshots WHERE id = ?`, id); err != nil {
		return nil, "", err
	}
	var p doc.Project
	if err := json.Unmarshal([]byte(raw), &p); err != nil {
		return nil, "", err
	}
	return &p, label, nil
}

func (s *Store) AddMessage(ctx context.Context, projectID string, m Message) error {
	meta, err := json.Marshal(m.Meta)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, `INSERT INTO messages (id, project_id, role, text, turn_id, meta, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		m.ID, projectID, m.Role, m.Text, m.TurnID, string(meta), m.CreatedAt)
	return err
}

// Messages returns the latest `limit` messages in chronological order.
func (s *Store) Messages(ctx context.Context, projectID string, limit int) ([]Message, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, role, text, turn_id, meta, created_at FROM
  (SELECT * FROM messages WHERE project_id = ? ORDER BY created_at DESC LIMIT ?) ORDER BY created_at`, projectID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Message{}
	for rows.Next() {
		var m Message
		var meta string
		if err := rows.Scan(&m.ID, &m.Role, &m.Text, &m.TurnID, &meta, &m.CreatedAt); err != nil {
			return nil, err
		}
		if meta != "" && meta != "{}" && meta != "null" {
			_ = json.Unmarshal([]byte(meta), &m.Meta)
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// Snapshots lists the undo history newest first.
func (s *Store) Snapshots(ctx context.Context, projectID string) ([]Snapshot, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, label, created_at FROM snapshots WHERE project_id = ? ORDER BY id DESC`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Snapshot{}
	for rows.Next() {
		var sn Snapshot
		if err := rows.Scan(&sn.ID, &sn.Label, &sn.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, sn)
	}
	return out, rows.Err()
}

// Snapshot loads one snapshot document without removing it.
func (s *Store) Snapshot(ctx context.Context, projectID string, id int64) (*doc.Project, error) {
	var raw string
	err := s.db.QueryRowContext(ctx, `SELECT doc FROM snapshots WHERE project_id = ? AND id = ?`, projectID, id).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	var p doc.Project
	return &p, json.Unmarshal([]byte(raw), &p)
}
