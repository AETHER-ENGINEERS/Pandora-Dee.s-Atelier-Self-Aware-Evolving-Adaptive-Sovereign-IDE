import { test } from "node:test";
import assert from "node:assert/strict";
import { isLocalAddress } from "./termLinks.ts";

test("local addresses stay out of the full browser", () => {
  for (const u of ["http://localhost:15695/", "https://LOCALHOST", "http://127.0.0.1:8788/x", "http://127.1.2.3", "http://[::1]:3000/", "http://app.localhost/", "http://0.0.0.0:80"]) assert.equal(isLocalAddress(u), true, u);
});

test("other addresses go to the full browser", () => {
  for (const u of ["https://example.com/", "http://192.168.3.1:11434", "https://localhost.example.com", "https://github.com/127.0.0.1", "not a url"]) assert.equal(isLocalAddress(u), false, u);
});
