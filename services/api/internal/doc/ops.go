package doc

import (
	"errors"
	"fmt"
	"maps"
	"slices"
	"strings"

	"github.com/Bass-Peerapon/ui-factory/services/api/internal/catalog"
)

// Placement rules: blocks live in the root's children, primitives live in a block slot.
func checkPlacement(c *catalog.Catalog, s *Spec, childType, parentID, slot string) error {
	parent := s.Elements[parentID]
	if parent == nil {
		return fmt.Errorf("parent %q not found", parentID)
	}
	child := c.Get(childType)
	if child == nil {
		return fmt.Errorf("unknown component type %q", childType)
	}
	pc := c.Get(parent.Type)
	switch child.Kind {
	case "layout":
		return fmt.Errorf("%s is a page root and cannot be nested", childType)
	case "block":
		if parentID != s.Root || (slot != "" && slot != "default") {
			return fmt.Errorf("block %s must be a child of the page root %q", childType, s.Root)
		}
	case "primitive":
		if slot == "" || slot == "default" || !slices.Contains(pc.Slots, slot) {
			return fmt.Errorf("primitive %s must go into a slot of a block; %s slots: %v", childType, parent.Type, pc.Slots)
		}
	}
	return nil
}

func insertAt(l []string, i int, id string) []string {
	i = min(max(i, 0), len(l))
	return slices.Insert(slices.Clone(l), i, id)
}

type AddArgs struct {
	FrameID  string
	Type     string
	ParentID string
	Slot     string
	Index    *int
	// AfterID places the node next to an existing element when ParentID is empty.
	AfterID  string
	Props    map[string]any
	Skeleton bool
}

// AddNode inserts a new element and returns its id.
func AddNode(c *catalog.Catalog, p *Project, a AddArgs) (string, error) {
	s, err := p.SpecOf(a.FrameID)
	if err != nil {
		return "", err
	}
	cp := c.Get(a.Type)
	if cp == nil {
		return "", fmt.Errorf("unknown component type %q (valid: %s)", a.Type, strings.Join(c.Names(), ", "))
	}
	parentID, slot, index := a.ParentID, a.Slot, -1
	if a.Index != nil {
		index = *a.Index
	}
	if parentID == "" {
		parentID, slot, index = autoPlace(c, s, cp.Kind, a.AfterID)
		if parentID == "" {
			return "", fmt.Errorf("select a block with slots before adding primitive %s", a.Type)
		}
	}
	if err := checkPlacement(c, s, a.Type, parentID, slot); err != nil {
		return "", err
	}
	props := a.Props
	if a.Skeleton || props == nil {
		props = maps.Clone(cp.Placeholder)
		props["skeleton"] = true
	}
	if err := c.ValidateProps(a.Type, props); err != nil {
		return "", fmt.Errorf("invalid props for %s: %w", a.Type, err)
	}
	id := NewID(a.Type)
	s.Elements[id] = &Element{Type: a.Type, Props: props, Children: []string{}}
	l := s.getList(parentID, slot)
	if index < 0 {
		index = len(l)
	}
	s.setList(parentID, slot, insertAt(l, index, id))
	return id, nil
}

func autoPlace(c *catalog.Catalog, s *Spec, kind, afterID string) (parentID, slot string, index int) {
	if kind == "block" {
		root := s.Elements[s.Root]
		if afterID != "" {
			if i := slices.Index(root.Children, s.TopLevel(afterID)); i >= 0 {
				return s.Root, "", i + 1
			}
		}
		return s.Root, "", len(root.Children)
	}
	if afterID == "" {
		return "", "", -1
	}
	el := s.Elements[afterID]
	if el == nil {
		return "", "", -1
	}
	if cp := c.Get(el.Type); cp != nil && cp.Kind == "block" && len(cp.Slots) > 0 {
		return afterID, cp.Slots[len(cp.Slots)-1], -1
	}
	if loc, ok := s.Locate(afterID); ok && loc.Slot != "" {
		return loc.ParentID, loc.Slot, loc.Index + 1
	}
	return "", "", -1
}

// UpdateProps merges (or replaces) props. A merge clears the skeleton flag unless it is set explicitly.
func UpdateProps(c *catalog.Catalog, p *Project, frameID, id string, props map[string]any, replace bool) error {
	s, err := p.SpecOf(frameID)
	if err != nil {
		return err
	}
	el := s.Elements[id]
	if el == nil {
		return fmt.Errorf("element %q not found in frame %q", id, frameID)
	}
	next := props
	if !replace {
		next = maps.Clone(el.Props)
		delete(next, "skeleton")
		maps.Copy(next, props)
	}
	if err := c.ValidateProps(el.Type, next); err != nil {
		return fmt.Errorf("invalid props for %s %q: %w", el.Type, id, err)
	}
	el.Props = next
	return nil
}

func MoveNode(c *catalog.Catalog, p *Project, frameID, id, parentID, slot string, index int) error {
	s, err := p.SpecOf(frameID)
	if err != nil {
		return err
	}
	el := s.Elements[id]
	if el == nil || id == s.Root {
		return fmt.Errorf("element %q cannot be moved", id)
	}
	if slices.Contains(s.Subtree(id), parentID) {
		return errors.New("cannot move an element into itself")
	}
	if err := checkPlacement(c, s, el.Type, parentID, slot); err != nil {
		return err
	}
	from, _ := s.Locate(id)
	s.setList(from.ParentID, from.Slot, slices.Delete(slices.Clone(s.getList(from.ParentID, from.Slot)), from.Index, from.Index+1))
	s.setList(parentID, slot, insertAt(s.getList(parentID, slot), index, id))
	return nil
}

func RemoveNode(p *Project, frameID, id string) error {
	s, err := p.SpecOf(frameID)
	if err != nil {
		return err
	}
	if s.Elements[id] == nil {
		return fmt.Errorf("element %q not found", id)
	}
	if id == s.Root {
		return errors.New("cannot remove the page root; delete the frame instead")
	}
	loc, ok := s.Locate(id)
	if ok {
		s.setList(loc.ParentID, loc.Slot, slices.Delete(slices.Clone(s.getList(loc.ParentID, loc.Slot)), loc.Index, loc.Index+1))
	}
	for _, k := range s.Subtree(id) {
		delete(s.Elements, k)
	}
	return nil
}

// SetTheme starts from a preset (or the current theme) and overrides individual tokens.
func SetTheme(c *catalog.Catalog, p *Project, preset string, tokens map[string]any) error {
	base := maps.Clone(p.Theme)
	if preset != "" {
		pr, ok := c.ThemePresets[preset]
		if !ok {
			return fmt.Errorf("unknown preset %q (valid: %s)", preset, strings.Join(slices.Sorted(maps.Keys(c.ThemePresets)), ", "))
		}
		base = maps.Clone(pr)
	}
	maps.Copy(base, tokens)
	if err := c.ValidateTheme(base); err != nil {
		return fmt.Errorf("invalid theme: %w", err)
	}
	p.Theme = base
	return nil
}

func CreateFrame(p *Project, name, device string) (string, error) {
	if device == "" {
		device = "desktop"
	}
	if _, ok := DeviceWidth[device]; !ok {
		return "", fmt.Errorf("unknown device %q (desktop, tablet, mobile)", device)
	}
	id := NewID("frame")
	x, y := p.NextFramePosition()
	if name == "" {
		name = fmt.Sprintf("Frame %d", len(p.FrameOrder)+1)
	}
	p.Frames[id] = &Frame{ID: id, Name: name, Device: device, X: x, Y: y}
	p.FrameOrder = append(p.FrameOrder, id)
	return id, nil
}

type FrameUpdate struct {
	Name   *string
	Device *string
	X, Y   *float64
}

func UpdateFrame(p *Project, frameID string, u FrameUpdate) error {
	f, err := p.Frame(frameID)
	if err != nil {
		return err
	}
	if u.Name != nil && *u.Name != "" {
		f.Name = *u.Name
	}
	if u.Device != nil {
		if _, ok := DeviceWidth[*u.Device]; !ok {
			return fmt.Errorf("unknown device %q", *u.Device)
		}
		f.Device = *u.Device
	}
	if u.X != nil {
		f.X = *u.X
	}
	if u.Y != nil {
		f.Y = *u.Y
	}
	return nil
}

func DeleteFrame(p *Project, frameID string) error {
	if _, err := p.Frame(frameID); err != nil {
		return err
	}
	delete(p.Frames, frameID)
	p.FrameOrder = slices.DeleteFunc(p.FrameOrder, func(id string) bool { return id == frameID })
	return nil
}

func SetLocale(p *Project, locale string) error {
	if locale != "th" && locale != "en" {
		return fmt.Errorf("locale must be th or en")
	}
	p.Locale = locale
	return nil
}

// SetNavigation wires a pressable element to show another frame in prototype mode.
func SetNavigation(c *catalog.Catalog, p *Project, frameID, id, target string) error {
	s, err := p.SpecOf(frameID)
	if err != nil {
		return err
	}
	el := s.Elements[id]
	if el == nil {
		return fmt.Errorf("element %q not found", id)
	}
	if !slices.Contains(c.Get(el.Type).Events, "press") {
		return fmt.Errorf("%s has no press event; only Button can navigate", el.Type)
	}
	if target == "" {
		delete(el.On, "press")
		return nil
	}
	if _, err := p.Frame(target); err != nil {
		return err
	}
	if el.On == nil {
		el.On = map[string]any{}
	}
	el.On["press"] = map[string]any{"action": "navigate", "params": map[string]any{"frameId": target}}
	return nil
}

// ValidateSpec checks a whole spec against the catalog and the tree rules.
func ValidateSpec(c *catalog.Catalog, s *Spec) error {
	root := s.Elements[s.Root]
	if root == nil {
		return fmt.Errorf("root %q missing", s.Root)
	}
	if cp := c.Get(root.Type); cp == nil || !cp.Root {
		return fmt.Errorf("root must be a layout component, got %s", root.Type)
	}
	seen := map[string]bool{}
	var errs []error
	for id, el := range s.Elements {
		if el.Children == nil {
			el.Children = []string{}
		}
		if err := c.ValidateProps(el.Type, el.Props); err != nil {
			errs = append(errs, fmt.Errorf("%s (%s): %w", id, el.Type, err))
		}
		if !c.Has(el.Type) {
			continue
		}
		refs := slices.Clone(el.Children)
		for _, child := range el.Children {
			if ch := s.Elements[child]; ch != nil {
				if err := checkPlacement(c, s, ch.Type, id, ""); err != nil {
					errs = append(errs, fmt.Errorf("%s: %w", child, err))
				}
			}
		}
		for slot, keys := range el.Slots {
			if !slices.Contains(c.Get(el.Type).Slots, slot) {
				errs = append(errs, fmt.Errorf("%s: unknown slot %q", id, slot))
			}
			for _, child := range keys {
				if ch := s.Elements[child]; ch != nil {
					if err := checkPlacement(c, s, ch.Type, id, slot); err != nil {
						errs = append(errs, fmt.Errorf("%s: %w", child, err))
					}
				}
			}
			refs = append(refs, keys...)
		}
		for _, r := range refs {
			if s.Elements[r] == nil {
				errs = append(errs, fmt.Errorf("%s references missing element %q", id, r))
			}
			if seen[r] {
				errs = append(errs, fmt.Errorf("element %q has more than one parent", r))
			}
			seen[r] = true
		}
	}
	return errors.Join(errs...)
}
