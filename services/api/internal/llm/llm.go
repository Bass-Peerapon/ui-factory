// Package llm hides the model choice behind small interfaces. Gemini is the only implementation.
//
// The free tier allows few requests per minute per model, so every call goes through a per-model
// limiter and falls back from the main model to the fast model on 429/503.
package llm

import (
	"context"
	"errors"
	"fmt"
	"iter"
	"log/slog"
	"strings"
	"time"

	"google.golang.org/adk/model"
	"google.golang.org/adk/model/gemini"
	"google.golang.org/genai"
)

// JSONRequest asks for one JSON object matching Schema.
type JSONRequest struct {
	System string
	Prompt string
	Schema map[string]any
	// Fast selects the cheaper model only.
	Fast bool
}

type Model interface {
	GenerateJSON(ctx context.Context, req JSONRequest) (string, error)
	// Agent returns the adk-go model used by the tool-calling edit agent.
	Agent() model.LLM
}

type tier struct {
	name string
	lim  *limiter
}

type Gemini struct {
	client *genai.Client
	adk    model.LLM
	main   tier
	fast   tier
}

type Options struct {
	APIKey, Model, FastModel string
	RPM, FastRPM             int
}

func NewGemini(ctx context.Context, o Options) (*Gemini, error) {
	if o.APIKey == "" {
		return nil, errors.New("GEMINI_API_KEY is not set")
	}
	cfg := &genai.ClientConfig{APIKey: o.APIKey, Backend: genai.BackendGeminiAPI}
	client, err := genai.NewClient(ctx, cfg)
	if err != nil {
		return nil, err
	}
	am, err := gemini.NewModel(ctx, o.Model, cfg)
	if err != nil {
		return nil, err
	}
	return &Gemini{
		client: client,
		adk:    am,
		main:   tier{o.Model, newLimiter(o.RPM)},
		fast:   tier{o.FastModel, newLimiter(o.FastRPM)},
	}, nil
}

// pick returns the first tier with a free slot, or waits for the last one.
func (g *Gemini) pick(ctx context.Context, fastOnly bool) (tier, error) {
	order := []tier{g.main, g.fast}
	if fastOnly {
		order = order[1:]
	}
	for _, t := range order {
		if ok, _ := t.lim.reserve(); ok {
			return t, nil
		}
	}
	last := order[len(order)-1]
	return last, last.lim.wait(ctx)
}

// backoff cools a tier down after an overload error so the next attempt uses the other tier.
func backoff(t tier, err error) {
	d := 5 * time.Second
	if apiErr, ok := errors.AsType[genai.APIError](err); ok && apiErr.Code == 429 {
		d = 30 * time.Second
	}
	t.lim.cooldown(d)
	slog.Warn("gemini overloaded, falling back", "model", t.name, "cooldown", d, "err", truncate(err.Error(), 120))
}

const maxAttempts = 6

func (g *Gemini) GenerateJSON(ctx context.Context, req JSONRequest) (string, error) {
	cfg := &genai.GenerateContentConfig{
		SystemInstruction:  genai.NewContentFromText(req.System, genai.RoleUser),
		ResponseMIMEType:   "application/json",
		ResponseJsonSchema: req.Schema,
		ThinkingConfig:     &genai.ThinkingConfig{ThinkingLevel: genai.ThinkingLevelLow},
	}
	var lastErr error
	for range maxAttempts {
		t, err := g.pick(ctx, req.Fast)
		if err != nil {
			return "", err
		}
		res, err := g.client.Models.GenerateContent(ctx, t.name, genai.Text(req.Prompt), cfg)
		if err == nil {
			return res.Text(), nil
		}
		lastErr = fmt.Errorf("gemini %s: %w", t.name, err)
		if ctx.Err() != nil || !overloaded(err) {
			return "", lastErr
		}
		backoff(t, err)
	}
	return "", lastErr
}

func (g *Gemini) Agent() model.LLM { return &agentModel{g} }

// agentModel wraps the adk Gemini model with the same limiter and fallback.
type agentModel struct{ g *Gemini }

func (a *agentModel) Name() string { return a.g.main.name }

func (a *agentModel) GenerateContent(ctx context.Context, req *model.LLMRequest, stream bool) iter.Seq2[*model.LLMResponse, error] {
	return func(yield func(*model.LLMResponse, error) bool) {
		var lastErr error
		for range maxAttempts {
			t, err := a.g.pick(ctx, false)
			if err != nil {
				yield(nil, err)
				return
			}
			r := *req
			r.Model = t.name
			retry := false
			yielded := false
			for resp, err := range a.g.adk.GenerateContent(ctx, &r, stream) {
				if err != nil && !yielded && overloaded(err) && ctx.Err() == nil {
					backoff(t, err)
					lastErr, retry = err, true
					break
				}
				yielded = true
				if !yield(resp, err) {
					return
				}
			}
			if !retry {
				return
			}
		}
		yield(nil, lastErr)
	}
}

func overloaded(err error) bool {
	if apiErr, ok := errors.AsType[genai.APIError](err); ok {
		return apiErr.Code == 429 || apiErr.Code >= 500
	}
	s := err.Error()
	return strings.Contains(s, "429") || strings.Contains(s, "503") || strings.Contains(s, "RESOURCE_EXHAUSTED")
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
