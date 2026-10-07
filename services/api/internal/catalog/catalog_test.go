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
	if err := c.ValidateTheme(c.ThemePresets["editorial"]); err != nil {
		t.Fatalf("preset should be valid: %v", err)
	}
	if s := c.ContentSchema("Pricing"); s["properties"].(map[string]any)["skeleton"] != nil {
		t.Fatal("skeleton should be stripped")
	}
}

func TestContentSchemaWithholdsEyebrow(t *testing.T) {
	c, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	for _, typ := range []string{"Hero", "ImageText"} {
		s := c.ContentSchema(typ)
		props := s["properties"].(map[string]any)
		if _, ok := props["eyebrow"]; ok {
			t.Errorf("%s: eyebrow must not be offered to the fill step", typ)
		}
		if _, ok := props["imageAlt"]; !ok {
			t.Errorf("%s: imageAlt missing", typ)
		}
		req, _ := s["required"].([]any)
		found := false
		for _, r := range req {
			found = found || r == "imageAlt"
		}
		if !found {
			t.Errorf("%s: imageAlt should be required for the fill step, got %v", typ, req)
		}
	}
}

func TestContentSchemaWithholdsNestedImage(t *testing.T) {
	c, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	items := c.ContentSchema("Gallery")["properties"].(map[string]any)["items"].(map[string]any)["items"].(map[string]any)
	if _, ok := items["properties"].(map[string]any)["image"]; ok {
		t.Fatal("Gallery item image must not be offered to the fill step")
	}
}
