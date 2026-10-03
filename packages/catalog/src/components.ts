import { z } from "zod";
import { def, Icon, P } from "./defs";

const str = () => z.string().min(1);

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export const layouts = {
  Page: def({
    kind: "layout",
    description: "Page root. Holds every section of one screen in vertical order.",
    props: z.object({ title: str() }),
    slots: ["default"],
    placeholder: { title: P },
    root: true,
  }),
};

// ---------------------------------------------------------------------------
// Blocks: ready-made page sections
// ---------------------------------------------------------------------------

export const blocks = {
  Navbar: def({
    kind: "block",
    description: "Top navigation bar with brand name, menu links and one call-to-action label.",
    props: z.object({
      brand: str(),
      links: z.array(str()).min(1).max(6),
      ctaLabel: str(),
    }),
    placeholder: { brand: P, links: [P, P, P], ctaLabel: P },
  }),
  Hero: def({
    kind: "block",
    description: "Hero section: eyebrow, large headline, supporting subtitle and a slot for action buttons.",
    props: z.object({
      eyebrow: str(),
      title: str(),
      subtitle: str(),
      align: z.enum(["left", "center"]),
      showImage: z.boolean(),
    }),
    slots: ["actions"],
    placeholder: { eyebrow: P, title: P, subtitle: P, align: "center", showImage: true },
  }),
  FeatureGrid: def({
    kind: "block",
    description: "Grid of product features or benefits, each with an icon, title and short description.",
    props: z.object({
      title: str(),
      subtitle: str(),
      features: z
        .array(z.object({ icon: Icon, title: str(), description: str() }))
        .min(2)
        .max(6),
    }),
    placeholder: {
      title: P,
      subtitle: P,
      features: [
        { icon: "sparkles", title: P, description: P },
        { icon: "zap", title: P, description: P },
        { icon: "shield", title: P, description: P },
      ],
    },
    maxUses: 2,
  }),
  Stats: def({
    kind: "block",
    description: "Row of key numbers or metrics with labels, e.g. customers served or uptime.",
    props: z.object({
      items: z.array(z.object({ value: str(), label: str() })).min(2).max(4),
    }),
    placeholder: { items: [{ value: P, label: P }, { value: P, label: P }, { value: P, label: P }] },
  }),
  Pricing: def({
    kind: "block",
    description: "Pricing table comparing plans with price, period, feature list and one highlighted plan.",
    props: z.object({
      title: str(),
      plans: z
        .array(
          z.object({
            name: str(),
            price: str(),
            period: str(),
            features: z.array(str()).min(1).max(6),
            highlighted: z.boolean(),
            ctaLabel: str(),
          }),
        )
        .min(1)
        .max(4),
    }),
    placeholder: {
      title: P,
      plans: [
        { name: P, price: P, period: P, features: [P, P, P], highlighted: false, ctaLabel: P },
        { name: P, price: P, period: P, features: [P, P, P], highlighted: true, ctaLabel: P },
        { name: P, price: P, period: P, features: [P, P, P], highlighted: false, ctaLabel: P },
      ],
    },
  }),
  Testimonials: def({
    kind: "block",
    description: "Customer testimonials: quotes with the customer's name and role.",
    props: z.object({
      title: str(),
      items: z.array(z.object({ quote: str(), name: str(), role: str() })).min(1).max(6),
    }),
    placeholder: {
      title: P,
      items: [
        { quote: P, name: P, role: P },
        { quote: P, name: P, role: P },
        { quote: P, name: P, role: P },
      ],
    },
  }),
  FAQ: def({
    kind: "block",
    description: "Frequently asked questions as an expandable list of question and answer pairs.",
    props: z.object({
      title: str(),
      items: z.array(z.object({ question: str(), answer: str() })).min(1).max(8),
    }),
    placeholder: {
      title: P,
      items: [
        { question: P, answer: P },
        { question: P, answer: P },
        { question: P, answer: P },
      ],
    },
  }),
  CTA: def({
    kind: "block",
    description: "Call-to-action banner with a headline, subtitle and a slot for action buttons.",
    props: z.object({ title: str(), subtitle: str() }),
    slots: ["actions"],
    placeholder: { title: P, subtitle: P },
  }),
  ContactForm: def({
    kind: "block",
    description: "Contact or sign-up form section. Put Input, Textarea and Checkbox primitives in `fields` and the submit Button in `actions`.",
    props: z.object({ title: str(), subtitle: str() }),
    slots: ["fields", "actions"],
    placeholder: { title: P, subtitle: P },
  }),
  Footer: def({
    kind: "block",
    description: "Page footer with brand, link columns and copyright line.",
    props: z.object({
      brand: str(),
      columns: z
        .array(z.object({ title: str(), links: z.array(str()).min(1).max(5) }))
        .min(1)
        .max(4),
      copyright: str(),
    }),
    placeholder: {
      brand: P,
      columns: [
        { title: P, links: [P, P, P] },
        { title: P, links: [P, P, P] },
      ],
      copyright: P,
    },
  }),
};

// ---------------------------------------------------------------------------
// Primitives: shadcn/ui components used inside block slots
// ---------------------------------------------------------------------------

export const primitives = {
  Button: def({
    kind: "primitive",
    description: "Button for actions. Lives in an `actions` slot.",
    props: z.object({
      label: str(),
      variant: z.enum(["default", "secondary", "outline", "ghost"]),
      size: z.enum(["sm", "default", "lg"]),
    }),
    events: ["press"],
    placeholder: { label: P, variant: "default", size: "default" },
    maxUses: 4,
  }),
  Input: def({
    kind: "primitive",
    description: "Single-line text field with label. Lives in a `fields` slot.",
    props: z.object({
      label: str(),
      placeholder: z.string(),
      inputType: z.enum(["text", "email", "tel", "password", "number"]),
    }),
    placeholder: { label: P, placeholder: P, inputType: "text" },
    maxUses: 6,
  }),
  Textarea: def({
    kind: "primitive",
    description: "Multi-line text field with label. Lives in a `fields` slot.",
    props: z.object({ label: str(), placeholder: z.string() }),
    placeholder: { label: P, placeholder: P },
    maxUses: 2,
  }),
  Checkbox: def({
    kind: "primitive",
    description: "Checkbox with a label, e.g. accept terms. Lives in a `fields` slot.",
    props: z.object({ label: str() }),
    placeholder: { label: P },
    maxUses: 3,
  }),
  Badge: def({
    kind: "primitive",
    description: "Small status or category label.",
    props: z.object({ label: str(), variant: z.enum(["default", "secondary", "outline"]) }),
    placeholder: { label: P, variant: "secondary" },
    maxUses: 3,
  }),
};

export const componentDefs = { ...layouts, ...blocks, ...primitives };
export type ComponentName = keyof typeof componentDefs;
