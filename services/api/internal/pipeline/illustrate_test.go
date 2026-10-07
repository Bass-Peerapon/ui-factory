package pipeline

import (
	"testing"

	"github.com/Bass-Peerapon/ui-factory/services/api/internal/doc"
)

func TestImageJobs(t *testing.T) {
	gallery := []any{}
	for range 6 {
		gallery = append(gallery, map[string]any{"caption": "จานเปิด"})
	}
	sp := page(
		&doc.Element{Type: "Hero", Props: map[string]any{"variant": "split", "imageAlt": "บาริสต้าดริปกาแฟ"}},
		&doc.Element{Type: "Hero", Props: map[string]any{"variant": "editorial", "imageAlt": "ไม่ควรวาด"}},
		&doc.Element{Type: "ImageText", Props: map[string]any{"imageAlt": "ไร่ชา", "image": "/api/images/done.jpg"}},
		&doc.Element{Type: "ImageText", Props: map[string]any{"imageAlt": "ไร่ชา", "skeleton": true}},
		&doc.Element{Type: "Gallery", Props: map[string]any{"items": gallery}},
	)
	jobs := imageJobs("f", sp)
	if len(jobs) != maxImagesPerFrame {
		t.Fatalf("got %d jobs, want the cap %d: %+v", len(jobs), maxImagesPerFrame, jobs)
	}
	if jobs[0].alt != "บาริสต้าดริปกาแฟ" || jobs[0].aspect != "4:3" || jobs[0].item != -1 {
		t.Errorf("hero job %+v", jobs[0])
	}
	if jobs[1].list != "items" || jobs[1].item != 0 || jobs[1].aspect != "3:4" {
		t.Errorf("first gallery job %+v", jobs[1])
	}
}
