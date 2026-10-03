import type { Spec } from "@ui-factory/catalog";

export interface ParentRef {
  parentId: string;
  slot: string | null; // null = children (default slot)
  index: number;
}

/** Finds where an element sits in its parent. */
export function findParent(spec: Spec, id: string): ParentRef | null {
  for (const [pid, el] of Object.entries(spec.elements)) {
    const i = el.children?.indexOf(id) ?? -1;
    if (i >= 0) return { parentId: pid, slot: null, index: i };
    for (const [slot, keys] of Object.entries(el.slots ?? {})) {
      const j = keys.indexOf(id);
      if (j >= 0) return { parentId: pid, slot, index: j };
    }
  }
  return null;
}

export function siblings(spec: Spec, ref: ParentRef): string[] {
  const p = spec.elements[ref.parentId];
  return (ref.slot ? p.slots?.[ref.slot] : p.children) ?? [];
}

export function hasSkeleton(spec: Spec | null | undefined): boolean {
  return !!spec && Object.values(spec.elements).some((e) => (e.props as { skeleton?: boolean }).skeleton);
}
