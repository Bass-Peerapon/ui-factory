import { DEVICES, componentDefs, isComponentName, propsSchema, type Device } from "@ui-factory/catalog";
import { CheckCircle2, ChevronRight, GripVertical, Loader2, PlusCircle, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { runOp } from "./api";
import { deviceIcon, iconFor } from "./icons";
import { SchemaField, type JSONSchema } from "./SchemaForm";
import { setState, useEditor } from "./store";

export function Inspector() {
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const turn = useEditor((s) => s.turn);
  const frame = selection.frameId ? doc?.frames[selection.frameId] : undefined;
  const el = frame && selection.elementId ? frame.spec?.elements[selection.elementId] : undefined;
  const locked = !!frame && turn?.frameId === frame.id;

  return (
    <aside className="panel flex w-[340px] shrink-0 flex-col border-l">
      <div className="flex h-[47px] items-center border-b border-[var(--ed-border)] px-4">
        <span className="text-[15px] font-semibold text-[var(--ed-strong)]">{el ? "Props inspector" : "Frame"}</span>
        <button className="icon-btn ml-auto" title="ปิด" onClick={() => setState({ selection: { frameId: null, elementId: null } })}>
          <X size={17} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {!frame && <p className="text-[var(--ed-muted)]">เลือกเฟรมหรือ element บน canvas</p>}
        {frame && !el && <FrameProps key={frame.id} frameId={frame.id} />}
        {frame && el && selection.elementId && (
          <ElementProps
            key={`${frame.id}/${selection.elementId}`}
            frameId={frame.id}
            id={selection.elementId}
            type={el.type}
            props={el.props as Record<string, unknown>}
            on={(el as { on?: Record<string, { action: string; params?: { frameId?: string } }> }).on}
            locked={locked}
            slots={
              <SlotLists frameId={frame.id} id={selection.elementId} slots={el.slots ?? {}} names={isComponentName(el.type) ? componentDefs[el.type].slots ?? [] : []}
                locked={locked} />
            }
          />
        )}
      </div>
    </aside>
  );
}

function Header({ icon: Icon, title, desc, id }: { icon: typeof X; title: string; desc?: string; id?: string }) {
  return (
    <div className="mb-4 flex gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--ed-border)] bg-[var(--ed-panel-2)]"><Icon size={18} /></span>
      <div className="min-w-0">
        <div className="text-[15px] font-semibold text-[var(--ed-strong)]">{title}</div>
        {desc && <div className="text-[12.5px] leading-snug text-[var(--ed-muted)]">{desc}</div>}
        {id && <span className="tag tag-muted mt-1.5 font-mono">id: {id}</span>}
      </div>
    </div>
  );
}

function FrameProps({ frameId }: { frameId: string }) {
  const frame = useEditor((s) => s.doc?.frames[frameId]);
  const [name, setName] = useState(frame?.name ?? "");
  if (!frame) return null;
  return (
    <div className="space-y-4">
      <Header icon={deviceIcon[frame.device]} title={frame.name} desc={`${DEVICES[frame.device].label} · ${DEVICES[frame.device].width}px`} />
      <label className="block space-y-1.5">
        <span className="field-label">ชื่อเฟรม</span>
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== frame.name && void runOp("update_frame", { frameId, name })}
        />
      </label>
      <div className="space-y-1.5">
        <span className="field-label">อุปกรณ์</span>
        <div className="seg seg-block">
          {(Object.keys(DEVICES) as Device[]).map((d) => (
            <button key={d} className={frame.device === d ? "is-on" : ""} onClick={() => void runOp("update_frame", { frameId, device: d })}>
              {DEVICES[d].label}
            </button>
          ))}
        </div>
      </div>
      <button className="btn btn-danger w-full" onClick={() => confirm("ลบเฟรมนี้?") && void runOp("delete_frame", { frameId })}>
        <Trash2 size={14} /> ลบเฟรม
      </button>
    </div>
  );
}

const slotType = (slot: string) => (slot === "fields" ? "Input" : "Button");

/** Elements placed in the selected element's slots (e.g. Hero actions), reorderable by drag. */
function SlotLists({ frameId, id, slots, names, locked }: {
  frameId: string; id: string; slots: Record<string, string[]>; names: readonly string[]; locked: boolean;
}) {
  const elements = useEditor((s) => s.doc?.frames[frameId]?.spec?.elements);
  const [drag, setDrag] = useState<{ slot: string; from: number } | null>(null);
  if (!elements || names.length === 0) return null;
  return (
    <>
      {names.map((slot) => {
        const keys = slots[slot] ?? [];
        return (
          <div key={slot} className="space-y-1.5">
            <div className="field-label font-semibold">{slot} ({keys.length})</div>
            {keys.map((k, i) => {
              const child = elements[k];
              if (!child) return null;
              const Icon = iconFor(child.type);
              const label = (child.props as { label?: string; text?: string }).label ?? (child.props as { text?: string }).text ?? k;
              return (
                <div
                  key={k}
                  draggable={!locked}
                  onDragStart={() => setDrag({ slot, from: i })}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (drag && drag.slot === slot && drag.from !== i) void runOp("move_node", { frameId, id: keys[drag.from], parentId: id, slot, index: i });
                    setDrag(null);
                  }}
                  className="flex h-10 items-center gap-2 rounded-lg border border-[var(--ed-border)] bg-[var(--ed-panel)] pr-1 pl-1.5"
                >
                  <GripVertical size={15} className="cursor-grab text-[var(--ed-faint)]" />
                  <button
                    className="flex min-w-0 flex-1 items-center gap-2 border-0 bg-transparent p-0 text-left"
                    onClick={() => setState({ selection: { frameId, elementId: k } })}
                  >
                    <Icon size={15} className="shrink-0 text-[var(--ed-muted)]" />
                    <span className="truncate text-[12.5px]"><b className="font-medium">{child.type}</b> · {String(label)}</span>
                    <ChevronRight size={15} className="ml-auto shrink-0 text-[var(--ed-faint)]" />
                  </button>
                  <button className="icon-btn !size-7" title="ลบ" disabled={locked} onClick={() => void runOp("remove_node", { frameId, id: k })}>
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
            <button
              className="btn btn-soft btn-sm"
              disabled={locked}
              onClick={() => void runOp("add_node", { frameId, type: slotType(slot), parentId: id, slot, skeleton: true })}
            >
              <PlusCircle size={14} /> เพิ่ม {slotType(slot)}
            </button>
          </div>
        );
      })}
    </>
  );
}

function ElementProps({ frameId, id, type, props, on, locked, slots }: {
  frameId: string;
  id: string;
  type: string;
  props: Record<string, unknown>;
  on?: Record<string, { action: string; params?: { frameId?: string } }>;
  locked: boolean;
  slots?: React.ReactNode;
}) {
  const frames = useEditor((s) => s.doc?.frames);
  const schema = useMemo(() => {
    if (!isComponentName(type)) return null;
    const s = z.toJSONSchema(propsSchema(type)) as JSONSchema;
    const { skeleton: _, ...properties } = s.properties ?? {};
    return { ...s, properties };
  }, [type]);
  const [draft, setDraft] = useState(props);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dirty = useRef(false);

  // Accept server updates when the user is not mid-edit.
  useEffect(() => {
    if (!dirty.current) setDraft(props);
  }, [props]);

  const commit = (next: Record<string, unknown>) => {
    setDraft(next);
    dirty.current = true;
    setStatus("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const result = isComponentName(type) ? propsSchema(type).safeParse(next) : null;
      if (result && !result.success) {
        setError(result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"));
        setStatus("idle");
        return;
      }
      setError(null);
      const { skeleton: _, ...clean } = next;
      await runOp("update_props", { frameId, id, props: clean, replace: true });
      dirty.current = false;
      setStatus("saved");
    }, 500);
  };

  if (!schema) return <p>ไม่รู้จัก type {type}</p>;
  const def = isComponentName(type) ? componentDefs[type] : null;
  const navTarget = on?.press?.action === "navigate" ? on.press.params?.frameId ?? "" : "";

  return (
    <fieldset disabled={locked} className="m-0 min-w-0 space-y-4 border-0 p-0">
      <Header icon={iconFor(type)} title={type} desc={def?.description} id={id} />
      {draft.skeleton === true && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-300">
          ยังเป็น skeleton กด Fill ในแชทเพื่อให้ AI เติมเนื้อหา หรือแก้ props เองด้านล่าง
        </div>
      )}
      <SchemaField schema={schema} value={draft} onChange={(v) => commit(v as Record<string, unknown>)} />
      {slots}
      {error && <pre className="rounded-lg bg-red-500/8 p-2 text-[11px] whitespace-pre-wrap text-[var(--ed-danger)]">{error}</pre>}
      {status !== "idle" && !error && (
        <div className={`flex items-center gap-1.5 text-[12.5px] font-medium ${status === "saved" ? "text-[var(--ed-ok)]" : "text-[var(--ed-muted)]"}`}>
          {status === "saved" ? <CheckCircle2 size={16} className="fill-[var(--ed-ok)] text-white" /> : <Loader2 size={14} className="spin" />}
          {status === "saved" ? "บันทึกแล้ว" : "กำลังบันทึก"}
        </div>
      )}
      {def?.events?.includes("press") && (
        <label className="block space-y-1.5 border-t border-[var(--ed-border)] pt-4">
          <span className="field-label font-semibold">เมื่อกด (prototype)</span>
          <select
            className="field"
            value={navTarget}
            onChange={(e) => void runOp("set_navigation", { frameId, id, target: e.target.value || null })}
          >
            <option value="">ไม่มี</option>
            {Object.values(frames ?? {}).filter((f) => f.id !== frameId).map((f) => (
              <option key={f.id} value={f.id}>ไปที่เฟรม {f.name}</option>
            ))}
          </select>
        </label>
      )}
    </fieldset>
  );
}
