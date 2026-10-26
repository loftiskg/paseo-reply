import assert from "node:assert/strict";
import { test } from "node:test";
import { contrast, opaqueRgb, readablePalette } from "../client/colors";

test("text and muted text stay readable when wrappers have the wrong foreground", () => {
  for (const [base, text] of [["rgb(24, 28, 25)", "rgb(0, 0, 0)"], ["rgb(255, 255, 255)", "rgb(255, 255, 255)"]]) {
    const palette = readablePalette(base, text, true);
    const bg = opaqueRgb(palette.background)!, fg = opaqueRgb(palette.foreground)!;
    const surface = bg.map((v, i) => v * .94 + fg[i] * .06) as [number, number, number];
    const muted = fg.map((v, i) => v * .7 + surface[i] * .3) as [number, number, number];
    assert.ok(contrast(fg, surface) >= 7);
    assert.ok(contrast(muted, surface) >= 4.5);
  }
});

test("transparent backgrounds are skipped; unrecognized colors use a safe palette", () => {
  assert.equal(opaqueRgb("rgba(0, 0, 0, 0)"), null);
  assert.equal(opaqueRgb("rgba(0, 0, 0, 0.5)"), null);
  assert.equal(readablePalette("transparent", "", true).scheme, "dark");
  assert.equal(readablePalette("", "", false).scheme, "light");
});
