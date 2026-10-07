import { flowPatterns, type FlowPattern } from "@ui-factory/catalog";
import { ArrowRight, Layers as LayersIcon, LayoutGrid, MessageCircle, Sparkles, Workflow } from "lucide-react";
import { Chat } from "./Chat";
import { patternIcon } from "./icons";
import { Components, FrameContext, Layers } from "./LeftPanel";
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
      <nav className="flex gap-0.5 border-b border-[var(--ed-border)] px-2">
        {tabs.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? "is-active" : ""}`} onClick={() => setState({ leftTab: t.id })}>
            <t.icon size={16} />
            {t.label}
            {t.id === "chat" && running && tab !== "chat" && <span className="size-1.5 rounded-full bg-[var(--ed-brand)]" />}
          </button>
        ))}
      </nav>
      {tab === "chat" ? (
        <Chat />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <FrameContext />
          <div className="min-h-0 flex-1 overflow-auto px-3 pb-4">
            {tab === "layers" && <Layers />}
            {tab === "components" && <Components />}
            {tab === "patterns" && <Patterns />}
          </div>
        </div>
      )}
    </aside>
  );
}

function Patterns() {
  const use = (name: string) => setState({ draft: `ทำ flow ${name} สำหรับ `, leftTab: "chat" });
  return (
    <div className="space-y-3">
      <div className="hint">
        <Sparkles size={16} />
        <span>UX flow มาตรฐาน AI จะสร้างทุกหน้าเรียงกันบน canvas และเชื่อมปุ่มหลักของแต่ละหน้าไปหน้าถัดไปให้</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {flowPatterns.map((p) => <PatternCard key={p.id} p={p} onUse={() => use(p.name)} />)}
      </div>
    </div>
  );
}

function PatternCard({ p, onUse }: { p: FlowPattern; onUse: () => void }) {
  const Icon = patternIcon[p.id] ?? Workflow;
  const pages = p.pages.slice(0, 4);
  return (
    <div className="group card card-hover relative flex flex-col gap-2.5 p-3 hover:!border-[var(--ed-brand)]" title={p.description}>
      <div className="flex items-center gap-2 font-semibold text-[var(--ed-strong)]">
        <Icon size={16} className="shrink-0" />
        <span className="truncate text-[13px]">{p.name}</span>
      </div>
      <div className="flex items-center gap-0.5">
        {pages.map((pg, i) => (
          <span key={pg.key} className="flex items-center gap-0.5">
            <span className="mini-page" style={{ width: 26, height: 34 }}>
              <i className="top" />
              <i />
              <i style={{ width: "60%" }} />
              {i === 1 && <i className="accent" />}
            </span>
            {i < pages.length - 1 && <ArrowRight size={10} className="shrink-0 text-[var(--ed-brand)]" />}
          </span>
        ))}
      </div>
      <div className="line-clamp-2 text-[11px] leading-snug text-[var(--ed-muted)]">{p.pages.map((pg) => pg.name).join(" › ")}</div>
      <button
        className="btn btn-primary btn-sm absolute inset-x-3 bottom-3 opacity-0 transition group-hover:opacity-100 focus:opacity-100"
        onClick={onUse}
      >
        ใช้ pattern
      </button>
    </div>
  );
}
