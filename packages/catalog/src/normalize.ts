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
  craftSpec(spec, fixes);
  return { spec, fixes };
}

/**
 * Page-scaffold rules from impeccable's craft floor (pbakaus/impeccable, skill/reference/craft-floor.md,
 * Apache-2.0) that can be enforced on the block order alone: equal card grids are not the page structure
 * (skill-ban-identical-card-grids), and the hero-metric template does not open the page (skill-ban-hero-metric).
 */
function craftSpec(spec: Spec, fixes: string[]) {
  const root = spec.elements[spec.root];
  const children = root?.children ?? [];
  const el = (id: string) => spec.elements[id];

  // At most one block in the equal-cards layout; later ones switch to a layout that breaks the grid.
  const alternative: Record<string, string> = { FeatureGrid: "list", Testimonials: "spotlight" };
  let cards = 0;
  for (const id of children) {
    const e = el(id);
    if (!e || !(e.type in alternative) || (e.props as Record<string, unknown>).variant !== "cards") continue;
    if (++cards === 1) continue;
    (e.props as Record<string, unknown>).variant = alternative[e.type];
    fixes.push(`switched ${e.type} ${id} from cards to ${alternative[e.type]}: one equal card grid per page`);
  }

  // A persuade opening carries its action (mode-persuade.md): give an empty Hero a primary button.
  for (const id of children) {
    const e = el(id);
    if (e?.type !== "Hero" || (e.slots?.actions?.length ?? 0) > 0) continue;
    const btn = `${id}-action`;
    spec.elements[btn] = { type: "Button", props: { ...(componentDefs.Button.placeholder as object), skeleton: true }, children: [] };
    e.slots = { ...e.slots, actions: [btn] };
    fixes.push(`added a primary Button to Hero ${id}: the opening needs its action`);
  }

  // A page with its own form closes on that form: a CTA band on top of it repeats the ask.
  const form = children.find((id) => ["ContactForm", "Newsletter"].includes(el(id)?.type ?? ""));
  if (form) {
    for (const id of children.filter((id) => el(id)?.type === "CTA")) {
      dropTree(spec, id);
      children.splice(children.indexOf(id), 1);
      fixes.push(`removed CTA ${id}: the ${el(form)?.type ?? "form"} already closes the page`);
    }
  }

  // Reading order of a landing page (one with a Hero): what it is, proof, price, comparison, objections,
  // then contact. Task screens without a Hero keep their form where the composer put it.
  // Other sections keep the order the composer chose; only these move later, in this order.
  const landing = children.some((id) => el(id)?.type === "Hero");
  const late: Record<string, number> = { Pricing: 1, ComparisonTable: 2, FAQ: 3, ContactInfo: 4, ContactForm: 5 };
  const middle = children.filter((id) => !["Banner", "Navbar", "Hero", "CTA", "Footer"].includes(el(id)?.type ?? ""));
  const ordered = [...middle].sort((x, y) => (late[el(x)?.type ?? ""] ?? 0) - (late[el(y)?.type ?? ""] ?? 0));
  if (landing && ordered.some((id, i) => id !== middle[i])) {
    let k = 0;
    for (let i = 0; i < children.length; i++) if (middle.includes(children[i])) children[i] = ordered[k++];
    fixes.push("ordered the page as story, proof, price, comparison, questions, contact");
  }

  // A form block without fields is just a button: give it name, contact and message fields.
  for (const id of children) {
    const e = el(id);
    if (e?.type !== "ContactForm" || (e.slots?.fields?.length ?? 0) > 0) continue;
    const add = (key: string, type: "Input" | "Textarea", props: Record<string, unknown> = {}) => {
      spec.elements[`${id}-${key}`] = { type, props: { ...(componentDefs[type].placeholder as object), ...props, skeleton: true }, children: [] };
      return `${id}-${key}`;
    };
    e.slots = { ...e.slots, fields: [add("name", "Input"), add("contact", "Input", { inputType: "tel" }), add("message", "Textarea")] };
    fixes.push(`added fields to ContactForm ${id}`);
  }

  // Stats right under the Hero is the hero-metric template; move it below the next content section.
  const hero = children.findIndex((id) => el(id)?.type === "Hero");
  if (hero >= 0 && el(children[hero + 1] ?? "")?.type === "Stats") {
    const next = children.findIndex((id, i) => i > hero + 1 && !["CTA", "Footer"].includes(el(id)?.type ?? ""));
    if (next > 0) {
      const [stats] = children.splice(hero + 1, 1);
      children.splice(next, 0, stats);
      fixes.push(`moved Stats ${stats} below the next section: no hero-metric opening`);
    }
  }
}

function dropTree(spec: Spec, id: string) {
  const e = spec.elements[id];
  if (!e) return;
  for (const c of [...(e.children ?? []), ...Object.values(e.slots ?? {}).flat()]) dropTree(spec, c);
  delete spec.elements[id];
}
