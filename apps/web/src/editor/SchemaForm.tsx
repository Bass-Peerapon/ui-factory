import { Plus, X } from "lucide-react";

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

const isLong = (v: unknown) => typeof v === "string" && v.length > 40;

/** Renders an editable form for any value described by a JSON Schema. */
export function SchemaField({ schema, value, onChange, label }: {
  schema: JSONSchema; value: Json; onChange: (v: Json) => void; label?: string;
}) {
  const wrap = (el: React.ReactNode) => (
    <label className="block space-y-1">
      {label && <span className="label block">{label}</span>}
      {el}
    </label>
  );

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
        isLong(value) ? (
          <textarea className="field" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} rows={3} />
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
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          <span className="label">{label}</span>
        </label>
      );
    case "array": {
      const arr = Array.isArray(value) ? value : [];
      const item = schema.items ?? {};
      const canAdd = schema.maxItems === undefined || arr.length < schema.maxItems;
      const canRemove = arr.length > (schema.minItems ?? 0);
      return (
        <div className="space-y-1">
          {label && <span className="label block">{label} ({arr.length})</span>}
          <div className="space-y-2 border-l-2 border-[var(--ed-border)] pl-2">
            {arr.map((v, i) => (
              <div key={i} className="relative pr-6">
                <SchemaField
                  schema={item}
                  value={v}
                  onChange={(nv) => onChange(arr.map((x, j) => (j === i ? nv : x)))}
                />
                <button
                  className="icon-btn absolute top-0 right-0"
                  disabled={!canRemove}
                  onClick={() => onChange(arr.filter((_, j) => j !== i))}
                  title="ลบ"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <button className="btn !h-6 !text-[12px]" disabled={!canAdd} onClick={() => onChange([...arr, defaultFor(item)])}>
              <Plus size={12} /> เพิ่ม
            </button>
          </div>
        </div>
      );
    }
    case "object": {
      const obj = (value ?? {}) as Record<string, Json>;
      return (
        <div className="space-y-2">
          {label && <span className="label block">{label}</span>}
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
