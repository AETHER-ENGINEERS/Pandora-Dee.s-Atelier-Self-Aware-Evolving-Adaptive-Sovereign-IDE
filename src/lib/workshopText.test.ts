import { test } from "node:test";
import assert from "node:assert/strict";
import { withArtist, workshopLine } from "./workshopText.ts";

test("a title gets the maker as its artist", () => {
  assert.equal(withArtist("Pandora Dee", "Salt Light"), "Pandora Dee - Salt Light");
  assert.equal(withArtist("Pandora Dee", ""), "Pandora Dee - Untitled");
});

test("a title that already names the artist is left alone", () => {
  assert.equal(withArtist("Noe", "noe - Tide"), "noe - Tide");
});

test("no artist leaves the title", () => {
  assert.equal(withArtist("", "Tide"), "Tide");
});

test("the log line carries the inspiration as a quote", () => {
  assert.equal(workshopLine("Dee", "started “X”.", "the harbour\nat dawn"), "Dee started “X”.\n> the harbour at dawn");
  assert.equal(workshopLine("Dee", "started “X”."), "Dee started “X”.");
});
