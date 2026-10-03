import { useSyncExternalStore } from "react";
import { applyPatch, type Operation } from "fast-json-patch";
import type { ChatMessage, ProjectDoc, TurnState } from "../shared/doc";

export interface Selection {
  frameId: string | null;
  elementId: string | null;
}

export interface EditorState {
  projectId: string | null;
  doc: ProjectDoc | null;
  version: number;
  messages: ChatMessage[];
  selection: Selection;
  turn: TurnState | null;
  thumbnails: Record<string, string>;
  heights: Record<string, number>;
  wireframe: boolean;
  connected: boolean;
  prototypeFrame: string | null;
  error: string | null;
}

let state: EditorState = {
  projectId: null,
  doc: null,
  version: 0,
  messages: [],
  selection: { frameId: null, elementId: null },
  turn: null,
  thumbnails: {},
  heights: {},
  wireframe: false,
  connected: false,
  prototypeFrame: null,
  error: null,
};
const listeners = new Set<() => void>();

export function getState() {
  return state;
}

export function setState(patch: Partial<EditorState> | ((s: EditorState) => Partial<EditorState>)) {
  state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  listeners.forEach((l) => l());
}

export function useEditor<T>(select: (s: EditorState) => T): T {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => select(state),
  );
}

/** Applies a server patch. Returns false when the version is out of sequence and a resync is needed. */
export function applyDocPatch(version: number, ops: Operation[]): boolean {
  if (!state.doc || version !== state.version + 1) return false;
  const doc = applyPatch(structuredClone(state.doc), ops, false, false).newDocument;
  setState((s) => ({ doc, version, selection: pruneSelection(doc, s.selection) }));
  return true;
}

export function pruneSelection(doc: ProjectDoc, sel: Selection): Selection {
  const frame = sel.frameId ? doc.frames[sel.frameId] : undefined;
  if (!frame) return { frameId: null, elementId: null };
  if (sel.elementId && !frame.spec?.elements[sel.elementId]) return { frameId: sel.frameId, elementId: null };
  return sel;
}
