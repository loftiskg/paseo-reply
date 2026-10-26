import assert from "node:assert/strict";
import { test } from "node:test";
import { draftKey, readQuote, toAttachment } from "../client/model";
import { validateDraftModule } from "../client/draft";
import { fakeHost, quote } from "./helpers";

test("empty comments and code whitespace round-trip exactly", () => {
  const a = toAttachment(quote);
  assert.equal(readQuote(a)?.text, quote.text);
  assert.equal(readQuote(a)?.comment, "");
  assert.ok(a.item.text.includes(quote.text));
  assert.equal(readQuote({ ...a, pluginId: "another-plugin" }), null);
});

test("adds multiple quotes without replacing main text or unrelated attachments", async () => {
  const h = fakeHost(); const foreign = { kind: "file", id: "file-1" };
  h.state.saveDraftInput({ draftKey: draftKey(quote), draft: { text: "Existing draft", attachments: [foreign] } });
  await h.bridge.change(quote, "add");
  await h.bridge.change({ ...quote, id: "quote-2", comment: "Explain" }, "add");
  assert.equal(h.bridge.read(quote).text, "Existing draft");
  assert.equal(h.bridge.read(quote).attachments[0], foreign);
  assert.equal(h.bridge.quotes(quote).length, 2);
});

test("same agent identifier on different hosts stays isolated", async () => {
  const h = fakeHost();
  await h.bridge.change(quote, "add");
  assert.equal(h.bridge.quotes({ ...quote, serverId: "host-b" }).length, 0);
  await h.bridge.change({ ...quote, serverId: "host-b" }, "add");
  assert.equal(Object.keys(h.state.drafts).length, 2);
});

test("edit and remove operate on one ID and retain a blank comment", async () => {
  const h = fakeHost(); await h.bridge.change(quote, "add");
  const other = { ...quote, id: "quote-2" }; await h.bridge.change(other, "add");
  await h.bridge.change({ ...quote, comment: "Explain this" }, "edit", quote);
  await h.bridge.change(quote, "edit", { ...quote, comment: "Explain this" });
  assert.equal(h.bridge.quotes(quote)[0].comment, "");
  await h.bridge.change(quote, "remove", quote);
  assert.equal(h.bridge.quotes(quote)[0].id, other.id);
});

test("editing a sent or concurrently changed quote does not resurrect or overwrite it", async () => {
  const h = fakeHost(); await h.bridge.change(quote, "add");
  await h.bridge.change({ ...quote, comment: "new" }, "edit", quote);
  await assert.rejects(h.bridge.change({ ...quote, comment: "stale" }, "edit", quote), /changed elsewhere/);
  h.state.drafts[draftKey(quote)].lifecycle = "sent";
  await assert.rejects(h.bridge.change(quote, "edit", quote), /removed or sent/);
});

test("loading drafts fail closed; no initial empty draft clobbers persisted data", async () => {
  const h = fakeHost(); h.setHydrated(false);
  await assert.rejects(h.bridge.change(quote, "add"), /loading/);
  assert.deepEqual(h.state.drafts, {});
  assert.throws(() => validateDraftModule({}), /changed/);
});

test("persistence failures surface and a retried add does not duplicate the quote", async () => {
  const h = fakeHost(); h.setFailFlush(true);
  await assert.rejects(h.bridge.change(quote, "add"), /Disk unavailable/);
  assert.equal(h.bridge.quotes(quote).length, 1);
  h.setFailFlush(false); await h.bridge.change(quote, "add");
  assert.equal(h.bridge.quotes(quote).length, 1);
});
