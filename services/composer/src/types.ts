import type { Spec } from "@ui-factory/catalog";

export type Intent = "new_page" | "edit_selection" | "set_theme";

export interface RouteInput {
  prompt: string;
  /** Short description of what is selected, e.g. "Hero element" or "nothing". */
  selection: string;
  frameHasContent: boolean;
}

export interface RouteResult {
  intent: Intent;
  confidence: number | null;
  ms: number;
}

export interface StructureInput {
  prompt: string;
  maxElements?: number;
  signal?: AbortSignal;
}

export type StructureEvent =
  | { type: "step"; spec: Spec; ms: number }
  | { type: "complete"; spec: Spec | null; stopReason: string; ms: number; evaluations: number };

/** Turns a prompt into an intent and a skeleton page layout. */
export interface Composer {
  readonly name: "jev" | "llm";
  route(input: RouteInput, signal?: AbortSignal): Promise<RouteResult>;
  structure(input: StructureInput): AsyncGenerator<StructureEvent>;
}

export const intents: Record<Intent, string> = {
  new_page: "The user wants a new page or screen created from scratch (for example a landing page, pricing page, sign-up page).",
  edit_selection: "The user wants to change the existing page: edit, rewrite, add, remove or reorder content or elements.",
  set_theme: "The user only wants to change the global look: colors, font, corner radius, light or dark theme.",
};
