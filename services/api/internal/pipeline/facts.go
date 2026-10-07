package pipeline

import (
	"context"
	"encoding/json/v2"
	"fmt"
	"log/slog"

	"github.com/Bass-Peerapon/ui-factory/services/api/internal/doc"
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/hub"
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/llm"
)

// factsSystem asks for one coherent, specific business before any copy is written. Blocks are filled
// in parallel, so without a shared sheet each one invents its own brand name, people and prices.
const factsSystem = `You define the facts of one specific, believable business for a prototype website, before any copy is written.

- Write in %s. Names of people and places fit the locale.
- Be concrete: a real-sounding brand name (not generic like "Premium Dental" or "Best Coffee"), a precise neighbourhood, opening hours, a phone number and email in local format.
- people: the actual staff a customer would meet, with their role.
- offerings: what the business really sells, each with a short concrete detail and a plausible local price.
- proof: modest, checkable facts (year opened, number of seats, a certification, a supplier), never superlatives or rankings.
- signature: the one thing only this business can claim, in one plain sentence.`

var factsSchema = map[string]any{
	"type": "object",
	"properties": map[string]any{
		"brand":     map[string]any{"type": "string"},
		"place":     map[string]any{"type": "string"},
		"address":   map[string]any{"type": "string"},
		"phone":     map[string]any{"type": "string"},
		"email":     map[string]any{"type": "string"},
		"hours":     map[string]any{"type": "string"},
		"signature": map[string]any{"type": "string"},
		"people": map[string]any{"type": "array", "minItems": 2, "maxItems": 4, "items": map[string]any{
			"type": "object", "properties": map[string]any{"name": map[string]any{"type": "string"}, "role": map[string]any{"type": "string"}},
			"required": []string{"name", "role"},
		}},
		"offerings": map[string]any{"type": "array", "minItems": 3, "maxItems": 8, "items": map[string]any{
			"type": "object", "properties": map[string]any{
				"name": map[string]any{"type": "string"}, "detail": map[string]any{"type": "string"}, "price": map[string]any{"type": "string"},
			},
			"required": []string{"name", "detail", "price"},
		}},
		"proof": map[string]any{"type": "array", "minItems": 2, "maxItems": 4, "items": map[string]any{"type": "string"}},
	},
	"required": []string{"brand", "place", "address", "phone", "email", "hours", "signature", "people", "offerings", "proof"},
}

// ensureFacts gives every listed frame without facts one shared fact sheet. Failure is not fatal:
// fill still works from the brief alone.
func (r *Runner) ensureFacts(ctx context.Context, s *hub.Session, frameIDs []string) {
	p, _ := s.Doc()
	var missing []string
	brief := ""
	for _, id := range frameIDs {
		if f := p.Frames[id]; f != nil && f.Facts == "" {
			missing = append(missing, id)
			if brief == "" {
				brief = f.Brief
			}
		}
	}
	if len(missing) == 0 || brief == "" {
		return
	}
	out, err := r.Model.GenerateJSON(ctx, llm.JSONRequest{
		System: fmt.Sprintf(factsSystem, localeName[p.Locale]),
		Prompt: brief,
		Schema: factsSchema,
		Fast:   true,
	})
	if err != nil {
		slog.Warn("facts failed, filling from the brief only", "err", err)
		return
	}
	var check map[string]any
	if err := json.Unmarshal([]byte(out), &check); err != nil {
		slog.Warn("facts were not JSON", "err", err)
		return
	}
	compact, _ := json.Marshal(check)
	_ = s.Mutate(ctx, hub.MutateOpts{}, func(p *doc.Project) error {
		for _, id := range missing {
			if f := p.Frames[id]; f != nil {
				f.Facts = string(compact)
			}
		}
		return nil
	})
}
