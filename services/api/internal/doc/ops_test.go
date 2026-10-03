package doc

import (
	"encoding/json/v2"
	"os"
	"testing"

	"github.com/Bass-Peerapon/ui-factory/services/api/internal/catalog"
)

func fixture(t *testing.T) (*catalog.Catalog, *Project) {
	t.Helper()
	c, err := catalog.Load()
	if err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile("../../../../packages/catalog/fixtures/coffee-landing.json")
	if err != nil {
		t.Fatal(err)
	}
	var s Spec
	if err := json.Unmarshal(b, &s); err != nil {
		t.Fatal(err)
	}
	p := &Project{ID: "p", Locale: "th", Theme: c.ThemePresets["neutral"], Frames: map[string]*Frame{
		"f": {ID: "f", Name: "Home", Device: "desktop", Spec: &s},
	}, FrameOrder: []string{"f"}}
	if err := ValidateSpec(c, &s); err != nil {
		t.Fatal(err)
	}
	return c, p
}

func TestOps(t *testing.T) {
	c, p := fixture(t)
	s := p.Frames["f"].Spec

	id, err := AddNode(c, p, AddArgs{FrameID: "f", Type: "Stats", AfterID: "hero-buy", Skeleton: true})
	if err != nil {
		t.Fatal(err)
	}
	if got := s.Elements["page"].Children[2]; got != id {
		t.Fatalf("Stats should follow hero, children=%v", s.Elements["page"].Children)
	}
	btn, err := AddNode(c, p, AddArgs{FrameID: "f", Type: "Button", AfterID: "cta", Skeleton: true})
	if err != nil {
		t.Fatal(err)
	}
	if l := s.Elements["cta"].Slots["actions"]; l[len(l)-1] != btn {
		t.Fatalf("button should be appended to cta actions: %v", l)
	}
	if _, err := AddNode(c, p, AddArgs{FrameID: "f", Type: "Button", ParentID: "page"}); err == nil {
		t.Fatal("primitive in page root should fail")
	}
	if err := UpdateProps(c, p, "f", id, map[string]any{"items": []any{map[string]any{"value": "1", "label": "a"}, map[string]any{"value": "2", "label": "b"}}}, false); err != nil {
		t.Fatal(err)
	}
	if _, sk := s.Elements[id].Props["skeleton"]; sk {
		t.Fatal("merge should clear skeleton")
	}
	if err := UpdateProps(c, p, "f", "hero", map[string]any{"align": "diagonal"}, false); err == nil {
		t.Fatal("bad enum should fail")
	}
	if err := MoveNode(c, p, "f", "hero-buy", "cta", "actions", 0); err != nil {
		t.Fatal(err)
	}
	if s.Elements["cta"].Slots["actions"][0] != "hero-buy" || len(s.Elements["hero"].Slots["actions"]) != 1 {
		t.Fatal("move failed")
	}
	if err := RemoveNode(p, "f", "contact"); err != nil {
		t.Fatal(err)
	}
	if s.Elements["f-name"] != nil {
		t.Fatal("subtree should be removed")
	}
	if err := SetTheme(c, p, "coffee", map[string]any{"radius": 1.0}); err != nil {
		t.Fatal(err)
	}
	if err := SetTheme(c, p, "", map[string]any{"primary": "red"}); err == nil {
		t.Fatal("non-hex color should fail")
	}
	f2, _ := CreateFrame(p, "Checkout", "mobile")
	if err := SetNavigation(c, p, "f", "cta-btn", f2); err != nil {
		t.Fatal(err)
	}
	if err := ValidateSpec(c, s); err != nil {
		t.Fatal(err)
	}
}
