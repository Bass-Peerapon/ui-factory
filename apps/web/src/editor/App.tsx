import { ReactFlowProvider } from "@xyflow/react";
import { useEffect, useState } from "react";
import { api, openProject } from "./api";
import { Canvas } from "./Canvas";
import { Chat } from "./Chat";
import { Inspector } from "./Inspector";
import { LeftPanel } from "./LeftPanel";
import { Prototype } from "./Prototype";
import { TopBar } from "./TopBar";
import { useEditor } from "./store";

export function App() {
  const doc = useEditor((s) => s.doc);
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
        <LeftPanel />
        <main className="relative min-w-0 flex-1">
          {doc ? (
            <ReactFlowProvider>
              <Canvas key={doc.id} />
            </ReactFlowProvider>
          ) : (
            <div className="grid h-full place-items-center text-[var(--ed-muted)]">{bootError ?? "กำลังโหลด"}</div>
          )}
        </main>
        <Inspector />
      </div>
      <Chat />
      <Prototype />
    </div>
  );
}
