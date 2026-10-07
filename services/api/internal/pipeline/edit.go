package pipeline

import (
	"context"
	"encoding/json/v2"
	"errors"
	"fmt"
	"maps"
	"slices"
	"strings"
	"sync"
	"time"

	"google.golang.org/adk/agent"
	"google.golang.org/adk/agent/llmagent"
	"google.golang.org/adk/runner"
	"google.golang.org/adk/session"
	"google.golang.org/adk/tool"
	"google.golang.org/adk/tool/functiontool"
	"google.golang.org/genai"

	"github.com/Bass-Peerapon/ui-factory/services/api/internal/doc"
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/hub"
)

// editTimeout bounds the whole tool loop of one turn.
const editTimeout = 2 * time.Minute

// toolResult is what every tool returns to the model.
type toolResult struct {
	OK        bool   `json:"ok"`
	ID        string `json:"id,omitempty"`
	Error     string `json:"error,omitempty"`
	Attempt   int    `json:"attempt,omitempty"`
	GiveUp    bool   `json:"give_up,omitempty"`
	Directive string `json:"directive,omitempty"`
}

// editSession tracks validation retries per tool call target within one turn.
type editSession struct {
	r        *Runner
	s        *hub.Session
	frameID  string
	mu       sync.Mutex
	attempts map[string]int
	failures []string
	applied  int
	// calls lists each successful tool call as "tool target" for the chat transcript.
	calls []string
	// scope limits edits to commented elements and their subtrees; nil means the whole frame.
	scope map[string]bool
}

var errOutOfScope = errors.New("out of scope: this turn may only change the commented elements and their children")

func (e *editSession) inScope(ids ...string) error {
	if e.scope == nil {
		return nil
	}
	for _, id := range ids {
		if !e.scope[id] {
			return fmt.Errorf("%w (element %q)", errOutOfScope, id)
		}
	}
	return nil
}

// apply runs one document operation; validation errors go back to the model until the retry budget is spent.
func (e *editSession) apply(ctx context.Context, key string, op func(p *doc.Project) (string, error)) toolResult {
	e.mu.Lock()
	if e.attempts[key] >= e.r.MaxRetries {
		e.mu.Unlock()
		return toolResult{Error: "retry budget exhausted for this change", GiveUp: true,
			Directive: "Do not call this again. Continue with other changes and tell the user this part could not be done."}
	}
	e.mu.Unlock()

	var id string
	err := e.s.Mutate(ctx, hub.MutateOpts{}, func(p *doc.Project) error {
		var err error
		id, err = op(p)
		return err
	})
	e.mu.Lock()
	defer e.mu.Unlock()
	if err == nil {
		e.applied++
		e.calls = append(e.calls, key)
		return toolResult{OK: true, ID: id}
	}
	e.attempts[key]++
	n := e.attempts[key]
	if n >= e.r.MaxRetries {
		e.failures = append(e.failures, fmt.Sprintf("%s: %s", key, truncate(err.Error(), 160)))
		return toolResult{Error: err.Error(), Attempt: n, GiveUp: true,
			Directive: "Validation failed too many times. Do not retry this change; tell the user it could not be done."}
	}
	return toolResult{Error: err.Error(), Attempt: n, Directive: "Fix the arguments to satisfy the schema and call the tool again."}
}

func parseProps(raw string) (map[string]any, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, nil
	}
	var m map[string]any
	if err := json.Unmarshal([]byte(raw), &m); err != nil {
		return nil, fmt.Errorf("props_json is not a JSON object: %w", err)
	}
	return m, nil
}

type addNodeArgs struct {
	ParentID  string `json:"parent_id" jsonschema:"id of the parent: the page root for blocks, or a block for primitives"`
	Slot      string `json:"slot,omitempty" jsonschema:"slot name of the parent for primitives (e.g. actions, fields); omit for blocks"`
	Index     *int   `json:"index,omitempty" jsonschema:"position inside the parent list; omit to append"`
	Type      string `json:"type" jsonschema:"component type from the catalog"`
	PropsJSON string `json:"props_json,omitempty" jsonschema:"complete props as a JSON object string matching the component schema; omit to add a skeleton that is filled automatically"`
}

type updatePropsArgs struct {
	ElementID string `json:"element_id"`
	PropsJSON string `json:"props_json" jsonschema:"JSON object string with the props to change; merged into existing props. Arrays are replaced whole."`
}

type moveNodeArgs struct {
	ElementID string `json:"element_id"`
	ParentID  string `json:"parent_id"`
	Slot      string `json:"slot,omitempty"`
	Index     int    `json:"index" jsonschema:"target position in the parent list (0 = first)"`
}

type removeNodeArgs struct {
	ElementID string `json:"element_id"`
}

type setThemeArgs struct {
	Preset     string `json:"preset,omitempty" jsonschema:"optional theme preset to start from"`
	TokensJSON string `json:"tokens_json,omitempty" jsonschema:"JSON object string of theme tokens to override, e.g. {\"primary\":\"#0f766e\",\"radius\":1}"`
}

type createFrameArgs struct {
	Name   string `json:"name"`
	Device string `json:"device" jsonschema:"desktop, tablet or mobile"`
}

type setNavigationArgs struct {
	ElementID     string `json:"element_id" jsonschema:"a Button element id"`
	TargetFrameID string `json:"target_frame_id" jsonschema:"frame to show when pressed in prototype mode; empty string removes the link"`
}

func (e *editSession) tools() ([]tool.Tool, error) {
	cat := e.r.Cat
	defs := []struct {
		name, desc string
		build      func(name, desc string) (tool.Tool, error)
	}{
		{"add_node", "Add a catalog component. Blocks go into the page root children; primitives go into a block slot.",
			func(n, d string) (tool.Tool, error) {
				return functiontool.New(functiontool.Config{Name: n, Description: d}, func(tc agent.ToolContext, a addNodeArgs) (toolResult, error) {
					return e.apply(tc, "add_node "+a.Type, func(p *doc.Project) (string, error) {
						if err := e.inScope(a.ParentID); err != nil {
							return "", err
						}
						props, err := parseProps(a.PropsJSON)
						if err != nil {
							return "", err
						}
						return doc.AddNode(cat, p, doc.AddArgs{FrameID: e.frameID, Type: a.Type, ParentID: a.ParentID,
							Slot: a.Slot, Index: a.Index, Props: props, Skeleton: props == nil})
					}), nil
				})
			}},
		{"update_props", "Change props of an existing element (merge).",
			func(n, d string) (tool.Tool, error) {
				return functiontool.New(functiontool.Config{Name: n, Description: d}, func(tc agent.ToolContext, a updatePropsArgs) (toolResult, error) {
					return e.apply(tc, "update_props "+a.ElementID, func(p *doc.Project) (string, error) {
						if err := e.inScope(a.ElementID); err != nil {
							return "", err
						}
						props, err := parseProps(a.PropsJSON)
						if err != nil {
							return "", err
						}
						return a.ElementID, doc.UpdateProps(cat, p, e.frameID, a.ElementID, props, false)
					}), nil
				})
			}},
		{"move_node", "Move an element to another parent or position.",
			func(n, d string) (tool.Tool, error) {
				return functiontool.New(functiontool.Config{Name: n, Description: d}, func(tc agent.ToolContext, a moveNodeArgs) (toolResult, error) {
					return e.apply(tc, "move_node "+a.ElementID, func(p *doc.Project) (string, error) {
						if err := e.inScope(a.ElementID, a.ParentID); err != nil {
							return "", err
						}
						return a.ElementID, doc.MoveNode(cat, p, e.frameID, a.ElementID, a.ParentID, a.Slot, a.Index)
					}), nil
				})
			}},
		{"remove_node", "Remove an element and everything inside it.",
			func(n, d string) (tool.Tool, error) {
				return functiontool.New(functiontool.Config{Name: n, Description: d}, func(tc agent.ToolContext, a removeNodeArgs) (toolResult, error) {
					return e.apply(tc, "remove_node "+a.ElementID, func(p *doc.Project) (string, error) {
						if err := e.inScope(a.ElementID); err != nil {
							return "", err
						}
						return a.ElementID, doc.RemoveNode(p, e.frameID, a.ElementID)
					}), nil
				})
			}},
		{"set_theme", "Change project design tokens (colors are #rrggbb, radius in rem 0 to 1.5, font one of sans, serif, mono, rounded).",
			func(n, d string) (tool.Tool, error) {
				return functiontool.New(functiontool.Config{Name: n, Description: d}, func(tc agent.ToolContext, a setThemeArgs) (toolResult, error) {
					return e.apply(tc, "set_theme", func(p *doc.Project) (string, error) {
						if e.scope != nil {
							return "", errOutOfScope
						}
						tokens, err := parseProps(a.TokensJSON)
						if err != nil {
							return "", err
						}
						return "", doc.SetTheme(cat, p, a.Preset, tokens)
					}), nil
				})
			}},
		{"create_frame", "Create a new empty frame (screen) on the canvas.",
			func(n, d string) (tool.Tool, error) {
				return functiontool.New(functiontool.Config{Name: n, Description: d}, func(tc agent.ToolContext, a createFrameArgs) (toolResult, error) {
					return e.apply(tc, "create_frame", func(p *doc.Project) (string, error) {
						if e.scope != nil {
							return "", errOutOfScope
						}
						return doc.CreateFrame(p, a.Name, a.Device)
					}), nil
				})
			}},
		{"set_navigation", "Make a Button open another frame when pressed in prototype mode.",
			func(n, d string) (tool.Tool, error) {
				return functiontool.New(functiontool.Config{Name: n, Description: d}, func(tc agent.ToolContext, a setNavigationArgs) (toolResult, error) {
					return e.apply(tc, "set_navigation "+a.ElementID, func(p *doc.Project) (string, error) {
						if err := e.inScope(a.ElementID); err != nil {
							return "", err
						}
						return a.ElementID, doc.SetNavigation(cat, p, e.frameID, a.ElementID, a.TargetFrameID)
					}), nil
				})
			}},
	}
	var out []tool.Tool
	for _, d := range defs {
		t, err := d.build(d.name, d.desc)
		if err != nil {
			return nil, fmt.Errorf("tool %s: %w", d.name, err)
		}
		out = append(out, t)
	}
	return out, nil
}

const editInstruction = `You are the editing agent of a UI builder. You change a page made of catalog components by calling tools.
Every change must go through a tool; never describe JSON in the reply instead of calling a tool.

Rules:
- Only use component types and props from the catalog. props_json must be a JSON object string matching the props schema.
- Blocks are children of the page root. Primitives (Button, Input, Textarea, Checkbox, Badge) live in a block slot.
- Prefer editing the selected element. "This", "it" or "นี่" refer to the selection.
- Write copy in %s. Keep the brand and tone of the existing page.
- For theme requests call set_theme once with a preset or tokens (colors as #rrggbb).
- If a tool returns give_up, stop retrying that change.
- Copy rules: specific and believable, no hype metrics, no filler, no emoji, short headlines, one solid Button per block.
- Layout variants (the "variant" prop) are allowed values in the schema; change them when the user asks for a different layout.
- For theme requests prefer a design system preset; override individual tokens only when the user asks for specific colors.
- When done, reply with one or two short sentences in Thai describing what changed. No markdown.

%s

Catalog:
%s
Theme presets (design systems): %s`

func (r *Runner) edit(ctx context.Context, s *hub.Session, t *hub.Turn, req ChatRequest, intent string) (reply, error) {
	phase := "edit"
	if intent == "set_theme" {
		phase = "theme"
	}
	p, _ := s.Doc()
	frame := p.Frames[req.FrameID]
	frameID := ""
	if frame != nil {
		frameID = frame.ID
	}
	s.UpdateTurn(t, frameID, phase)

	es := &editSession{r: r, s: s, frameID: frameID, attempts: map[string]int{}}
	if len(req.Comments) > 0 && frame != nil && frame.Spec != nil {
		es.scope = map[string]bool{}
		for _, c := range req.Comments {
			for _, id := range frame.Spec.Subtree(c.ElementID) {
				es.scope[id] = true
			}
		}
		s.Step(t, 1, fmt.Sprintf("%d คอมเมนต์", len(req.Comments)))
	}
	tools, err := es.tools()
	if err != nil {
		return reply{}, err
	}
	a, err := llmagent.New(llmagent.Config{
		Name:        "ui_editor",
		Description: "Edits UI frames with catalog-validated tool calls.",
		Model:       r.Model.Agent(),
		Instruction: fmt.Sprintf(editInstruction, localeName[p.Locale], r.Cat.DesignGuide(fmt.Sprint(p.Theme["designSystem"])), r.Cat.Summary(),
			strings.Join(slices.Sorted(maps.Keys(r.Cat.ThemePresets)), ", ")),
		Tools: tools,
		GenerateContentConfig: &genai.GenerateContentConfig{
			ThinkingConfig: &genai.ThinkingConfig{ThinkingLevel: genai.ThinkingLevelLow},
		},
	})
	if err != nil {
		return reply{}, err
	}
	run, err := runner.New(runner.Config{AppName: "ui-factory", Agent: a, SessionService: session.InMemoryService(), AutoCreateSession: true})
	if err != nil {
		return reply{}, err
	}

	prompt, err := r.editContext(ctx, s, p, frame, req)
	if err != nil {
		return reply{}, err
	}
	ctx, cancel := context.WithTimeout(ctx, editTimeout)
	defer cancel()
	var answer strings.Builder
	for ev, err := range run.Run(ctx, "user", t.ID, genai.NewContentFromText(prompt, genai.RoleUser), agent.RunConfig{}) {
		if err != nil {
			if ctx.Err() != nil {
				return reply{}, context.Cause(ctx)
			}
			return reply{}, err
		}
		if ev.IsFinalResponse() && ev.Content != nil {
			for _, part := range ev.Content.Parts {
				if part.Text != "" && !part.Thought {
					answer.WriteString(part.Text)
				}
			}
		}
	}

	out := strings.TrimSpace(answer.String())
	if out == "" {
		out = fmt.Sprintf("แก้ไขแล้ว %d รายการ", es.applied)
	}
	if es.applied == 0 && len(es.failures) == 0 {
		out += "\n(ไม่มีการเปลี่ยนแปลงในเฟรม)"
	}
	if len(es.failures) > 0 {
		out += "\nส่วนที่ทำไม่ได้หลังลองครบ " + fmt.Sprint(r.MaxRetries) + " ครั้ง:\n- " + strings.Join(es.failures, "\n- ")
	}
	// Elements added without props are skeletons; fill them in the same turn.
	if frameID != "" {
		cur, _ := s.Doc()
		if spec := cur.Frames[frameID].Spec; spec != nil && len(skeletonGroups(spec)) > 0 {
			res, err := r.fill(ctx, s, t, frameID, true, nil)
			if err != nil {
				return reply{}, err
			}
			out += "\n" + res.Summary()
		}
	}
	if frameID == "" {
		return reply{text: out, meta: map[string]any{"tools": toolSummary(es.calls)}}, nil
	}
	rep := r.withNext(s, frameID, out)
	rep.meta["tools"] = toolSummary(es.calls)
	return rep, nil
}

// toolSummary groups successful tool calls by tool, keeping first-seen order, e.g.
// {"tool": "update_props", "targets": ["hero"], "count": 2}.
func toolSummary(calls []string) []map[string]any {
	out := []map[string]any{}
	idx := map[string]int{}
	for _, c := range calls {
		tool, target, _ := strings.Cut(c, " ")
		i, ok := idx[tool]
		if !ok {
			i = len(out)
			idx[tool] = i
			out = append(out, map[string]any{"tool": tool, "targets": []string{}, "count": 0})
		}
		out[i]["count"] = out[i]["count"].(int) + 1
		if t := out[i]["targets"].([]string); target != "" && !slices.Contains(t, target) {
			out[i]["targets"] = append(t, target)
		}
	}
	return out
}

// editContext builds the user message: selection subtree, frame outline, theme and the last 10 chat turns.
func (r *Runner) editContext(ctx context.Context, s *hub.Session, p *doc.Project, frame *doc.Frame, req ChatRequest) (string, error) {
	history, err := s.History(ctx, 21)
	if err != nil {
		return "", err
	}
	// The current request is already the last stored message.
	if n := len(history); n > 0 && history[n-1].Role == "user" && history[n-1].Text == req.Text {
		history = history[:n-1]
	}
	var turns []map[string]string
	for _, m := range history[max(0, len(history)-20):] {
		turns = append(turns, map[string]string{"role": m.Role, "text": truncate(m.Text, 300)})
	}
	frames := []map[string]string{}
	for _, id := range p.FrameOrder {
		frames = append(frames, map[string]string{"id": id, "name": p.Frames[id].Name, "device": p.Frames[id].Device})
	}
	c := map[string]any{
		"request":      req.Text,
		"theme":        p.Theme,
		"frames":       frames,
		"chat_history": turns,
	}
	if frame != nil && frame.Spec != nil {
		c["current_frame"] = map[string]any{"id": frame.ID, "name": frame.Name, "root": frame.Spec.Root, "outline": frame.Spec.Outline()}
		if len(req.Comments) > 0 {
			var items []map[string]any
			for i, cm := range req.Comments {
				if el := frame.Spec.Elements[cm.ElementID]; el != nil {
					items = append(items, map[string]any{"n": i + 1, "comment": cm.Text, "element_id": cm.ElementID, "type": el.Type,
						"subtree": frame.Spec.SubtreeSpec(cm.ElementID)})
				}
			}
			c["comments"] = items
			c["hard_scope"] = "Change ONLY the commented elements and their children. Do not modify sibling blocks, other frames, the page order or the theme. Address every comment."
		} else if el := frame.Spec.Elements[req.ElementID]; el != nil {
			c["selected"] = map[string]any{"id": req.ElementID, "type": el.Type, "subtree": frame.Spec.SubtreeSpec(req.ElementID)}
		} else {
			c["selected"] = "nothing selected; the request applies to the whole frame"
		}
	} else {
		c["current_frame"] = "none selected"
	}
	b, err := json.Marshal(c)
	return string(b), err
}
