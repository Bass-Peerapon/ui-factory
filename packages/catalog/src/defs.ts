import { z } from "zod";

/** Placeholder string used in skeleton props before the Fill step replaces it. */
export const P = "…";

export const ICONS = [
  "sparkles", "zap", "shield", "heart", "star", "coffee", "truck", "clock",
  "users", "chart", "globe", "lock", "smile", "leaf", "gift", "phone",
] as const;
export const Icon = z.enum(ICONS);

export type Kind = "layout" | "block" | "primitive";

export interface ComponentDef<S extends z.ZodObject = z.ZodObject> {
  kind: Kind;
  /** Human-readable description shared with the composer and the agent. */
  description: string;
  /** Content props. `skeleton` is added automatically to every component. */
  props: S;
  slots?: readonly string[];
  events?: readonly string[];
  /** Valid props used for the skeleton candidate (schema defaults are not applied to candidates). */
  placeholder: z.input<S>;
  /** How many times the composer may place this component in one page. */
  maxUses?: number;
  /** Only layout roots may be the spec root. */
  root?: boolean;
}

export function def<S extends z.ZodObject>(d: ComponentDef<S>): ComponentDef<S> {
  return d;
}
