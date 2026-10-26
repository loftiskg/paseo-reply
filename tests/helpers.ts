import { DraftBridge, type Draft, type DraftModule, type DraftRecord } from "../client/draft";
import type { Quote } from "../client/model";

export const quote: Quote = { id: "quote-1", serverId: "host-a", agentId: "chat-a", messageId: "message-1", text: "  const x = 1;\n\n  return x;  ", comment: "" };
export function fakeHost() {
  const drafts: Record<string, DraftRecord> = {};
  const listeners = new Set<() => void>();
  let hydrated = true, failFlush = false;
  const state = {
    drafts,
    getDraftInput(key: string) { return drafts[key]?.lifecycle === "active" ? drafts[key].input : undefined; },
    saveDraftInput({ draftKey, draft }: { draftKey: string; draft: Draft }) {
      drafts[draftKey] = { input: draft, lifecycle: "active", version: (drafts[draftKey]?.version ?? 0) + 1 };
      for (const listener of listeners) listener();
    },
  };
  const module: DraftModule = {
    useDraftStore: { getState: () => state, persist: { hasHydrated: () => hydrated },
      subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; } },
    async flushDraftPersistStorage() { if (failFlush) throw new Error("Disk unavailable"); },
  };
  return { bridge: new DraftBridge(module), module, state, setHydrated(v: boolean) { hydrated = v; }, setFailFlush(v: boolean) { failFlush = v; } };
}
