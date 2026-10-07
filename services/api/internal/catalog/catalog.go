// Package catalog validates props against the JSON Schema generated from the Zod catalog
// (packages/catalog is the source of truth; run `pnpm gen:schema` after changing it).
package catalog

import (
	"bytes"
	_ "embed"
	"encoding/json/v2"
	"fmt"
	"maps"
	"slices"
	"strings"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

//go:embed catalog.schema.json
var schemaJSON []byte

type Component struct {
	Kind        string         `json:"kind"`
	Description string         `json:"description"`
	Slots       []string       `json:"slots"`
	Events      []string       `json:"events"`
	Root        bool           `json:"root"`
	Props       map[string]any `json:"props"`
	Placeholder map[string]any `json:"placeholder"`

	schema *jsonschema.Schema
}

type DesignSystem struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Category string   `json:"category"`
	Summary  string   `json:"summary"`
	Rules    []string `json:"rules"`
}

type Catalog struct {
	Components    map[string]*Component     `json:"components"`
	Theme         map[string]any            `json:"theme"`
	ThemePresets  map[string]map[string]any `json:"themePresets"`
	DesignSystems []DesignSystem            `json:"designSystems"`

	themeSchema *jsonschema.Schema
}

// Load parses and compiles the embedded catalog schema.
func Load() (*Catalog, error) {
	var c Catalog
	if err := json.Unmarshal(schemaJSON, &c); err != nil {
		return nil, fmt.Errorf("parse catalog schema: %w", err)
	}
	comp := jsonschema.NewCompiler()
	compile := func(name string, doc map[string]any) (*jsonschema.Schema, error) {
		url := "mem://" + name
		if err := comp.AddResource(url, normalize(doc)); err != nil {
			return nil, err
		}
		return comp.Compile(url)
	}
	for name, cp := range c.Components {
		s, err := compile(name, cp.Props)
		if err != nil {
			return nil, fmt.Errorf("compile %s: %w", name, err)
		}
		cp.schema = s
	}
	s, err := compile("theme", c.Theme)
	if err != nil {
		return nil, fmt.Errorf("compile theme: %w", err)
	}
	c.themeSchema = s
	return &c, nil
}

// normalize round-trips a value through the jsonschema decoder so numbers become json.Number.
func normalize(v any) any {
	b, err := json.Marshal(v)
	if err != nil {
		return v
	}
	out, err := jsonschema.UnmarshalJSON(bytes.NewReader(b))
	if err != nil {
		return v
	}
	return out
}

func (c *Catalog) Has(t string) bool { _, ok := c.Components[t]; return ok }

func (c *Catalog) Get(t string) *Component { return c.Components[t] }

func (c *Catalog) Names() []string { return slices.Sorted(maps.Keys(c.Components)) }

// ValidateProps checks props (including the optional skeleton flag) for a component type.
func (c *Catalog) ValidateProps(t string, props map[string]any) error {
	cp, ok := c.Components[t]
	if !ok {
		return fmt.Errorf("unknown component type %q (valid: %s)", t, strings.Join(c.Names(), ", "))
	}
	return describe(cp.schema.Validate(normalize(props)))
}

// ValidateTheme checks a complete theme object.
func (c *Catalog) ValidateTheme(theme map[string]any) error {
	return describe(c.themeSchema.Validate(normalize(theme)))
}

// WithheldProps are never written by the fill step, at any depth. Eyebrows (kickers above a heading)
// are banned outright by impeccable's craft floor (skill/reference/craft-floor.md, rule
// skill-ban-eyebrow-on-every-section) and stay only for older projects; image URLs come from the image step.
var WithheldProps = []string{"eyebrow", "image"}

// requiredContent are optional props the fill step must still write when a component has them.
var requiredContent = []string{"imageAlt"}

// ContentSchema returns the props schema without the skeleton flag and withheld props, with only
// the keywords Gemini structured output supports.
func (c *Catalog) ContentSchema(t string) map[string]any {
	cp := c.Components[t]
	if cp == nil {
		return nil
	}
	s := geminiSafe(cp.Props).(map[string]any)
	props, ok := s["properties"].(map[string]any)
	if !ok {
		return s
	}
	delete(props, "skeleton")
	withhold(s)
	req, _ := s["required"].([]any)
	for _, k := range requiredContent {
		if _, has := props[k]; has && !slices.Contains(req, any(k)) {
			req = append(req, k)
		}
	}
	if req != nil {
		s["required"] = req
	}
	return s
}

func withhold(v any) {
	switch t := v.(type) {
	case map[string]any:
		if props, ok := t["properties"].(map[string]any); ok {
			for _, k := range WithheldProps {
				delete(props, k)
			}
		}
		for _, val := range t {
			withhold(val)
		}
	case []any:
		for _, val := range t {
			withhold(val)
		}
	}
}

var unsupported = []string{"$schema", "minLength", "maxLength", "pattern", "additionalProperties"}

func geminiSafe(v any) any {
	switch t := v.(type) {
	case map[string]any:
		out := make(map[string]any, len(t))
		for k, val := range t {
			if !slices.Contains(unsupported, k) {
				out[k] = geminiSafe(val)
			}
		}
		return out
	case []any:
		out := make([]any, len(t))
		for i, val := range t {
			out[i] = geminiSafe(val)
		}
		return out
	default:
		return v
	}
}

// describe flattens a validation error into "path: message" lines that an LLM can act on.
func describe(err error) error {
	if err == nil {
		return nil
	}
	ve, ok := err.(*jsonschema.ValidationError)
	if !ok {
		return err
	}
	var lines []string
	var walk func(u jsonschema.OutputUnit)
	walk = func(u jsonschema.OutputUnit) {
		if u.Error != nil && len(u.Errors) == 0 {
			loc := u.InstanceLocation
			if loc == "" {
				loc = "/"
			}
			lines = append(lines, fmt.Sprintf("%s: %s", loc, u.Error.String()))
		}
		for _, e := range u.Errors {
			walk(e)
		}
	}
	walk(*ve.BasicOutput())
	lines = slices.Compact(lines)
	if len(lines) == 0 {
		return err
	}
	return fmt.Errorf("%s", strings.Join(lines, "; "))
}

// Summary describes every component for LLM prompts.
func (c *Catalog) Summary() string {
	var b strings.Builder
	for _, kind := range []string{"layout", "block", "primitive"} {
		for _, name := range c.Names() {
			cp := c.Components[name]
			if cp.Kind != kind {
				continue
			}
			props, _ := json.Marshal(c.ContentSchema(name)["properties"])
			fmt.Fprintf(&b, "- %s [%s] %s", name, kind, cp.Description)
			if len(cp.Slots) > 0 {
				fmt.Fprintf(&b, " slots=%v", cp.Slots)
			}
			fmt.Fprintf(&b, "\n  props: %s\n", props)
		}
	}
	return b.String()
}

// DesignGuide returns the posture rules of a design system id, or "" when unknown.
func (c *Catalog) DesignGuide(id string) string {
	for _, d := range c.DesignSystems {
		if d.ID == id {
			return fmt.Sprintf("Design system %q (%s): %s\n- %s", d.Name, d.Category, d.Summary, strings.Join(d.Rules, "\n- "))
		}
	}
	return ""
}
