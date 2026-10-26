import { draftKey, readQuote, toAttachment, type Quote, type Target } from "./model";

export interface Draft { text: string; attachments: unknown[] }
export interface DraftRecord { input: Draft; lifecycle: string; version: number }
export interface DraftState {
  drafts: Record<string, DraftRecord>;
  getDraftInput(key: string): Draft | undefined;
  saveDraftInput(input: { draftKey: string; draft: Draft }): void;
}
export interface DraftModule {
  useDraftStore: {
    getState(): DraftState;
    subscribe(listener: () => void): () => void;
    persist: { hasHydrated(): boolean };
  };
  flushDraftPersistStorage(): Promise<void>;
}

export function validateDraftModule(value: unknown): DraftModule {
  const m = value as DraftModule;
  if (!m?.useDraftStore?.getState || !m.useDraftStore.subscribe ||
      !m.useDraftStore.persist?.hasHydrated || typeof m.flushDraftPersistStorage !== "function")
    throw new Error("Paseo's draft interface has changed.");
  const state = m.useDraftStore.getState();
  if (!state.drafts || typeof state.saveDraftInput !== "function" || typeof state.getDraftInput !== "function")
    throw new Error("Paseo's draft format has changed.");
  return m;
}

export class DraftBridge {
  constructor(readonly module: DraftModule) {}

  read(target: Target): Draft {
    if (!this.module.useDraftStore.persist.hasHydrated()) throw new Error("Paseo is still loading drafts. Try again shortly.");
    const state = this.module.useDraftStore.getState();
    const key = draftKey(target);
    const record = state.drafts[key];
    const draft = state.getDraftInput(key);
    if (record?.lifecycle === "active" && !draft) throw new Error("This draft is not ready. Open the chat and try again.");
    const result = draft ?? { text: "", attachments: [] };
    if (typeof result.text !== "string" || !Array.isArray(result.attachments)) throw new Error("Paseo's draft format has changed.");
    return result;
  }

  quotes(target: Target): Quote[] {
    return this.read(target).attachments.map(readQuote).filter((q): q is Quote => !!q);
  }

  // Read and write in the same JS turn: no await between reading current user text and saving.
  async change(quote: Quote, mode: "add" | "edit" | "remove", original?: Quote): Promise<void> {
    const draft = this.read(quote);
    const matches = draft.attachments.filter(a => readQuote(a)?.id === quote.id);
    if (matches.length > 1) throw new Error("Duplicate annotation identity. The draft was left unchanged.");
    const existing = readQuote(matches[0]);
    if (mode !== "add" && !existing) throw new Error("This annotation was removed or sent. The draft was left unchanged.");
    if (existing && (existing.serverId !== quote.serverId || existing.agentId !== quote.agentId))
      throw new Error("Annotation conversation mismatch. The draft was left unchanged.");
    if (mode === "add" && existing) {
      if (existing.text !== quote.text || existing.comment !== quote.comment)
        throw new Error("This annotation has changed. Reopen it before editing.");
      await this.module.flushDraftPersistStorage();
      return;
    }
    if (original && existing && (existing.comment !== original.comment || existing.text !== original.text))
      throw new Error("This annotation changed elsewhere. Reopen it before editing.");
    const attachment = toAttachment(quote);
    const attachments = mode === "add" ? [...draft.attachments, attachment] : draft.attachments.flatMap(a =>
      readQuote(a)?.id === quote.id ? (mode === "remove" ? [] : [attachment]) : [a]);
    this.module.useDraftStore.getState().saveDraftInput({ draftKey: draftKey(quote), draft: { ...draft, attachments } });
    // Flush failures remain visible; never roll back over newer user edits.
    await this.module.flushDraftPersistStorage();
  }
}
