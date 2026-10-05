// Blocks added in M5. Shared helpers live in blocks.tsx.
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, ImageIcon, Minus, Quote as QuoteIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { Bar, Heading, Section, SkCards, SkHeading, hasSlot, icons, type BlockProps } from "./blocks-shared";
import { Badge } from "./ui/badge";

const ImagePlaceholder = ({ className }: { className?: string }) => (
  <div className={cn("grid place-items-center rounded-lg border bg-gradient-to-br from-muted via-accent to-muted text-muted-foreground", className)}>
    <ImageIcon className="size-8 opacity-60" />
  </div>
);

export const Banner = ({ props }: BlockProps<"Banner">) => (
  <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-primary px-4 py-2 text-center text-sm text-primary-foreground">
    <span>{props.text}</span>
    <span className="inline-flex items-center gap-1 font-semibold underline underline-offset-4">
      {props.linkLabel} <ArrowRight className="size-3.5" />
    </span>
  </div>
);

export const LogoCloud = ({ props }: BlockProps<"LogoCloud">) => (
  <Section className="py-10 md:py-12">
    <p className="mb-6 text-center text-sm font-medium text-muted-foreground">{props.title}</p>
    <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
      {props.logos.map((l, i) => (
        <span key={i} className="text-xl font-bold text-foreground/45">{l}</span>
      ))}
    </div>
  </Section>
);

export const ImageText = ({ props, slots }: BlockProps<"ImageText">) => (
  <Section>
    <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
      <ImagePlaceholder className={cn("aspect-[4/3]", props.imageSide === "left" ? "md:order-first" : "md:order-last")} />
      <div>
        <div className="eyebrow text-primary">{props.eyebrow}</div>
        <h2 className="mt-3 text-3xl font-semibold md:text-4xl">{props.title}</h2>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{props.description}</p>
        {props.bullets.length > 0 && (
          <ul className="mt-6 space-y-3">
            {props.bullets.map((b, i) => (
              <li key={i} className="flex gap-3"><Check className="mt-0.5 size-5 shrink-0 text-foreground/70" />{b}</li>
            ))}
          </ul>
        )}
        {hasSlot(slots.actions) && <div className="mt-8 flex flex-wrap gap-3">{slots.actions}</div>}
      </div>
    </div>
  </Section>
);

export const Steps = ({ props }: BlockProps<"Steps">) => (
  <Section>
    <Heading title={props.title} />
    <ol className={cn("grid gap-8", props.steps.length >= 4 ? "md:grid-cols-4" : "md:grid-cols-3")}>
      {props.steps.map((s, i) => (
        <li key={i} className="relative">
          <div className="mb-4 grid size-10 place-items-center rounded-full bg-foreground font-semibold text-background tabular">{i + 1}</div>
          <h3 className="text-lg font-semibold">{s.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.description}</p>
        </li>
      ))}
    </ol>
  </Section>
);

export const ProductGrid = ({ props }: BlockProps<"ProductGrid">) => (
  <Section>
    <Heading title={props.title} />
    <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
      {props.products.map((p, i) => (
        <div key={i} className="group">
          <div className="relative">
            <ImagePlaceholder className="aspect-square" />
            {p.badge && <Badge className="absolute top-3 left-3">{p.badge}</Badge>}
          </div>
          <div className="mt-3 flex items-start justify-between gap-2">
            <h3 className="font-semibold">{p.name}</h3>
            <span className="tabular shrink-0 font-semibold">{p.price}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
        </div>
      ))}
    </div>
  </Section>
);

export const Gallery = ({ props }: BlockProps<"Gallery">) => (
  <Section>
    <Heading title={props.title} />
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {props.items.map((it, i) => (
        <figure key={i}>
          <ImagePlaceholder className={i % 5 === 0 ? "aspect-[4/5]" : "aspect-[4/3]"} />
          <figcaption className="mt-2 text-sm text-muted-foreground">{it.caption}</figcaption>
        </figure>
      ))}
    </div>
  </Section>
);

export const Team = ({ props }: BlockProps<"Team">) => (
  <Section>
    <Heading title={props.title} />
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
      {props.members.map((m, i) => (
        <div key={i} className="text-center">
          <div className="mx-auto grid size-24 place-items-center rounded-full bg-muted text-2xl font-semibold text-foreground">{m.name.slice(0, 1)}</div>
          <h3 className="mt-4 font-semibold">{m.name}</h3>
          <div className="text-sm text-muted-foreground">{m.role}</div>
          <p className="mt-2 text-sm text-muted-foreground">{m.bio}</p>
        </div>
      ))}
    </div>
  </Section>
);

export const Timeline = ({ props }: BlockProps<"Timeline">) => (
  <Section>
    <Heading title={props.title} />
    <ol className="relative mx-auto max-w-3xl border-l-2 border-border pl-8">
      {props.items.map((it, i) => (
        <li key={i} className="relative pb-10 last:pb-0">
          <span className="absolute -left-[41px] top-1 size-4 rounded-full border-4 border-background bg-primary" />
          <div className="eyebrow text-muted-foreground">{it.date}</div>
          <h3 className="mt-1 text-lg font-semibold">{it.title}</h3>
          <p className="mt-1 text-muted-foreground">{it.description}</p>
        </li>
      ))}
    </ol>
  </Section>
);

export const ComparisonTable = ({ props }: BlockProps<"ComparisonTable">) => (
  <Section>
    <Heading title={props.title} />
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr>
            <th className="p-4 text-left font-semibold" />
            {props.columns.map((c, i) => <th key={i} className="p-4 text-center font-semibold">{c}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y">
          {props.rows.map((r, i) => (
            <tr key={i}>
              <td className="p-4 font-medium">{r.feature}</td>
              {props.columns.map((_, j) => {
                const v = r.values[j] ?? "";
                const yes = /^(✓|yes|true|มี|ได้)$/i.test(v);
                const no = /^(✗|-|no|false|ไม่มี)$/i.test(v);
                return (
                  <td key={j} className="p-4 text-center text-muted-foreground">
                    {yes ? <Check className="mx-auto size-4 text-foreground" /> : no ? <Minus className="mx-auto size-4 opacity-40" /> : v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Section>
);

export const BlogList = ({ props }: BlockProps<"BlogList">) => (
  <Section>
    <Heading title={props.title} />
    <div className="grid gap-8 md:grid-cols-3">
      {props.posts.map((p, i) => (
        <article key={i}>
          <ImagePlaceholder className="aspect-video" />
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{p.category}</Badge>
            <span>{p.date}</span>
          </div>
          <h3 className="mt-2 text-lg font-semibold leading-snug">{p.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{p.excerpt}</p>
        </article>
      ))}
    </div>
  </Section>
);

export const Quote = ({ props }: BlockProps<"Quote">) => (
  <Section>
    <figure className="mx-auto max-w-3xl text-center">
      <QuoteIcon className="mx-auto size-10 text-muted-foreground/40" />
      <blockquote className="mt-6 text-2xl font-medium leading-relaxed md:text-3xl">{props.quote}</blockquote>
      <figcaption className="mt-6">
        <div className="font-semibold">{props.author}</div>
        <div className="text-sm text-muted-foreground">{props.role}</div>
      </figcaption>
    </figure>
  </Section>
);

export const Newsletter = ({ props, slots }: BlockProps<"Newsletter">) => (
  <Section>
    <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border bg-muted/50 p-8 md:flex-row md:items-center md:p-10">
      <div className="max-w-md">
        <h2 className="text-2xl font-semibold">{props.title}</h2>
        <p className="mt-2 text-muted-foreground">{props.subtitle}</p>
      </div>
      <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">{slots.fields}</div>
        {slots.actions}
      </div>
    </div>
  </Section>
);

export const ContactInfo = ({ props }: BlockProps<"ContactInfo">) => (
  <Section>
    <Heading title={props.title} />
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {props.items.map((it, i) => {
        const Icon = icons[it.icon];
        return (
          <div key={i} className="flex gap-4 rounded-lg border p-5">
            <div className="grid size-10 shrink-0 place-items-center rounded-md bg-muted text-foreground"><Icon className="size-5" /></div>
            <div>
              <div className="text-sm text-muted-foreground">{it.label}</div>
              <div className="mt-0.5 font-medium">{it.value}</div>
            </div>
          </div>
        );
      })}
    </div>
  </Section>
);

export const AuthForm = ({ props, slots }: BlockProps<"AuthForm">) => (
  <div className="grid min-h-[640px] place-items-center bg-muted/40 px-6 py-16">
    <div className="w-full max-w-sm rounded-xl border bg-background p-8 shadow-sm">
      <h1 className="text-2xl font-semibold">{props.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{props.subtitle}</p>
      <div className="mt-6 space-y-4">{slots.fields}</div>
      {hasSlot(slots.actions) && <div className="mt-6 grid gap-2 [&>*]:w-full [&_button]:w-full">{slots.actions}</div>}
      <p className="mt-6 text-center text-sm text-muted-foreground">{props.footerText}</p>
    </div>
  </div>
);

const trendIcon = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus };
const trendColor = { up: "text-emerald-600", down: "text-red-600", flat: "text-muted-foreground" };

export const KPIGrid = ({ props }: BlockProps<"KPIGrid">) => (
  <section className="px-6 py-8">
    <h2 className="mb-4 text-xl font-semibold">{props.title}</h2>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {props.items.map((k, i) => {
        const T = trendIcon[k.trend];
        return (
          <div key={i} className="rounded-lg border bg-background p-5 shadow-sm">
            <div className="text-sm text-muted-foreground">{k.label}</div>
            <div className="mt-2 text-3xl font-bold">{k.value}</div>
            <div className={cn("mt-1 flex items-center gap-1 text-sm font-medium", trendColor[k.trend])}>
              <T className="size-4" /> {k.delta}
            </div>
          </div>
        );
      })}
    </div>
  </section>
);

export const DataTable = ({ props }: BlockProps<"DataTable">) => (
  <section className="px-6 py-8">
    <h2 className="mb-4 text-xl font-semibold">{props.title}</h2>
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left">
          <tr>{props.columns.map((c, i) => <th key={i} className="px-4 py-3 font-semibold">{c}</th>)}</tr>
        </thead>
        <tbody className="divide-y">
          {props.rows.map((r, i) => (
            <tr key={i} className="hover:bg-muted/30">
              {props.columns.map((_, j) => <td key={j} className="px-4 py-3 text-muted-foreground first:font-medium first:text-foreground">{r[j] ?? ""}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

export const EmptyState = ({ props, slots }: BlockProps<"EmptyState">) => {
  const Icon = icons[props.icon];
  return (
    <Section>
      <div className="mx-auto flex max-w-md flex-col items-center rounded-xl border border-dashed p-10 text-center">
        <div className="grid size-14 place-items-center rounded-full bg-muted text-foreground"><Icon className="size-7" /></div>
        <h2 className="mt-4 text-xl font-semibold">{props.title}</h2>
        <p className="mt-2 text-muted-foreground">{props.description}</p>
        {hasSlot(slots.actions) && <div className="mt-6 flex gap-3">{slots.actions}</div>}
      </div>
    </Section>
  );
};

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

type Sk = (p: BlockProps<never>) => ReactNode;

export const skeletons2: Record<keyof typeof renders2, Sk> = {
  Banner: () => <div className="flex justify-center bg-muted py-2.5"><Bar className="w-72" /></div>,
  LogoCloud: () => (
    <Section className="py-10 md:py-12">
      <div className="flex flex-col items-center gap-6"><Bar className="w-40" /><div className="flex gap-10">{[0, 1, 2, 3, 4].map((i) => <Bar key={i} className="h-6 w-20" />)}</div></div>
    </Section>
  ),
  ImageText: ({ slots }) => (
    <Section>
      <div className="grid items-center gap-12 md:grid-cols-2">
        <div><Bar className="w-24" /><Bar className="mt-4 h-9 w-4/5" /><Bar className="mt-4 w-full" /><Bar className="mt-2 w-3/4" />
          <div className="mt-6 space-y-3">{[0, 1, 2].map((i) => <Bar key={i} className="w-2/3" />)}</div>
          <div className="mt-6 flex gap-3">{slots.actions}</div></div>
        <div className="sk aspect-[4/3]" />
      </div>
    </Section>
  ),
  Steps: () => (
    <Section><SkHeading />
      <div className="grid gap-8 md:grid-cols-3">{[0, 1, 2].map((i) => <div key={i}><div className="sk size-10 rounded-full" /><Bar className="mt-4 w-1/2" /><Bar className="mt-3 w-full" /></div>)}</div>
    </Section>
  ),
  ProductGrid: () => (
    <Section><SkHeading />
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i}><div className="sk aspect-square" /><Bar className="mt-3 w-2/3" /><Bar className="mt-2 w-1/3" /></div>)}</div>
    </Section>
  ),
  Gallery: () => (
    <Section><SkHeading />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="sk aspect-[4/3]" />)}</div>
    </Section>
  ),
  Team: () => (
    <Section><SkHeading />
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="flex flex-col items-center gap-3"><div className="sk size-24 rounded-full" /><Bar className="w-24" /><Bar className="w-16" /></div>)}</div>
    </Section>
  ),
  Timeline: () => (
    <Section><SkHeading />
      <div className="mx-auto max-w-3xl space-y-8 border-l-2 pl-8">{[0, 1, 2].map((i) => <div key={i}><Bar className="w-20" /><Bar className="mt-2 w-1/2" /><Bar className="mt-2 w-3/4" /></div>)}</div>
    </Section>
  ),
  ComparisonTable: () => (
    <Section><SkHeading />
      <div className="divide-y rounded-lg border">{[0, 1, 2, 3].map((i) => <div key={i} className="grid grid-cols-4 gap-4 p-4">{[0, 1, 2, 3].map((j) => <Bar key={j} className="w-3/4" />)}</div>)}</div>
    </Section>
  ),
  BlogList: () => (
    <Section><SkHeading />
      <div className="grid gap-8 md:grid-cols-3">{[0, 1, 2].map((i) => <div key={i}><div className="sk aspect-video" /><Bar className="mt-4 w-20" /><Bar className="mt-3 w-full" /><Bar className="mt-2 w-2/3" /></div>)}</div>
    </Section>
  ),
  Quote: () => (
    <Section><div className="mx-auto flex max-w-3xl flex-col items-center gap-3"><Bar className="h-7 w-full" /><Bar className="h-7 w-4/5" /><Bar className="mt-4 w-32" /></div></Section>
  ),
  Newsletter: ({ slots }) => (
    <Section>
      <div className="flex flex-col justify-between gap-6 rounded-2xl border p-10 md:flex-row md:items-center">
        <div className="space-y-3"><Bar className="h-7 w-56" /><Bar className="w-72" /></div>
        <div className="flex gap-3">{hasSlot(slots.fields) ? slots.fields : <div className="sk h-10 w-56" />}{slots.actions}</div>
      </div>
    </Section>
  ),
  ContactInfo: () => (
    <Section><SkHeading /><SkCards n={3}><div className="flex gap-4"><div className="sk size-10" /><div className="flex-1 space-y-2"><Bar className="w-16" /><Bar className="w-32" /></div></div></SkCards></Section>
  ),
  AuthForm: ({ slots }) => (
    <div className="grid min-h-[640px] place-items-center px-6 py-16">
      <div className="w-full max-w-sm rounded-xl border p-8">
        <Bar className="h-7 w-1/2" /><Bar className="mt-3 w-3/4" />
        <div className="mt-6 space-y-4">{hasSlot(slots.fields) ? slots.fields : <div className="sk h-10 w-full" />}</div>
        <div className="mt-6 grid gap-2">{slots.actions}</div>
      </div>
    </div>
  ),
  KPIGrid: () => (
    <section className="px-6 py-8"><Bar className="mb-4 h-6 w-40" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="rounded-lg border p-5"><Bar className="w-20" /><Bar className="mt-3 h-8 w-24" /><Bar className="mt-2 w-12" /></div>)}</div>
    </section>
  ),
  DataTable: () => (
    <section className="px-6 py-8"><Bar className="mb-4 h-6 w-40" />
      <div className="divide-y rounded-lg border">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="grid grid-cols-4 gap-4 px-4 py-3">{[0, 1, 2, 3].map((j) => <Bar key={j} className="w-2/3" />)}</div>)}</div>
    </section>
  ),
  EmptyState: ({ slots }) => (
    <Section>
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-dashed p-10">
        <div className="sk size-14 rounded-full" /><Bar className="h-6 w-40" /><Bar className="w-56" />
        <div className="mt-3 flex gap-3">{slots.actions}</div>
      </div>
    </Section>
  ),
};

export const renders2 = {
  Banner, LogoCloud, ImageText, Steps, ProductGrid, Gallery, Team, Timeline, ComparisonTable, BlogList, Quote,
  Newsletter, ContactInfo, AuthForm, KPIGrid, DataTable, EmptyState,
};
