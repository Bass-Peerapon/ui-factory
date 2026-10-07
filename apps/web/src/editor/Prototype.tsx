import { DEVICES, type Device } from "@ui-factory/catalog";
import { ArrowRight, ChevronLeft, ChevronRight, Info, Lightbulb, Link2, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FRAME_MSG, type ToFrame } from "../shared/protocol";
import { deviceIcon } from "./icons";
import { Logo } from "./TopBar";
import { getState, setState, useEditor } from "./store";

const screenHeight: Record<Device, number> = { desktop: 800, tablet: 1024, mobile: 844 };
const BEZEL = 12;

type Press = { action?: string; params?: { frameId?: string } };

/** Clickable prototype: renders one frame in prototype mode; `navigate` actions switch frames. */
export function Prototype() {
  const frameId = useEditor((s) => s.prototypeFrame);
  const doc = useEditor((s) => s.doc);
  const thumbs = useEditor((s) => s.thumbnails);
  const frame = frameId ? doc?.frames[frameId] : undefined;
  const ref = useRef<HTMLIFrameElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(true);
  const [area, setArea] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!getState().prototypeFrame) return;
      if (e.key === "Escape") setState({ prototypeFrame: null });
      if (e.key === "r" || e.key === "R") restart();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    const send = () => {
      if (!frame || !doc) return;
      const msg: ToFrame = { type: "render", spec: frame.spec, theme: doc.theme, locale: doc.locale, mode: "prototype", selectedId: null, pins: [] };
      ref.current?.contentWindow?.postMessage({ [FRAME_MSG]: msg }, "*");
    };
    send();
    const onMsg = (e: MessageEvent) => e.data?.[FRAME_MSG]?.type === "ready" && e.source === ref.current?.contentWindow && send();
    addEventListener("message", onMsg);
    return () => removeEventListener("message", onMsg);
  }, [frame, doc?.theme, doc?.locale]);

  useLayoutEffect(() => {
    if (!stage.current) return;
    const ro = new ResizeObserver(([e]) => setArea({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(stage.current);
    return () => ro.disconnect();
  }, [frameId]);

  if (!frameId || !frame || !doc) return null;

  // Frames of the same flow, in canvas order; a standalone frame shows every frame.
  const order = doc.frameOrder.filter((id) => doc.frames[id] && (!frame.flow || doc.frames[id].flow === frame.flow));
  const idx = order.indexOf(frame.id);
  const go = (id: string | undefined) => id && setState({ prototypeFrame: id });
  function step(d: number) {
    go(order[idx + d]);
  }
  function restart() {
    go(order[0]);
  }
  const links = Object.entries(frame.spec?.elements ?? {}).flatMap(([id, el]) => {
    const press = (el as { on?: { press?: Press } }).on?.press;
    const target = press?.action === "navigate" ? press.params?.frameId : undefined;
    return target && doc.frames[target] ? [{ id, label: String((el.props as { label?: string }).label ?? el.type), target }] : [];
  });
  const next = links[0]?.target ?? order[idx + 1];

  const width = DEVICES[frame.device].width;
  const height = screenHeight[frame.device];
  const mobile = frame.device === "mobile";
  const outerW = width + BEZEL * 2, outerH = height + BEZEL * 2;
  const scale = fit ? Math.min(1, (area.w - 32) / outerW, (area.h - 32) / outerH) : 1;
  const Icon = deviceIcon[frame.device];

  return (
    <div className="proto">
      <div className="proto-bar">
        <span className="flex items-center gap-2.5 text-[16px] font-semibold text-white"><Logo size={26} /> UI Factory</span>
        <span className="h-5 w-px bg-white/15" />
        <span className="font-semibold text-white">Prototype</span>
        <span className="h-5 w-px bg-white/15" />
        <span className="max-w-48 truncate text-[13px] text-white/60">{doc.name}{frame.flow ? ` — ${frame.flow}` : ""}</span>
        <div className="mx-auto flex items-center gap-2">
          <select className="proto-select" value={frame.id} onChange={(e) => go(e.target.value)}>
            {order.map((id) => <option key={id} value={id}>{doc.frames[id].name} · {DEVICES[doc.frames[id].device].label}</option>)}
          </select>
          <span className="proto-btn tabular-nums"><Icon size={15} /> {width} × {height}</span>
          <select className="proto-select" value={fit ? "fit" : "100"} onChange={(e) => setFit(e.target.value === "fit")}>
            <option value="fit">Fit</option>
            <option value="100">100%</option>
          </select>
          <span className="flex">
            <button className="proto-btn !rounded-r-none" disabled={idx <= 0} onClick={() => step(-1)} title="ก่อนหน้า (←)"><ChevronLeft size={16} /></button>
            <button className="proto-btn !rounded-l-none border-l-0" disabled={idx >= order.length - 1} onClick={() => step(1)} title="ถัดไป (→)"><ChevronRight size={16} /></button>
          </span>
        </div>
        <span className="hidden text-[12px] text-white/50 xl:inline">ปุ่มที่ตั้ง “เมื่อกด” ไว้จะพาไปเฟรมอื่น · Esc เพื่อปิด</span>
        <button className="proto-btn !px-2" onClick={() => setState({ prototypeFrame: null })} title="ปิด (Esc)"><X size={17} /></button>
      </div>

      <div className="flex min-h-0 flex-1 gap-5 p-5">
        <aside className="proto-panel flex w-72 shrink-0 flex-col p-4">
          <div className="mb-3 flex items-center font-semibold text-white">
            Frames <span className="ml-auto grid size-6 place-items-center rounded-full bg-white/10 text-[12px]">{order.length}</span>
          </div>
          <div className="min-h-0 flex-1 space-y-2.5 overflow-auto">
            {order.map((id, i) => {
              const f = doc.frames[id];
              return (
                <button key={id} className={`proto-frame ${id === frame.id ? "is-on" : ""}`} onClick={() => go(id)}>
                  <span className="h-[72px] w-12 shrink-0 overflow-hidden rounded-md bg-white">
                    {thumbs[id] && <img src={thumbs[id]} alt="" className="w-full" draggable={false} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-white">{/^\d/.test(f.name) ? f.name : `${i + 1}. ${f.name}`}</span>
                    <span className="text-[12px] text-white/50">{DEVICES[f.device].label} · {DEVICES[f.device].width}px</span>
                  </span>
                  <span className={`size-4 shrink-0 rounded-full border-2 ${id === frame.id ? "border-[var(--ed-brand)] bg-[radial-gradient(#fff_35%,transparent_40%)]" : "border-white/30"}`} />
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2 text-[12px] text-white/50"><Info size={14} /> คลิกเฟรมเพื่อเปิดโดยตรง</div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col items-center">
          <div ref={stage} className="relative min-h-0 w-full flex-1 overflow-auto">
            <div className="absolute top-1/2 left-1/2" style={{ width: outerW * scale, height: outerH * scale, transform: "translate(-50%, -50%)" }}>
              <div
                className={mobile ? "device" : "rounded-2xl bg-[#0b0b10] shadow-[0_0_0_1px_#3a3a46,0_40px_80px_rgb(0_0_0/.55)]"}
                style={{ width: outerW, height: outerH, padding: BEZEL, transform: `scale(${scale})`, transformOrigin: "top left", boxSizing: "border-box" }}
              >
                {mobile && <span className="device-notch" />}
                <div className={mobile ? "device-screen" : "overflow-hidden rounded-lg bg-white"} style={{ width, height }}>
                  <iframe
                    key={frame.id}
                    ref={ref}
                    title="prototype"
                    src={`/frame.html?f=${encodeURIComponent(frame.id)}&proto=1`}
                    style={{ width, height, border: 0, display: "block" }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <button className="proto-btn !h-11 !w-14 justify-center" disabled={idx <= 0} onClick={() => step(-1)}><ChevronLeft size={18} /></button>
            <span className="w-14 text-center font-semibold text-white tabular-nums">{idx + 1} / {order.length}</span>
            <button className="proto-btn is-primary !h-11 !px-6" disabled={!next} onClick={() => go(next)}>
              {next ? doc.frames[next].name : "จบ flow"} <ArrowRight size={16} />
            </button>
          </div>
          <span className="mt-3 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12.5px]">
            <span className="size-2 rounded-full bg-[var(--ed-ok)]" /> Interactive
          </span>
        </div>

        <aside className="proto-panel h-fit w-72 shrink-0 p-4">
          <div className="mb-3 font-semibold text-white">Interactions</div>
          {links.length === 0 && <div className="text-[12.5px] text-white/50">ยังไม่มีปุ่มที่ลิงก์ไปเฟรมอื่น ตั้งได้ที่ Inspector “เมื่อกด”</div>}
          <div className="space-y-2">
            {links.map((l) => (
              <button key={l.id} className="proto-frame !py-2.5" onClick={() => go(l.target)}>
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/8 text-[#b9b0ff]"><Link2 size={15} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-white">{l.label}</span>
                  <span className="block truncate text-[12px] text-white/50">Navigate to {doc.frames[l.target].name}</span>
                </span>
                <span className="rounded-full border border-[var(--ed-brand)] px-2 py-0.5 text-[11px] text-[#b9b0ff]">On press</span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3 text-[12.5px] text-white/60">
            <Lightbulb size={15} /> กด <span className="kbd !border-white/20 !bg-white/10 !text-white">R</span> เพื่อเริ่มใหม่
          </div>
        </aside>
      </div>
    </div>
  );
}
