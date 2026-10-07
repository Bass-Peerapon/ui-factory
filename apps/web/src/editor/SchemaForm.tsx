import { PlusCircle, Trash2 } from "lucide-react";

/** Minimal JSON Schema shape produced by z.toJSONSchema for catalog props. */
export interface JSONSchema {
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: unknown[];
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
  description?: string;
  anyOf?: JSONSchema[];
}

type Json = unknown;

function defaultFor(s: JSONSchema): Json {
  if (s.enum) return s.enum[0];
  switch (s.type) {
    case "string": return "";
    case "number": case "integer": return s.minimum ?? 0;
    case "boolean": return false;
    case "array": return [];
    case "object":
      return Object.fromEntries(Object.entries(s.properties ?? {}).map(([k, v]) => [k, defaultFor(v)]));
    default: return null;
  }
}

const isLong = (v: unknown, label?: string) =>
  (typeof v === "string" && v.length > 36) || (!!label && /^(title|subtitle|description|body|quote|text)$/.test(label));

/** Renders an editable form for any value described by a JSON Schema. */
export function SchemaField({ schema, value, onChange, label }: {
  schema: JSONSchema; value: Json; onChange: (v: Json) => void; label?: string;
}) {
  const wrap = (el: React.ReactNode) => (
    <label className="block space-y-1.5">
      {label && <span className="field-label">{label}</span>}
      {el}
    </label>
  );

  if (schema.enum && schema.enum.length <= 4) {
    return (
      <div className="space-y-1.5">
        {label && <span className="field-label">{label}</span>}
        <div className="seg seg-block">
          {schema.enum.map((o) => (
            <button key={String(o)} type="button" className={value === o ? "is-on" : ""} onClick={() => onChange(o)}>{String(o)}</button>
          ))}
        </div>
      </div>
    );
  }
  if (schema.enum) {
    return wrap(
      <select className="field" value={String(value)} onChange={(e) => onChange(e.target.value)}>
        {schema.enum.map((o) => <option key={String(o)} value={String(o)}>{String(o)}</option>)}
      </select>,
    );
  }
  switch (schema.type) {
    case "string":
      return wrap(
        isLong(value, label) ? (
          <textarea className="field" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} rows={2} />
        ) : (
          <input className="field" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
        ),
      );
    case "number":
    case "integer":
      return wrap(
        <input
          className="field"
          type="number"
          step={schema.type === "integer" ? 1 : 0.05}
          value={Number(value ?? 0)}
          onChange={(e) => onChange(Number(e.target.value))}
        />,
      );
    case "boolean":
      return (
        <label className="flex items-center gap-2">
          <input type="checkbox" className="size-4 accent-[var(--ed-brand)]" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          <span className="field-label">{label}</span>
        </label>
      );
    case "array": {
      const arr = Array.isArray(value) ? value : [];
      const item = schema.items ?? {};
      const canAdd = schema.maxItems === undefined || arr.length < schema.maxItems;
      const canRemove = arr.length > (schema.minItems ?? 0);
      return (
        <div className="space-y-1.5">
          {label && <span className="field-label font-semibold">{label} ({arr.length})</span>}
          <div className="space-y-2">
            {arr.map((v, i) => (
              <div key={i} className="relative rounded-lg border border-[var(--ed-border)] bg-[var(--ed-panel-2)] p-2.5 pr-9">
                <SchemaField
                  schema={item}
                  value={v}
                  onChange={(nv) => onChange(arr.map((x, j) => (j === i ? nv : x)))}
                />
                <button
                  type="button"
                  className="icon-btn !size-7 absolute top-1.5 right-1.5"
                  disabled={!canRemove}
                  onClick={() => onChange(arr.filter((_, j) => j !== i))}
                  title="ลบ"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-soft btn-sm" disabled={!canAdd} onClick={() => onChange([...arr, defaultFor(item)])}>
              <PlusCircle size={14} /> เพิ่ม
            </button>
          </div>
        </div>
      );
    }
    case "object": {
      const obj = (value ?? {}) as Record<string, Json>;
      return (
        <div className="space-y-3">
          {label && <span className="field-label font-semibold">{label}</span>}
          {Object.entries(schema.properties ?? {}).map(([k, s]) => (
            <SchemaField key={k} label={k} schema={s} value={obj[k]} onChange={(nv) => onChange({ ...obj, [k]: nv })} />
          ))}
        </div>
      );
    }
    default:
      return wrap(<code className="text-[11px]">{JSON.stringify(value)}</code>);
  }
}
