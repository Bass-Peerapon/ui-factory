import type { Device, Locale, Spec, Theme } from "@ui-factory/catalog";

export interface Frame {
  id: string;
  name: string;
  device: Device;
  x: number;
  y: number;
  spec: Spec | null;
}

/** The whole editable project. The API streams RFC 6902 patches against this shape. */
export interface ProjectDoc {
  id: string;
  name: string;
  locale: Locale;
  theme: Theme;
  frames: Record<string, Frame>;
  frameOrder: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  turnId?: string;
  createdAt: string;
}

export interface TurnState {
  id: string;
  frameId: string | null;
  status: "running" | "done" | "stopped" | "error";
  phase: string;
}
