import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { captureSelection, connectHost, mountReply, SUPPORTED_BUNDLE } from "../client/web";
import { fakeHost, quote } from "./helpers";
import { toAttachment } from "../client/model";

function fixture() {
  const dom = new JSDOM(`<div data-testid="agent-chat-scroll"><div data-message-id="m1"><div data-testid="assistant-message"><span>First sentence.</span><pre>  line one\n  line two</pre></div></div><div data-message-id="m2"><div data-testid="assistant-message">Second response.</div></div></div>`, { url: "https://paseo.test" });
  const w = dom.window;
  Object.assign(globalThis, { window: w, document: w.document, HTMLElement: w.HTMLElement,
    HTMLTextAreaElement: w.HTMLTextAreaElement, AbortController: w.AbortController });
  const props = { serverId: "host-a", agentId: "chat-a" };
  for (const el of w.document.querySelectorAll('[data-testid="assistant-message"]')) {
    Object.assign(el, { __reactFiber$fixture: { memoizedProps: props } });
  }
  Object.defineProperty(w.Range.prototype, "getBoundingClientRect", { value: () => new w.DOMRect(40, 40, 100, 20) });
  function select(a: Node, b = a) {
    const r = w.document.createRange(); r.setStart(a, 0); r.setEnd(b, b.textContent!.length);
    const s = w.getSelection()!; s.removeAllRanges(); s.addRange(r); return s;
  }
  return { dom, w, select };
}

test("one assistant message including code is accepted; spanning messages is rejected", () => {
  const { dom, w, select } = fixture();
  const code = w.document.querySelector("pre")!.firstChild!;
  assert.equal(captureSelection(select(code))?.quote.text, "  line one\n  line two");
  const first = w.document.querySelector("span")!.firstChild!;
  const second = w.document.querySelectorAll('[data-testid="assistant-message"]')[1].firstChild!;
  assert.equal(captureSelection(select(first, second)), null);
  dom.window.close();
});

test("unknown bundles never invoke private module loader", () => {
  const { dom, w } = fixture(); let calls = 0;
  assert.throws(() => connectHost(w.document, { __r: () => { calls++; } } as never), /not supported/);
  assert.equal(calls, 0);
  const script = w.document.createElement("script"); script.src = `/_expo/static/js/web/${SUPPORTED_BUNDLE}`; w.document.body.append(script);
  const h = fakeHost();
  assert.ok(connectHost(w.document, { __r: () => h.module } as never));
  dom.window.close();
});

test("Reply adds an optional blank comment to the draft and cleanup removes UI/listeners", async () => {
  const { dom, w, select } = fixture(); const h = fakeHost();
  const dispose = mountReply(w.document, h.bridge);
  const span = w.document.querySelector("span")!; select(span.firstChild!);
  span.dispatchEvent(new w.Event("pointerup", { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 5));
  const shadow = w.document.querySelector('[data-selected-reply]')!.shadowRoot!;
  (shadow.querySelector("button") as HTMLButtonElement).click();
  assert.equal(shadow.querySelector("textarea")?.value, "");
  [...shadow.querySelectorAll("button")].find(b => b.textContent === "Add to chat")!.click();
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(h.bridge.quotes({ serverId: "host-a", agentId: "chat-a" }).length, 1);
  assert.equal(shadow.querySelector('[role="dialog"]'), null);
  dispose(); assert.equal(w.document.querySelector('[data-selected-reply]'), null);
  dom.window.close();
});

test("Escape from an editor button closes without creating an annotation", async () => {
  const { dom, w, select } = fixture(); const h = fakeHost();
  const dispose = mountReply(w.document, h.bridge);
  const span = w.document.querySelector("span")!; select(span.firstChild!);
  span.dispatchEvent(new w.Event("pointerup", { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 5));
  const shadow = w.document.querySelector('[data-selected-reply]')!.shadowRoot!;
  (shadow.querySelector("button") as HTMLButtonElement).click();
  const cancel = shadow.querySelector<HTMLButtonElement>('[aria-label="Close reply"]')!;
  cancel.focus(); cancel.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
  assert.equal(shadow.querySelector('[role="dialog"]'), null);
  assert.equal(h.bridge.quotes({ serverId: "host-a", agentId: "chat-a" }).length, 0);
  dispose(); dom.window.close();
});

test("failed removal can retry persistence even after its native pill disappears", async () => {
  const { dom, w } = fixture(); const h = fakeHost(); await h.bridge.change(quote, "add");
  const pill = w.document.createElement("button"); pill.dataset.testid = "composer-plugin-resource-attachment-pill";
  Object.assign(pill, { __reactFiber$fixture: { memoizedProps: { ...quote, attachment: toAttachment(quote) } } });
  w.document.body.append(pill);
  const dispose = mountReply(w.document, h.bridge); pill.click();
  const shadow = w.document.querySelector('[data-selected-reply]')!.shadowRoot!;
  h.setFailFlush(true);
  [...shadow.querySelectorAll("button")].find(b => b.textContent === "Remove")!.click();
  await new Promise(resolve => setTimeout(resolve, 5));
  pill.remove(); h.setFailFlush(false);
  [...shadow.querySelectorAll("button")].find(b => b.textContent === "Retry saving")!.click();
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(shadow.querySelector('[role="dialog"]'), null);
  assert.equal(h.bridge.quotes(quote).length, 0);
  dispose(); dom.window.close();
});

test("dark chat with black wrapper and white text never produces black popup text", async () => {
  const { dom, w, select } = fixture(); const h = fakeHost();
  w.document.body.style.backgroundColor = "rgb(24, 28, 25)";
  const wrapper = w.document.querySelector<HTMLElement>('[data-testid="assistant-message"]')!;
  wrapper.style.color = "rgb(0, 0, 0)";
  const span = w.document.querySelector<HTMLSpanElement>("span")!;
  span.style.color = "rgb(235, 237, 235)";
  const dispose = mountReply(w.document, h.bridge);
  select(span.firstChild!); span.dispatchEvent(new w.Event("pointerup", { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 5));
  const shadow = w.document.querySelector('[data-selected-reply]')!.shadowRoot!;
  (shadow.querySelector("button") as HTMLButtonElement).click();
  const panel = shadow.querySelector<HTMLElement>('[role="dialog"]')!;
  assert.notEqual(panel.style.getPropertyValue("--reply-fg"), "rgb(0, 0, 0)");
  assert.equal(panel.style.getPropertyValue("--reply-base"), "rgb(24, 28, 25)");
  dispose(); dom.window.close();
});
