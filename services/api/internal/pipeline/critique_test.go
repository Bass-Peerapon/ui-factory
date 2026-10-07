package pipeline

import (
	"slices"
	"testing"

	"github.com/Bass-Peerapon/ui-factory/services/api/internal/doc"
)

func page(blocks ...*doc.Element) *doc.Spec {
	sp := &doc.Spec{Root: "page", Elements: map[string]*doc.Element{"page": {Type: "Page", Props: map[string]any{}}}}
	for i, b := range blocks {
		id := b.Type + string(rune('a'+i))
		if b.Props == nil {
			b.Props = map[string]any{}
		}
		sp.Elements[id] = b
		sp.Elements["page"].Children = append(sp.Elements["page"].Children, id)
	}
	return sp
}

func rules(fs []critiqueFinding) []string {
	out := make([]string, len(fs))
	for i, f := range fs {
		out[i] = f.Rule
	}
	return out
}

func TestCritique(t *testing.T) {
	bad := page(
		&doc.Element{Type: "Navbar"},
		&doc.Element{Type: "Hero", Props: map[string]any{"variant": "centered", "eyebrow": "ใหม่"}},
		&doc.Element{Type: "Stats"},
		&doc.Element{Type: "FeatureGrid", Props: map[string]any{"variant": "cards"}},
		&doc.Element{Type: "Testimonials", Props: map[string]any{"variant": "cards"}},
		&doc.Element{Type: "FAQ"},
		&doc.Element{Type: "FAQ"},
	)
	got := rules(critique(bad, "ร้านกาแฟ\n(page type: landing, page mode: persuade)"))
	for _, want := range []string{
		"skill-persuade-conversion-in-form", "skill-ban-identical-card-grids", "skill-ban-hero-metric",
		"skill-layout-spacing-rhythm", "skill-ban-eyebrow-on-every-section",
	} {
		if !slices.Contains(got, want) {
			t.Errorf("missing %s in %v", want, got)
		}
	}

	good := page(
		&doc.Element{Type: "Navbar"},
		&doc.Element{Type: "Hero", Props: map[string]any{"variant": "split"}, Slots: map[string][]string{"actions": {"btn"}}},
		&doc.Element{Type: "FeatureGrid", Props: map[string]any{"variant": "list"}},
		&doc.Element{Type: "Footer"},
	)
	good.Elements["btn"] = &doc.Element{Type: "Button", Props: map[string]any{}}
	if fs := critique(good, "(page mode: persuade)"); len(fs) != 0 {
		t.Errorf("clean page got findings %v", rules(fs))
	}

	app := page(&doc.Element{Type: "Navbar"}, &doc.Element{Type: "KPIGrid"}, &doc.Element{Type: "CTA"})
	if got := rules(critique(app, "")); !slices.Contains(got, "skill-mode-operate") {
		t.Errorf("operate page with CTA: got %v", got)
	}
}
