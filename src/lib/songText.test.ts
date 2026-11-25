import { test } from "node:test";
import assert from "node:assert/strict";
import { fitLength } from "./songText.ts";

const song = (verses: number, linesEach: number) =>
  Array.from({ length: verses }, (_, i) => [`[${i % 2 ? "Chorus" : "Verse"}]`, ...Array.from({ length: linesEach }, (_, k) => `line ${k}`)].join("\n")).join("\n\n");

test("a short song still gets four minutes", () => {
  assert.equal(fitLength(song(4, 4)), 240);
  assert.equal(fitLength(""), 240);
});

test("a long one gets the time its words need, up to the most", () => {
  assert.equal(fitLength(song(8, 8)), 360);
  const mid = fitLength(song(6, 9)); // 54 sung lines, 6 sections: 243 + 48 + 10 → 300
  assert.equal(mid, 300);
});

test("the floor and ceiling can be set (a shorter engine)", () => {
  assert.equal(fitLength(song(8, 8), 30, 240), 240);
  assert.equal(fitLength("[Verse]\nla", 30, 240), 30);
});
