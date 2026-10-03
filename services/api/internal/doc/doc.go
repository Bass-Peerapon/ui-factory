// Package doc holds the project document (frames of json-render specs) and the edit operations
// shared by the agent tools and the manual editor.
package doc

import (
	"crypto/rand"
	"encoding/json/v2"
	"fmt"
	"maps"
	"slices"
	"strings"
)

type Element struct {
	Type     string              `json:"type"`
	Props    map[string]any      `json:"props"`
	Children []string            `json:"children"`
	Slots    map[string][]string `json:"slots,omitempty"`
	On       map[string]any      `json:"on,omitempty"`
	Visible  any                 `json:"visible,omitempty"`
}

type Spec struct {
	Root     string              `json:"root"`
	Elements map[string]*Element `json:"elements"`
	State    map[string]any      `json:"state"`
}

type Frame struct {
	ID     string  `json:"id"`
	Name   string  `json:"name"`
	Device string  `json:"device"`
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	// Brief is the prompt that produced the frame; the Fill step reuses it.
	Brief string `json:"brief,omitempty"`
	Spec  *Spec  `json:"spec"`
}

type Project struct {
	ID         string            `json:"id"`
	Name       string            `json:"name"`
	Locale     string            `json:"locale"`
	Theme      map[string]any    `json:"theme"`
	Frames     map[string]*Frame `json:"frames"`
	FrameOrder []string          `json:"frameOrder"`
}

var DeviceWidth = map[string]float64{"desktop": 1280, "tablet": 768, "mobile": 390}

// Clone deep-copies the project via JSON.
func (p *Project) Clone() *Project {
	b, err := json.Marshal(p)
	if err != nil {
		panic(err)
	}
	var out Project
	if err := json.Unmarshal(b, &out); err != nil {
		panic(err)
	}
	return &out
}

func (p *Project) Frame(id string) (*Frame, error) {
	f, ok := p.Frames[id]
	if !ok {
		return nil, fmt.Errorf("frame %q not found", id)
	}
	return f, nil
}

func (p *Project) SpecOf(frameID string) (*Spec, error) {
	f, err := p.Frame(frameID)
	if err != nil {
		return nil, err
	}
	if f.Spec == nil {
		return nil, fmt.Errorf("frame %q is empty", frameID)
	}
	return f.Spec, nil
}

// NextFramePosition places a new frame to the right of the existing ones.
func (p *Project) NextFramePosition() (x, y float64) {
	for _, id := range p.FrameOrder {
		f := p.Frames[id]
		x = max(x, f.X+DeviceWidth[f.Device]+160)
	}
	return x, 0
}

func NewID(prefix string) string {
	b := make([]byte, 4)
	rand.Read(b)
	return fmt.Sprintf("%s-%x", strings.ToLower(prefix), b)
}

// --- tree helpers -----------------------------------------------------------

// Location of an element inside its parent. Slot "" means the children list.
type Location struct {
	ParentID string
	Slot     string
	Index    int
}

func (s *Spec) getList(parentID, slot string) []string {
	el := s.Elements[parentID]
	if slot == "" || slot == "default" {
		return el.Children
	}
	return el.Slots[slot]
}

func (s *Spec) setList(parentID, slot string, l []string) {
	el := s.Elements[parentID]
	if slot == "" || slot == "default" {
		el.Children = l
		return
	}
	if el.Slots == nil {
		el.Slots = map[string][]string{}
	}
	if len(l) == 0 {
		delete(el.Slots, slot)
		return
	}
	el.Slots[slot] = l
}

func (s *Spec) Locate(id string) (Location, bool) {
	for pid, el := range s.Elements {
		if i := slices.Index(el.Children, id); i >= 0 {
			return Location{pid, "", i}, true
		}
		for slot, keys := range el.Slots {
			if i := slices.Index(keys, id); i >= 0 {
				return Location{pid, slot, i}, true
			}
		}
	}
	return Location{}, false
}

// Subtree returns id and all descendants.
func (s *Spec) Subtree(id string) []string {
	out := []string{id}
	el := s.Elements[id]
	if el == nil {
		return out
	}
	for _, c := range el.Children {
		out = append(out, s.Subtree(c)...)
	}
	for _, slot := range slices.Sorted(maps.Keys(el.Slots)) {
		for _, c := range el.Slots[slot] {
			out = append(out, s.Subtree(c)...)
		}
	}
	return out
}

// TopLevel returns the direct child of the root that contains id (or id itself).
func (s *Spec) TopLevel(id string) string {
	for {
		loc, ok := s.Locate(id)
		if !ok || loc.ParentID == s.Root {
			return id
		}
		id = loc.ParentID
	}
}

func (s *Spec) Outline() []map[string]any {
	var out []map[string]any
	var walk func(id string, depth int, slot string)
	walk = func(id string, depth int, slot string) {
		el := s.Elements[id]
		if el == nil {
			return
		}
		item := map[string]any{"id": id, "type": el.Type, "depth": depth}
		if slot != "" {
			item["slot"] = slot
		}
		if sk, _ := el.Props["skeleton"].(bool); sk {
			item["skeleton"] = true
		}
		out = append(out, item)
		for _, c := range el.Children {
			walk(c, depth+1, "")
		}
		for _, sl := range slices.Sorted(maps.Keys(el.Slots)) {
			for _, c := range el.Slots[sl] {
				walk(c, depth+1, sl)
			}
		}
	}
	walk(s.Root, 0, "")
	return out
}

// SubtreeSpec returns the elements of a subtree keyed by id.
func (s *Spec) SubtreeSpec(id string) map[string]*Element {
	out := map[string]*Element{}
	for _, k := range s.Subtree(id) {
		if el := s.Elements[k]; el != nil {
			out[k] = el
		}
	}
	return out
}
