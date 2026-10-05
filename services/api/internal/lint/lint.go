// Package lint flags filled props that read like default LLM output. The rules are adapted from
// open-design's craft/anti-ai-slop.md (Apache-2.0, itself adapted from refero_skill, MIT):
// filler copy, emoji icons, invented hype metrics, and copy that overflows its layout budget.
package lint

import (
	"fmt"
	"regexp"
	"slices"
	"strings"
	"unicode/utf8"
)

// Budgets are maximum characters per prop name; values above 1.4x the budget fail.
var Budgets = map[string]int{
	"eyebrow": 28, "title": 64, "subtitle": 160, "description": 140, "label": 24, "ctaLabel": 22,
	"linkLabel": 22, "quote": 200, "question": 90, "answer": 240, "bio": 130, "excerpt": 150,
	"text": 100, "value": 18, "name": 42, "role": 42, "caption": 60, "brand": 28, "footerText": 80,
	"feature": 40, "date": 24, "delta": 14, "category": 20, "copyright": 80, "placeholder": 40,
}

const overflow = 1.4

var (
	filler = regexp.MustCompile(`(?i)lorem ipsum|placeholder text|sample content|feature (one|two|three|1|2|3)\b|ฟีเจอร์ที่ ?[0-9]|ข้อความตัวอย่าง|…`)
	hype   = regexp.MustCompile(`(?i)\d+(\.\d+)?\s?[x×](\s|$)|(เร็ว|ดี|มาก|ประหยัด)ขึ้น\s?\d+\s?เท่า|99\.9+\s?%|อันดับ\s?(1|หนึ่ง)\s?(ของ|ใน)?\s?(ประเทศ|โลก)|ที่สุดในโลก|best in the world|#1 in`)
	emoji  = regexp.MustCompile(`[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{1F000}-\x{1F2FF}]`)
)

type Finding struct {
	Path    string
	Message string
}

func (f Finding) String() string { return f.Path + ": " + f.Message }

// Props checks one element's filled props.
func Props(props map[string]any) []Finding {
	var out []Finding
	walk("", props, func(path, key, s string) {
		switch {
		case filler.MatchString(s):
			out = append(out, Finding{path, "filler or placeholder copy; write real, specific content"})
		case emoji.MatchString(s):
			out = append(out, Finding{path, "remove emoji; icons come from the icon prop"})
		case hype.MatchString(s):
			out = append(out, Finding{path, "invented hype metric or superlative; use a plausible, specific figure or plain wording"})
		}
		if b, ok := Budgets[key]; ok {
			if n := utf8.RuneCountInString(s); float64(n) > float64(b)*overflow {
				out = append(out, Finding{path, fmt.Sprintf("too long (%d chars, budget %d); shorten", n, b)})
			}
		}
	})
	return out
}

func walk(path string, v any, visit func(path, key, s string)) {
	switch t := v.(type) {
	case map[string]any:
		for k, val := range t {
			if k == "skeleton" || k == "variant" || k == "icon" {
				continue
			}
			p := k
			if path != "" {
				p = path + "." + k
			}
			if s, ok := val.(string); ok {
				visit(p, k, s)
				continue
			}
			walk(p, val, visit)
		}
	case []any:
		key := path
		if i := strings.LastIndex(path, "."); i >= 0 {
			key = path[i+1:]
		}
		for i, val := range t {
			p := fmt.Sprintf("%s[%d]", path, i)
			if s, ok := val.(string); ok {
				// arrays of strings (links, bullets, features) are budgeted as one short item each
				visit(p, singular(key), s)
				continue
			}
			walk(p, val, visit)
		}
	}
}

func singular(key string) string {
	switch key {
	case "links", "logos", "columns":
		return "label"
	case "features", "bullets":
		return "feature"
	}
	return key
}

// PrimaryButtons returns the ids of buttons to demote so a slot keeps at most one solid button.
func PrimaryButtons(slot []string, typeOf func(string) string, variantOf func(string) string) []string {
	var demote []string
	seen := false
	for _, id := range slot {
		if typeOf(id) != "Button" || variantOf(id) != "default" {
			continue
		}
		if seen {
			demote = append(demote, id)
		}
		seen = true
	}
	return slices.Clip(demote)
}
