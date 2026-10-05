import type { Spec } from "@json-render/core";
import { componentDefs } from "./components";

const kindOf = (type: string) => (componentDefs as Record<string, { kind: string; slots?: readonly string[] }>)[type]?.kind;

/**
 * Repairs placement the composer is not constrained to follow: blocks must be children of the root,
 * primitives must sit in a slot the parent declares. Misplaced blocks move to the root right after
 * their top-level ancestor; misplaced primitives are dropped. Returns a new spec and a list of fixes.
 */
export function normalizeSpec(input: Spec): { spec: Spec; fixes: string[] } {
  const spec = structuredClone(input);
  const fixes: string[] = [];
  const root = spec.elements[spec.root];
  if (!root) return { spec, fixes };
  root.children ??= [];

  const parentOf = (id: string): string | null => {
    for (const [pid, el] of Object.entries(spec.elements)) {
      if (el.children?.includes(id) || Object.values(el.slots ?? {}).some((k) => k.includes(id))) return pid;
    }
    return null;
  };
  const topLevel = (id: string) => {
    let cur = id;
    for (let p = parentOf(cur); p && p !== spec.root; p = parentOf(cur)) cur = p;
    return cur;
  };
  const drop = (id: string) => {
    const el = spec.elements[id];
    if (!el) return;
    for (const c of [...(el.children ?? []), ...Object.values(el.slots ?? {}).flat()]) drop(c);
    delete spec.elements[id];
  };

  for (const [pid, el] of Object.entries(spec.elements)) {
    if (!spec.elements[pid]) continue;
    const declared = (componentDefs as Record<string, { slots?: readonly string[] }>)[el.type]?.slots ?? [];
    const lists: [string | null, string[]][] = [[null, el.children ?? []], ...Object.entries(el.slots ?? {})];
    for (const [slot, keys] of lists) {
      for (const id of [...keys]) {
        const child = spec.elements[id];
        if (!child) continue;
        const kind = kindOf(child.type);
        const ok =
          kind === "block" ? pid === spec.root && slot === null
          : kind === "primitive" ? slot !== null && declared.includes(slot)
          : false;
        if (ok) continue;
        keys.splice(keys.indexOf(id), 1);
        if (kind === "block") {
          const anchor = topLevel(pid);
          const at = root.children.indexOf(anchor);
          root.children.splice(at >= 0 ? at + 1 : root.children.length, 0, id);
          fixes.push(`moved ${child.type} ${id} out of ${el.type}${slot ? `.${slot}` : ""} to the page root`);
        } else {
          drop(id);
          fixes.push(`removed ${child.type} ${id} from ${el.type}${slot ? `.${slot}` : " children"}`);
        }
      }
    }
    for (const [slot, keys] of Object.entries(el.slots ?? {})) if (keys.length === 0) delete el.slots![slot];
  }
  // Page chrome: Banner and Navbar open the page; the closing CTA and the Footer end it.
  const order = (id: string) => ({ Banner: 0, Navbar: 1, CTA: 3, Footer: 4 })[spec.elements[id]?.type ?? ""] ?? 2;
  const children = root.children ?? [];
  const sorted = [...children].sort((a, b) => order(a) - order(b));
  if (sorted.some((id, i) => id !== children[i])) {
    root.children = sorted;
    fixes.push("moved page chrome (Banner, Navbar, CTA, Footer) to the page edges");
  }
  return { spec, fixes };
}
