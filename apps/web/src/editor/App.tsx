import { ReactFlowProvider } from "@xyflow/react";
import { useEffect, useState } from "react";
import { api, openProject } from "./api";
import { Canvas } from "./Canvas";
import { CanvasToolbar } from "./CanvasToolbar";
import { Inspector } from "./Inspector";
import { LeftColumn } from "./LeftColumn";
import { Prototype } from "./Prototype";
import { TopBar } from "./TopBar";
import { VersionsPanel } from "./VersionsPanel";
import { useEditor } from "./store";

export function App() {
  const doc = useEditor((s) => s.doc);
  const hasSelection = useEditor((s) => !!s.selection.frameId);
  const mode = useEditor((s) => s.canvasMode);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const wanted = new URLSearchParams(location.search).get("p");
      const list = await api.list();
      const id = wanted && list.some((p) => p.id === wanted) ? wanted : list[0]?.id ?? (await api.create("โปรเจกต์แรก")).doc.id;
      await openProject(id);
    })().catch((e) => setBootError(`เชื่อมต่อ API ไม่ได้: ${(e as Error).message}`));
  }, []);

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <LeftColumn />
        <ReactFlowProvider>
          <main className={`relative min-w-0 flex-1 ${mode === "comment" ? "cursor-crosshair" : ""}`}>
            {doc ? (
              <>
                <Canvas key={doc.id} />
                <CanvasToolbar />
                <VersionsPanel />
                {mode === "comment" && (
                  <div className="glass absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full px-4 py-1.5 text-[12.5px]">
                    โหมดคอมเมนต์: คลิก element บนเฟรมเพื่อปักหมุด · กด V หรือ Esc เพื่อออก
                  </div>
                )}
              </>
            ) : (
              <div className="grid h-full place-items-center text-[var(--ed-muted)]">{bootError ?? "กำลังโหลด"}</div>
            )}
          </main>
        </ReactFlowProvider>
        {hasSelection && <Inspector />}
      </div>
      <Prototype />
    </div>
  );
}
