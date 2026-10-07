package pipeline

import (
	"reflect"
	"testing"
)

func TestToolSummary(t *testing.T) {
	got := toolSummary([]string{"update_props hero", "add_node Button", "update_props hero", "update_props nav", "set_theme"})
	want := []map[string]any{
		{"tool": "update_props", "targets": []string{"hero", "nav"}, "count": 3},
		{"tool": "add_node", "targets": []string{"Button"}, "count": 1},
		{"tool": "set_theme", "targets": []string{}, "count": 1},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("toolSummary = %v, want %v", got, want)
	}
	if got := toolSummary(nil); len(got) != 0 {
		t.Fatalf("toolSummary(nil) = %v, want empty", got)
	}
}
