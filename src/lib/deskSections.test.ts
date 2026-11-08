import { test } from "node:test";
import assert from "node:assert/strict";
import { applySections, extraIn, hasOwnStuff, toSections } from "./deskSections.ts";

test("the shared desk in sections: each character's files apart, the device's layout left out", () => {
  const state = { wins: { room: { x: 1 } }, uiScale: 1.2, model: { tools: true }, files: { dee: { "SOUL.md": "# Dee" }, jade: { "SOUL.md": "# Jade" } }, chats: [], set: () => 0 };
  assert.deepEqual(toSections(state), { model: { tools: true }, "files:dee": { "SOUL.md": "# Dee" }, "files:jade": { "SOUL.md": "# Jade" }, chats: [] });
});

test("sections laid back in keep this device's own parts", () => {
  const mine = { wins: { room: { x: 9 } }, uiScale: 0.9, model: { tools: false }, files: { dee: { "SOUL.md": "old" } } };
  const next = applySections(mine, { model: { tools: true }, "files:dee": { "SOUL.md": "# Dee" }, "files:noe": { "SOUL.md": "# Noe" }, wins: { room: { x: 1 } } });
  assert.deepEqual(next.wins, { room: { x: 9 } }, "a shared section never moves this device's windows");
  assert.equal(next.uiScale, 0.9);
  assert.deepEqual(next.model, { tools: true });
  assert.deepEqual(next.files, { dee: { "SOUL.md": "# Dee" }, noe: { "SOUL.md": "# Noe" } });
  assert.deepEqual(applySections(next, { "files:noe": null }).files, { dee: { "SOUL.md": "# Dee" } }, "null removes a character's files");
});

test("only what the shared desk doesn't have counts", () => {
  const shared = { custom: [{ id: "forge" }], chats: [{ id: "c1" }], env: { A: "" }, "files:dee": { "SOUL.md": "# Dee" } };
  assert.equal(extraIn({ custom: [{ id: "forge" }], chats: [{ id: "c1" }], env: { A: "x" }, files: { dee: { "SOUL.md": "# Dee" } } }, shared), 0, "the same desk: nothing to ask about");
  assert.equal(extraIn({ custom: [{ id: "phonefriend" }], chats: [{ id: "c9" }], env: { B: "y" }, files: { dee: { "SOUL.md": "# Dee, on the phone" } } }, shared), 4);
});

test("a desk worth asking about", () => {
  assert.equal(hasOwnStuff({ wins: {}, model: {} }), false);
  assert.equal(hasOwnStuff({ chats: [{ id: "c" }] }), true);
  assert.equal(hasOwnStuff({ custom: [{ id: "x" }] }), true);
  assert.equal(hasOwnStuff({ env: { KEY: "v" } }), true);
});
