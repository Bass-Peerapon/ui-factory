import type { ReactNode } from "react";
import { useState } from "react";
import type { z } from "zod";
import type { componentDefs } from "@ui-factory/catalog";
import {
  BarChart3, Clock, Coffee, Gift, Globe, Heart, Leaf, Lock, Phone, Shield, Smile, Sparkles, Star, Truck, Users, Zap,
  Check, ChevronDown, ImageIcon,
} from "lucide-react";
import { cn } from "../lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Checkbox as CheckboxUI, Input as InputUI, Label, Textarea as TextareaUI } from "./ui/form";

type Defs = typeof componentDefs;
export type PropsOf<N extends keyof Defs> = z.infer<Defs[N]["props"]>;

export interface BlockProps<N extends keyof Defs> {
  props: PropsOf<N>;
  slots: Record<string, ReactNode>;
  emit: (event: string) => void;
}

const icons = {
  sparkles: Sparkles, zap: Zap, shield: Shield, heart: Heart, star: Star, coffee: Coffee, truck: Truck, clock: Clock,
  users: Users, chart: BarChart3, globe: Globe, lock: Lock, smile: Smile, leaf: Leaf, gift: Gift, phone: Phone,
};

const Section = ({ className, children }: { className?: string; children: ReactNode }) => (
  <section className={cn("px-6 py-16 md:px-12 md:py-20", className)}>
    <div className="mx-auto max-w-6xl">{children}</div>
  </section>
);

const Heading = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="mx-auto mb-12 max-w-2xl text-center">
    <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>
    {subtitle && <p className="mt-4 text-lg text-muted-foreground">{subtitle}</p>}
  </div>
);

const hasSlot = (n: ReactNode) => n !== undefined && n !== null && !(Array.isArray(n) && n.length === 0);

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

export const Hero = ({ props, slots }: BlockProps<"Hero">) => {
  const center = props.align === "center";
  return (
    <Section className="md:py-28">
      <div className={cn("grid items-center gap-12", props.showImage && !center && "md:grid-cols-2")}>
        <div className={cn(center && "mx-auto max-w-3xl text-center")}>
          <Badge variant="secondary" className="mb-6">{props.eyebrow}</Badge>
          <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl">{props.title}</h1>
          <p className="mt-6 text-lg text-muted-foreground md:text-xl">{props.subtitle}</p>
          {hasSlot(slots.actions) && (
            <div className={cn("mt-8 flex flex-wrap gap-3", center && "justify-center")}>{slots.actions}</div>
          )}
        </div>
        {props.showImage && (
          <div
            className={cn(
              "grid aspect-video place-items-center rounded-xl border bg-gradient-to-br from-primary/25 via-accent to-muted text-muted-foreground",
              center && "mx-auto mt-4 w-full max-w-4xl",
            )}
          >
            <ImageIcon className="size-10 opacity-60" />
          </div>
        )}
      </div>
    </Section>
  );
};

export const FeatureGrid = ({ props }: BlockProps<"FeatureGrid">) => (
  <Section>
    <Heading title={props.title} subtitle={props.subtitle} />
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {props.features.map((f, i) => {
        const Icon = icons[f.icon] ?? Sparkles;
        return (
          <div key={i} className="rounded-lg border bg-background p-6 shadow-sm">
            <div className="mb-4 grid size-11 place-items-center rounded-md bg-primary/10 text-primary">
              <Icon className="size-5" />
            </div>
            <h3 className="text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.description}</p>
          </div>
        );
      })}
    </div>
  </Section>
);

export const Stats = ({ props }: BlockProps<"Stats">) => (
  <Section className="bg-muted/60 md:py-14">
    <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
      {props.items.map((s, i) => (
        <div key={i}>
          <div className="text-3xl font-bold text-primary md:text-4xl">{s.value}</div>
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
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
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

export const Testimonials = ({ props }: BlockProps<"Testimonials">) => (
  <Section className="bg-muted/40">
    <Heading title={props.title} />
    <div className="grid gap-6 md:grid-cols-3">
      {props.items.map((t, i) => (
        <figure key={i} className="rounded-lg border bg-background p-6 shadow-sm">
          <blockquote className="leading-relaxed">“{t.quote}”</blockquote>
          <figcaption className="mt-6 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-primary/15 font-semibold text-primary">
              {t.name.slice(0, 1)}
            </div>
            <div>
              <div className="text-sm font-semibold">{t.name}</div>
              <div className="text-xs text-muted-foreground">{t.role}</div>
            </div>
          </figcaption>
        </figure>
      ))}
    </div>
  </Section>
);

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

export const CTA = ({ props, slots }: BlockProps<"CTA">) => (
  <Section>
    <div className="rounded-2xl bg-primary px-8 py-14 text-center text-primary-foreground md:px-16">
      <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{props.title}</h2>
      <p className="mx-auto mt-4 max-w-2xl text-lg opacity-85">{props.subtitle}</p>
      {hasSlot(slots.actions) && <div className="mt-8 flex flex-wrap justify-center gap-3">{slots.actions}</div>}
    </div>
  </Section>
);

export const ContactForm = ({ props, slots }: BlockProps<"ContactForm">) => (
  <Section>
    <div className="mx-auto max-w-xl rounded-xl border bg-background p-8 shadow-sm">
      <h2 className="text-2xl font-bold">{props.title}</h2>
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

const Bar = ({ className }: { className?: string }) => <div className={cn("sk h-4", className)} />;

const SkCards = ({ n, className, children }: { n: number; className?: string; children: ReactNode }) => (
  <div className={cn("grid gap-6 md:grid-cols-3", className)}>
    {Array.from({ length: n }, (_, i) => (
      <div key={i} className="rounded-lg border p-6">{children}</div>
    ))}
  </div>
);

const SkHeading = () => (
  <div className="mx-auto mb-12 flex max-w-xl flex-col items-center gap-3">
    <Bar className="h-8 w-2/3" />
    <Bar className="w-1/2" />
  </div>
);

export const skeletons: Record<keyof Defs, (p: BlockProps<never>) => ReactNode> = {
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
};

export const renders: Record<keyof Defs, (p: BlockProps<never>) => ReactNode> = {
  Page, Navbar, Hero, FeatureGrid, Stats, Pricing, Testimonials, FAQ, CTA, ContactForm, Footer,
  Button: ButtonBlock, Input: InputBlock, Textarea: TextareaBlock, Checkbox: CheckboxBlock, Badge: BadgeBlock,
} as never;
