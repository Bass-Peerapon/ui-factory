// Package composer is the client for the Node composer sidecar (json-render + Jev, or the LLM baseline).
package composer

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json/v2"
	"fmt"
	"iter"
	"net/http"

	"github.com/Bass-Peerapon/ui-factory/services/api/internal/doc"
)

type Client struct {
	BaseURL string
	Mode    string
	HTTP    *http.Client
}

func New(baseURL, mode string) *Client {
	return &Client{BaseURL: baseURL, Mode: mode, HTTP: &http.Client{}}
}

type RouteInput struct {
	Prompt          string `json:"prompt"`
	Selection       string `json:"selection"`
	FrameHasContent bool   `json:"frameHasContent"`
	CurrentPage     string `json:"currentPage,omitempty"`
	Mode            string `json:"mode,omitempty"`
}

type RouteResult struct {
	Intent     string   `json:"intent"`
	Confidence *float64 `json:"confidence"`
	MS         int      `json:"ms"`
	Composer   string   `json:"composer"`
}

func (c *Client) post(ctx context.Context, path string, body any) (*http.Response, error) {
	b, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+path, bytes.NewReader(b))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := c.HTTP.Do(req)
	if err != nil {
		return nil, fmt.Errorf("composer unreachable at %s: %w", c.BaseURL, err)
	}
	if res.StatusCode != http.StatusOK {
		defer res.Body.Close()
		var e struct{ Error string }
		_ = json.UnmarshalRead(res.Body, &e)
		return nil, fmt.Errorf("composer %s: HTTP %d %s", path, res.StatusCode, e.Error)
	}
	return res, nil
}

func (c *Client) Route(ctx context.Context, in RouteInput) (RouteResult, error) {
	if in.Mode == "" {
		in.Mode = c.Mode
	}
	res, err := c.post(ctx, "/route", in)
	if err != nil {
		return RouteResult{}, err
	}
	defer res.Body.Close()
	var out RouteResult
	return out, json.UnmarshalRead(res.Body, &out)
}

type StructureEvent struct {
	Type        string    `json:"type"` // step | complete | error
	Spec        *doc.Spec `json:"spec"`
	StopReason  string    `json:"stopReason"`
	MS          int       `json:"ms"`
	Evaluations int       `json:"evaluations"`
	Valid       *bool     `json:"valid"`
	Error       string    `json:"error"`
}

// Structure streams skeleton spec snapshots for a new page.
func (c *Client) Structure(ctx context.Context, prompt string) iter.Seq2[StructureEvent, error] {
	return func(yield func(StructureEvent, error) bool) {
		res, err := c.post(ctx, "/structure", map[string]any{"prompt": prompt, "mode": c.Mode})
		if err != nil {
			yield(StructureEvent{}, err)
			return
		}
		defer res.Body.Close()
		sc := bufio.NewScanner(res.Body)
		sc.Buffer(make([]byte, 0, 1<<20), 8<<20)
		for sc.Scan() {
			var ev StructureEvent
			if err := json.Unmarshal(sc.Bytes(), &ev); err != nil {
				yield(StructureEvent{}, fmt.Errorf("decode composer event: %w", err))
				return
			}
			if ev.Type == "error" {
				yield(ev, fmt.Errorf("composer: %s", ev.Error))
				return
			}
			if !yield(ev, nil) {
				return
			}
		}
		if err := sc.Err(); err != nil {
			yield(StructureEvent{}, err)
		}
	}
}

type PlanPage struct {
	Key   string `json:"key"`
	Name  string `json:"name"`
	Brief string `json:"brief"`
}

type Plan struct {
	Pattern    string      `json:"pattern"`
	Device     string      `json:"device"`
	Pages      []PlanPage  `json:"pages"`
	Links      [][2]string `json:"links"`
	Confidence *float64    `json:"confidence"`
	MS         int         `json:"ms"`
}

type BriefChoice struct {
	Value      string   `json:"value"`
	Confidence *float64 `json:"confidence"`
}

type Brief struct {
	Sufficient float64                `json:"sufficient"`
	Answers    map[string]BriefChoice `json:"answers"`
	MS         int                    `json:"ms"`
}

func postJSON[T any](ctx context.Context, c *Client, path string, body any) (T, error) {
	var out T
	res, err := c.post(ctx, path, body)
	if err != nil {
		return out, err
	}
	defer res.Body.Close()
	return out, json.UnmarshalRead(res.Body, &out)
}

// Plan picks a flow pattern (or a custom set of screens) and a device for a multi-page request.
func (c *Client) Plan(ctx context.Context, prompt string) (Plan, error) {
	return postJSON[Plan](ctx, c, "/plan", map[string]any{"prompt": prompt, "mode": c.Mode})
}

// Brief infers recommended answers for the clarify form and how specific the request already is.
func (c *Client) Brief(ctx context.Context, prompt string) (Brief, error) {
	return postJSON[Brief](ctx, c, "/brief", map[string]any{"prompt": prompt, "mode": c.Mode})
}
