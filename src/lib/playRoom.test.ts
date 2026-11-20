import test from "node:test";
import assert from "node:assert/strict";
import { WRAP_AT, playNote, timeToWrap, wrapNote } from "./playRoom.ts";

test("wraps up at four-fifths of her room, not before", () => {
  const w = 262144;
  assert.equal(timeToWrap(undefined, w), false);
  assert.equal(timeToWrap(Math.floor(w * WRAP_AT) - 1, w), false);
  assert.equal(timeToWrap(Math.ceil(w * WRAP_AT), w), true);
});

test("the notes say how long she has, and what to say at the end", () => {
  assert.match(playNote(262144), /about 210k tokens.*of 262k/);
  const n = wrapNote(215000, 262144);
  assert.match(n, /215k of 262k/);
  assert.match(n, /safe/);
  assert.match(n, /x, y, z/);
  assert.match(n, /next turn/);
});
