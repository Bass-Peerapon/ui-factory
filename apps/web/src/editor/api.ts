import type { Operation } from "fast-json-patch";
import type { ChatMessage, ProjectDoc, TurnState } from "../shared/doc";
import { applyDocPatch, getState, setState } from "./store";

export const API = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8080";

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(API + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
  return data as T;
}

export interface ChatBody {
  text: string;
  frameId: string | null;
  elementId?: string | null;
  wireframe?: boolean;
  comments?: { elementId: string; text: string }[];
  brief?: Record<string, string>;
  skipBrief?: boolean;
  displayText?: string;
}

export interface Version {
  id: number;
  label: string;
  createdAt: string;
}

/** Sends a chat turn for the current project and reports failures in the status bar. */
export async function sendChat(body: ChatBody) {
  const s = getState();
  if (!s.projectId) return false;
  try {
    await api.chat(s.projectId, { wireframe: s.wireframe, elementId: null, ...body });
    return true;
  } catch (e) {
    setState({ error: (e as Error).message });
    return false;
  }
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
}

export const api = {
  list: () => req<ProjectSummary[]>("GET", "/api/projects"),
  create: (name: string) => req<{ doc: ProjectDoc }>("POST", "/api/projects", { name }),
  get: (id: string) =>
    req<{ doc: ProjectDoc; version: number; messages: ChatMessage[]; turn: TurnState | null }>("GET", `/api/projects/${id}`),
  chat: (id: string, body: ChatBody) => req<{ turnId: string }>("POST", `/api/projects/${id}/chat`, body),
  stop: (id: string) => req<unknown>("POST", `/api/projects/${id}/stop`),
  undo: (id: string) => req<unknown>("POST", `/api/projects/${id}/undo`),
  fill: (id: string, frameId: string) => req<{ turnId: string }>("POST", `/api/projects/${id}/fill`, { frameId }),
  versions: (id: string) => req<Version[]>("GET", `/api/projects/${id}/versions`),
  restore: (id: string, vid: number) => req<unknown>("POST", `/api/projects/${id}/versions/${vid}/restore`),
  op: (id: string, op: string, args: Record<string, unknown>) => req<unknown>("POST", `/api/projects/${id}/ops`, { op, args }),
  exportUrl: (id: string) => `${API}/api/projects/${id}/export`,
};

/** Runs an editor operation and surfaces failures in the status bar. */
export async function runOp(op: string, args: Record<string, unknown>) {
  const id = getState().projectId;
  if (!id) return;
  try {
    await api.op(id, op, args);
  } catch (e) {
    setState({ error: (e as Error).message });
  }
}

let source: EventSource | null = null;

export async function openProject(id: string) {
  source?.close();
  const data = await api.get(id);
  setState({
    projectId: id,
    doc: data.doc,
    version: data.version,
    messages: data.messages,
    turn: data.turn,
    selection: { frameId: data.doc.frameOrder[0] ?? null, elementId: null },
  });
  history.replaceState(null, "", `?p=${id}`);

  const es = new EventSource(`${API}/api/projects/${id}/events`);
  source = es;
  es.onopen = () => setState({ connected: true });
  es.onerror = () => setState({ connected: false });
  es.addEventListener("doc", (e) => {
    const m = JSON.parse((e as MessageEvent).data) as { version: number; doc: ProjectDoc };
    setState((s) => ({ doc: m.doc, version: m.version, selection: s.selection }));
  });
  es.addEventListener("patch", (e) => {
    const m = JSON.parse((e as MessageEvent).data) as { version: number; ops: Operation[] };
    if (m.version <= getState().version) return;
    if (!applyDocPatch(m.version, m.ops)) void resync(id);
  });
  es.addEventListener("message", (e) => {
    const m = JSON.parse((e as MessageEvent).data) as ChatMessage;
    setState((s) => ({ messages: s.messages.some((x) => x.id === m.id) ? s.messages : [...s.messages, m] }));
  });
  es.addEventListener("turn", (e) => {
    const t = JSON.parse((e as MessageEvent).data) as TurnState;
    setState({ turn: t.status === "running" ? t : null });
    // Follow the frame a new-page turn is building.
    if (t.status === "running" && t.phase === "structure" && t.frameId && getState().selection.frameId !== t.frameId)
      setState({ selection: { frameId: t.frameId, elementId: null }, focusFrame: t.frameId });
  });
}

async function resync(id: string) {
  const data = await api.get(id);
  setState({ doc: data.doc, version: data.version });
}
