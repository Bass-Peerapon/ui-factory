package catalog

import "testing"

func TestValidateProps(t *testing.T) {
	c, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if err := c.ValidateProps("Hero", c.Get("Hero").Placeholder); err != nil {
		t.Fatalf("placeholder should be valid: %v", err)
	}
	err = c.ValidateProps("Hero", map[string]any{"title": "x", "align": "middle"})
	if err == nil {
		t.Fatal("expected error for bad enum and missing props")
	}
	t.Log(err)
	if err := c.ValidateProps("Nope", nil); err == nil {
		t.Fatal("expected unknown type error")
	}
	if err := c.ValidateTheme(c.ThemePresets["coffee"]); err != nil {
		t.Fatalf("preset should be valid: %v", err)
	}
	if s := c.ContentSchema("Pricing"); s["properties"].(map[string]any)["skeleton"] != nil {
		t.Fatal("skeleton should be stripped")
	}
}
