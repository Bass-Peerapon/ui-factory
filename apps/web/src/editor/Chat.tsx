import { designSystems } from "@ui-factory/catalog";
import {
  ArrowRight, Check, CheckCircle2, ChevronDown, Circle, ClipboardList, Loader2, MessageSquare, Pencil, Play, Sparkles, Square, X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { BriefMeta, ChatMessage, NextStep, ToolCallSummary, TurnState } from "../shared/doc";
import { api, runOp, sendChat } from "./api";
import { Swatches } from "./DesignSystemPicker";
import { deviceIcon, deviceLabel } from "./icons";
import { hasSkeleton } from "./specTree";
import { getState, setState, useEditor } from "./store";

export function Chat() {
  const messages = useEditor((s) => s.messages);
  const turn = useEditor((s) => s.turn);
  const error = useEditor((s) => s.error);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, turn?.steps?.length]);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setState({ error: null }), 6000);
    return () => clearTimeout(t);
  }, [error]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const lastBrief = [...messages].reverse().find((m) => m.meta?.kind === "brief");
  const briefAnswered = lastBrief && messages.indexOf(lastBrief) < messages.length - 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-4 py-4">
        {messages.length === 0 && <Welcome />}
        {messages.map((m) => (
          <Message key={m.id} m={m} isLastAssistant={m === lastAssistant && !turn} briefActive={m === lastBrief && !briefAnswered && !turn} />
        ))}
        {turn?.steps && turn.steps.length > 0 && <ProgressCard turn={turn} />}
      </div>
      {error && <div className="mx-3 mb-2 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-[12.5px] text-[var(--ed-danger)]">{error}</div>}
      <CommentQueue />
      <Composer />
    </div>
  );
}

function Welcome() {
  const examples = [
    "ทำหน้า landing page สตูดิโอโยคะในเชียงใหม่ มีคลาส ราคา และรีวิว",
    "ทำ flow สมัครสมาชิกแอปออมเงิน บนมือถือ",
    "หน้า dashboard ร้านค้าออนไลน์ มีสรุปยอดขายและตารางออเดอร์",
  ];
  return (
    <div className="mt-4 space-y-5 px-1">
      <div>
        <span className="avatar avatar-ai mb-4 !size-10"><Sparkles size={18} /></span>
        <div className="text-[22px] leading-tight font-semibold tracking-tight text-[var(--ed-strong)]">อยากสร้างหน้าไหนวันนี้?</div>
        <p className="mt-2 text-[var(--ed-muted)]">
          พิมพ์สิ่งที่ต้องการ AI จะเลือก block จาก catalog วางโครง แล้วเติมเนื้อหาจริงตาม design system ที่เลือก
        </p>
      </div>
      <div className="space-y-2">
        <div className="label">ลองเริ่มจาก</div>
        {examples.map((e) => (
          <button key={e} className="card card-hover flex w-full items-center gap-3 p-3 text-left text-[13px]" onClick={() => setState({ draft: e })}>
            <span className="min-w-0 flex-1">{e}</span>
            <ArrowRight size={15} className="shrink-0 text-[var(--ed-faint)]" />
          </button>
        ))}
      </div>
    </div>
  );
}

const time = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
};

function Message({ m, isLastAssistant, briefActive }: { m: ChatMessage; isLastAssistant: boolean; briefActive: boolean }) {
  if (m.role === "system") return <div className="msg-system">{m.text}</div>;
  const ai = m.role === "assistant";
  const isBrief = m.meta?.kind === "brief";
  return (
    <div className="msg-row">
      <span className={`avatar ${ai ? "avatar-ai" : "avatar-user"}`}>{ai ? "AI" : "U"}</span>
      <div className="min-w-0 flex-1">
        <div className="msg-meta">
          {ai && <Sparkles size={14} className="text-[var(--ed-brand)]" />}
          {ai ? "UI Factory" : "คุณ"}
          <time>{time(m.createdAt)}</time>
        </div>
        {isBrief ? (
          <BriefForm meta={m.meta as BriefMeta} text={m.text} active={briefActive} />
        ) : (
          <>
            <div className={`bubble ${ai ? "bubble-ai" : "bubble-user"}`}>
              {(m.meta?.kind as string | undefined) === "comments" && (
                <div className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--ed-warn)]">
                  <MessageSquare size={12} /> {m.meta?.comments?.length} คอมเมนต์
                </div>
              )}
              {m.text}
            </div>
            {ai && m.meta?.tools && m.meta.tools.length > 0 && <ToolCalls tools={m.meta.tools} />}
            {ai && !m.meta?.tools && m.meta?.frames && m.meta.frames.length > 0 && <ResultCard frameIds={m.meta.frames} />}
            {ai && isLastAssistant && m.meta?.next && m.meta.next.length > 0 && <NextSteps steps={m.meta.next} />}
          </>
        )}
      </div>
    </div>
  );
}

const toolLabel: Record<string, string> = {
  add_node: "เพิ่ม element", update_props: "อัปเดตข้อความและ props", move_node: "ย้ายตำแหน่ง", remove_node: "ลบ element",
  set_theme: "เปลี่ยน theme", create_frame: "สร้างเฟรม", set_navigation: "ตั้งลิงก์ prototype",
};

function ToolCalls({ tools }: { tools: ToolCallSummary[] }) {
  return (
    <div className="mt-2 space-y-1.5">
      {tools.map((t) => (
        <div key={t.tool} className="card flex items-start gap-2.5 px-3 py-2.5">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 fill-[var(--ed-ok)] text-white" />
          <div className="min-w-0">
            <div className="text-[13px]">
              <span className="font-mono font-semibold text-[var(--ed-strong)]">{t.tool}</span>
              <span className="text-[var(--ed-muted)]"> · </span>
              <span className="font-medium text-[var(--ed-ok)]">สำเร็จ</span>
              {t.count > 1 && <span className="text-[var(--ed-muted)]"> ×{t.count}</span>}
            </div>
            <div className="truncate text-[12px] text-[var(--ed-muted)]">
              {toolLabel[t.tool] ?? t.tool}{t.targets.length > 0 && ` · ${t.targets.join(", ")}`}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ResultCard({ frameIds }: { frameIds: string[] }) {
  const frames = useEditor((s) => s.doc?.frames);
  const list = frameIds.flatMap((id) => (frames?.[id] ? [frames[id]] : []));
  if (list.length === 0) return null;
  const flow = list.length > 1 ? list[0].flow : undefined;
  const focus = (id: string) => setState({ selection: { frameId: id, elementId: null }, focusFrame: id });
  return (
    <div className="card mt-2 p-3">
      <div className="mb-2 flex items-center gap-2 font-semibold text-[var(--ed-strong)]">
        <CheckCircle2 size={18} className="fill-[var(--ed-ok)] text-white" />
        {flow ?? (list.length > 1 ? `สร้าง ${list.length} หน้าสำเร็จแล้ว` : "สร้างหน้าเว็บสำเร็จแล้ว")}
      </div>
      <div className="space-y-1.5">
        {list.map((f) => {
          const Icon = deviceIcon[f.device];
          return (
            <button key={f.id} className="card card-hover flex w-full items-center gap-3 px-3 py-2 text-left" onClick={() => focus(f.id)}>
              <Icon size={17} className="shrink-0 text-[var(--ed-muted)]" />
              <span className="min-w-0 leading-tight">
                <span className="block truncate font-medium text-[var(--ed-strong)]">{f.name}</span>
                <span className="text-[11.5px] text-[var(--ed-muted)]">{deviceLabel(f.device)}</span>
              </span>
            </button>
          );
        })}
      </div>
      {list.length > 1 && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button className="btn btn-primary" onClick={() => setState({ prototypeFrame: list[0].id })}><Play size={14} fill="currentColor" /> เปิด Prototype</button>
          <button className="btn" onClick={() => setState({ selection: { frameId: list[0].id, elementId: null }, draft: "แก้ทั้ง flow: " })}>
            <Pencil size={14} /> แก้ flow
          </button>
        </div>
      )}
    </div>
  );
}

function NextSteps({ steps }: { steps: NextStep[] }) {
  const run = (n: NextStep) => {
    if (n.action === "prototype") return setState({ prototypeFrame: n.frameId ?? null });
    if (n.op) return void runOp(n.op, n.args ?? {});
    if (n.prompt) {
      if (n.frameId) setState({ selection: { frameId: n.frameId, elementId: null } });
      void sendChat({ text: n.prompt, frameId: n.frameId ?? null, skipBrief: true });
    }
  };
  return (
    <div className="mt-3 space-y-1.5">
      <div className="label">ทำต่อ</div>
      <div className="flex flex-wrap gap-1.5">
        {steps.map((n) => (
          <button key={n.label} className="chip chip-pill" onClick={() => run(n)}>
            <Sparkles size={12} className="text-[var(--ed-brand)]" /> {n.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProgressCard({ turn }: { turn: TurnState }) {
  const [open, setOpen] = useState(true);
  const steps = turn.steps ?? [];
  const activeIdx = Math.max(0, steps.findIndex((s) => s.status === "active"));
  return (
    <div className="progress-card p-3.5">
      <button className="flex w-full items-center gap-2 border-0 bg-transparent p-0 text-left" onClick={() => setOpen(!open)}>
        <Sparkles size={17} className="text-[var(--ed-brand)]" />
        <span className="font-semibold text-[var(--ed-strong)]">กำลังสร้างหน้า</span>
        <span className="ml-auto text-[12.5px] font-medium text-[var(--ed-muted)]">Step {activeIdx + 1}/{steps.length}</span>
        <ChevronDown size={15} className={`shrink-0 text-[var(--ed-muted)] transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-2.5 space-y-0.5">
          {steps.map((s, i) => (
            <div key={i} className={`step-row ${s.status === "active" ? "is-active" : ""}`}>
              <span className="step-dot">
                {s.status === "done" && <CheckCircle2 size={18} className="fill-[var(--ed-ok)] text-white" />}
                {s.status === "active" && <Loader2 size={16} className="spin text-[var(--ed-brand)]" />}
                {(s.status === "pending" || s.status === "skipped") && <Circle size={16} className="text-[var(--ed-border-strong)]" />}
              </span>
              <span className={`shrink-0 whitespace-nowrap ${s.status === "pending" ? "text-[var(--ed-muted)]" : s.status === "active" ? "font-semibold text-[var(--ed-strong)]" : "text-[var(--ed-text)]"}`}>
                {s.label}
              </span>
              <span className="truncate text-[12px] text-[var(--ed-muted)]">{s.status === "skipped" ? "ข้าม" : s.detail}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2 text-[12px] text-[var(--ed-muted)]">
        <span className="tracking-[3px] text-[var(--ed-brand)]">•••</span> กำลังรับการอัปเดต
        <button className="btn btn-sm btn-danger ml-auto" onClick={() => void api.stop(getState().projectId!)}>
          <Square size={10} fill="currentColor" /> Stop
        </button>
      </div>
    </div>
  );
}

// --- clarify form -------------------------------------------------------------

type Question = { id: string; label: string; options: { value: string; label: string }[] };
const pageType: Question = {
  id: "pageType", label: "ประเภทหน้า", options: [
    { value: "landing", label: "Landing" }, { value: "pricing", label: "ราคา" }, { value: "signup", label: "สมัคร / เข้าสู่ระบบ" },
    { value: "dashboard", label: "Dashboard" }, { value: "shop", label: "ร้านค้า" }, { value: "content", label: "บทความ" },
    { value: "event", label: "อีเวนต์" }, { value: "portfolio", label: "ผลงาน" }, { value: "booking", label: "จองคิว" },
  ],
};
// Page mode follows impeccable's persuade / operate / read split (skill/reference/mode-*.md).
const mode: Question = {
  id: "mode", label: "หน้านี้มีไว้ทำอะไร", options: [
    { value: "persuade", label: "ชวนให้ตัดสินใจ" }, { value: "operate", label: "ใช้ทำงาน" }, { value: "read", label: "อ่านหาข้อมูล" },
  ],
};
const platform: Question = { id: "platform", label: "อุปกรณ์", options: [{ value: "desktop", label: "Desktop" }, { value: "tablet", label: "Tablet" }, { value: "mobile", label: "Mobile" }] };
const tone: Question = {
  id: "tone", label: "โทน", options: [
    { value: "formal", label: "ทางการ" }, { value: "friendly", label: "เป็นกันเอง" }, { value: "premium", label: "พรีเมียม" },
    { value: "playful", label: "สนุกสนาน" }, { value: "technical", label: "เทคนิค" },
  ],
};
const density: Question = { id: "density", label: "ความแน่น", options: [{ value: "relaxed", label: "โปร่ง" }, { value: "standard", label: "ปกติ" }, { value: "compact", label: "แน่น" }] };
const questions = [pageType, mode, platform, tone, density];

function BriefForm({ meta, text, active }: { meta: BriefMeta; text: string; active: boolean }) {
  const [answers, setAnswers] = useState<Record<string, string>>(meta.defaults);
  const [allDs, setAllDs] = useState(false);
  const set = (k: string, v: string) => setAnswers((a) => ({ ...a, [k]: v }));
  const submit = (skip: boolean) => {
    const ds = designSystems.find((d) => d.id === answers.designSystem)?.name ?? answers.designSystem;
    const label = (id: string) => questions.find((q) => q.id === id)?.options.find((o) => o.value === answers[id])?.label;
    void sendChat(
      skip
        ? { text: meta.prompt, frameId: meta.frameId, skipBrief: true, displayText: `${meta.prompt}\n(ข้ามคำถาม)` }
        : {
            text: meta.prompt, frameId: meta.frameId, brief: answers,
            displayText: `${meta.prompt}\n${[label("pageType"), label("mode"), label("platform"), ds, label("tone"), label("density")].filter(Boolean).join(" · ")}`,
          },
    );
  };
  if (!active) {
    return (
      <div className="bubble bubble-ai flex items-center gap-1.5 text-[12.5px] text-[var(--ed-muted)]">
        <Check size={13} /> ถามรายละเอียดก่อนสร้าง · ตอบแล้ว
      </div>
    );
  }
  // Recommended system first, then the rest; collapsed to one row of four.
  const ordered = [...designSystems].sort((a, b) => Number(b.id === meta.defaults.designSystem) - Number(a.id === meta.defaults.designSystem));
  const shown = allDs ? ordered : ordered.slice(0, 4);
  if (!allDs && answers.designSystem && !shown.some((d) => d.id === answers.designSystem)) {
    shown[3] = designSystems.find((d) => d.id === answers.designSystem)!;
  }
  const choice = (q: Question) => (
    <div className="flex flex-wrap gap-2">
      {q.options.map((o) => (
        <button key={o.value} className={`chip relative ${answers[q.id] === o.value ? "is-on" : ""}`} onClick={() => set(q.id, o.value)}>
          {o.label}
          {meta.defaults[q.id] === o.value && <span className="rec-badge">แนะนำ</span>}
        </button>
      ))}
    </div>
  );
  const section = (n: number, label: string, body: React.ReactNode) => (
    <div className="space-y-2">
      <div className="text-[13px] font-semibold text-[var(--ed-strong)]">{n}. {label}</div>
      {body}
    </div>
  );
  return (
    <div className="mt-1.5 space-y-2">
      <div className="bubble bubble-ai">{text}</div>
      <div className="card space-y-4 p-4">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-[var(--ed-strong)]">
          <ClipboardList size={18} /> ตั้งค่า Brief
        </div>
        {section(1, pageType.label, choice(pageType))}
        {section(2, mode.label, choice(mode))}
        {section(3, platform.label, choice(platform))}
        {section(4, "Design system", (
          <>
            <div className="grid grid-cols-4 gap-2">
              {shown.map((d) => (
                <button
                  key={d.id}
                  onClick={() => set("designSystem", d.id)}
                  className={`card card-hover relative p-0 text-center ${answers.designSystem === d.id ? "is-on" : ""}`}
                  title={d.summary}
                >
                  <span className="flex h-11 items-center justify-center rounded-t-[11px]" style={{ background: d.theme.background }}>
                    <Swatches t={d.theme} size={12} />
                  </span>
                  <span className={`block truncate px-1 py-1.5 text-[11.5px] font-medium ${answers.designSystem === d.id ? "text-[var(--ed-brand-ink)]" : ""}`}>{d.name}</span>
                  {meta.defaults.designSystem === d.id && <span className="rec-badge">แนะนำ</span>}
                </button>
              ))}
            </div>
            <button className="border-0 bg-transparent p-0 text-[12px] font-medium text-[var(--ed-brand-ink)]" onClick={() => setAllDs(!allDs)}>
              {allDs ? "แสดงน้อยลง" : `ดูทั้งหมด ${designSystems.length} แบบ`}
            </button>
          </>
        ))}
        {section(5, tone.label, choice(tone))}
        {section(6, density.label, choice(density))}
        <div className="grid grid-cols-[1.15fr_1fr] gap-2 pt-1">
          <button className="btn btn-primary btn-lg" onClick={() => submit(false)}>
            <Sparkles size={16} /> สร้างเลย
          </button>
          <button className="btn btn-lg !font-medium" onClick={() => submit(true)}>ข้ามคำถาม</button>
        </div>
      </div>
    </div>
  );
}

// --- comments ------------------------------------------------------------------

function CommentQueue() {
  const comments = useEditor((s) => s.comments);
  const frames = useEditor((s) => s.doc?.frames);
  const turn = useEditor((s) => s.turn);
  if (comments.length === 0) return null;
  const frameId = comments[0].frameId;
  const batch = comments.filter((c) => c.frameId === frameId);
  const send = async () => {
    const ok = await sendChat({ text: "", frameId, comments: batch.map((c) => ({ elementId: c.elementId, text: c.text })) });
    if (ok) setState((s) => ({ comments: s.comments.filter((c) => c.frameId !== frameId), canvasMode: "select" }));
  };
  return (
    <div className="comment-card mx-3 mb-2 p-3">
      <div className="mb-2 flex items-center gap-2 font-semibold text-[var(--ed-warn)]">
        <MessageSquare size={17} /> คอมเมนต์ที่รอส่ง · {frames?.[frameId]?.name}
        <span className="pin-num ml-auto">{batch.length}</span>
      </div>
      <ol className="mb-2.5 max-h-44 space-y-1.5 overflow-auto">
        {batch.map((c) => (
          <li key={c.id} className="flex items-center gap-2.5 rounded-lg border border-[var(--ed-border)] bg-[var(--ed-panel)] px-2.5 py-2 text-[12.5px]">
            <span className="pin-num">{comments.indexOf(c) + 1}</span>
            <span className="min-w-0 flex-1 leading-snug">
              <b className="block text-[var(--ed-strong)]">{c.elementType}</b>
              <span className="text-[var(--ed-text)]">{c.text}</span>
            </span>
            <button className="icon-btn !size-6" title="ลบคอมเมนต์" onClick={() => setState((s) => ({ comments: s.comments.filter((x) => x.id !== c.id) }))}>
              <X size={14} />
            </button>
          </li>
        ))}
      </ol>
      <button className="btn btn-warn btn-lg w-full" disabled={!!turn} onClick={send}>
        <Sparkles size={16} /> ส่ง {batch.length} คอมเมนต์ให้ AI แก้เฉพาะจุด
      </button>
      <div className="mt-1.5 text-[11.5px] text-[var(--ed-muted)]">
        AI จะแก้เฉพาะ element ที่ปักหมุด{comments.length > batch.length && " · เฟรมอื่นจะส่งรอบถัดไป"}
      </div>
    </div>
  );
}

// --- composer --------------------------------------------------------------------

function Composer() {
  const draft = useEditor((s) => s.draft);
  const turn = useEditor((s) => s.turn);
  const wireframe = useEditor((s) => s.wireframe);
  const selection = useEditor((s) => s.selection);
  const doc = useEditor((s) => s.doc);
  const ref = useRef<HTMLTextAreaElement>(null);
  const frame = selection.frameId ? doc?.frames[selection.frameId] : undefined;
  const el = selection.elementId ? frame?.spec?.elements[selection.elementId] : undefined;
  const skeletonFrames = doc ? doc.frameOrder.filter((id) => hasSkeleton(doc.frames[id]?.spec)) : [];

  useEffect(() => {
    if (draft) ref.current?.focus();
  }, [draft]);

  const send = async () => {
    const s = getState();
    if (!s.draft.trim()) return;
    const ok = await sendChat({ text: s.draft.trim(), frameId: s.selection.frameId, elementId: s.selection.elementId });
    if (ok) setState({ draft: "" });
  };
  const fill = (frameId: string) => {
    const id = getState().projectId;
    if (id) void api.fill(id, frameId).catch((e) => setState({ error: (e as Error).message }));
  };
  const scope = frame ? (el ? `${frame.id}/${selection.elementId}` : frame.id) : "";
  const placeholder = turn ? "AI กำลังทำงาน" : el ? `สั่งแก้ ${el.type}...` : frame ? "สั่งแก้หน้านี้..." : "อธิบายหน้าที่ต้องการ หรือสั่งแก้";

  return (
    <div className="space-y-2 border-t border-[var(--ed-border)] p-3">
      <select
        className="field !h-9 font-medium"
        value={scope}
        title="ขอบเขตของคำสั่ง"
        onChange={(e) => {
          const [frameId, elementId] = e.target.value.split("/");
          setState({ selection: { frameId: frameId || null, elementId: elementId ?? null } });
        }}
      >
        <option value="">เฟรมใหม่</option>
        {doc?.frameOrder.map((id) => <option key={id} value={id}>{doc.frames[id]?.name}</option>)}
        {el && frame && <option value={scope}>{frame.name} › {el.type}</option>}
      </select>
      <div className="rounded-xl border border-[var(--ed-border)] bg-[var(--ed-panel)] p-2.5 transition focus-within:border-[var(--ed-brand)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ed-brand)_14%,transparent)]">
        <textarea
          ref={ref}
          rows={2}
          className="block w-full resize-none border-0 bg-transparent px-1 text-[14px] outline-none placeholder:text-[var(--ed-faint)]"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setState({ draft: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          disabled={!!turn}
        />
        <div className="mt-1.5 flex items-center gap-1.5">
          <button className={`chip chip-pill ${wireframe ? "is-on" : ""}`} onClick={() => setState({ wireframe: !wireframe })} title="หยุดหลังวางโครง แล้วกด Fill เอง">
            <ClipboardList size={13} /> Wireframe
          </button>
          {!turn && frame && hasSkeleton(frame.spec) && (
            <button className="chip chip-pill" onClick={() => fill(frame.id)}><Sparkles size={12} /> Fill</button>
          )}
          {!turn && skeletonFrames.length > 1 && (
            <button className="chip chip-pill" onClick={() => fill("")}><Sparkles size={12} /> Fill ทั้งหมด ({skeletonFrames.length})</button>
          )}
          <div className="ml-auto">
            {turn ? (
              <button className="send-btn !bg-[var(--ed-danger)]" title="Stop" onClick={() => void api.stop(getState().projectId!)}>
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button className="send-btn" title="ส่ง (Enter)" onClick={send} disabled={!draft.trim()}>
                <ArrowRight size={17} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
