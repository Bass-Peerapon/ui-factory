import { componentDefs, type ComponentName, type Kind, type Spec } from "@ui-factory/catalog";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { runOp } from "./api";
import { findParent, siblings } from "./specTree";
import { setState, useEditor } from "./store";

const kindLabel: Record<Kind, string> = { layout: "Layout", block: "Blocks", primitive: "Primitives (shadcn/ui)" };

export function Components() {
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const turn = useEditor((s) => s.turn);
  const frame = selection.frameId ? doc?.frames[selection.frameId] : undefined;

  const add = (type: ComponentName) => {
    if (!frame) return setState({ error: "เลือกเฟรมก่อนเพิ่ม component" });
    void runOp("add_node", { frameId: frame.id, type, afterId: selection.elementId, skeleton: true });
  };

  const groups = (["block", "primitive"] as Kind[]).map((k) => ({
    kind: k,
    items: (Object.keys(componentDefs) as ComponentName[]).filter((n) => componentDefs[n].kind === k),
  }));
  return (
    <div className="space-y-4">
      <p className="px-1 text-[12px] text-[var(--ed-muted)]">
        คลิกเพื่อเพิ่มลงเฟรมที่เลือก (ต่อจาก element ที่เลือก) จะได้ skeleton แล้วกด Fill เพื่อให้ AI เติมเนื้อหา
      </p>
      {groups.map((g) => (
        <div key={g.kind}>
          <div className="label mb-1 px-1">{kindLabel[g.kind]}</div>
          {g.items.map((n) => (
            <button
              key={n}
              className="layer w-full border-0 bg-transparent px-2 text-left text-[var(--ed-text)]"
              title={componentDefs[n].description}
              onClick={() => add(n)}
              disabled={!frame || turn?.frameId === frame?.id}
            >
              <span className="font-medium">{n}</span>
              <span className="truncate text-[11px] text-[var(--ed-muted)]">{componentDefs[n].description}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

export function Layers() {
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const frame = selection.frameId ? doc?.frames[selection.frameId] : undefined;
  if (!frame) return <p className="px-1 text-[var(--ed-muted)]">เลือกเฟรมบน canvas</p>;
  if (!frame.spec) return <p className="px-1 text-[var(--ed-muted)]">เฟรมนี้ยังว่าง</p>;
  return <LayerNode spec={frame.spec} frameId={frame.id} id={frame.spec.root} depth={0} selected={selection.elementId} />;
}

function LayerNode({ spec, frameId, id, depth, selected }: {
  spec: Spec; frameId: string; id: string; depth: number; selected: string | null;
}) {
  const el = spec.elements[id];
  const turn = useEditor((s) => s.turn);
  if (!el) return null;
  const parent = findParent(spec, id);
  const sibs = parent ? siblings(spec, parent) : [];
  const locked = turn?.frameId === frameId;
  const move = (delta: number) =>
    parent && void runOp("move_node", { frameId, id, parentId: parent.parentId, slot: parent.slot, index: parent.index + delta });
  const skeleton = (el.props as { skeleton?: boolean }).skeleton;

  return (
    <div>
      <div
        className={`layer ${selected === id ? "is-selected" : ""}`}
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={() => setState({ selection: { frameId, elementId: id } })}
      >
        <span className="font-medium">{el.type}</span>
        <span className="truncate text-[11px] text-[var(--ed-muted)]">{skeleton ? "skeleton" : id}</span>
        {parent && !locked && (
          <span className="actions" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn" disabled={parent.index === 0} onClick={() => move(-1)} title="ขึ้น"><ArrowUp size={13} /></button>
            <button className="icon-btn" disabled={parent.index >= sibs.length - 1} onClick={() => move(1)} title="ลง"><ArrowDown size={13} /></button>
            <button className="icon-btn" onClick={() => void runOp("remove_node", { frameId, id })} title="ลบ"><Trash2 size={13} /></button>
          </span>
        )}
      </div>
      {el.children?.map((c) => <LayerNode key={c} spec={spec} frameId={frameId} id={c} depth={depth + 1} selected={selected} />)}
      {Object.entries(el.slots ?? {}).map(([slot, keys]) => (
        <div key={slot}>
          <div className="slot-label" style={{ paddingLeft: 6 + (depth + 1) * 14 }}>{slot}</div>
          {keys.map((c) => <LayerNode key={c} spec={spec} frameId={frameId} id={c} depth={depth + 2} selected={selected} />)}
        </div>
      ))}
    </div>
  );
}
