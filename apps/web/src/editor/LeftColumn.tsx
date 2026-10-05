import { flowPatterns } from "@ui-factory/catalog";
import { ArrowRight, Layers as LayersIcon, LayoutGrid, MessageCircle, Workflow } from "lucide-react";
import { Chat } from "./Chat";
import { Components, Layers } from "./LeftPanel";
import { setState, useEditor, type EditorState } from "./store";

const tabs: { id: EditorState["leftTab"]; label: string; icon: typeof MessageCircle }[] = [
  { id: "chat", label: "แชท", icon: MessageCircle },
  { id: "layers", label: "Layers", icon: LayersIcon },
  { id: "components", label: "Blocks", icon: LayoutGrid },
  { id: "patterns", label: "Patterns", icon: Workflow },
];

export function LeftColumn() {
  const tab = useEditor((s) => s.leftTab);
  const running = useEditor((s) => !!s.turn);
  return (
    <aside className="panel flex w-[400px] shrink-0 flex-col border-r">
      <nav className="flex gap-1 border-b border-[var(--ed-border)] px-2">
        {tabs.map((t) => (
          <button key={t.id} className={`tab flex items-center gap-1.5 ${tab === t.id ? "is-active" : ""}`} onClick={() => setState({ leftTab: t.id })}>
            <t.icon size={14} />
            {t.label}
            {t.id === "chat" && running && tab !== "chat" && <span className="size-1.5 rounded-full bg-[var(--ed-brand)]" />}
          </button>
        ))}
      </nav>
      {tab === "chat" ? (
        <Chat />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {tab === "layers" && <Layers />}
          {tab === "components" && <Components />}
          {tab === "patterns" && <Patterns />}
        </div>
      )}
    </aside>
  );
}

function Patterns() {
  const use = (name: string) => setState({ draft: `ทำ flow ${name} สำหรับ `, leftTab: "chat" });
  return (
    <div className="space-y-3">
      <p className="px-1 text-[12.5px] text-[var(--ed-muted)]">
        UX flow มาตรฐาน AI จะสร้างทุกหน้าเรียงกันบน canvas และเชื่อมปุ่มหลักของแต่ละหน้าไปหน้าถัดไปให้ เปิดดูแบบคลิกได้ด้วย Prototype
      </p>
      {flowPatterns.map((p) => (
        <button key={p.id} className="card block w-full p-3.5 text-left" onClick={() => use(p.name)}>
          <div className="font-semibold text-[var(--ed-strong)]">{p.name}</div>
          <div className="mt-0.5 text-[12px] text-[var(--ed-muted)]">{p.description}</div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1">
            {p.pages.map((pg, i) => (
              <span key={pg.key} className="flex items-center gap-1">
                <span className="rounded-md bg-[var(--ed-hover)] px-1.5 py-0.5 text-[11.5px]">{pg.name}</span>
                {i < p.pages.length - 1 && <ArrowRight size={11} className="text-[var(--ed-muted)]" />}
              </span>
            ))}
          </div>
        </button>
      ))}
    </div>
  );
}
