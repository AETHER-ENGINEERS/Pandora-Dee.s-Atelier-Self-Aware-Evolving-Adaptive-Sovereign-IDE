import { test } from "node:test";
import assert from "node:assert/strict";
import { BUILT_IN, foldBabalon } from "./characters.ts";

test("there is one Babalon, on no shelf", () => {
  const b = BUILT_IN.filter((c) => /^babalon/.test(c.id));
  assert.deepEqual(b.map((c) => c.id), ["babalon"]);
  assert.equal(b[0].shelf, undefined);
});

test("the old adult seat is folded into her, keeping what it had", () => {
  const r = foldBabalon({
    files: { babalon: { "MEMORY.md": "mine", "SOUL.md": "S" }, "babalon-adult": { "MEMORY.md": "from the cup", "SOUL.md": "old", "journal/2026.md": "j" } },
    members: ["dee", "babalon-adult", "babalon"],
    focus: "babalon-adult",
    charPrefs: { "babalon-adult": { a: 1 } },
  });
  assert.deepEqual(r.members, ["dee", "babalon"]);
  assert.equal(r.focus, "babalon");
  assert.equal(r.files?.["babalon-adult"], undefined);
  assert.match(r.files!.babalon["MEMORY.md"], /mine[\s\S]*from the cup/);
  assert.equal(r.files!.babalon["SOUL.md"], "S");
  assert.equal(r.files!.babalon["journal/2026.md"], "j");
  assert.deepEqual(r.charPrefs, { babalon: { a: 1 } });
});

test("nothing to fold, nothing changes", () => {
  const p = { members: ["dee"], focus: "dee" };
  assert.deepEqual(foldBabalon(p), p);
});
