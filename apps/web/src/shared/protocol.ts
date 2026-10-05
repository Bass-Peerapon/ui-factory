import type { Spec, Theme } from "@ui-factory/catalog";

/** Messages from the editor to a frame iframe. */
export type ToFrame = {
  type: "render";
  spec: Spec | null;
  theme: Theme;
  mode: "edit" | "comment" | "prototype";
  selectedId: string | null;
  locale: "th" | "en";
  /** Numbered comment pins shown on elements. */
  pins: { elementId: string; n: number }[];
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Messages from a frame iframe to the editor. */
export type FromFrame =
  | { type: "ready"; frameId: string }
  | { type: "select"; frameId: string; id: string | null }
  | { type: "comment-target"; frameId: string; id: string; elementType: string; rect: Rect }
  | { type: "navigate"; frameId: string; target: string }
  | { type: "height"; frameId: string; height: number }
  | { type: "thumbnail"; frameId: string; dataUrl: string };

export const FRAME_MSG = "ui-factory";
