import type { Spec, Theme } from "@ui-factory/catalog";

/** Messages from the editor to a frame iframe. */
export type ToFrame = {
  type: "render";
  spec: Spec | null;
  theme: Theme;
  mode: "edit" | "prototype";
  selectedId: string | null;
  locale: "th" | "en";
};

/** Messages from a frame iframe to the editor. */
export type FromFrame =
  | { type: "ready"; frameId: string }
  | { type: "select"; frameId: string; id: string | null }
  | { type: "navigate"; frameId: string; target: string }
  | { type: "height"; frameId: string; height: number }
  | { type: "thumbnail"; frameId: string; dataUrl: string };

export const FRAME_MSG = "ui-factory";
