import { JSONUIProvider, Renderer } from "@json-render/react";
import { themePresets, type Spec, type Theme } from "@ui-factory/catalog";
import { toJpeg } from "html-to-image";
import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { FRAME_MSG, type FromFrame, type ToFrame } from "../shared/protocol";
import "./frame.css";
import { registry, tagSpec } from "./registry";
import { applyTheme } from "./theme";

const frameId = new URLSearchParams(location.search).get("f") ?? "";
const post = (m: FromFrame) => parent.postMessage({ [FRAME_MSG]: m }, "*");

function App() {
  const [msg, setMsg] = useState<ToFrame>({
    type: "render", spec: null, theme: themePresets.neutral, mode: "edit", selectedId: null,
  });

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const m = e.data?.[FRAME_MSG] as ToFrame | undefined;
      if (m?.type === "render") setMsg(m);
    };
    addEventListener("message", onMsg);
    post({ type: "ready", frameId });
    return () => removeEventListener("message", onMsg);
  }, []);

  useEffect(() => applyTheme(msg.theme as Theme), [msg.theme]);
  useEffect(() => {
    document.body.classList.toggle("mode-edit", msg.mode === "edit");
  }, [msg.mode]);

  // Selection highlight
  useEffect(() => {
    document.querySelectorAll(".is-selected").forEach((n) => n.classList.remove("is-selected"));
    if (msg.selectedId) document.querySelector(`[data-el-id="${CSS.escape(msg.selectedId)}"]`)?.classList.add("is-selected");
  });

  // Click to select in edit mode
  useEffect(() => {
    if (msg.mode !== "edit") return;
    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const el = (e.target as HTMLElement).closest("[data-el-id]");
      post({ type: "select", frameId, id: el?.getAttribute("data-el-id") ?? null });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [msg.mode]);

  // Report content height and a thumbnail after changes settle
  useEffect(() => {
    const ro = new ResizeObserver(() => post({ type: "height", frameId, height: document.body.scrollHeight }));
    ro.observe(document.body);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (msg.mode !== "edit" || !msg.spec) return;
    const t = setTimeout(async () => {
      try {
        const w = document.documentElement.clientWidth;
        const dataUrl = await toJpeg(document.body, {
          quality: 0.7, pixelRatio: Math.min(1, 480 / w), cacheBust: false, skipFonts: true,
          height: Math.min(document.body.scrollHeight, 4000),
        });
        post({ type: "thumbnail", frameId, dataUrl });
      } catch {
        /* thumbnail is best effort */
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [msg.spec, msg.theme, msg.mode]);

  const spec = useMemo(() => (msg.spec ? tagSpec(msg.spec as Spec) : null), [msg.spec]);
  const handlers = useMemo(
    () => ({
      navigate: (p: Record<string, unknown>) => post({ type: "navigate", frameId, target: String(p.frameId) }),
    }),
    [],
  );

  if (!spec) return null;
  return (
    <JSONUIProvider key={msg.mode} registry={registry} initialState={spec.state ?? {}} handlers={handlers}>
      <Renderer spec={spec} registry={registry} />
    </JSONUIProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
