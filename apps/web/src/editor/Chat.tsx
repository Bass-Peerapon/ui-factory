import { Loader2, Send, Sparkles, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { hasSkeleton } from "./specTree";
import { getState, setState, useEditor } from "./store";

const phaseLabel: Record<string, string> = {
  route: "กำลังจำแนกคำสั่ง",
  structure: "กำลังวางโครง (Jev)",
  fill: "กำลังเติมเนื้อหา (Gemini)",
  edit: "กำลังแก้ไข",
  theme: "กำลังปรับ theme",
};

export function Chat() {
  const messages = useEditor((s) => s.messages);
  const turn = useEditor((s) => s.turn);
  const wireframe = useEditor((s) => s.wireframe);
  const selection = useEditor((s) => s.selection);
  const doc = useEditor((s) => s.doc);
  const error = useEditor((s) => s.error);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const frame = selection.frameId ? doc?.frames[selection.frameId] : undefined;
  const el = selection.elementId ? frame?.spec?.elements[selection.elementId] : undefined;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setState({ error: null }), 6000);
    return () => clearTimeout(t);
  }, [error]);

  const send = async () => {
    const s = getState();
    if (!text.trim() || !s.projectId) return;
    try {
      await api.chat(s.projectId, {
        text: text.trim(), frameId: s.selection.frameId, elementId: s.selection.elementId, wireframe: s.wireframe,
      });
      setText("");
    } catch (e) {
      setState({ error: (e as Error).message });
    }
  };

  const fill = async () => {
    const s = getState();
    if (!s.projectId || !s.selection.frameId) return;
    try {
      await api.fill(s.projectId, s.selection.frameId);
    } catch (e) {
      setState({ error: (e as Error).message });
    }
  };

  return (
    <section className="panel flex h-64 shrink-0 flex-col border-t">
      <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="text-[var(--ed-muted)]">
            ลองพิมพ์ เช่น “ทำหน้า landing page ร้านกาแฟ มีราคาและฟอร์มติดต่อ” หรือเลือก element แล้วสั่ง “เปลี่ยนหัวข้อให้สั้นลง”
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`msg msg-${m.role}`}>{m.text}</div>
        ))}
      </div>
      {error && <div className="bg-red-500/10 px-4 py-1.5 text-[12px] text-red-600">{error}</div>}
      <div className="flex items-center gap-2 border-t border-[var(--ed-border)] px-3 py-2">
        <div className="flex min-w-0 flex-col text-[11px] text-[var(--ed-muted)]">
          <span>เป้าหมาย</span>
          <span className="truncate font-medium text-[var(--ed-text)]">
            {frame ? `${frame.name}${el ? ` › ${el.type}` : ""}` : "เฟรมใหม่"}
          </span>
        </div>
        <textarea
          className="field !h-10 flex-1 !py-2"
          placeholder={turn ? "AI กำลังทำงาน" : "สั่งงาน AI (Enter ส่ง, Shift+Enter ขึ้นบรรทัดใหม่)"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          disabled={!!turn}
        />
        <label className="flex items-center gap-1.5 text-[12px]" title="หยุดหลังวางโครง แล้วกด Fill เอง">
          <input type="checkbox" checked={wireframe} onChange={(e) => setState({ wireframe: e.target.checked })} />
          Wireframe
        </label>
        {frame && hasSkeleton(frame.spec) && !turn && (
          <button className="btn" onClick={fill}><Sparkles size={14} /> Fill</button>
        )}
        {turn ? (
          <>
            <span className="flex items-center gap-1.5 text-[12px] text-[var(--ed-muted)]">
              <Loader2 size={14} className="spin" /> {phaseLabel[turn.phase] ?? turn.phase}
            </span>
            <button className="btn btn-danger" onClick={() => void api.stop(getState().projectId!)}>
              <Square size={12} /> Stop
            </button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={send} disabled={!text.trim()}>
            <Send size={14} /> ส่ง
          </button>
        )}
      </div>
    </section>
  );
}
