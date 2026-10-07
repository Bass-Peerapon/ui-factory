import type { ReactNode } from "react";
import type { z } from "zod";
import type { componentDefs } from "@ui-factory/catalog";
import {
  BarChart3, ImageIcon, Clock, Coffee, Gift, Globe, Heart, Leaf, Lock, Phone, Shield, Smile, Sparkles, Star, Truck, Users, Zap,
} from "lucide-react";
import { cn } from "../lib/utils";

export type Defs = typeof componentDefs;
export type PropsOf<N extends keyof Defs> = z.infer<Defs[N]["props"]>;

export interface BlockProps<N extends keyof Defs> {
  props: PropsOf<N>;
  slots: Record<string, ReactNode>;
  emit: (event: string) => void;
}

export const icons = {
  sparkles: Sparkles, zap: Zap, shield: Shield, heart: Heart, star: Star, coffee: Coffee, truck: Truck, clock: Clock,
  users: Users, chart: BarChart3, globe: Globe, lock: Lock, smile: Smile, leaf: Leaf, gift: Gift, phone: Phone,
};

export const Section = ({ className, children }: { className?: string; children: ReactNode }) => (
  <section className={cn("section-y px-6 md:px-12", className)}>
    <div className="mx-auto max-w-6xl">{children}</div>
  </section>
);

/**
 * Section heading. Left-aligned by default, with the subtitle beside it on wide screens: a page of
 * centered heading-over-grid sections is the template rhythm impeccable's craft floor rejects.
 */
export const Heading = ({ title, subtitle, center }: { title: string; subtitle?: string; center?: boolean }) =>
  center ? (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <h2 className="text-3xl font-semibold md:text-[2.5rem]">{title}</h2>
      {subtitle && <p className="measure mx-auto mt-4 text-lg text-muted-foreground">{subtitle}</p>}
    </div>
  ) : (
    <div className="mb-10 grid gap-4 md:mb-14 md:grid-cols-[1.4fr_1fr] md:items-end md:gap-12">
      <h2 className="max-w-[18ch] text-3xl font-semibold md:text-[2.75rem]">{title}</h2>
      {subtitle && <p className="measure text-lg text-muted-foreground md:pb-1">{subtitle}</p>}
    </div>
  );

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8080";
const srcOf = (image?: string) => (image ? (image.startsWith("/api/") ? API + image : image) : undefined);

/**
 * Stand-in for a photo the prototype does not have. It stays a flat surface that names the intended shot
 * instead of a decorative gradient (impeccable craft floor: real imagery or an honest placeholder).
 */
export const Photo = ({ alt, image, className, tone = "light" }: { alt?: string; image?: string; className?: string; tone?: "light" | "dark" }) =>
  image ? (
    <img src={srcOf(image)} alt={alt ?? ""} className={cn("block w-full rounded-xl object-cover", className)} />
  ) : (
  <div
    role="img"
    aria-label={alt || "ภาพประกอบ"}
    className={cn(
      "relative flex items-end overflow-hidden rounded-xl p-4",
      tone === "dark" ? "bg-neutral-800 text-white/70" : "bg-muted text-muted-foreground",
      className,
    )}
  >
    <ImageIcon className="absolute top-4 left-4 size-5 opacity-40" strokeWidth={1.5} />
    {alt && <span className="max-w-[40ch] text-xs leading-snug">{alt}</span>}
  </div>
);

export const hasSlot = (n: ReactNode) => n !== undefined && n !== null && !(Array.isArray(n) && n.length === 0);

export const Bar = ({ className }: { className?: string }) => <div className={cn("sk h-4", className)} />;

export const SkCards = ({ n, className, children }: { n: number; className?: string; children: ReactNode }) => (
  <div className={cn("grid gap-6 md:grid-cols-3", className)}>
    {Array.from({ length: n }, (_, i) => (
      <div key={i} className="rounded-lg border p-6">{children}</div>
    ))}
  </div>
);

export const SkHeading = () => (
  <div className="mb-12 flex max-w-xl flex-col gap-3">
    <Bar className="h-8 w-2/3" />
    <Bar className="w-1/2" />
  </div>
);
