import { JevComposer } from "./jev";
import { LLMComposer } from "./llm";
import type { Composer } from "./types";

export * from "./types";
export { JevComposer, LLMComposer };

export function createComposer(mode: string): Composer {
  return mode === "llm" ? new LLMComposer() : new JevComposer();
}
export { loadEnv } from "./env";
