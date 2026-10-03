import type { Spec } from "@ui-factory/catalog";

export type Intent = "new_page" | "edit_selection" | "set_theme";

export interface RouteInput {
  prompt: string;
  /** Short description of what is selected, e.g. "Hero element" or "nothing". */
  selection: string;
  frameHasContent: boolean;
  /** Brief or name of the open page, so a request about another topic routes to new_page. */
  currentPage?: string;
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
  new_page:
    'Build a different page or screen: the request names a page to create ("ทำหน้า ...", "หน้า ... สำหรับ ...", "landing page for ...", "create a pricing page"), usually about a topic other than `current_page`.',
  edit_selection:
    'Change the page that is already open: rewrite, shorten, add, remove, move or restyle its content or the `selected` element. Refers to existing content ("this", "นี่", "หัวข้อ", "เพิ่มปุ่ม", "ลบส่วน").',
  set_theme: "Only change the global look of the project: colors, color tone, font, corner radius, dark or light mode.",
};

export const routeInstructions =
  "What does `request` ask the UI editor to do? A request that names a new page to build is new_page even when a page is open.";

export function routeState(input: RouteInput) {
  return {
    request: input.prompt,
    selected: input.selection,
    current_page: input.frameHasContent ? input.currentPage || "an existing page" : "empty",
  };
}
