import { DEVICES } from "@ui-factory/catalog";
import { useStore, type Node, type NodeProps } from "@xyflow/react";
import { Loader2, Lock, Monitor, Smartphone, Tablet } from "lucide-react";
import { memo, useEffect, useRef } from "react";
import { FRAME_MSG, type ToFrame } from "../shared/protocol";
import type { Frame } from "../shared/doc";
import { setState, useEditor } from "./store";

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
  const thumb = useEditor((s) => s.thumbnails[data.frameId]);
  const rawHeight = useEditor((s) => s.heights[data.frameId]);
  const height = frameHeight(rawHeight);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const onScreen = useOnScreen(frame, height);
  const active = selection.frameId === data.frameId;
  const locked = turn?.frameId === data.frameId;

  const send = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win || !frame || !theme) return;
    const msg: ToFrame = {
      type: "render", spec: frame.spec, theme, locale, mode: "edit", selectedId: active ? selection.elementId : null,
    };
    win.postMessage({ [FRAME_MSG]: msg }, "*");
  };

  useEffect(send, [frame?.spec, theme, locale, active, selection.elementId, onScreen]);
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

  return (
    <div className={`frame-node ${active ? "is-active" : ""}`} style={{ width }}>
      <div className="frame-header frame-drag">
        <Icon size={14} />
        <span className="frame-name">{frame.name}</span>
        <span className="frame-device">{DEVICES[frame.device].label} · {width}px</span>
        {locked && (
          <span className="frame-lock">
            <Lock size={12} /> AI กำลังทำงาน
          </span>
        )}
      </div>
      <div className="frame-body" style={{ height }}>
        {onScreen ? (
          <iframe
            ref={iframeRef}
            title={frame.name}
            src={`/frame.html?f=${encodeURIComponent(frame.id)}`}
            style={{ width, height, pointerEvents: active && !locked ? "auto" : "none" }}
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
        {!active && (
          <div
            className="frame-click-catcher"
            onClick={() => setState({ selection: { frameId: data.frameId, elementId: null } })}
          />
        )}
        {locked && <div className="frame-lock-overlay" />}
      </div>
    </div>
  );
});
