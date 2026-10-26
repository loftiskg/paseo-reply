import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";
import * as zod from "zod";
import { SUPPORTED_BUNDLE, DRAFT_MODULE_ID } from "../client/web";
import { toAttachment } from "../client/model";
import { quote } from "./helpers";

const path = process.env.PASEO_RENDERER_BUNDLE ?? `/Applications/Paseo.app/Contents/Resources/app-dist/_expo/static/js/web/${SUPPORTED_BUNDLE}`;
test("installed 0.13.0 renderer accepts, retains, and submits our native attachment", { skip: !existsSync(path) }, () => {
  const bundle = readFileSync(path, "utf8");
  const lines = bundle.split("\n");
  const moduleLine = (id: number) => {
    const line = lines.find(l => l.startsWith("__d(") && new RegExp(`\\},${id},\\[`).test(l));
    assert.ok(line, `Installed renderer module ${id} exists`); return line;
  };
  assert.match(moduleLine(DRAFT_MODULE_ID), /"useDraftStore"/);
  assert.match(moduleLine(DRAFT_MODULE_ID), /flushDraftPersistStorage/);
  // Evaluate only pure schemas/serialization from the installed app, never its bootstrap or UI.
  const cache = new Map<number, any>([[3260, zod]]);
  const allowed = new Set([3573, 3574, 3403, 3604, 3605]);
  function load(id: number): any {
    if (cache.has(id)) return cache.get(id);
    // The public SDK barrel also imports unrelated RPC/settings code. Only its attachment export is used here.
    if (id === 3575) return load(3403);
    assert.ok(allowed.has(id), `Only audited pure module dependencies may execute: ${id}`);
    let factory: Function | undefined; let dependencies: number[] = [];
    vm.runInNewContext(moduleLine(id), { __d(fn: Function, actual: number, deps: number[]) {
      assert.equal(actual, id); factory = fn; dependencies = deps;
    } });
    const module = { exports: {} }; cache.set(id, module.exports);
    factory!({}, load, load, load, module, module.exports, dependencies);
    return module.exports;
  }
  const state = load(3604);
  const attachment = toAttachment(quote);
  const parsed = state.CanonicalDraftInputSchema.parse({ text: "Existing text", attachments: [attachment] });
  assert.equal(parsed.attachments[0].item.subtitle, attachment.item.subtitle);
  assert.equal(parsed.text, "Existing text");
  const sent = load(3574).pluginResourceAttachmentToAgentAttachment(parsed.attachments[0]);
  assert.equal(sent.type, "text"); assert.equal(sent.text, attachment.item.text);
  assert.equal(sent.externalResource.provider, "selected-reply");
});
