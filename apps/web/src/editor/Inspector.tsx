import { DEVICES, componentDefs, isComponentName, propsSchema, type Device } from "@ui-factory/catalog";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { runOp } from "./api";
import { SchemaField, type JSONSchema } from "./SchemaForm";
import { useEditor } from "./store";

export function Inspector() {
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const turn = useEditor((s) => s.turn);
  const frame = selection.frameId ? doc?.frames[selection.frameId] : undefined;
  const el = frame && selection.elementId ? frame.spec?.elements[selection.elementId] : undefined;
  const locked = !!frame && turn?.frameId === frame.id;

  return (
    <aside className="panel flex w-80 shrink-0 flex-col border-l">
      <div className="border-b border-[var(--ed-border)] px-3 py-2.5 font-semibold">Props inspector</div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
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
          />
        )}
      </div>
    </aside>
  );
}

function FrameProps({ frameId }: { frameId: string }) {
  const frame = useEditor((s) => s.doc?.frames[frameId]);
  const [name, setName] = useState(frame?.name ?? "");
  if (!frame) return null;
  return (
    <div className="space-y-3">
      <div className="label">Frame</div>
      <label className="block space-y-1">
        <span className="label block">name</span>
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== frame.name && void runOp("update_frame", { frameId, name })}
        />
      </label>
      <label className="block space-y-1">
        <span className="label block">device</span>
        <select
          className="field"
          value={frame.device}
          onChange={(e) => void runOp("update_frame", { frameId, device: e.target.value as Device })}
        >
          {(Object.keys(DEVICES) as Device[]).map((d) => <option key={d} value={d}>{DEVICES[d].label} ({DEVICES[d].width}px)</option>)}
        </select>
      </label>
      <button className="btn btn-danger" onClick={() => confirm("ลบเฟรมนี้?") && void runOp("delete_frame", { frameId })}>
        ลบเฟรม
      </button>
    </div>
  );
}

function ElementProps({ frameId, id, type, props, on, locked }: {
  frameId: string;
  id: string;
  type: string;
  props: Record<string, unknown>;
  on?: Record<string, { action: string; params?: { frameId?: string } }>;
  locked: boolean;
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
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dirty = useRef(false);

  // Accept server updates when the user is not mid-edit.
  useEffect(() => {
    if (!dirty.current) setDraft(props);
  }, [props]);

  const commit = (next: Record<string, unknown>) => {
    setDraft(next);
    dirty.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const result = isComponentName(type) ? propsSchema(type).safeParse(next) : null;
      if (result && !result.success) {
        setError(result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"));
        return;
      }
      setError(null);
      const { skeleton: _, ...clean } = next;
      await runOp("update_props", { frameId, id, props: clean, replace: true });
      dirty.current = false;
    }, 500);
  };

  if (!schema) return <p>ไม่รู้จัก type {type}</p>;
  const def = isComponentName(type) ? componentDefs[type] : null;
  const navTarget = on?.press?.action === "navigate" ? on.press.params?.frameId ?? "" : "";

  return (
    <fieldset disabled={locked} className="space-y-3">
      <div>
        <div className="text-[14px] font-semibold">{type}</div>
        <div className="text-[12px] text-[var(--ed-muted)]">{def?.description}</div>
        <div className="mt-1 font-mono text-[11px] text-[var(--ed-muted)]">id: {id}</div>
      </div>
      {draft.skeleton === true && (
        <div className="rounded-md bg-amber-500/10 px-2 py-1.5 text-[12px] text-amber-700 dark:text-amber-300">
          ยังเป็น skeleton กด Fill ในแชทเพื่อให้ AI เติมเนื้อหา หรือแก้ props เองด้านล่าง
        </div>
      )}
      <SchemaField schema={schema} value={draft} onChange={(v) => commit(v as Record<string, unknown>)} />
      {error && <pre className="whitespace-pre-wrap text-[11px] text-red-600">{error}</pre>}
      {def?.events?.includes("press") && (
        <label className="block space-y-1 border-t border-[var(--ed-border)] pt-3">
          <span className="label block">เมื่อกด (prototype)</span>
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
