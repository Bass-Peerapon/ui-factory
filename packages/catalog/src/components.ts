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
      variant: z.enum(["centered", "split", "editorial", "immersive"]),
      eyebrow: str(),
      title: str(),
      subtitle: str(),
    }),
    slots: ["actions"],
    placeholder: { variant: "centered", eyebrow: P, title: P, subtitle: P },
    variants: [
      { value: "centered", description: "centered headline with a wide product image below; general landing pages" },
      { value: "split", description: "headline and actions on the left, product image on the right; apps, SaaS and products" },
      { value: "editorial", description: "very large left-aligned type, no image; brands, agencies, editorial and minimal pages" },
      { value: "immersive", description: "full-bleed photo background with overlaid headline; travel, hospitality, food and events" },
    ],
  }),
  FeatureGrid: def({
    kind: "block",
    description: "Grid of product features or benefits, each with an icon, title and short description.",
    props: z.object({
      variant: z.enum(["cards", "list", "bento"]),
      title: str(),
      subtitle: str(),
      features: z
        .array(z.object({ icon: Icon, title: str(), description: str() }))
        .min(2)
        .max(6),
    }),
    variants: [
      { value: "cards", description: "three-column cards; the default feature overview" },
      { value: "list", description: "two-column list with the heading on the left; calm, text-led sites" },
      { value: "bento", description: "asymmetric bento grid with one large tile; product capability showcases" },
    ],
    placeholder: {
      variant: "cards",
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
      variant: z.enum(["cards", "spotlight"]),
      title: str(),
      items: z.array(z.object({ quote: str(), name: str(), role: str() })).min(1).max(6),
    }),
    variants: [
      { value: "cards", description: "grid of three quote cards" },
      { value: "spotlight", description: "one large featured quote with smaller supporting quotes" },
    ],
    placeholder: {
      variant: "cards",
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
    props: z.object({ variant: z.enum(["band", "split", "quiet"]), title: str(), subtitle: str() }),
    slots: ["actions"],
    placeholder: { variant: "band", title: P, subtitle: P },
    variants: [
      { value: "band", description: "solid primary-colored band; strong closing call to action" },
      { value: "split", description: "headline left, actions right on a subtle surface; B2B and product pages" },
      { value: "quiet", description: "plain centered text and one button with a top divider; minimal and editorial pages" },
    ],
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

  // --- added in M5 ---------------------------------------------------------
  Banner: def({
    kind: "block",
    description: "Thin announcement bar at the very top of a page with a short message and a link label.",
    props: z.object({ text: str(), linkLabel: str() }),
    placeholder: { text: P, linkLabel: P },
  }),
  LogoCloud: def({
    kind: "block",
    description: "Row of customer or partner brand names that build trust (\"trusted by\").",
    props: z.object({ title: str(), logos: z.array(str()).min(3).max(8) }),
    placeholder: { title: P, logos: [P, P, P, P, P] },
  }),
  ImageText: def({
    kind: "block",
    description: "Split section: image on one side, eyebrow, title, description and bullet points on the other, with an actions slot.",
    props: z.object({
      eyebrow: str(),
      title: str(),
      description: str(),
      bullets: z.array(str()).min(0).max(5),
      imageSide: z.enum(["left", "right"]),
    }),
    slots: ["actions"],
    placeholder: { eyebrow: P, title: P, description: P, bullets: [P, P, P], imageSide: "right" },
    maxUses: 3,
  }),
  Steps: def({
    kind: "block",
    description: "How it works: numbered steps a customer follows, each with title and description.",
    props: z.object({
      title: str(),
      steps: z.array(z.object({ title: str(), description: str() })).min(2).max(5),
    }),
    placeholder: { title: P, steps: [{ title: P, description: P }, { title: P, description: P }, { title: P, description: P }] },
  }),
  ProductGrid: def({
    kind: "block",
    description: "E-commerce product cards with name, price, optional badge and short description.",
    props: z.object({
      title: str(),
      products: z
        .array(z.object({ name: str(), price: str(), badge: z.string(), description: str() }))
        .min(2)
        .max(8),
    }),
    placeholder: {
      title: P,
      products: [
        { name: P, price: P, badge: "", description: P },
        { name: P, price: P, badge: "", description: P },
        { name: P, price: P, badge: "", description: P },
        { name: P, price: P, badge: "", description: P },
      ],
    },
  }),
  Gallery: def({
    kind: "block",
    description: "Image gallery grid with captions, e.g. portfolio, rooms, menu photos.",
    props: z.object({ title: str(), items: z.array(z.object({ caption: str() })).min(3).max(9) }),
    placeholder: { title: P, items: [{ caption: P }, { caption: P }, { caption: P }, { caption: P }, { caption: P }, { caption: P }] },
  }),
  Team: def({
    kind: "block",
    description: "Team members or experts with name, role and short bio.",
    props: z.object({
      title: str(),
      members: z.array(z.object({ name: str(), role: str(), bio: str() })).min(2).max(8),
    }),
    placeholder: { title: P, members: [{ name: P, role: P, bio: P }, { name: P, role: P, bio: P }, { name: P, role: P, bio: P }] },
  }),
  Timeline: def({
    kind: "block",
    description: "Chronological timeline: company history, event agenda or roadmap with date, title and description.",
    props: z.object({
      title: str(),
      items: z.array(z.object({ date: str(), title: str(), description: str() })).min(2).max(8),
    }),
    placeholder: { title: P, items: [{ date: P, title: P, description: P }, { date: P, title: P, description: P }, { date: P, title: P, description: P }] },
  }),
  ComparisonTable: def({
    kind: "block",
    description:
      "Feature comparison table between plans or products. `columns` are only the plan or product names (no header for the feature column); each row has a feature name and exactly one value per column, e.g. ✓, ✗ or a short value.",
    props: z.object({
      title: str(),
      columns: z.array(str()).min(2).max(4),
      rows: z.array(z.object({ feature: str(), values: z.array(z.string()).min(2).max(4) })).min(2).max(10),
    }),
    placeholder: {
      title: P,
      columns: [P, P, P],
      rows: [{ feature: P, values: [P, P, P] }, { feature: P, values: [P, P, P] }, { feature: P, values: [P, P, P] }],
    },
  }),
  BlogList: def({
    kind: "block",
    description: "List of articles or news posts with category, title, excerpt and date.",
    props: z.object({
      title: str(),
      posts: z.array(z.object({ category: str(), title: str(), excerpt: str(), date: str() })).min(2).max(6),
    }),
    placeholder: {
      title: P,
      posts: [
        { category: P, title: P, excerpt: P, date: P },
        { category: P, title: P, excerpt: P, date: P },
        { category: P, title: P, excerpt: P, date: P },
      ],
    },
  }),
  Quote: def({
    kind: "block",
    description: "One large highlighted quote from a founder, customer or press, with author and role.",
    props: z.object({ quote: str(), author: str(), role: str() }),
    placeholder: { quote: P, author: P, role: P },
  }),
  Newsletter: def({
    kind: "block",
    description: "Newsletter or waitlist sign-up strip. Put an email Input in `fields` and a Button in `actions`.",
    props: z.object({ title: str(), subtitle: str() }),
    slots: ["fields", "actions"],
    placeholder: { title: P, subtitle: P },
  }),
  ContactInfo: def({
    kind: "block",
    description: "Contact details such as address, phone, email and opening hours, each with an icon.",
    props: z.object({
      title: str(),
      items: z.array(z.object({ icon: Icon, label: str(), value: str() })).min(1).max(6),
    }),
    placeholder: { title: P, items: [{ icon: "phone", label: P, value: P }, { icon: "globe", label: P, value: P }, { icon: "clock", label: P, value: P }] },
  }),
  AuthForm: def({
    kind: "block",
    description: "Centered login or sign-up card for an app. Put Input and Checkbox primitives in `fields` and Buttons in `actions`.",
    props: z.object({ title: str(), subtitle: str(), mode: z.enum(["login", "signup"]), footerText: str() }),
    slots: ["fields", "actions"],
    placeholder: { title: P, subtitle: P, mode: "login", footerText: P },
  }),
  KPIGrid: def({
    kind: "block",
    description: "Dashboard KPI cards for an app screen: metric label, value, change and trend direction.",
    props: z.object({
      title: str(),
      items: z.array(z.object({ label: str(), value: str(), delta: str(), trend: z.enum(["up", "down", "flat"]) })).min(2).max(6),
    }),
    placeholder: {
      title: P,
      items: [
        { label: P, value: P, delta: P, trend: "up" },
        { label: P, value: P, delta: P, trend: "down" },
        { label: P, value: P, delta: P, trend: "up" },
        { label: P, value: P, delta: P, trend: "flat" },
      ],
    },
  }),
  DataTable: def({
    kind: "block",
    description: "Data table for an app screen (orders, users, transactions) with column headers and rows of cells.",
    props: z.object({
      title: str(),
      columns: z.array(str()).min(2).max(6),
      rows: z.array(z.array(z.string()).min(2).max(6)).min(1).max(10),
    }),
    placeholder: { title: P, columns: [P, P, P, P], rows: [[P, P, P, P], [P, P, P, P], [P, P, P, P], [P, P, P, P]] },
  }),
  EmptyState: def({
    kind: "block",
    description: "Empty or success state message for an app screen with an icon, title, description and an actions slot.",
    props: z.object({ icon: Icon, title: str(), description: str() }),
    slots: ["actions"],
    placeholder: { icon: "sparkles", title: P, description: P },
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
