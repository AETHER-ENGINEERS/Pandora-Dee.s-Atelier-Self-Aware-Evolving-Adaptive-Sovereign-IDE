import test from "node:test";
import assert from "node:assert/strict";
import { moveDigest, pageRows } from "./xdcRows.ts";

const row = (serial: number, payload: unknown) => ({ serial, name: "x", update: { payload } }) as never;

test("pageRows shows the latest page and says how to read the rest", () => {
  const rows = Array.from({ length: 50 }, (_, i) => row(i + 1, {}));
  let r = pageRows(rows, 0, 30);
  assert.equal(r.shown.length, 30);
  assert.match(r.note, /#21 to #50 of 50/);
  assert.match(r.note, /since: 0/);
  r = pageRows(rows.filter((x: { serial: number }) => x.serial > 5), 5, 30);
  assert.match(r.note, /#6 to #35/);
  assert.match(r.note, /Later ones: call again with since: 35/);
  assert.equal(pageRows(rows.slice(0, 10), 0, 30).note, "");
});

test("moveDigest lists every move of every game in ply order", () => {
  const rows = [
    row(1, { type: "gstart", gameId: "g1" }),
    row(3, { type: "move", gameId: "g1", ply: 1, uci: "e7e5" }),
    row(2, { type: "move", gameId: "g1", ply: 0, uci: "e2e4" }),
    row(4, { type: "move", gameId: "g1", ply: 1, uci: "d7d5" }),
    row(5, { type: "move", gameId: "g2", ply: 0, move: "d2d4" }),
  ];
  const d = moveDigest(rows);
  assert.match(d, /g1: 0:e2e4 1:e7e5 \(next is ply 2, white/);
  assert.match(d, /g2: 0:d2d4 \(next is ply 1, black/);
  assert.equal(moveDigest([row(1, { hi: 1 })]), "");
});
