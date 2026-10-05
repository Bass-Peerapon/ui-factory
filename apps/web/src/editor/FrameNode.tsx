import { DEVICES } from "@ui-factory/catalog";
import { Handle, Position, useStore, type Node, type NodeProps } from "@xyflow/react";
import { Loader2, Monitor, Smartphone, Tablet } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { FRAME_MSG, type ToFrame } from "../shared/protocol";
import type { Frame } from "../shared/doc";
import { setState, useEditor, type EditorState } from "./store";

export type FrameNodeData = { frameId: string };
export type FrameNodeType = Node<FrameNodeData, "frame">;

const deviceIcon = { desktop: Monitor, tablet: Tablet, mobile: Smartphone };
export const MIN_FRAME_HEIGHT = 720;
const HEADER = 32;

/** Registry of live iframes so the canvas can route postMessage traffic. */
export const frameWindows = new Map<string, Window>();

export function frameHeight(h: number | undefined) {
  return Math.min(Math.max(h ?? MIN_FRAME_HEIGHT, MIN_FRAME_HEIGHT), 8000);
}

function useOnScreen(frame: Frame | undefined, height: number) {
  return useStore((s) => {
    if (!frame) return false;
    const [tx, ty, zoom] = s.transform;
    const w = DEVICES[frame.device].width;
    const x0 = frame.x * zoom + tx, y0 = frame.y * zoom + ty;
    const x1 = x0 + w * zoom, y1 = y0 + (height + HEADER) * zoom;
    const margin = 200;
    return x1 > -margin && y1 > -margin && x0 < s.width + margin && y0 < s.height + margin;
  });
}

export const FrameNode = memo(function FrameNode({ data }: NodeProps<FrameNodeType>) {
  const frame = useEditor((s) => s.doc?.frames[data.frameId]);
  const theme = useEditor((s) => s.doc?.theme);
  const locale = useEditor((s) => s.doc?.locale ?? "th");
  const selection = useEditor((s) => s.selection);
  const turn = useEditor((s) => s.turn);
  const canvasMode = useEditor((s) => s.canvasMode);
  const comments = useEditor((s) => s.comments);
  const draft = useEditor((s) => (s.commentDraft?.frameId === data.frameId ? s.commentDraft : null));
  const thumb = useEditor((s) => s.thumbnails[data.frameId]);
  const rawHeight = useEditor((s) => s.heights[data.frameId]);
  const zoom = useStore((s) => s.transform[2]);
  const height = frameHeight(rawHeight);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const onScreen = useOnScreen(frame, height);
  const active = selection.frameId === data.frameId;
  const locked = !!turn && (!turn.frameId || turn.frameId === data.frameId);
  const commenting = canvasMode === "comment";
  const pins = comments.flatMap((c, i) => (c.frameId === data.frameId ? [{ elementId: c.elementId, n: i + 1 }] : []));
  const pinKey = pins.map((p) => `${p.elementId}:${p.n}`).join(",");
  const activeStep = turn?.steps?.find((s) => s.status === "active");

  const send = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win || !frame || !theme) return;
    const msg: ToFrame = {
      type: "render", spec: frame.spec, theme, locale, pins,
      mode: commenting ? "comment" : "edit",
      selectedId: active && !commenting ? selection.elementId : null,
    };
    win.postMessage({ [FRAME_MSG]: msg }, "*");
  };

  useEffect(send, [frame?.spec, theme, locale, active, selection.elementId, onScreen, commenting, pinKey]);
  useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    frameWindows.set(data.frameId, win);
    // re-send once the iframe reports ready
    (win as Window & { __send?: () => void }).__send = send;
    return () => void frameWindows.delete(data.frameId);
  });

  if (!frame) return null;
  const width = DEVICES[frame.device].width;
  const Icon = deviceIcon[frame.device];
  const interactive = !locked && (active || commenting);

  return (
    <div className={`frame-node ${active ? "is-active" : ""}`} style={{ width }}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="frame-header frame-drag">
        <Icon size={14} />
        <span className="frame-name">{frame.name}</span>
        {frame.flow && <span className="frame-flow">{frame.flow}</span>}
        <span className="frame-device">{DEVICES[frame.device].label} · {width}px</span>
        {locked && (
          <span className="frame-lock">
            <Loader2 size={12} className="spin" /> {activeStep ? `${activeStep.label}${activeStep.detail ? ` · ${activeStep.detail}` : ""}` : "AI กำลังทำงาน"}
          </span>
        )}
      </div>
      <div className="frame-body" style={{ height }}>
        {onScreen ? (
          <iframe
            ref={iframeRef}
            title={frame.name}
            src={`/frame.html?f=${encodeURIComponent(frame.id)}`}
            style={{ width, height, pointerEvents: interactive ? "auto" : "none" }}
          />
        ) : thumb ? (
          <img src={thumb} alt={frame.name} style={{ width, height: "auto" }} draggable={false} />
        ) : (
          <div className="frame-placeholder" />
        )}
        {!frame.spec && (
          <div className="frame-empty">
            {locked ? <Loader2 className="spin" size={20} /> : "เฟรมว่าง พิมพ์คำสั่งในแชทเพื่อสร้างหน้า"}
          </div>
        )}
        {!active && !commenting && (
          <div
            className="frame-click-catcher"
            onClick={() => setState({ selection: { frameId: data.frameId, elementId: null } })}
          />
        )}
        {locked && <div className="frame-lock-overlay" />}
        {draft && <CommentPopover draft={draft} zoom={zoom} />}
      </div>
    </div>
  );
});

/** Comment input anchored under the picked element; counter-scaled so it stays readable at any zoom. */
function CommentPopover({ draft, zoom }: { draft: NonNullable<EditorState["commentDraft"]>; zoom: number }) {
  const [text, setText] = useState("");
  const add = () => {
    if (!text.trim()) return;
    setState((s) => ({
      comments: [
        ...s.comments,
        { id: crypto.randomUUID(), frameId: draft.frameId, elementId: draft.elementId, elementType: draft.elementType, text: text.trim() },
      ],
      commentDraft: null,
    }));
  };
  return (
    <div
      className="comment-pop nodrag nowheel"
      style={{ left: draft.rect.x, top: draft.rect.y + draft.rect.h + 8, transform: `scale(${1 / zoom})` }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="glass w-72 rounded-xl p-2.5">
        <div className="mb-1.5 text-[11.5px] font-semibold text-[var(--ed-muted)]">คอมเมนต์ที่ {draft.elementType}</div>
        <textarea
          autoFocus
          rows={2}
          className="field"
          placeholder="อยากให้แก้อะไรตรงนี้"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              add();
            }
            if (e.key === "Escape") setState({ commentDraft: null });
          }}
        />
        <div className="mt-2 flex justify-end gap-1.5">
          <button className="btn btn-sm btn-ghost" onClick={() => setState({ commentDraft: null })}>ยกเลิก</button>
          <button className="btn btn-sm btn-primary" onClick={add} disabled={!text.trim()}>เพิ่มคอมเมนต์</button>
        </div>
      </div>
    </div>
  );
}
