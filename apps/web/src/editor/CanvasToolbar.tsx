import { DEVICES, type Device } from "@ui-factory/catalog";
import { useReactFlow, useStore } from "@xyflow/react";
import { ChevronDown, History, Link2, Maximize, MessageCircle, MousePointer2 } from "lucide-react";
import { useEffect, useState } from "react";
import { runOp } from "./api";
import { deviceIcon } from "./icons";
import { getState, setState, useEditor } from "./store";

const zoomSteps = [0.25, 0.5, 0.75, 1];

export function CanvasToolbar() {
  const mode = useEditor((s) => s.canvasMode);
  const versionsOpen = useEditor((s) => s.versionsOpen);
  const doc = useEditor((s) => s.doc);
  const zoom = useStore((s) => s.transform[2]);
  const { fitView, zoomTo } = useReactFlow();
  const [zoomMenu, setZoomMenu] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.tagName === "SELECT" || t.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "c") setState({ canvasMode: getState().canvasMode === "comment" ? "select" : "comment" });
      if (e.key === "v" || e.key === "Escape") setState({ canvasMode: "select", commentDraft: null });
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const addFrame = (device: Device) => void runOp("create_frame", { name: `Frame ${(doc?.frameOrder.length ?? 0) + 1}`, device });
  const commenting = mode === "comment";
  return (
    <div className="glass absolute top-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-2xl p-1.5">
      <button className={`icon-btn !size-9 ${mode === "select" ? "is-on" : ""}`} title="เลือก (V)" onClick={() => setState({ canvasMode: "select" })}>
        <MousePointer2 size={17} fill={mode === "select" ? "currentColor" : "none"} />
      </button>
      <span className="relative">
        <button
          className={`icon-btn !size-9 ${commenting ? "is-warn" : ""}`}
          title="คอมเมนต์บน element (C)"
          onClick={() => setState({ canvasMode: commenting ? "select" : "comment" })}
        >
          <MessageCircle size={17} />
        </button>
        {commenting && <span className="kbd absolute -bottom-6 left-1/2 -translate-x-1/2 !bg-[var(--ed-strong)] !text-[var(--ed-panel)]">C</span>}
      </span>
      <span className="divider-v mx-1" />
      {(Object.keys(DEVICES) as Device[]).map((d) => {
        const Icon = deviceIcon[d];
        return (
          <button key={d} className="icon-btn !size-9" title={`เพิ่มเฟรม ${DEVICES[d].label}`} onClick={() => addFrame(d)} disabled={!doc}>
            <Icon size={17} />
          </button>
        );
      })}
      <span className="divider-v mx-1" />
      <button className="icon-btn !size-9" title="พอดีจอ" onClick={() => void fitView({ padding: 0.15, duration: 400 })}>
        <Maximize size={17} />
      </button>
      <button className={`icon-btn !size-9 ${versionsOpen ? "is-on" : ""}`} title="Version history" onClick={() => setState({ versionsOpen: !versionsOpen })}>
        <History size={17} />
      </button>
      <span className="divider-v mx-1" />
      <span className="relative">
        <button className="btn btn-ghost btn-sm !h-9 w-[76px] !justify-between tabular-nums" onClick={() => setZoomMenu(!zoomMenu)} title="Zoom">
          {Math.round(zoom * 100)}% <ChevronDown size={14} />
        </button>
        {zoomMenu && (
          <div className="popover absolute top-11 right-0 w-36 p-1" onMouseLeave={() => setZoomMenu(false)}>
            {zoomSteps.map((z) => (
              <button key={z} className="layer w-full border-0 bg-transparent px-2.5 text-left" onClick={() => (void zoomTo(z, { duration: 250 }), setZoomMenu(false))}>
                {z * 100}%
              </button>
            ))}
            <button className="layer w-full border-0 bg-transparent px-2.5 text-left" onClick={() => (void fitView({ padding: 0.15, duration: 400 }), setZoomMenu(false))}>
              พอดีจอ
            </button>
          </div>
        )}
      </span>
    </div>
  );
}

/** Count of prototype links between frames, shown on the canvas when a flow exists. */
export function LinkCount({ count }: { count: number }) {
  const commenting = useEditor((s) => s.canvasMode === "comment");
  if (count === 0 || commenting) return null;
  return (
    <div className="glass absolute right-4 bottom-4 z-10 flex h-10 items-center gap-2 rounded-xl px-3.5 text-[13px] font-medium text-[var(--ed-brand-ink)]">
      <Link2 size={15} /> {count} prototype links
    </div>
  );
}
