// All browser and private React/Metro access lives in this adapter.
import { createElement as createIcon, Quote as QuoteIcon, X, CornerDownLeft } from "lucide";
import { opaqueRgb, readablePalette } from "./colors";
import { DraftBridge, validateDraftModule } from "./draft";
import { readQuote, type Quote, type Target } from "./model";

export const SUPPORTED_BUNDLE = "index-f1a1407fb8de7ac3fefc1cc576f0e46f.js";
export const DRAFT_MODULE_ID = 3598;
const ASSISTANT = '[data-testid="assistant-message"]';
const TRANSCRIPT = '[data-testid="agent-chat-scroll"]';
const PILL = '[data-testid="composer-plugin-resource-attachment-pill"]';
const INPUT = '[data-testid="message-input-root"]';
interface Fiber { memoizedProps?: Record<string, unknown>; return?: Fiber | null }
type HostGlobal = typeof globalThis & {
  __r?: (id: number) => unknown;
  __selectedReplyV1?: { refs: number; dispose(): void };
};

function fibers(element: Element): Fiber[] {
  const key = Object.keys(element).find(k => k.startsWith("__reactFiber$"));
  let fiber = key ? (element as unknown as Record<string, Fiber>)[key] : undefined;
  const result: Fiber[] = [];
  const seen = new Set<Fiber>();
  while (fiber && result.length < 160 && !seen.has(fiber)) {
    result.push(fiber); seen.add(fiber); fiber = fiber.return ?? undefined;
  }
  return result;
}

export function targetOf(element: Element): Target | null {
  for (const fiber of fibers(element)) {
    const p = fiber.memoizedProps;
    if (p?.readOnly === true) return null;
    if (typeof p?.serverId === "string" && p.serverId && typeof p.agentId === "string" && p.agentId)
      return { serverId: p.serverId, agentId: p.agentId };
  }
  return null;
}

function sameTarget(a: Target | null, b: Target): boolean {
  return a?.serverId === b.serverId && a.agentId === b.agentId;
}

function elementOf(node: Node | null): Element | null {
  return node?.nodeType === 1 ? node as Element : node?.parentElement ?? null;
}

export interface Capture { quote: Quote; anchor: Element; rect: DOMRect }
export function captureSelection(selection: Selection | null): Capture | null {
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return null;
  const range = selection.getRangeAt(0);
  const start = elementOf(range.startContainer)?.closest(ASSISTANT);
  const end = elementOf(range.endContainer)?.closest(ASSISTANT);
  if (!start || start !== end || !start.closest(TRANSCRIPT)) return null;
  const messageId = start.closest('[data-message-id]')?.getAttribute('data-message-id');
  const target = targetOf(start);
  const text = range.toString();
  if (!messageId || !target || !text.trim()) return null;
  return { quote: { ...target, id: crypto.randomUUID(), messageId, text, comment: "" },
    anchor: start, rect: range.getBoundingClientRect() };
}

export function connectHost(doc: Document, host: HostGlobal): DraftBridge {
  // IDs are accepted ONLY with the exact installed renderer fingerprint. Never probe arbitrary modules.
  if (![...doc.scripts].some(s => new URL(s.src, doc.baseURI).pathname.endsWith(`/${SUPPORTED_BUNDLE}`)) ||
      typeof host.__r !== "function") throw new Error("This Paseo build is not supported yet.");
  return new DraftBridge(validateDraftModule(host.__r(DRAFT_MODULE_ID)));
}

const CSS = `
:host { color-scheme:light dark; font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; --reply-base:light-dark(#fff,#191c19); --reply-fg:light-dark(#202322,#ebedeb); }
* { box-sizing:border-box; }
.box { --surface:color-mix(in srgb,var(--reply-base) 94%,var(--reply-fg)); --muted:color-mix(in srgb,var(--reply-fg) 70%,var(--surface)); position:fixed; z-index:2147483000; color:var(--reply-fg); background:var(--surface); border:1px solid color-mix(in srgb,var(--reply-fg) 18%,var(--surface)); border-radius:12px; box-shadow:0 6px 20px #0002; padding:16px; width:min(360px,calc(100vw - 24px)); }
.toolbar { width:auto; padding:4px; }
button { font:inherit; cursor:pointer; color:inherit; border:1px solid color-mix(in srgb,var(--reply-fg) 18%,var(--surface)); border-radius:7px; padding:6px 10px; background:transparent; display:inline-flex; align-items:center; justify-content:center; gap:8px; }
button:hover { background:color-mix(in srgb,var(--reply-fg) 9%,var(--surface)); } button:disabled { opacity:.5; cursor:wait; }
button:focus-visible { outline:1px solid var(--muted); outline-offset:2px; }
.primary { background:color-mix(in srgb,var(--reply-fg) 7%,var(--surface)); }
.primary svg { opacity:.7; }
.quote-row { display:flex; align-items:center; gap:12px; color:var(--muted); margin:-4px -4px 12px 0; }
.quote-toggle { border:0; padding:0; min-width:0; flex:1; justify-content:flex-start; color:var(--muted); }
.quote-toggle:hover { background:transparent; color:var(--reply-fg); }
.quote-toggle span { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
svg { flex-shrink:0; }
.close { padding:4px; width:28px; height:28px; border:0; color:var(--muted); }
.actions { display:flex; gap:8px; justify-content:flex-end; margin-top:10px; }
.remove { margin-right:auto; border:0; color:var(--muted); padding-left:0; }
pre { white-space:pre-wrap; overflow-wrap:anywhere; font:12px/1.5 ui-monospace,monospace; max-height:140px; overflow:auto; margin:0 0 12px; color:var(--muted); user-select:text; }
textarea { display:block; resize:none; width:100%; height:54px; font:inherit; line-height:1.5; padding:3px 0; border:0; border-radius:0; outline:none; background:transparent; color:inherit; }
textarea::placeholder { color:var(--muted); }
.error { color:light-dark(#a12424,#ffb6b6); margin-top:8px; white-space:pre-wrap; font-size:12px; }
.error:empty { display:none; }
.notice { right:16px; bottom:20px; } [hidden] { display:none!important; }

`;

export function mountReply(doc: Document, bridge: DraftBridge | null, initialError?: string): () => void {
  const root = doc.createElement("div");
  root.dataset.selectedReply = "true";
  const shadow = root.attachShadow({ mode: "open" });
  const style = doc.createElement("style"); style.textContent = CSS; shadow.append(style);
  doc.body.append(root);
  let panel: HTMLElement | null = null;
  let editing = false;
  let disposed = false;
  let pendingTimer: ReturnType<typeof setTimeout> | undefined;
  let restoreFocus: HTMLElement | null = null;
  const abort = new AbortController();
  const eventOptions = { capture: true, signal: abort.signal };

  function close() {
    panel?.remove(); panel = null; editing = false;
    if (restoreFocus?.isConnected) restoreFocus.focus();
    restoreFocus = null;
  }
  function box(className = "") {
    panel?.remove();
    const p = doc.createElement("section"); p.className = `box ${className}`;
    shadow.append(p); panel = p; return p;
  }
  function button(label: string, action: () => void, primary = false) {
    const b = doc.createElement("button"); b.type = "button"; b.textContent = label;
    if (primary) b.className = "primary";
    b.onclick = action; return b;
  }
  function position(p: HTMLElement, rect: DOMRect) {
    const width = p.getBoundingClientRect().width || 370;
    const height = p.getBoundingClientRect().height || 230;
    p.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
    p.style.top = `${Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - height - 12))}px`;
    p.style.maxHeight = "calc(100vh - 24px)"; p.style.overflowY = "auto";
  }
  function matchTheme(p: HTMLElement, anchor: Element) {
    const view = doc.defaultView;
    if (!view) return;
    const foreground = view.getComputedStyle(anchor).color;
    let background = "";
    for (let node: Element | null = anchor; node; node = node.parentElement) {
      const color = view.getComputedStyle(node).backgroundColor;
      if (opaqueRgb(color)) { background = color; break; }
    }
    const palette = readablePalette(background, foreground, view.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true);
    p.style.setProperty("--reply-base", palette.background);
    p.style.setProperty("--reply-fg", palette.foreground);
    p.style.colorScheme = palette.scheme;
  }
  function notice(message: string) {
    editing = false;
    const p = box("notice"); p.setAttribute("role", "status");
    const title = doc.createElement("strong"); title.textContent = "Selected Reply is unavailable";
    const text = doc.createElement("p"); text.textContent = `${message} Existing drafts are unchanged.`;
    p.append(title, text, button("Dismiss", close));
  }
  function focusComposer(target: Target) {
    for (const input of doc.querySelectorAll(`${INPUT} textarea`)) {
      if (input instanceof HTMLTextAreaElement && sameTarget(targetOf(input), target) && !input.disabled) {
        input.focus(); return;
      }
    }
  }
  function editor(capture: Capture, existing = false) {
    if (!bridge) return;
    editing = true;
    restoreFocus = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
    const p = box(); p.setAttribute("role", "dialog"); p.setAttribute("aria-label", existing ? "Edit reply annotation" : "Reply to selection");
    matchTheme(p, capture.anchor);
    const header = doc.createElement("div"); header.className = "quote-row";
    const quote = doc.createElement("pre"); quote.textContent = capture.quote.text; quote.hidden = true;
    const preview = button("", () => { quote.hidden = !quote.hidden; preview.setAttribute("aria-expanded", String(!quote.hidden)); position(p, capture.rect); });
    preview.className = "quote-toggle"; preview.setAttribute("aria-label", "Show full quote"); preview.setAttribute("aria-expanded", "false");
    const excerpt = doc.createElement("span"); excerpt.textContent = capture.quote.text.replace(/\s+/g, " ").trim();
    preview.append(createIcon(QuoteIcon, { width: 16, height: 16, "aria-hidden": "true" }), excerpt);
    const dismiss = button("", close); dismiss.className = "close"; dismiss.setAttribute("aria-label", "Close reply"); dismiss.title = "Close (Escape)";
    dismiss.append(createIcon(X, { width: 16, height: 16, "aria-hidden": "true" }));
    header.append(preview, dismiss);
    const input = doc.createElement("textarea"); input.value = capture.quote.comment;
    input.placeholder = "Add a comment…"; input.setAttribute("aria-label", "Comment (optional)");
    input.title = "Optional comment. Enter adds to chat; Shift+Enter inserts a new line.";
    const error = doc.createElement("div"); error.className = "error"; error.setAttribute("role", "alert");
    const actions = doc.createElement("div"); actions.className = "actions";
    let busy = false;
    let flushPending = false;
    let lastMode: "add" | "edit" | "remove" = existing ? "edit" : "add";
    async function save(mode: "add" | "edit" | "remove") {
      if (busy || !bridge) return;
      // Resolve target again while the source is present. A tab switch must never retarget the quote.
      if (!flushPending && (!capture.anchor.isConnected || !sameTarget(targetOf(capture.anchor), capture.quote))) {
        error.textContent = "The source chat changed. Return to it and reopen Reply."; return;
      }
      busy = true; input.disabled = true; error.textContent = "";
      for (const b of p.querySelectorAll("button")) b.disabled = true;
      try {
        if (flushPending) await bridge.module.flushDraftPersistStorage();
        else {
          lastMode = mode;
          const next = { ...capture.quote, comment: input.value };
          try { await bridge.change(next, mode, existing ? capture.quote : undefined); }
          catch (e) {
            // Native writes are synchronous; detect a completed in-memory mutation before retrying persistence.
            const saved = bridge.quotes(next).find(q => q.id === next.id);
            flushPending = mode === "remove" ? !saved : saved?.comment === next.comment && saved?.text === next.text;
            throw e;
          }
        }
        if (!disposed) { close(); focusComposer(capture.quote); }
      } catch (e) {
        error.textContent = `${e instanceof Error ? e.message : String(e)}${flushPending ? " The change is in the draft but saving is unconfirmed. Retry before closing." : ""}`;
        if (flushPending) submit.textContent = "Retry saving";
      } finally {
        busy = false; input.disabled = flushPending;
        for (const b of p.querySelectorAll("button")) b.disabled = flushPending && b !== submit;
      }
    }
    const submit = button(existing ? "Save comment" : "Add to chat", () => { void save(flushPending ? lastMode : existing ? "edit" : "add"); }, true);
    submit.append(createIcon(CornerDownLeft, { width: 14, height: 14, "aria-hidden": "true" }));
    if (existing) { const remove = button("Remove", () => { void save("remove"); }); remove.className = "remove"; actions.append(remove); }
    actions.append(submit);
    p.append(header, quote, input, error, actions); position(p, capture.rect);
    input.addEventListener("keydown", e => {
      e.stopPropagation();
      if (e.isComposing) return;
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void save(flushPending ? lastMode : existing ? "edit" : "add"); }
      if (e.key === "Escape" && !busy && !flushPending) { e.preventDefault(); close(); }
    });
    // Keep keyboard focus inside the nonmodal editor until Save or Cancel.
    p.addEventListener("keydown", e => {
      e.stopPropagation();
      if (e.key === "Escape" && !busy && !flushPending && !e.isComposing) {
        e.preventDefault(); close(); return;
      }
      if (e.key !== "Tab") return;
      const items = [...p.querySelectorAll<HTMLElement>('textarea:not(:disabled),button:not(:disabled)')];
      const first = items[0], last = items.at(-1);
      if (e.shiftKey && shadow.activeElement === first) { e.preventDefault(); last?.focus(); }
      if (!e.shiftKey && shadow.activeElement === last) { e.preventDefault(); first?.focus(); }
    });
    input.focus();
  }

  function selectionFinished(event: Event) {
    if (editing || !bridge || event.composedPath().includes(root)) return;
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => {
      if (disposed || editing) return;
      const capture = captureSelection(doc.getSelection());
      if (!capture) { close(); return; }
      try { bridge.read(capture.quote); } catch (e) { notice(String(e)); return; }
      const p = box("toolbar"); p.setAttribute("role", "toolbar"); p.setAttribute("aria-label", "Selected text actions");
      matchTheme(p, capture.anchor);
      const reply = button("Reply", () => editor(capture));
      reply.onpointerdown = e => e.preventDefault();
      p.append(reply); position(p, capture.rect);
    }, 0);
  }
  function openAttachment(event: Event) {
    if (!bridge || event.composedPath().includes(root)) return;
    const pill = elementOf(event.target as Node)?.closest(PILL);
    if (!pill) return;
    const props = fibers(pill).map(f => f.memoizedProps).find(p => readQuote(p?.attachment));
    const quote = readQuote(props?.attachment);
    if (!quote) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (!sameTarget(targetOf(pill), quote)) { notice("The annotation's conversation could not be verified."); return; }
    editor({ quote, anchor: pill, rect: pill.getBoundingClientRect() }, true);
  }
  doc.addEventListener("pointerup", selectionFinished, eventOptions);
  doc.addEventListener("keyup", e => { if (e.key.startsWith("Arrow") || e.key === "Shift") selectionFinished(e); }, eventOptions);
  doc.addEventListener("click", openAttachment, eventOptions);
  doc.addEventListener("keydown", e => {
    if (e.composedPath().includes(root)) return;
    if ((e.key === "Enter" || e.key === " ") && elementOf(e.target as Node)?.closest(PILL)) openAttachment(e);
    if (e.key === "Escape" && panel && !editing) { e.preventDefault(); e.stopPropagation(); close(); }
  }, eventOptions);
  doc.addEventListener("scroll", () => { if (!editing) close(); }, eventOptions);
  if (initialError) notice(initialError);
  return () => { disposed = true; clearTimeout(pendingTimer); abort.abort(); root.remove(); };
}

export function installReply(): () => void {
  if (typeof document === "undefined" || typeof window === "undefined") return () => {};
  const host = globalThis as HostGlobal;
  if (!host.__selectedReplyV1) {
    let bridge: DraftBridge | null = null;
    let error: string | undefined;
    try { bridge = connectHost(document, host); } catch (e) { error = e instanceof Error ? e.message : String(e); }
    host.__selectedReplyV1 = { refs: 0, dispose: mountReply(document, bridge, error) };
  }
  const instance = host.__selectedReplyV1; instance.refs++;
  let released = false;
  return () => {
    if (released) return; released = true;
    if (--instance.refs === 0) { instance.dispose(); delete host.__selectedReplyV1; }
  };
}
