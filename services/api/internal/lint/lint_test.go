package lint

import "testing"

func TestProps(t *testing.T) {
	bad := map[string]any{
		"title":    "เร็วขึ้น 10x เพื่อธุรกิจของคุณ",
		"subtitle": "ข้อความตัวอย่าง",
		"features": []any{map[string]any{"title": "🚀 Launch", "description": "ok"}},
		"eyebrow":  "นี่คือ eyebrow ที่ยาวเกินกว่าที่ควรจะเป็นอย่างมากมายมหาศาลเลยทีเดียว",
	}
	got := Props(bad)
	if len(got) != 4 {
		t.Fatalf("want 4 findings, got %d: %v", len(got), got)
	}
	good := map[string]any{"title": "คั่วสดทุกวันจันทร์ ส่งถึงบ้านใน 48 ชั่วโมง", "links": []any{"เมนู", "ราคา"}}
	if f := Props(good); len(f) != 0 {
		t.Fatalf("unexpected findings: %v", f)
	}
}

func TestPrimaryButtons(t *testing.T) {
	types := map[string]string{"a": "Button", "b": "Button", "c": "Button"}
	variants := map[string]string{"a": "default", "b": "outline", "c": "default"}
	d := PrimaryButtons([]string{"a", "b", "c"}, func(id string) string { return types[id] }, func(id string) string { return variants[id] })
	if len(d) != 1 || d[0] != "c" {
		t.Fatalf("want [c], got %v", d)
	}
}
