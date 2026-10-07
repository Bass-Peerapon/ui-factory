import { Download, Play, Plus, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api, openProject, runOp, type ProjectSummary } from "./api";
import { DensityControl, DesignSystemButton } from "./DesignSystemPicker";
import { getState, setState, useEditor } from "./store";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d="M16 2.5 28 9.25v13.5L16 29.5 4 22.75V9.25z" fill="var(--ed-brand)" />
      <path d="M16 9.5 22 13v6.5L16 23l-6-3.5V13z" fill="#fff" opacity=".95" />
      <path d="M16 16.2 22 13v6.5L16 23z" fill="#fff" opacity=".55" />
    </svg>
  );
}

export function TopBar() {
  const doc = useEditor((s) => s.doc);
  const projectId = useEditor((s) => s.projectId);
  const connected = useEditor((s) => s.connected);
  const turn = useEditor((s) => s.turn);
  const selection = useEditor((s) => s.selection);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  useEffect(() => {
    void api.list().then(setProjects).catch(() => {});
  }, [projectId]);

  const newProject = async () => {
    const name = prompt("ชื่อโปรเจกต์", "โปรเจกต์ใหม่");
    if (!name) return;
    const { doc } = await api.create(name);
    await openProject(doc.id);
  };

  const busy = !!turn;
  const protoFrame = selection.frameId ?? doc?.frameOrder.find((id) => doc.frames[id]?.spec) ?? null;
  return (
    <header className="panel flex h-14 shrink-0 items-center gap-2.5 border-b px-4">
      <strong className="mr-3 flex items-center gap-2.5 text-[17px] font-semibold tracking-tight text-[var(--ed-strong)]">
        <Logo /> UI Factory
      </strong>
      <select className="field !h-9 !w-60 font-medium" value={projectId ?? ""} onChange={(e) => void openProject(e.target.value)}>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <button className="btn !h-9 !w-9 !px-0" title="โปรเจกต์ใหม่" onClick={newProject}><Plus size={17} /></button>
      <div className="divider-v mx-1" />
      <DesignSystemButton disabled={!doc || busy} />

      <div className="ml-auto flex items-center gap-2.5">
        <DensityControl disabled={!doc || busy} />
        <select
          className="field !h-9 !w-[84px]"
          value={doc?.locale ?? "th"}
          onChange={(e) => void runOp("set_locale", { locale: e.target.value })}
          disabled={!doc || busy}
          title="ภาษาของเนื้อหา"
        >
          <option value="th">ไทย</option>
          <option value="en">EN</option>
        </select>
        <span
          className="mx-1 size-2.5 rounded-full"
          style={{ background: connected ? "var(--ed-ok)" : "var(--ed-danger)", boxShadow: `0 0 0 3px color-mix(in srgb, ${connected ? "var(--ed-ok)" : "var(--ed-danger)"} 18%, transparent)` }}
          title={connected ? "เชื่อมต่อแล้ว" : "ขาดการเชื่อมต่อ"}
        />
        <button
          className="btn !h-9"
          disabled={!projectId || busy}
          onClick={() => void api.undo(getState().projectId!).catch((e) => setState({ error: e.message }))}
        >
          <Undo2 size={15} /> Undo
        </button>
        <button className="btn !h-9" disabled={!protoFrame} onClick={() => setState({ prototypeFrame: protoFrame })}>
          <Play size={14} fill="currentColor" /> Prototype
        </button>
        <a className="btn !h-9" href={projectId ? api.exportUrl(projectId) : undefined} download>
          <Download size={15} /> Export JSON
        </a>
      </div>
    </header>
  );
}
