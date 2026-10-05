import { History, RotateCcw, Sparkles, Undo2, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type Version } from "./api";
import { getState, setState, useEditor } from "./store";

const opLabels: Record<string, string> = {
  add_node: "เพิ่ม block", update_props: "แก้ props", move_node: "ย้าย element", remove_node: "ลบ element",
  set_theme: "เปลี่ยน theme", set_locale: "เปลี่ยนภาษา", create_frame: "เพิ่มเฟรม", update_frame: "แก้เฟรม",
  delete_frame: "ลบเฟรม", duplicate_frame: "คัดลอกเฟรม", set_navigation: "ตั้งลิงก์ prototype",
};

function describe(label: string) {
  if (label.startsWith("AI: ")) return { kind: "AI edit", icon: Sparkles, text: label.slice(4) };
  if (label.startsWith("restore")) return { kind: "Restored", icon: Undo2, text: `ก่อนย้อนไป ${label.replace("restore ", "")}` };
  return { kind: "Manual edit", icon: User, text: opLabels[label] ?? label };
}

function ago(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s} วินาทีที่แล้ว`;
  if (s < 3600) return `${Math.round(s / 60)} นาทีที่แล้ว`;
  if (s < 86400) return `${Math.round(s / 3600)} ชั่วโมงที่แล้ว`;
  return new Date(iso).toLocaleString("th-TH");
}

/** Version history: every snapshot records the state before a change, labeled by who made it. */
export function VersionsPanel() {
  const open = useEditor((s) => s.versionsOpen);
  const version = useEditor((s) => s.version);
  const turn = useEditor((s) => s.turn);
  const [list, setList] = useState<Version[]>([]);

  useEffect(() => {
    const id = getState().projectId;
    if (!open || !id) return;
    const t = setTimeout(() => void api.versions(id).then(setList).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [open, version, turn]);

  if (!open) return null;
  const restore = async (v: Version) => {
    const id = getState().projectId;
    if (!id) return;
    try {
      await api.restore(id, v.id);
    } catch (e) {
      setState({ error: (e as Error).message });
    }
  };
  return (
    <aside className="glass absolute top-3 right-3 bottom-3 z-30 flex w-80 flex-col rounded-2xl">
      <div className="flex items-center gap-2 border-b border-[var(--ed-border)] px-4 py-3">
        <History size={15} />
        <span className="font-semibold">Version history</span>
        <button className="icon-btn ml-auto" onClick={() => setState({ versionsOpen: false })}><X size={15} /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {list.length === 0 && <p className="p-3 text-[var(--ed-muted)]">ยังไม่มีประวัติ</p>}
        {list.map((v) => {
          const d = describe(v.label);
          return (
            <div key={v.id} className="group rounded-xl p-3 hover:bg-[var(--ed-hover)]">
              <div className="flex items-center gap-1.5 text-[11.5px] text-[var(--ed-muted)]">
                <d.icon size={12} /> {d.kind} · #{v.id} · {ago(v.createdAt)}
              </div>
              <div className="mt-1 line-clamp-2 text-[13px] text-[var(--ed-strong)]">{d.text}</div>
              <button className="btn btn-sm mt-2 opacity-0 group-hover:opacity-100" disabled={!!turn} onClick={() => restore(v)}>
                <RotateCcw size={12} /> ย้อนไปก่อนการเปลี่ยนนี้
              </button>
            </div>
          );
        })}
      </div>
      <p className="border-t border-[var(--ed-border)] px-4 py-2.5 text-[11px] text-[var(--ed-muted)]">
        การย้อนกลับจะบันทึกสถานะปัจจุบันเป็น version ใหม่ก่อนเสมอ จึงย้อนกลับมาได้อีก
      </p>
    </aside>
  );
}
