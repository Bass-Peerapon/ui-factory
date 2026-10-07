package pipeline

import (
	"fmt"
	"slices"

	"github.com/Bass-Peerapon/ui-factory/services/api/internal/doc"
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/hub"
)

// withNext attaches clickable follow-up suggestions to a reply. They are derived from the frame
// deterministically, so they cost no model call (pattern after open-design's next-step actions).
func (r *Runner) withNext(s *hub.Session, frameID, text string) reply {
	p, _ := s.Doc()
	return reply{text: text, meta: map[string]any{"next": nextSteps(p, frameID), "frames": []string{frameID}}}
}

func nextSteps(p *doc.Project, frameID string) []map[string]any {
	f := p.Frames[frameID]
	if f == nil || f.Spec == nil {
		return []map[string]any{}
	}
	sp := f.Spec
	has := func(t string) bool {
		for _, el := range sp.Elements {
			if el.Type == t {
				return true
			}
		}
		return false
	}
	var out []map[string]any
	add := func(m map[string]any) {
		if len(out) < 3 {
			out = append(out, m)
		}
	}
	prompt := func(label, text string) map[string]any {
		return map[string]any{"label": label, "prompt": text, "frameId": frameID}
	}

	if f.Device == "desktop" && !slices.ContainsFunc(p.FrameOrder, func(id string) bool {
		o := p.Frames[id]
		return o.Device == "mobile" && o.Brief == f.Brief
	}) {
		add(map[string]any{"label": "ทำเวอร์ชันมือถือ", "op": "duplicate_frame", "args": map[string]any{"frameId": frameID, "device": "mobile"}})
	}
	for _, el := range sp.Elements {
		if el.Type == "Hero" && el.Props["variant"] == "centered" {
			add(prompt("ลอง Hero แบบ split", "เปลี่ยน Hero เป็น layout แบบ split ให้เห็นภาพสินค้าชัดขึ้น"))
			break
		}
	}
	isMarketing := has("Hero") || has("Pricing")
	if isMarketing && !has("Testimonials") && !has("Quote") && !has("LogoCloud") {
		add(prompt("เพิ่มเสียงจากลูกค้า", "เพิ่มส่วนรีวิวลูกค้าที่น่าเชื่อถือหลัง section แรก"))
	}
	if isMarketing && !has("CTA") {
		add(prompt("เพิ่มส่วนปิดท้าย", "เพิ่ม CTA ปิดท้ายก่อน Footer พร้อมปุ่มหลัก"))
	}
	if !slices.ContainsFunc(p.FrameOrder, func(id string) bool { return p.Frames[id].Flow != "" }) && isMarketing {
		add(prompt("ต่อเป็น flow สมัครสมาชิก", fmt.Sprintf("ทำ flow สมัครสมาชิกต่อจากหน้า %s", f.Name)))
	}
	add(prompt("ขัดเกลาข้อความ", "ปรับข้อความทั้งหน้าให้สั้น กระชับ และเฉพาะเจาะจงขึ้น โดยไม่เปลี่ยน layout"))
	return out
}
