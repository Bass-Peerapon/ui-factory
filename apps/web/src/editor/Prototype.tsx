import { DEVICES } from "@ui-factory/catalog";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { FRAME_MSG, type ToFrame } from "../shared/protocol";
import { setState, useEditor } from "./store";

/** Clickable prototype: renders one frame in prototype mode; `navigate` actions switch frames. */
export function Prototype() {
  const frameId = useEditor((s) => s.prototypeFrame);
  const frame = useEditor((s) => (frameId ? s.doc?.frames[frameId] : undefined));
  const theme = useEditor((s) => s.doc?.theme);
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setState({ prototypeFrame: null });
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const send = () => {
      if (!frame || !theme) return;
      const msg: ToFrame = { type: "render", spec: frame.spec, theme, mode: "prototype", selectedId: null };
      ref.current?.contentWindow?.postMessage({ [FRAME_MSG]: msg }, "*");
    };
    send();
    const onMsg = (e: MessageEvent) => e.data?.[FRAME_MSG]?.type === "ready" && e.source === ref.current?.contentWindow && send();
    addEventListener("message", onMsg);
    return () => removeEventListener("message", onMsg);
  }, [frame, theme]);

  if (!frameId) return null;
  if (!frame) return null;
  const width = DEVICES[frame.device].width;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm">
      <div className="flex h-11 items-center gap-3 px-4 text-white">
        <strong>Prototype</strong>
        <span className="opacity-70">{frame.name} · {DEVICES[frame.device].label}</span>
        <span className="text-[12px] opacity-50">ปุ่มที่ตั้ง “เมื่อกด” ไว้จะพาไปเฟรมอื่น · Esc เพื่อปิด</span>
        <button className="icon-btn ml-auto !text-white" onClick={() => setState({ prototypeFrame: null })}><X size={18} /></button>
      </div>
      <div className="flex min-h-0 flex-1 justify-center overflow-auto pb-6">
        <iframe
          key={frame.id}
          ref={ref}
          title="prototype"
          src={`/frame.html?f=${encodeURIComponent(frame.id)}&proto=1`}
          className="rounded-md bg-white shadow-2xl"
          style={{ width: Math.min(width, innerWidth - 32), height: "100%", border: 0 }}
        />
      </div>
    </div>
  );
}
