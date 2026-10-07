import { componentDefs, type ComponentName, type Spec } from "@ui-factory/catalog";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Folder, Search, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { runOp } from "./api";
import { deviceIcon, deviceLabel, iconFor } from "./icons";
import { findParent, siblings } from "./specTree";
import { setState, useEditor } from "./store";

/** Which frame the panel acts on. */
export function FrameContext() {
  const frame = useEditor((s) => (s.selection.frameId ? s.doc?.frames[s.selection.frameId] : undefined));
  if (!frame) {
    return <div className="mx-3 my-3 rounded-xl border border-dashed border-[var(--ed-border-strong)] px-3 py-2.5 text-[12.5px] text-[var(--ed-muted)]">เลือกเฟรมบน canvas</div>;
  }
  const Icon = deviceIcon[frame.device];
  return (
    <div className="mx-3 my-3 flex items-center gap-3 rounded-xl px-1 py-1">
      <span className="grid size-9 place-items-center rounded-full bg-[var(--ed-brand-soft)] text-[var(--ed-brand-ink)]"><Icon size={16} /></span>
      <div className="min-w-0 leading-tight">
        <div className="truncate font-semibold text-[var(--ed-strong)]">{frame.name}</div>
        <div className="text-[12px] text-[var(--ed-muted)]">{deviceLabel(frame.device)}</div>
      </div>
    </div>
  );
}

export function Components() {
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const turn = useEditor((s) => s.turn);
  const [q, setQ] = useState("");
  const frame = selection.frameId ? doc?.frames[selection.frameId] : undefined;

  const add = (type: ComponentName) => {
    if (!frame) return setState({ error: "เลือกเฟรมก่อนเพิ่ม component" });
    void runOp("add_node", { frameId: frame.id, type, afterId: selection.elementId, skeleton: true });
  };
  const names = (Object.keys(componentDefs) as ComponentName[]).filter(
    (n) => !q || `${n} ${componentDefs[n].description}`.toLowerCase().includes(q.toLowerCase()),
  );
  const groups = [
    { label: "Blocks", cols: "grid-cols-2", items: names.filter((n) => componentDefs[n].kind === "block") },
    { label: "Primitives (shadcn/ui)", cols: "grid-cols-3", items: names.filter((n) => componentDefs[n].kind === "primitive") },
  ];
  const disabled = !frame || turn?.frameId === frame?.id;
  return (
    <div className="space-y-3">
      <div className="hint">
        <Sparkles size={16} />
        <span>คลิกเพื่อเพิ่มลงเฟรมที่เลือก ต่อจาก element ที่เลือก แล้วกด Fill เพื่อให้ AI เติมเนื้อหา</span>
      </div>
      <div className="search">
        <Search size={15} />
        <input className="field" placeholder="ค้นหา blocks" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {groups.map((g) => g.items.length > 0 && (
        <div key={g.label}>
          <div className="label mb-2 px-0.5">{g.label}</div>
          <div className={`grid ${g.cols} gap-2`}>
            {g.items.map((n) => {
              const Icon = iconFor(n);
              return (
                <button key={n} className="block-tile" title={componentDefs[n].description} onClick={() => add(n)} disabled={disabled}>
                  <Icon size={16} />
                  <span className="truncate">{n}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {names.length === 0 && <p className="py-6 text-center text-[var(--ed-muted)]">ไม่พบ block</p>}
    </div>
  );
}

export function Layers() {
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const frame = selection.frameId ? doc?.frames[selection.frameId] : undefined;
  const spec = frame?.spec;

  // Ancestors of the selected element stay expanded.
  const path = useMemo(() => {
    const out = new Set<string>();
    if (!spec || !selection.elementId) return out;
    let id: string | undefined = selection.elementId;
    while (id) {
      out.add(id);
      id = findParent(spec, id)?.parentId;
    }
    return out;
  }, [spec, selection.elementId]);

  if (!frame) return null;
  if (!spec) return <p className="px-1 text-[var(--ed-muted)]">เฟรมนี้ยังว่าง</p>;
  const count = Object.values(spec.elements).filter((e) => isBlock(e.type)).length;
  const matches = q ? Object.entries(spec.elements).filter(([id, e]) => `${e.type} ${id}`.toLowerCase().includes(q.toLowerCase())) : [];
  const isOpen = (id: string, depth: number) => open[id] ?? (depth === 0 || path.has(id));
  const toggle = (id: string, depth: number) => setOpen((o) => ({ ...o, [id]: !isOpen(id, depth) }));

  return (
    <div className="space-y-2">
      <div className="search">
        <Search size={15} />
        <input className="field" placeholder="ค้นหา layer" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="px-1 text-[12px] text-[var(--ed-muted)]">{count} blocks</div>
      {q ? (
        matches.map(([id, e]) => (
          <LayerRow key={id} frameId={frame.id} spec={spec} id={id} depth={0} selected={selection.elementId} type={e.type} />
        ))
      ) : (
        <LayerNode spec={spec} frameId={frame.id} id={spec.root} depth={0} selected={selection.elementId} isOpen={isOpen} toggle={toggle} />
      )}
      {q && matches.length === 0 && <p className="px-1 text-[var(--ed-muted)]">ไม่พบ layer</p>}
    </div>
  );
}

const isBlock = (type: string) => (componentDefs as Record<string, { kind: string }>)[type]?.kind === "block";
const indent = (depth: number) => 4 + depth * 18;

function LayerNode({ spec, frameId, id, depth, selected, isOpen, toggle }: {
  spec: Spec; frameId: string; id: string; depth: number; selected: string | null;
  isOpen: (id: string, depth: number) => boolean; toggle: (id: string, depth: number) => void;
}) {
  const el = spec.elements[id];
  if (!el) return null;
  const slots = Object.entries(el.slots ?? {});
  const hasKids = (el.children?.length ?? 0) > 0 || slots.length > 0;
  const expanded = hasKids && isOpen(id, depth);
  const child = (c: string, d: number) => (
    <LayerNode key={c} spec={spec} frameId={frameId} id={c} depth={d} selected={selected} isOpen={isOpen} toggle={toggle} />
  );
  return (
    <div>
      <LayerRow frameId={frameId} spec={spec} id={id} depth={depth} selected={selected} type={el.type}
        twisty={hasKids ? { open: expanded, onToggle: () => toggle(id, depth) } : undefined} />
      {expanded && (
        <>
          {el.children?.map((c) => child(c, depth + 1))}
          {slots.map(([slot, keys]) => (
            <div key={slot}>
              <div className="slot-label" style={{ paddingLeft: indent(depth + 1) + 18 }}>
                <Folder size={15} className="text-[var(--ed-muted)]" /> {slot}
              </div>
              {keys.map((c) => child(c, depth + 2))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function LayerRow({ spec, frameId, id, depth, selected, type, twisty }: {
  spec: Spec; frameId: string; id: string; depth: number; selected: string | null; type: string;
  twisty?: { open: boolean; onToggle: () => void };
}) {
  const turn = useEditor((s) => s.turn);
  const el = spec.elements[id];
  const parent = findParent(spec, id);
  const sibs = parent ? siblings(spec, parent) : [];
  const locked = turn?.frameId === frameId;
  const move = (delta: number) =>
    parent && void runOp("move_node", { frameId, id, parentId: parent.parentId, slot: parent.slot, index: parent.index + delta });
  const skeleton = (el?.props as { skeleton?: boolean } | undefined)?.skeleton;
  const Icon = iconFor(type);

  return (
    <div
      className={`layer ${selected === id ? "is-selected" : ""}`}
      style={{ paddingLeft: indent(depth) }}
      onClick={() => setState({ selection: { frameId, elementId: id } })}
    >
      {twisty ? (
        <button className="twisty" onClick={(e) => (e.stopPropagation(), twisty.onToggle())}>
          {twisty.open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      ) : (
        <span className="w-4 shrink-0" />
      )}
      <Icon size={16} className="layer-icon" />
      <span className="truncate">
        <span className={`font-medium ${selected === id ? "text-[var(--ed-brand-ink)]" : "text-[var(--ed-strong)]"}`}>{type}</span>
        <span className="text-[var(--ed-muted)]"> / {skeleton ? "skeleton" : id}</span>
      </span>
      {parent && !locked && (
        <span className="actions" onClick={(e) => e.stopPropagation()}>
          <button className="icon-btn" disabled={parent.index === 0} onClick={() => move(-1)} title="ขึ้น"><ArrowUp size={13} /></button>
          <button className="icon-btn" disabled={parent.index >= sibs.length - 1} onClick={() => move(1)} title="ลง"><ArrowDown size={13} /></button>
          <button className="icon-btn" onClick={() => void runOp("remove_node", { frameId, id })} title="ลบ"><Trash2 size={13} /></button>
        </span>
      )}
    </div>
  );
}
