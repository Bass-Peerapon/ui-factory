package pipeline

import (
	"fmt"
	"slices"
	"strings"

	"github.com/Bass-Peerapon/ui-factory/services/api/internal/doc"
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/hub"
)

// critiqueFinding is one page-level problem the deterministic critic found after fill.
type critiqueFinding struct {
	Rule    string // impeccable rule id the check follows
	Message string // shown in chat
	Fix     string // instruction for the edit agent
}

// pageMode reads the mode the brief settled on, falling back to what the page contains.
func pageMode(brief string, sp *doc.Spec) string {
	for _, m := range []string{"persuade", "operate", "read"} {
		if strings.Contains(brief, "page mode: "+m) {
			return m
		}
	}
	has := func(types ...string) bool {
		for _, el := range sp.Elements {
			if slices.Contains(types, el.Type) {
				return true
			}
		}
		return false
	}
	switch {
	case has("AuthForm", "KPIGrid", "DataTable"):
		return "operate"
	case has("Hero", "Pricing"):
		return "persuade"
	}
	return ""
}

var (
	marketingBlocks = []string{"Hero", "Testimonials", "Pricing", "CTA", "LogoCloud", "Stats", "Quote"}
	chromeBlocks    = []string{"Banner", "Navbar"}
	formBlocks      = []string{"ContactForm", "AuthForm", "Newsletter"}
)

// critique checks page composition against impeccable's craft floor and mode rules
// (pbakaus/impeccable skill/reference/craft-floor.md, mode-persuade.md, mode-operate.md; Apache-2.0).
// It runs on the spec only, so it costs no model call; fixes go to the edit agent when the user asks.
func critique(sp *doc.Spec, brief string) []critiqueFinding {
	if sp == nil || sp.Elements[sp.Root] == nil {
		return nil
	}
	blocks := sp.Elements[sp.Root].Children
	typeOf := func(id string) string {
		if el := sp.Elements[id]; el != nil {
			return el.Type
		}
		return ""
	}
	var out []critiqueFinding
	mode := pageMode(brief, sp)

	// The opening of a persuade page carries the action visitors came for.
	if mode == "persuade" {
		first := ""
		for _, id := range blocks {
			if !slices.Contains(chromeBlocks, typeOf(id)) {
				first = id
				break
			}
		}
		if first != "" && !slices.Contains(formBlocks, typeOf(first)) && !hasButton(sp, first) {
			out = append(out, critiqueFinding{
				Rule:    "skill-persuade-conversion-in-form",
				Message: fmt.Sprintf("ส่วนแรกของหน้า (%s) ไม่มี action หลัก ผู้เข้าชมต้องเลื่อนหาว่าทำอะไรต่อ", typeOf(first)),
				Fix:     fmt.Sprintf("เพิ่มปุ่มหลักใน %s ที่เป็น action จริงของธุรกิจนี้ เช่น จองคิว สั่งซื้อ หรือลงทะเบียน", typeOf(first)),
			})
		}
	}

	// App screens are not marketing pages.
	if mode == "operate" {
		var found []string
		for _, id := range blocks {
			if t := typeOf(id); slices.Contains(marketingBlocks, t) {
				found = append(found, t)
			}
		}
		if len(found) > 0 {
			out = append(out, critiqueFinding{
				Rule:    "skill-mode-operate",
				Message: "หน้าใช้งาน (operate) มี section การตลาด: " + strings.Join(found, ", "),
				Fix:     "ลบ section การตลาด " + strings.Join(found, ", ") + " ออก หน้านี้เป็นหน้าใช้งานจริง",
			})
		}
	}

	// One equal card grid per page.
	var cards []string
	for _, id := range blocks {
		if v, _ := sp.Elements[id].Props["variant"].(string); v == "cards" {
			cards = append(cards, typeOf(id))
		}
	}
	if len(cards) > 1 {
		out = append(out, critiqueFinding{
			Rule:    "skill-ban-identical-card-grids",
			Message: "มี grid การ์ดขนาดเท่ากันหลายส่วน (" + strings.Join(cards, ", ") + ") หน้าดูเป็น template",
			Fix:     "เปลี่ยน layout ของ " + strings.Join(cards[1:], ", ") + " ให้ไม่ใช่ cards เช่น list, bento หรือ spotlight",
		})
	}

	for i, id := range blocks {
		// The hero-metric template: big numbers right under the headline.
		if typeOf(id) == "Hero" && i+1 < len(blocks) && typeOf(blocks[i+1]) == "Stats" {
			out = append(out, critiqueFinding{
				Rule:    "skill-ban-hero-metric",
				Message: "Stats อยู่ใต้ Hero ทันที เป็นรูปแบบ hero-metric ที่เห็นได้ทั่วไป",
				Fix:     "ย้าย Stats ลงไปหลัง section ถัดไป",
			})
		}
		// Two sections of the same type in a row read as one long, flat block.
		if i > 0 && typeOf(id) == typeOf(blocks[i-1]) {
			out = append(out, critiqueFinding{
				Rule:    "skill-layout-spacing-rhythm",
				Message: fmt.Sprintf("มี %s ติดกันสองส่วน จังหวะของหน้าแบนเกินไป", typeOf(id)),
				Fix:     fmt.Sprintf("รวม %s สองส่วนที่ติดกันเป็นส่วนเดียว หรือคั่นด้วย section อื่น", typeOf(id)),
			})
		}
	}

	// Eyebrows survive only from older projects or manual edits.
	for _, id := range blocks {
		if e, _ := sp.Elements[id].Props["eyebrow"].(string); e != "" {
			out = append(out, critiqueFinding{
				Rule:    "skill-ban-eyebrow-on-every-section",
				Message: fmt.Sprintf("%s มีข้อความ eyebrow เหนือหัวข้อ", typeOf(id)),
				Fix:     fmt.Sprintf("ลบ eyebrow ของ %s ให้หัวข้อสื่อสารเอง", typeOf(id)),
			})
		}
	}
	return out
}

func hasButton(sp *doc.Spec, block string) bool {
	return slices.ContainsFunc(sp.Subtree(block), func(id string) bool {
		el := sp.Elements[id]
		return el != nil && el.Type == "Button"
	})
}

// critiqueText renders findings for the chat reply and the edit prompt.
func critiqueText(fs []critiqueFinding) (summary, fix string) {
	if len(fs) == 0 {
		return "", ""
	}
	msgs := make([]string, len(fs))
	fixes := make([]string, len(fs))
	for i, f := range fs {
		msgs[i] = f.Message
		fixes[i] = fmt.Sprintf("%d. %s", i+1, f.Fix)
	}
	return "ผลตรวจ craft (impeccable):\n- " + strings.Join(msgs, "\n- "), "แก้ตามผลตรวจ craft:\n" + strings.Join(fixes, "\n")
}

// review runs the critic on filled frames. It returns the step detail, a summary for the reply, and an
// edit prompt per frame that has findings.
func (r *Runner) review(s *hub.Session, frameIDs []string, res FillResult) (detail, summary string, fixes map[string]string) {
	p, _ := s.Doc()
	fixes = map[string]string{}
	var parts []string
	n := 0
	for _, id := range frameIDs {
		f := p.Frames[id]
		if f == nil {
			continue
		}
		fs := critique(f.Spec, f.Brief)
		if len(fs) == 0 {
			continue
		}
		n += len(fs)
		text, fix := critiqueText(fs)
		if len(frameIDs) > 1 {
			text = f.Name + ": " + text
		}
		parts = append(parts, text)
		fixes[id] = fix
	}
	detail = res.QualityDetail()
	if n > 0 {
		detail += fmt.Sprintf(", craft %d จุด", n)
	}
	return detail, strings.Join(parts, "\n"), fixes
}

// withReview prepends a "fix what the critic found" action to a reply's next steps.
func withReview(out reply, summary string, fixes map[string]string, order []string) reply {
	if summary == "" {
		return out
	}
	out.text += "\n" + summary
	if out.meta == nil {
		out.meta = map[string]any{}
	}
	next, _ := out.meta["next"].([]map[string]any)
	for _, id := range order {
		if fix, ok := fixes[id]; ok {
			next = append([]map[string]any{{"label": "แก้ตามผลตรวจ", "prompt": fix, "frameId": id}}, next...)
			break
		}
	}
	out.meta["next"] = next
	return out
}
