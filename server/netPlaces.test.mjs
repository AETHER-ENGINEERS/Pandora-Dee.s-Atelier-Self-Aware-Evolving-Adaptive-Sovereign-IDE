import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { listFolders, netShare, parseNetView } from "./music.mjs";

test("network addresses: a computer, a share, a folder in it", () => {
  assert.deepEqual(netShare(String.raw`\\ALICEMOVIES`), { host: "ALICEMOVIES", share: "" });
  assert.deepEqual(netShare(String.raw`\\ALICEMOVIES\1 Alice\Films`), { host: "ALICEMOVIES", share: "1 Alice" });
  assert.deepEqual(netShare("//nas/media"), { host: "nas", share: "media" });
  assert.equal(netShare(String.raw`C:\Music`), null);
});

test("a computer's shared folders read from net view", () => {
  const out = [
    String.raw`Shared resources at \\NAS`,
    "",
    "Share name  Type  Used as  Comment",
    "-------------------------------------------------------------------------------",
    "files       Disk           Everyone's files",
    "media       Disk  M:",
    "printer     Print          The printer",
    "The command completed successfully.",
  ].join("\r\n");
  assert.deepEqual(parseNetView(out), ["files", "media"]);
});

test("another device can't make the computer reach a new network address", async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "places-")), "network-places.json");
  await assert.rejects(listFolders(String.raw`\\somewhere-new\share`, file, { newPlaces: false }), /desktop's own computer/);
  await assert.rejects(listFolders(String.raw`\\somewhere-new`, file, { newPlaces: false }), /desktop's own computer/);
});
