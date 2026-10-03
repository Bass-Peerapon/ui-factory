// Writes fixtures/showcase-skeleton.json: every block as a skeleton, for render and fill checks.
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { blocks, placeholderProps, type ComponentName, type Spec } from "../src/index";

const slotFill: Record<string, Record<string, ComponentName[]>> = {
  Hero: { actions: ["Button", "Button"] },
  CTA: { actions: ["Button"] },
  ContactForm: { fields: ["Input", "Textarea"], actions: ["Button"] },
  ImageText: { actions: ["Button"] },
  Newsletter: { fields: ["Input"], actions: ["Button"] },
  AuthForm: { fields: ["Input", "Input", "Checkbox"], actions: ["Button"] },
  EmptyState: { actions: ["Button"] },
};
const spec: Spec = { root: "page", state: {}, elements: { page: { type: "Page", props: placeholderProps("Page"), children: [] } } };
let n = 0;
for (const type of Object.keys(blocks) as ComponentName[]) {
  const id = `${type.toLowerCase()}`;
  spec.elements[id] = { type, props: placeholderProps(type), children: [] };
  spec.elements.page.children!.push(id);
  for (const [slot, items] of Object.entries(slotFill[type] ?? {})) {
    spec.elements[id].slots = { ...spec.elements[id].slots, [slot]: items.map((t) => {
      const cid = `${t.toLowerCase()}-${++n}`;
      spec.elements[cid] = { type: t, props: placeholderProps(t), children: [] };
      return cid;
    }) };
  }
}
const out = resolve(dirname(fileURLToPath(import.meta.url)), "../fixtures/showcase-skeleton.json");
writeFileSync(out, JSON.stringify(spec, null, 1) + "\n");
console.log("wrote", out, Object.keys(spec.elements).length, "elements");
