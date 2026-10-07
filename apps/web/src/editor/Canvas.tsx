import { Background, MarkerType, ReactFlow, useReactFlow, type Edge, type NodeChange, applyNodeChanges } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, useState } from "react";
import { FRAME_MSG, type FromFrame } from "../shared/protocol";
import { runOp } from "./api";
import { LinkCount } from "./CanvasToolbar";
import { FlowEdge } from "./FlowEdge";
import { FRAME_HEADER, FrameNode, frameHeight, frameWindows, type FrameNodeType } from "./FrameNode";
import { getState, setState, useEditor } from "./store";

const nodeTypes = { frame: FrameNode };
const edgeTypes = { flow: FlowEdge };

export function Canvas() {
  const doc = useEditor((s) => s.doc);
  const heights = useEditor((s) => s.heights);
  const focusFrame = useEditor((s) => s.focusFrame);
  const { fitView } = useReactFlow();
  const [dragging, setDragging] = useState<Record<string, { x: number; y: number }>>({});

  const nodes = useMemo<FrameNodeType[]>(
    () =>
      (doc?.frameOrder ?? []).flatMap((id) => {
        const f = doc!.frames[id];
        if (!f) return [];
        const pos = dragging[id] ?? { x: f.x, y: f.y };
        return [{
          id, type: "frame", position: pos, data: { frameId: id }, dragHandle: ".frame-drag",
          style: { height: frameHeight(heights[id]) + FRAME_HEADER },
        }];
      }),
    [doc, dragging, heights],
  );

  // Prototype links between frames become edges labeled with the button text.
  const edges = useMemo<Edge[]>(() => {
    if (!doc) return [];
    const out: Edge[] = [];
    const seen = new Set<string>();
    for (const id of doc.frameOrder) {
      const sp = doc.frames[id]?.spec;
      for (const el of Object.values(sp?.elements ?? {})) {
        const press = (el as { on?: { press?: { action?: string; params?: { frameId?: string } } } }).on?.press;
        const target = press?.action === "navigate" ? press.params?.frameId : undefined;
        if (!target || !doc.frames[target] || seen.has(id + target)) continue;
        seen.add(id + target);
        out.push({
          id: `${id}->${target}`, source: id, target, type: "flow", animated: true,
          label: String((el.props as { label?: string }).label ?? ""),
          markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: "var(--ed-brand)" },
        });
      }
    }
    return out;
  }, [doc]);

  useEffect(() => {
    if (!focusFrame || !nodes.some((n) => n.id === focusFrame)) return;
    const t = setTimeout(() => {
      void fitView({ nodes: [{ id: focusFrame }], duration: 500, padding: 0.1, maxZoom: 0.6 });
      setState({ focusFrame: null });
    }, 50);
    return () => clearTimeout(t);
  }, [focusFrame, nodes, fitView]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const m = e.data?.[FRAME_MSG] as FromFrame | undefined;
      if (!m) return;
      switch (m.type) {
        case "ready": {
          const w = frameWindows.get(m.frameId) as (Window & { __send?: () => void }) | undefined;
          w?.__send?.();
          break;
        }
        case "select":
          setState({ selection: { frameId: m.frameId, elementId: m.id } });
          break;
        case "comment-target":
          setState({
            selection: { frameId: m.frameId, elementId: m.id },
            commentDraft: { frameId: m.frameId, elementId: m.id, elementType: m.elementType, rect: m.rect },
          });
          break;
        case "height":
          if (getState().heights[m.frameId] !== m.height)
            setState((s) => ({ heights: { ...s.heights, [m.frameId]: m.height } }));
          break;
        case "thumbnail":
          setState((s) => ({ thumbnails: { ...s.thumbnails, [m.frameId]: m.dataUrl } }));
          break;
        case "navigate":
          setState({ prototypeFrame: m.target });
          break;
      }
    };
    addEventListener("message", onMsg);
    return () => removeEventListener("message", onMsg);
  }, []);

  const onNodesChange = (changes: NodeChange<FrameNodeType>[]) => {
    for (const c of changes) {
      if (c.type !== "position" || !c.position) continue;
      if (c.dragging) {
        setDragging((d) => ({ ...d, [c.id]: c.position! }));
      } else {
        const p = dragging[c.id] ?? c.position;
        void runOp("update_frame", { frameId: c.id, x: Math.round(p.x), y: Math.round(p.y) }).finally(() =>
          setDragging((d) => {
            const { [c.id]: _, ...rest } = d;
            return rest;
          }),
        );
      }
    }
    applyNodeChanges(changes, nodes);
  };

  return (
    <>
    <LinkCount count={edges.length} />
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onPaneClick={() => setState({ selection: { frameId: null, elementId: null }, commentDraft: null })}
      minZoom={0.05}
      maxZoom={2}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      proOptions={{ hideAttribution: true }}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnScroll
      zoomOnPinch
    >
      <Background gap={22} size={1.6} />
    </ReactFlow>
    </>
  );
}
