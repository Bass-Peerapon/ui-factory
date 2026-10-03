import { DEVICES, themePresets, type Device } from "@ui-factory/catalog";
import { Download, Monitor, Play, Plus, Smartphone, Tablet, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api, openProject, runOp, type ProjectSummary } from "./api";
import { getState, setState, useEditor } from "./store";

const deviceIcon = { desktop: Monitor, tablet: Tablet, mobile: Smartphone };

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

  const addFrame = (device: Device) => {
    const n = (doc?.frameOrder.length ?? 0) + 1;
    void runOp("create_frame", { name: `Frame ${n}`, device });
  };

  const busy = !!turn;
  return (
    <header className="panel flex h-12 shrink-0 items-center gap-2 border-b px-3">
      <strong className="mr-2 text-[14px]">UI Factory</strong>
      <select
        className="field !w-48"
        value={projectId ?? ""}
        onChange={(e) => void openProject(e.target.value)}
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <button className="icon-btn" title="โปรเจกต์ใหม่" onClick={newProject}><Plus size={16} /></button>

      <div className="mx-2 h-5 w-px bg-[var(--ed-border)]" />
      <span className="label">เพิ่มเฟรม</span>
      {(Object.keys(DEVICES) as Device[]).map((d) => {
        const Icon = deviceIcon[d];
        return (
          <button key={d} className="icon-btn" title={DEVICES[d].label} onClick={() => addFrame(d)} disabled={!doc}>
            <Icon size={16} />
          </button>
        );
      })}

      <div className="mx-2 h-5 w-px bg-[var(--ed-border)]" />
      <span className="label">Theme</span>
      <select
        className="field !w-28"
        value=""
        onChange={(e) => e.target.value && void runOp("set_theme", { preset: e.target.value })}
        disabled={!doc || busy}
      >
        <option value="">เลือก preset</option>
        {Object.keys(themePresets).map((k) => <option key={k} value={k}>{k}</option>)}
      </select>
      {doc && (
        <div className="flex gap-0.5" title="theme ปัจจุบัน">
          {[doc.theme.primary, doc.theme.accent, doc.theme.background, doc.theme.foreground].map((c, i) => (
            <span key={i} className="size-4 rounded-sm border border-[var(--ed-border)]" style={{ background: c }} />
          ))}
        </div>
      )}
      <span className="label ml-2">ภาษา</span>
      <select
        className="field !w-20"
        value={doc?.locale ?? "th"}
        onChange={(e) => void runOp("set_locale", { locale: e.target.value })}
        disabled={!doc || busy}
      >
        <option value="th">ไทย</option>
        <option value="en">EN</option>
      </select>

      <div className="ml-auto flex items-center gap-2">
        <span
          className="size-2 rounded-full"
          style={{ background: connected ? "#22c55e" : "#ef4444" }}
          title={connected ? "เชื่อมต่อแล้ว" : "ขาดการเชื่อมต่อ"}
        />
        <button
          className="btn"
          disabled={!projectId || busy}
          onClick={() => void api.undo(getState().projectId!).catch((e) => setState({ error: e.message }))}
        >
          <Undo2 size={14} /> Undo
        </button>
        <button
          className="btn"
          disabled={!selection.frameId}
          onClick={() => setState({ prototypeFrame: selection.frameId })}
        >
          <Play size={14} /> Prototype
        </button>
        <a className="btn" href={projectId ? api.exportUrl(projectId) : undefined} download>
          <Download size={14} /> Export JSON
        </a>
      </div>
    </header>
  );
}
