import { History, Info, RotateCcw, Sparkles, Undo2, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type Version } from "./api";
import { getState, setState, useEditor } from "./store";

const opLabels: Record<string, string> = {
  add_node: "เพิ่ม block", update_props: "แก้ props", move_node: "ย้าย element", remove_node: "ลบ element",
  set_theme: "เปลี่ยน theme", set_locale: "เปลี่ยนภาษา", create_frame: "เพิ่มเฟรม", update_frame: "แก้เฟรม",
  delete_frame: "ลบเฟรม", duplicate_frame: "คัดลอกเฟรม", set_navigation: "ตั้งลิงก์ prototype",
};

const kinds = {
  ai: { label: "AI edit", icon: Sparkles, color: "var(--ed-brand)" },
  manual: { label: "Manual edit", icon: User, color: "var(--ed-select)" },
  restore: { label: "Restored", icon: Undo2, color: "var(--ed-warn)" },
};

function describe(label: string) {
  if (label.startsWith("AI: ")) return { ...kinds.ai, text: label.slice(4) };
  if (label.startsWith("restore")) return { ...kinds.restore, text: `ก่อนย้อนไป ${label.replace("restore ", "")}` };
  return { ...kinds.manual, text: opLabels[label] ?? label };
}

function ago(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "เมื่อสักครู่";
  if (s < 3600) return `${Math.round(s / 60)} นาทีที่แล้ว`;
  if (s < 86400) return `${Math.round(s / 3600)} ชั่วโมงที่แล้ว`;
  return new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (diff === 0) return "วันนี้";
  if (diff === 1) return "เมื่อวาน";
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

/** Version history: every snapshot records the state before a change, labeled by who made it. */
export function VersionsPanel() {
  const open = useEditor((s) => s.versionsOpen);
  const version = useEditor((s) => s.version);
  const turn = useEditor((s) => s.turn);
  const projectName = useEditor((s) => s.doc?.name);
  const [list, setList] = useState<Version[]>([]);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  useEffect(() => {
    const id = getState().projectId;
    if (!open || !id) return;
    const t = setTimeout(() => void api.versions(id).then(setList).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [open, version, turn]);

  if (!open) return null;
  const projectId = getState().projectId;
  const restore = async (v: Version) => {
    setConfirmId(null);
    if (!projectId) return;
    try {
      await api.restore(projectId, v.id);
    } catch (e) {
      setState({ error: (e as Error).message });
    }
  };
  const undo = () => projectId && void api.undo(projectId).catch((e) => setState({ error: (e as Error).message }));

  const groups: { day: string; items: Version[] }[] = [];
  for (const v of list) {
    const day = dayLabel(v.createdAt);
    if (groups.at(-1)?.day !== day) groups.push({ day, items: [] });
    groups.at(-1)!.items.push(v);
  }

  return (
    <aside className="glass absolute top-4 right-4 bottom-4 z-30 flex w-[400px] flex-col rounded-2xl !bg-[var(--ed-panel)]">
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <History size={20} />
          <span className="text-[18px] font-semibold text-[var(--ed-strong)]">Version history</span>
          <button className="icon-btn ml-auto" onClick={() => setState({ versionsOpen: false })} title="ปิด"><X size={18} /></button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="truncate text-[14px] text-[var(--ed-text)]">{projectName}</span>
          <span className="tag ml-auto">Current · v{version}</span>
        </div>
        <button className="card card-hover mt-3 flex w-full items-center gap-3 p-3 text-left" disabled={!!turn || list.length === 0} onClick={undo}>
          <span className="grid size-10 place-items-center rounded-lg bg-[var(--ed-brand-soft)] text-[var(--ed-brand-ink)]"><Undo2 size={18} /></span>
          <span>
            <span className="block font-semibold text-[var(--ed-brand-ink)]">Undo ล่าสุด</span>
            <span className="text-[12px] text-[var(--ed-muted)]">ย้อนกลับ 1 การเปลี่ยนแปลง</span>
          </span>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
        {list.length === 0 && <p className="p-3 text-[var(--ed-muted)]">ยังไม่มีประวัติ</p>}
        {groups.map((g) => (
          <div key={g.day}>
            <div className="mx-2 mt-2 mb-1 border-b border-[var(--ed-border)] pb-1.5 text-[13px] font-semibold text-[var(--ed-strong)]">{g.day}</div>
            {g.items.map((v, i) => {
              const d = describe(v.label);
              const last = i === g.items.length - 1;
              return (
                <div key={v.id} className="group relative flex gap-3 rounded-xl px-2 py-2.5 hover:bg-[var(--ed-hover)]">
                  <div className="relative flex w-7 shrink-0 justify-center">
                    {!last && <span className="absolute top-8 -bottom-3 w-px bg-[var(--ed-border)]" />}
                    <span className="relative grid size-7 place-items-center rounded-full border bg-[var(--ed-panel)]" style={{ color: d.color, borderColor: `color-mix(in srgb, ${d.color} 35%, transparent)` }}>
                      <d.icon size={14} />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px]">
                      <span className="font-semibold" style={{ color: d.color }}>{d.label}</span>
                      <span className="text-[var(--ed-muted)]"> · #{v.id} · {ago(v.createdAt)}</span>
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-[13px] text-[var(--ed-strong)]">{d.text}</div>
                  </div>
                  <button
                    className="btn btn-soft btn-sm self-center opacity-0 group-hover:opacity-100 focus:opacity-100"
                    disabled={!!turn}
                    onClick={() => setConfirmId(confirmId === v.id ? null : v.id)}
                  >
                    <RotateCcw size={13} /> ย้อนไปก่อนการเปลี่ยนนี้
                  </button>
                  {confirmId === v.id && (
                    <div className="popover absolute top-full right-2 z-10 mt-1 w-64 p-3.5">
                      <div className="font-semibold text-[var(--ed-strong)]">กู้คืน #{v.id}?</div>
                      <div className="mt-0.5 text-[12px] text-[var(--ed-muted)]">สถานะปัจจุบันจะถูกบันทึกเป็น version ใหม่ก่อน</div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button className="btn btn-sm" onClick={() => setConfirmId(null)}>ยกเลิก</button>
                        <button className="btn btn-primary btn-sm" onClick={() => void restore(v)}>Restore</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="m-3 mt-0 flex items-start gap-2 rounded-lg bg-[var(--ed-panel-2)] px-3 py-2.5 text-[11.5px] text-[var(--ed-muted)]">
        <Info size={14} className="mt-0.5 shrink-0" />
        การย้อนกลับจะบันทึกสถานะปัจจุบันเป็น version ใหม่ก่อนเสมอ จึงย้อนกลับมาได้อีก
      </p>
    </aside>
  );
}
