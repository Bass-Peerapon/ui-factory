import { DEVICES, type Device } from "@ui-factory/catalog";
import { useReactFlow } from "@xyflow/react";
import { History, Maximize, MessageSquarePlus, Monitor, MousePointer2, Smartphone, Tablet } from "lucide-react";
import { useEffect } from "react";
import { runOp } from "./api";
import { getState, setState, useEditor } from "./store";

const deviceIcon = { desktop: Monitor, tablet: Tablet, mobile: Smartphone };

export function CanvasToolbar() {
  const mode = useEditor((s) => s.canvasMode);
  const versionsOpen = useEditor((s) => s.versionsOpen);
  const doc = useEditor((s) => s.doc);
  const { fitView } = useReactFlow();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable) return;
      if (e.key === "c") setState({ canvasMode: getState().canvasMode === "comment" ? "select" : "comment" });
      if (e.key === "v" || e.key === "Escape") setState({ canvasMode: "select", commentDraft: null });
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const addFrame = (device: Device) => void runOp("create_frame", { name: `Frame ${(doc?.frameOrder.length ?? 0) + 1}`, device });
  return (
    <div className="glass absolute top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-xl p-1">
      <button className={`icon-btn ${mode === "select" ? "is-on" : ""}`} title="เลือก (V)" onClick={() => setState({ canvasMode: "select" })}>
        <MousePointer2 size={15} />
      </button>
      <button className={`icon-btn ${mode === "comment" ? "is-on" : ""}`} title="คอมเมนต์บน element (C)" onClick={() => setState({ canvasMode: "comment" })}>
        <MessageSquarePlus size={15} />
      </button>
      <span className="mx-1 h-5 w-px bg-[var(--ed-border)]" />
      {(Object.keys(DEVICES) as Device[]).map((d) => {
        const Icon = deviceIcon[d];
        return (
          <button key={d} className="icon-btn" title={`เพิ่มเฟรม ${DEVICES[d].label}`} onClick={() => addFrame(d)} disabled={!doc}>
            <Icon size={15} />
          </button>
        );
      })}
      <span className="mx-1 h-5 w-px bg-[var(--ed-border)]" />
      <button className="icon-btn" title="พอดีจอ" onClick={() => void fitView({ padding: 0.15, duration: 400 })}>
        <Maximize size={15} />
      </button>
      <button className={`icon-btn ${versionsOpen ? "is-on" : ""}`} title="Version history" onClick={() => setState({ versionsOpen: !versionsOpen })}>
        <History size={15} />
      </button>
    </div>
  );
}
