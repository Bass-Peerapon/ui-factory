import { designSystems } from "@ui-factory/catalog";
import { ArrowUp, Check, ChevronDown, Circle, Loader2, MessageSquare, Sparkles, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { BriefMeta, ChatMessage, NextStep, TurnState } from "../shared/doc";
import { api, runOp, sendChat } from "./api";
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
      <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-4 py-4">
        {messages.length === 0 && <Welcome />}
        {messages.map((m) => (
          <Message key={m.id} m={m} isLastAssistant={m === lastAssistant && !turn} briefActive={m === lastBrief && !briefAnswered && !turn} />
        ))}
        {turn?.steps && turn.steps.length > 0 && <PlanPill turn={turn} />}
      </div>
      {error && <div className="mx-3 mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-[12px] text-red-600">{error}</div>}
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
    <div className="mt-6 space-y-4 px-1">
      <div>
        <div className="font-display text-[22px] leading-tight font-semibold text-[var(--ed-strong)]">
          อยากสร้าง <span className="rounded bg-[var(--ed-brand)]/60 px-1">หน้าไหน</span> วันนี้?
        </div>
        <p className="mt-2 text-[var(--ed-muted)]">
          พิมพ์สิ่งที่ต้องการ AI จะเลือก block จาก catalog วางโครง แล้วเติมเนื้อหาจริงตาม design system ที่เลือก
        </p>
      </div>
      <div className="space-y-2">
        {examples.map((e) => (
          <button key={e} className="card w-full p-3 text-left text-[13px]" onClick={() => setState({ draft: e })}>
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

function Message({ m, isLastAssistant, briefActive }: { m: ChatMessage; isLastAssistant: boolean; briefActive: boolean }) {
  if (m.meta?.kind === "brief") return <BriefForm meta={m.meta as BriefMeta} text={m.text} active={briefActive} />;
  return (
    <div className={`msg msg-${m.role}`}>
      {m.meta?.kind === "comments" && (
        <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-[var(--ed-warn)]">
          <MessageSquare size={12} /> {m.meta.comments?.length} คอมเมนต์
        </div>
      )}
      {m.text}
      {isLastAssistant && m.meta?.next && m.meta.next.length > 0 && <NextSteps steps={m.meta.next} />}
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
    <div className="mt-3 flex flex-col gap-1.5">
      <div className="label">ทำต่อ</div>
      {steps.map((n) => (
        <button key={n.label} className="chip w-fit" onClick={() => run(n)}>
          <Sparkles size={12} /> {n.label}
        </button>
      ))}
    </div>
  );
}

function PlanPill({ turn }: { turn: TurnState }) {
  const [open, setOpen] = useState(true);
  const steps = turn.steps ?? [];
  const activeIdx = Math.max(0, steps.findIndex((s) => s.status === "active"));
  const active = steps[activeIdx];
  return (
    <div className="plan-pill p-3">
      <button className="flex w-full items-center gap-2 border-0 bg-transparent p-0 text-left" onClick={() => setOpen(!open)}>
        <Loader2 size={14} className="spin text-[var(--ed-brand-ink)]" />
        <span className="font-semibold text-[var(--ed-strong)]">Step {activeIdx + 1}/{steps.length}</span>
        <span className="truncate text-[var(--ed-muted)]">{active?.label}{active?.detail ? ` · ${active.detail}` : ""}</span>
        <ChevronDown size={14} className={`ml-auto shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ol className="mt-2.5 space-y-1.5 pl-0.5">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-2 text-[12.5px]">
              <span
                className="step-dot"
                style={{
                  background: s.status === "done" ? "var(--ed-strong)" : "transparent",
                  border: s.status === "done" ? "none" : "1.5px solid var(--ed-border-strong)",
                }}
              >
                {s.status === "done" && <Check size={9} color="var(--ed-panel)" strokeWidth={3.5} />}
                {s.status === "active" && <Circle size={6} fill="currentColor" className="text-[var(--ed-brand-ink)]" />}
              </span>
              <span className={s.status === "pending" ? "text-[var(--ed-muted)]" : "text-[var(--ed-text)]"}>{s.label}</span>
              {s.detail && <span className="text-[var(--ed-muted)]">· {s.detail}</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// --- clarify form -------------------------------------------------------------

const questions: { id: string; label: string; options: { value: string; label: string }[] }[] = [
  {
    id: "pageType", label: "ประเภทหน้า", options: [
      { value: "landing", label: "Landing" }, { value: "pricing", label: "ราคา" }, { value: "signup", label: "สมัคร / เข้าสู่ระบบ" },
      { value: "dashboard", label: "Dashboard" }, { value: "shop", label: "ร้านค้า" }, { value: "content", label: "บทความ" },
      { value: "event", label: "อีเวนต์" }, { value: "portfolio", label: "ผลงาน" }, { value: "booking", label: "จองคิว" },
    ],
  },
  { id: "platform", label: "อุปกรณ์", options: [{ value: "desktop", label: "Desktop" }, { value: "tablet", label: "Tablet" }, { value: "mobile", label: "Mobile" }] },
  {
    id: "tone", label: "โทน", options: [
      { value: "formal", label: "ทางการ" }, { value: "friendly", label: "เป็นกันเอง" }, { value: "premium", label: "พรีเมียม" },
      { value: "playful", label: "สนุกสนาน" }, { value: "technical", label: "เทคนิค" },
    ],
  },
  { id: "density", label: "ความแน่น", options: [{ value: "relaxed", label: "โปร่ง" }, { value: "standard", label: "ปกติ" }, { value: "compact", label: "แน่น" }] },
];

function BriefForm({ meta, text, active }: { meta: BriefMeta; text: string; active: boolean }) {
  const [answers, setAnswers] = useState<Record<string, string>>(meta.defaults);
  const set = (k: string, v: string) => setAnswers((a) => ({ ...a, [k]: v }));
  const submit = (skip: boolean) => {
    const ds = designSystems.find((d) => d.id === answers.designSystem)?.name ?? answers.designSystem;
    const label = (id: string) => questions.find((q) => q.id === id)?.options.find((o) => o.value === answers[id])?.label;
    void sendChat(
      skip
        ? { text: meta.prompt, frameId: meta.frameId, skipBrief: true, displayText: `${meta.prompt}\n(ข้ามคำถาม)` }
        : {
            text: meta.prompt, frameId: meta.frameId, brief: answers,
            displayText: `${meta.prompt}\n${[label("pageType"), label("platform"), ds, label("tone"), label("density")].filter(Boolean).join(" · ")}`,
          },
    );
  };
  if (!active) {
    return (
      <div className="msg msg-assistant text-[12.5px] text-[var(--ed-muted)]">
        <Check size={12} className="mr-1 inline" /> ถามรายละเอียดก่อนสร้าง · ตอบแล้ว
      </div>
    );
  }
  return (
    <div className="card space-y-3 p-3.5">
      <p className="text-[13px] text-[var(--ed-text)]">{text}</p>
      {questions.map((q) => (
        <div key={q.id} className="space-y-1.5">
          <div className="label">{q.label}</div>
          <div className="flex flex-wrap gap-1.5">
            {q.options.map((o) => (
              <button key={o.value} disabled={!active} className={`chip ${answers[q.id] === o.value ? "is-on" : ""}`} onClick={() => set(q.id, o.value)}>
                {o.label}
                {meta.defaults[q.id] === o.value && <span className="text-[10px] opacity-60">แนะนำ</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="space-y-1.5">
        <div className="label">Design system</div>
        <div className="grid grid-cols-2 gap-1.5">
          {designSystems.map((d) => (
            <button
              key={d.id}
              disabled={!active}
              onClick={() => set("designSystem", d.id)}
              className={`chip justify-start ${answers.designSystem === d.id ? "is-on" : ""}`}
            >
              <span className="flex overflow-hidden rounded-sm">
                {[d.theme.background, d.theme.foreground, d.theme.primary].map((c, i) => <span key={i} className="h-3 w-2.5" style={{ background: c }} />)}
              </span>
              <span className="truncate">{d.name}</span>
              {meta.defaults.designSystem === d.id && <span className="text-[10px] opacity-60">แนะนำ</span>}
            </button>
          ))}
        </div>
      </div>
      {active && (
        <div className="flex gap-2 pt-1">
          <button className="btn btn-primary" onClick={() => submit(false)}>
            <Sparkles size={14} /> สร้างเลย
          </button>
          <button className="btn btn-ghost" onClick={() => submit(true)}>ข้ามคำถาม</button>
        </div>
      )}
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
    <div className="mx-3 mb-2 rounded-xl border border-[var(--ed-warn)]/40 bg-[var(--ed-warn)]/8 p-2.5">
      <div className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold">
        <MessageSquare size={13} className="text-[var(--ed-warn)]" /> คอมเมนต์ที่รอส่ง · {frames?.[frameId]?.name}
      </div>
      <ol className="mb-2 max-h-28 space-y-1 overflow-auto">
        {batch.map((c) => (
          <li key={c.id} className="flex items-start gap-2 text-[12.5px]">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--ed-warn)] text-[11px] font-bold text-stone-900">
              {comments.indexOf(c) + 1}
            </span>
            <span className="min-w-0 flex-1"><b>{c.elementType}</b> {c.text}</span>
            <button className="icon-btn !size-5" onClick={() => setState((s) => ({ comments: s.comments.filter((x) => x.id !== c.id) }))}>
              <X size={12} />
            </button>
          </li>
        ))}
      </ol>
      <button className="btn btn-primary btn-sm" disabled={!!turn} onClick={send}>
        ส่ง {batch.length} คอมเมนต์ให้ AI แก้เฉพาะจุด
      </button>
      {comments.length > batch.length && <span className="ml-2 text-[11px] text-[var(--ed-muted)]">เฟรมอื่นจะส่งรอบถัดไป</span>}
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

  return (
    <div className="border-t border-[var(--ed-border)] p-3">
      <div className="rounded-2xl border border-[var(--ed-border)] bg-[var(--ed-panel)] p-2.5 shadow-sm focus-within:border-[var(--ed-border-strong)]">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11.5px] text-[var(--ed-muted)]">
          <span className="rounded-md bg-[var(--ed-hover)] px-1.5 py-0.5 font-medium text-[var(--ed-text)]">
            {frame ? `${frame.name}${el ? ` › ${el.type}` : ""}` : "เฟรมใหม่"}
          </span>
          {el && <span>คำสั่งจะใช้กับ element ที่เลือก</span>}
        </div>
        <textarea
          ref={ref}
          rows={2}
          className="block w-full resize-none border-0 bg-transparent px-1 text-[14px] outline-none placeholder:text-[var(--ed-muted)]"
          placeholder={turn ? "AI กำลังทำงาน" : "อธิบายหน้าที่ต้องการ หรือสั่งแก้ (Enter ส่ง)"}
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
          <button className={`chip ${wireframe ? "is-on" : ""}`} onClick={() => setState({ wireframe: !wireframe })} title="หยุดหลังวางโครง แล้วกด Fill เอง">
            Wireframe
          </button>
          {!turn && frame && hasSkeleton(frame.spec) && (
            <button className="chip" onClick={() => fill(frame.id)}><Sparkles size={12} /> Fill</button>
          )}
          {!turn && skeletonFrames.length > 1 && (
            <button className="chip" onClick={() => fill("")}><Sparkles size={12} /> Fill ทั้งหมด ({skeletonFrames.length})</button>
          )}
          <div className="ml-auto">
            {turn ? (
              <button className="send-btn !bg-red-600 !text-white" title="Stop" onClick={() => void api.stop(getState().projectId!)}>
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button className="send-btn" title="ส่ง" onClick={send} disabled={!draft.trim()}>
                <ArrowUp size={17} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
