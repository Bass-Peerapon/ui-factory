import type { Device, Locale, Spec, Theme } from "@ui-factory/catalog";

export interface Frame {
  id: string;
  name: string;
  device: Device;
  x: number;
  y: number;
  brief?: string;
  facts?: string;
  flow?: string;
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

export interface NextStep {
  label: string;
  prompt?: string;
  frameId?: string;
  op?: string;
  args?: Record<string, unknown>;
  action?: "prototype";
}

export interface BriefMeta {
  kind: "brief";
  prompt: string;
  frameId: string | null;
  defaults: Record<string, string>;
  sufficient: number;
}

export interface ToolCallSummary {
  tool: string;
  targets: string[];
  count: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  turnId?: string;
  meta?: Partial<BriefMeta> & {
    kind?: string;
    next?: NextStep[];
    comments?: { elementId: string; text: string }[];
    /** Frames a page or flow turn created or changed. */
    frames?: string[];
    /** Successful edit tool calls, grouped by tool. */
    tools?: ToolCallSummary[];
  };
  createdAt: string;
}

export interface TurnStep {
  label: string;
  status: "pending" | "active" | "done" | "skipped";
  detail?: string;
}

export interface TurnState {
  id: string;
  frameId: string | null;
  status: "running" | "done" | "stopped" | "error";
  phase: string;
  steps?: TurnStep[];
}

export interface PendingComment {
  id: string;
  frameId: string;
  elementId: string;
  elementType: string;
  text: string;
}
