// Checks the craft rules in normalizeSpec on a hand-written spec.
import assert from "node:assert/strict";
import { normalizeSpec, type Spec } from "../src/index";

const el = (type: string, props: Record<string, unknown> = {}) => ({ type, props, children: [] });
const input = {
  root: "page",
  elements: {
    page: { type: "Page", props: { title: "t" }, children: ["nav", "hero", "stats", "f1", "t1", "f2", "footer"] },
    nav: el("Navbar"),
    hero: el("Hero", { variant: "split" }),
    stats: el("Stats"),
    f1: el("FeatureGrid", { variant: "cards" }),
    t1: el("Testimonials", { variant: "cards" }),
    f2: el("FeatureGrid", { variant: "cards" }),
    footer: el("Footer"),
  },
} as unknown as Spec;

const { spec, fixes } = normalizeSpec(input);
const props = (id: string) => spec.elements[id].props as Record<string, unknown>;
assert.deepEqual(spec.elements.page.children, ["nav", "hero", "f1", "stats", "t1", "f2", "footer"]);
assert.equal(props("f1").variant, "cards");
assert.equal(props("t1").variant, "spotlight");
assert.equal(props("f2").variant, "list");
assert.equal(input.elements.f2.props.variant, "cards", "input must not be mutated");
assert.deepEqual(spec.elements.hero.slots?.actions, ["hero-action"]);
assert.equal(spec.elements["hero-action"].type, "Button");

const withForm = normalizeSpec({
  root: "page",
  elements: {
    page: { type: "Page", props: { title: "t" }, children: ["nav", "hero", "form", "info", "story", "cta", "footer"] },
    nav: el("Navbar"), hero: el("Hero", { variant: "split" }), form: el("ContactForm"), info: el("ContactInfo"),
    story: el("ImageText"), cta: { ...el("CTA", { variant: "band" }), slots: { actions: ["ctabtn"] } }, ctabtn: el("Button"), footer: el("Footer"),
  },
} as unknown as Spec);
assert.deepEqual(withForm.spec.elements.page.children, ["nav", "hero", "story", "info", "form", "footer"]);
assert.equal(withForm.spec.elements.ctabtn, undefined, "the CTA subtree is dropped");
assert.equal(withForm.spec.elements.form.slots?.fields?.length, 3, "an empty form gets fields");

const saas = normalizeSpec({
  root: "page",
  elements: {
    page: { type: "Page", props: { title: "t" }, children: ["nav", "hero", "faq", "pricing", "story", "steps", "compare", "footer"] },
    nav: el("Navbar"), hero: el("Hero", { variant: "split" }), faq: el("FAQ"), pricing: el("Pricing"),
    story: el("ImageText"), steps: el("Steps"), compare: el("ComparisonTable"), footer: el("Footer"),
  },
} as unknown as Spec);
assert.deepEqual(saas.spec.elements.page.children, ["nav", "hero", "story", "steps", "pricing", "compare", "faq", "footer"]);

const booking = normalizeSpec({
  root: "page",
  elements: {
    page: { type: "Page", props: { title: "t" }, children: ["nav", "form", "steps", "footer"] },
    nav: el("Navbar"), form: { ...el("ContactForm"), slots: { fields: ["f1"] } }, f1: el("Input"), steps: el("Steps"), footer: el("Footer"),
  },
} as unknown as Spec);
assert.deepEqual(booking.spec.elements.page.children, ["nav", "form", "steps", "footer"], "a task screen keeps its form first");
console.log("ok   craft rules\n  " + fixes.join("\n  "));
