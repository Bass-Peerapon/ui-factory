import type { ReactNode } from "react";
import type { z } from "zod";
import type { componentDefs } from "@ui-factory/catalog";
import {
  BarChart3, Clock, Coffee, Gift, Globe, Heart, Leaf, Lock, Phone, Shield, Smile, Sparkles, Star, Truck, Users, Zap,
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

export const Heading = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="mx-auto mb-12 max-w-2xl text-center">
    <h2 className="text-3xl font-semibold md:text-[2.5rem]">{title}</h2>
    {subtitle && <p className="measure mx-auto mt-4 text-lg text-muted-foreground">{subtitle}</p>}
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
  <div className="mx-auto mb-12 flex max-w-xl flex-col items-center gap-3">
    <Bar className="h-8 w-2/3" />
    <Bar className="w-1/2" />
  </div>
);
