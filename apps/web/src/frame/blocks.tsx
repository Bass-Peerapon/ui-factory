import type { ReactNode } from "react";
import { useState } from "react";
import type { componentDefs } from "@ui-factory/catalog";
import { Check, ChevronDown, ImageIcon, Sparkles } from "lucide-react";
import { Bar, Heading, Section, SkCards, SkHeading, hasSlot, icons, type BlockProps, type PropsOf } from "./blocks-shared";
import { renders2, skeletons2 } from "./blocks2";
import { cn } from "../lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Checkbox as CheckboxUI, Input as InputUI, Label, Textarea as TextareaUI } from "./ui/form";






// ---------------------------------------------------------------------------
// Real renders
// ---------------------------------------------------------------------------

export const Page = ({ slots }: BlockProps<"Page">) => <main className="min-h-screen bg-background">{slots.default}</main>;

export const Navbar = ({ props }: BlockProps<"Navbar">) => (
  <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur">
    <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6">
      <span className="text-lg font-bold">{props.brand}</span>
      <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
        {props.links.map((l, i) => (
          <a key={i} className="hover:text-foreground">{l}</a>
        ))}
      </nav>
      <Button size="sm">{props.ctaLabel}</Button>
    </div>
  </header>
);

const HeroImage = ({ className }: { className?: string }) => (
  <div className={cn("grid place-items-center rounded-xl border bg-gradient-to-br from-muted via-accent to-muted text-muted-foreground", className)}>
    <ImageIcon className="size-10 opacity-50" />
  </div>
);

export const Hero = ({ props, slots }: BlockProps<"Hero">) => {
  const actions = hasSlot(slots.actions) ? slots.actions : null;
  switch (props.variant) {
    case "split":
      return (
        <Section>
          <div className="grid items-center gap-12 md:grid-cols-[1.1fr_1fr] md:gap-16">
            <div>
              <div className="eyebrow text-primary">{props.eyebrow}</div>
              <h1 className="mt-5 text-4xl md:text-[3.5rem]">{props.title}</h1>
              <p className="measure mt-6 text-lg text-muted-foreground">{props.subtitle}</p>
              {actions && <div className="mt-8 flex flex-wrap gap-3">{actions}</div>}
            </div>
            <HeroImage className="aspect-[4/3.4] shadow-sm" />
          </div>
        </Section>
      );
    case "editorial":
      return (
        <Section className="md:pt-32">
          <div className="eyebrow text-muted-foreground">{props.eyebrow}</div>
          <h1 className="mt-6 max-w-5xl text-5xl md:text-[5.5rem]">{props.title}</h1>
          <div className="mt-10 grid gap-8 border-t pt-8 md:grid-cols-[2fr_1fr] md:items-end">
            <p className="measure text-xl text-muted-foreground">{props.subtitle}</p>
            {actions && <div className="flex flex-wrap gap-3 md:justify-end">{actions}</div>}
          </div>
        </Section>
      );
    case "immersive":
      return (
        <section className="relative isolate grid min-h-[620px] place-items-center overflow-hidden px-6 py-24 text-center text-white">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-neutral-700 via-neutral-500 to-neutral-800" />
          <ImageIcon className="absolute top-1/2 left-1/2 -z-10 size-16 -translate-1/2 opacity-15" />
          <div className="absolute inset-0 -z-10 bg-black/45" />
          <div className="mx-auto max-w-3xl">
            <div className="eyebrow opacity-85">{props.eyebrow}</div>
            <h1 className="mt-5 text-4xl md:text-6xl">{props.title}</h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg opacity-90">{props.subtitle}</p>
            {actions && <div className="mt-9 flex flex-wrap justify-center gap-3">{actions}</div>}
          </div>
        </section>
      );
    default:
      return (
        <Section className="md:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-6">{props.eyebrow}</Badge>
            <h1 className="text-4xl md:text-6xl">{props.title}</h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">{props.subtitle}</p>
            {actions && <div className="mt-9 flex flex-wrap justify-center gap-3">{actions}</div>}
          </div>
          <HeroImage className="mx-auto mt-16 aspect-[16/8] w-full max-w-5xl shadow-sm" />
        </Section>
      );
  }
};

export const FeatureGrid = ({ props }: BlockProps<"FeatureGrid">) => {
  const Feature = ({ f, big }: { f: PropsOf<"FeatureGrid">["features"][number]; big?: boolean }) => {
    const Icon = icons[f.icon] ?? Sparkles;
    return (
      <>
        <Icon className={cn("text-foreground/80", big ? "size-7" : "size-5")} strokeWidth={1.7} />
        <h3 className={cn("mt-4", big ? "text-2xl" : "text-lg")}>{f.title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{f.description}</p>
      </>
    );
  };
  if (props.variant === "list") {
    return (
      <Section>
        <div className="grid gap-12 md:grid-cols-[1fr_1.6fr]">
          <div>
            <h2 className="text-3xl md:text-[2.5rem]">{props.title}</h2>
            <p className="mt-4 text-muted-foreground">{props.subtitle}</p>
          </div>
          <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2">
            {props.features.map((f, i) => <div key={i} className="border-t pt-6"><Feature f={f} /></div>)}
          </div>
        </div>
      </Section>
    );
  }
  if (props.variant === "bento") {
    return (
      <Section>
        <Heading title={props.title} subtitle={props.subtitle} />
        <div className="grid auto-rows-[minmax(170px,auto)] gap-4 md:grid-cols-3">
          {props.features.map((f, i) => (
            <div key={i} className={cn("flex flex-col justify-end rounded-xl border bg-muted/50 p-7", i === 0 && "md:col-span-2 md:row-span-2 bg-muted")}>
              <Feature f={f} big={i === 0} />
            </div>
          ))}
        </div>
      </Section>
    );
  }
  return (
    <Section>
      <Heading title={props.title} subtitle={props.subtitle} />
      <div className="grid gap-[var(--gap)] sm:grid-cols-2 lg:grid-cols-3">
        {props.features.map((f, i) => (
          <div key={i} className="rounded-lg border bg-background p-7">
            <Feature f={f} />
          </div>
        ))}
      </div>
    </Section>
  );
};

export const Stats = ({ props }: BlockProps<"Stats">) => (
  <Section className="bg-muted/60 md:py-14">
    <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
      {props.items.map((s, i) => (
        <div key={i}>
          <div className="font-display tabular text-3xl font-semibold md:text-4xl">{s.value}</div>
          <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
        </div>
      ))}
    </div>
  </Section>
);

export const Pricing = ({ props }: BlockProps<"Pricing">) => (
  <Section>
    <Heading title={props.title} />
    <div className="grid gap-6 md:grid-cols-3">
      {props.plans.map((p, i) => (
        <div
          key={i}
          className={cn(
            "flex flex-col rounded-xl border bg-background p-8 shadow-sm",
            p.highlighted && "border-primary ring-2 ring-primary/30 md:-translate-y-2",
          )}
        >
          <h3 className="font-semibold">{p.name}</h3>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-4xl font-bold">{p.price}</span>
            <span className="text-sm text-muted-foreground">{p.period}</span>
          </div>
          <ul className="mt-6 flex-1 space-y-3 text-sm">
            {p.features.map((f, j) => (
              <li key={j} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                {f}
              </li>
            ))}
          </ul>
          <Button className="mt-8 w-full" variant={p.highlighted ? "default" : "outline"}>{p.ctaLabel}</Button>
        </div>
      ))}
    </div>
  </Section>
);

export const Testimonials = ({ props }: BlockProps<"Testimonials">) => {
  const Person = ({ t }: { t: PropsOf<"Testimonials">["items"][number] }) => (
    <figcaption className="mt-6 flex items-center gap-3">
      <div className="grid size-10 place-items-center rounded-full bg-muted font-semibold text-foreground">{t.name.slice(0, 1)}</div>
      <div>
        <div className="text-sm font-semibold">{t.name}</div>
        <div className="text-xs text-muted-foreground">{t.role}</div>
      </div>
    </figcaption>
  );
  if (props.variant === "spotlight" && props.items.length > 0) {
    const [first, ...rest] = props.items;
    return (
      <Section className="bg-muted/50">
        <div className="eyebrow mb-8 text-muted-foreground">{props.title}</div>
        <figure className="max-w-4xl">
          <blockquote className="font-display text-3xl leading-snug md:text-[2.6rem]">“{first.quote}”</blockquote>
          <Person t={first} />
        </figure>
        {rest.length > 0 && (
          <div className="mt-14 grid gap-8 border-t pt-10 md:grid-cols-3">
            {rest.map((t, i) => (
              <figure key={i}>
                <blockquote className="text-muted-foreground">“{t.quote}”</blockquote>
                <Person t={t} />
              </figure>
            ))}
          </div>
        )}
      </Section>
    );
  }
  return (
    <Section className="bg-muted/40">
      <Heading title={props.title} />
      <div className="grid gap-[var(--gap)] md:grid-cols-3">
        {props.items.map((t, i) => (
          <figure key={i} className="rounded-lg border bg-background p-7">
            <blockquote>“{t.quote}”</blockquote>
            <Person t={t} />
          </figure>
        ))}
      </div>
    </Section>
  );
};

export const FAQ = ({ props }: BlockProps<"FAQ">) => {
  const [open, setOpen] = useState(0);
  return (
    <Section>
      <Heading title={props.title} />
      <div className="mx-auto max-w-3xl divide-y rounded-lg border">
        {props.items.map((q, i) => (
          <div key={i}>
            <button
              className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left font-medium"
              onClick={() => setOpen(open === i ? -1 : i)}
            >
              {q.question}
              <ChevronDown className={cn("size-4 shrink-0 transition-transform", open === i && "rotate-180")} />
            </button>
            {open === i && <p className="px-6 pb-5 text-sm leading-relaxed text-muted-foreground">{q.answer}</p>}
          </div>
        ))}
      </div>
    </Section>
  );
};

export const CTA = ({ props, slots }: BlockProps<"CTA">) => {
  const actions = hasSlot(slots.actions) ? slots.actions : null;
  if (props.variant === "split") {
    return (
      <Section>
        <div className="flex flex-col gap-8 rounded-2xl border bg-muted/60 p-10 md:flex-row md:items-center md:justify-between md:p-14">
          <div className="max-w-xl">
            <h2 className="text-3xl md:text-4xl">{props.title}</h2>
            <p className="mt-3 text-muted-foreground">{props.subtitle}</p>
          </div>
          {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
        </div>
      </Section>
    );
  }
  if (props.variant === "quiet") {
    return (
      <Section>
        <div className="mx-auto max-w-2xl border-t pt-16 text-center">
          <h2 className="text-3xl md:text-4xl">{props.title}</h2>
          <p className="mt-4 text-muted-foreground">{props.subtitle}</p>
          {actions && <div className="mt-8 flex justify-center gap-3">{actions}</div>}
        </div>
      </Section>
    );
  }
  return (
    <Section>
      <div className="rounded-2xl bg-primary px-8 py-16 text-center text-primary-foreground md:px-16 [&_button]:bg-primary-foreground [&_button]:text-primary">
        <h2 className="text-3xl md:text-4xl">{props.title}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg opacity-85">{props.subtitle}</p>
        {actions && <div className="mt-8 flex flex-wrap justify-center gap-3">{actions}</div>}
      </div>
    </Section>
  );
};

export const ContactForm = ({ props, slots }: BlockProps<"ContactForm">) => (
  <Section>
    <div className="mx-auto max-w-xl rounded-xl border bg-background p-8 shadow-sm">
      <h2 className="text-2xl font-semibold">{props.title}</h2>
      <p className="mt-2 text-muted-foreground">{props.subtitle}</p>
      <div className="mt-8 space-y-5">{slots.fields}</div>
      {hasSlot(slots.actions) && <div className="mt-8 flex gap-3">{slots.actions}</div>}
    </div>
  </Section>
);

export const Footer = ({ props }: BlockProps<"Footer">) => (
  <footer className="border-t bg-muted/40 px-6 py-12 md:px-12">
    <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[2fr_repeat(4,1fr)]">
      <div className="text-lg font-bold">{props.brand}</div>
      {props.columns.map((c, i) => (
        <div key={i}>
          <div className="mb-3 text-sm font-semibold">{c.title}</div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {c.links.map((l, j) => <li key={j}>{l}</li>)}
          </ul>
        </div>
      ))}
    </div>
    <div className="mx-auto mt-10 max-w-6xl border-t pt-6 text-xs text-muted-foreground">{props.copyright}</div>
  </footer>
);

export const ButtonBlock = ({ props, emit }: BlockProps<"Button">) => (
  <Button variant={props.variant} size={props.size} onClick={() => emit("press")}>{props.label}</Button>
);

export const InputBlock = ({ props }: BlockProps<"Input">) => (
  <div className="grid gap-2">
    <Label>{props.label}</Label>
    <InputUI type={props.inputType} placeholder={props.placeholder} />
  </div>
);

export const TextareaBlock = ({ props }: BlockProps<"Textarea">) => (
  <div className="grid gap-2">
    <Label>{props.label}</Label>
    <TextareaUI placeholder={props.placeholder} />
  </div>
);

export const CheckboxBlock = ({ props }: BlockProps<"Checkbox">) => {
  const [v, setV] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <CheckboxUI checked={v} onChange={setV} />
      <Label>{props.label}</Label>
    </div>
  );
};

export const BadgeBlock = ({ props }: BlockProps<"Badge">) => <Badge variant={props.variant}>{props.label}</Badge>;

// ---------------------------------------------------------------------------
// Skeleton variants: rendered while props.skeleton is true
// ---------------------------------------------------------------------------




export const skeletons: Record<keyof typeof componentDefs, (p: BlockProps<never>) => ReactNode> = {
  Page: ({ slots }) => <main className="min-h-screen">{slots.default}</main>,
  Navbar: () => (
    <div className="flex h-16 items-center justify-between border-b px-6">
      <Bar className="h-6 w-28" />
      <div className="hidden gap-6 md:flex"><Bar className="w-14" /><Bar className="w-14" /><Bar className="w-14" /></div>
      <Bar className="h-8 w-24" />
    </div>
  ),
  Hero: ({ slots }) => (
    <Section className="md:py-28">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4">
        <Bar className="h-5 w-24 rounded-full" />
        <Bar className="h-12 w-full" />
        <Bar className="h-12 w-3/4" />
        <Bar className="mt-2 w-2/3" />
        <div className="mt-6 flex gap-3">{hasSlot(slots.actions) ? slots.actions : <Bar className="h-10 w-32" />}</div>
      </div>
    </Section>
  ),
  FeatureGrid: () => (
    <Section>
      <SkHeading />
      <SkCards n={3}><div className="sk mb-4 size-11" /><Bar className="w-1/2" /><Bar className="mt-3 w-full" /><Bar className="mt-2 w-4/5" /></SkCards>
    </Section>
  ),
  Stats: () => (
    <Section className="md:py-14">
      <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="flex flex-col items-center gap-2"><Bar className="h-9 w-20" /><Bar className="w-24" /></div>)}
      </div>
    </Section>
  ),
  Pricing: () => (
    <Section>
      <SkHeading />
      <SkCards n={3}><Bar className="w-20" /><Bar className="mt-4 h-10 w-28" />{[0, 1, 2].map((i) => <Bar key={i} className="mt-4 w-full" />)}<Bar className="mt-8 h-10 w-full" /></SkCards>
    </Section>
  ),
  Testimonials: () => (
    <Section>
      <SkHeading />
      <SkCards n={3}><Bar className="w-full" /><Bar className="mt-2 w-4/5" /><div className="mt-6 flex items-center gap-3"><div className="sk size-10 rounded-full" /><Bar className="w-24" /></div></SkCards>
    </Section>
  ),
  FAQ: () => (
    <Section>
      <SkHeading />
      <div className="mx-auto max-w-3xl divide-y rounded-lg border">
        {[0, 1, 2].map((i) => <div key={i} className="px-6 py-5"><Bar className="w-2/3" /></div>)}
      </div>
    </Section>
  ),
  CTA: ({ slots }) => (
    <Section>
      <div className="flex flex-col items-center gap-4 rounded-2xl border px-8 py-14">
        <Bar className="h-9 w-1/2" />
        <Bar className="w-1/3" />
        <div className="mt-4 flex gap-3">{hasSlot(slots.actions) ? slots.actions : <Bar className="h-10 w-32" />}</div>
      </div>
    </Section>
  ),
  ContactForm: ({ slots }) => (
    <Section>
      <div className="mx-auto max-w-xl rounded-xl border p-8">
        <Bar className="h-7 w-1/2" />
        <Bar className="mt-3 w-2/3" />
        <div className="mt-8 space-y-5">{hasSlot(slots.fields) ? slots.fields : <Bar className="h-10 w-full" />}</div>
        <div className="mt-8 flex gap-3">{slots.actions}</div>
      </div>
    </Section>
  ),
  Footer: () => (
    <div className="grid gap-10 border-t px-12 py-12 md:grid-cols-4">
      <Bar className="h-6 w-24" />
      {[0, 1, 2].map((i) => <div key={i} className="space-y-3"><Bar className="w-16" /><Bar className="w-20" /><Bar className="w-14" /></div>)}
    </div>
  ),
  Button: () => <div className="sk h-10 w-32" />,
  Input: () => <div className="grid gap-2"><Bar className="w-20" /><div className="sk h-10 w-full" /></div>,
  Textarea: () => <div className="grid gap-2"><Bar className="w-20" /><div className="sk h-24 w-full" /></div>,
  Checkbox: () => <div className="flex items-center gap-2"><div className="sk size-4" /><Bar className="w-40" /></div>,
  Badge: () => <div className="sk h-5 w-16 rounded-full" />,
  ...skeletons2,
};

export const renders: Record<keyof typeof componentDefs, (p: BlockProps<never>) => ReactNode> = {
  Page, Navbar, Hero, FeatureGrid, Stats, Pricing, Testimonials, FAQ, CTA, ContactForm, Footer,
  Button: ButtonBlock, Input: InputBlock, Textarea: TextareaBlock, Checkbox: CheckboxBlock, Badge: BadgeBlock,
  ...renders2,
} as never;
