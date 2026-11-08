// The shared desk, live (server/deskState.mjs): what changes here goes to the server within a second or so, a section
// at a time, and what other devices change comes in every few seconds. If two devices changed the same section at
// once, the later one stands and this desk says so. A device keeping its own desk (legacy mode) doesn't take part.

import { desk, useDesk } from "./store.ts";
import { applySections, toSections } from "./deskSections.ts";
import { ASK, FOUND, LEGACY, MODE, REV } from "./deskBoot.ts";
import { deviceName } from "./devshare.ts";
import { deviceId } from "./pads.ts";

const me = () => `${deviceName()} · ${deviceId().slice(0, 4)}`;
let rev = Number(localStorage.getItem(REV) || 0);
const base: Record<string, number> = {};
const sent = new Map<string, string>(); // section → what this desk last agreed with the server on
let timer = 0;
let saving = false;

const sectionsNow = () => toSections(desk() as unknown as Record<string, unknown>);

async function save(founding = false) {
  if (saving) return;
  saving = true;
  try {
    const now = sectionsNow();
    const changes: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(now)) {
      const json = JSON.stringify(v);
      if (sent.get(k) !== json) changes[k] = v;
    }
    for (const k of sent.keys()) if (!(k in now)) changes[k] = null; // a character removed: their files go too
    if (!Object.keys(changes).length) return;
    const r = await fetch("/api/desk/save", { method: "POST", body: JSON.stringify({ device: me(), base, changes }) });
    if (!r.ok) return; // the server will hear the next change; nothing is lost here
    const j = (await r.json()) as { rev: number; clashes?: { section: string; with: string }[] };
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) sent.delete(k);
      else sent.set(k, JSON.stringify(v));
    }
    // (the pull mark stays where it is: another device may have saved between this desk's last pull and this save, and
    // the next pull has to see that; this desk's own sections come back in it and are skipped as its own)
    void j.rev;
    if (founding) localStorage.removeItem(FOUND);
    if (j.clashes?.length) desk().notice(`Another device changed ${j.clashes.map((c) => c.section.replace(/^files:/, "the files of ")).join(", ")} at the same time (${j.clashes[0].with}). This device's change stands.`);
  } catch {
    /* the server isn't answering: tried again on the next change */
  } finally {
    saving = false;
  }
}

/** What the other devices changed since this desk last looked. */
async function pull() {
  try {
    const r = await fetch(`/api/desk?since=${rev}`);
    if (!r.ok) return;
    const j = (await r.json()) as { rev: number; sections: Record<string, { rev: number; value: unknown; by: string }> };
    const theirs: Record<string, unknown> = {};
    for (const [k, s] of Object.entries(j.sections)) {
      base[k] = s.rev;
      if (s.by === me()) continue;
      const json = JSON.stringify(s.value);
      if (sent.get(k) === json) continue;
      sent.set(k, json);
      theirs[k] = s.value;
    }
    rev = Math.max(rev, j.rev);
    localStorage.setItem(REV, String(rev));
    if (Object.keys(theirs).length) {
      const s = desk() as unknown as Record<string, unknown>;
      const next = applySections({ files: s.files }, theirs);
      desk().set(next as never);
    }
  } catch {
    /* tried again shortly */
  }
}

let started = false;
/** Joins the shared desk once SEASIDE is open (after deskBoot.ts took it up). */
export function startDeskSync() {
  if (started || localStorage.getItem(MODE) === "legacy") return;
  started = true;
  const founding = localStorage.getItem(FOUND) === "1";
  // what this desk holds now is what the server holds (deskBoot laid it in), unless this device is starting the desk
  if (!founding) for (const [k, v] of Object.entries(sectionsNow())) sent.set(k, JSON.stringify(v));
  void (founding ? save(true) : pull());
  useDesk.subscribe(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void save(), 1200);
  });
  window.setInterval(() => void pull(), 3000);
  window.addEventListener("pagehide", () => void save());
}

// ── a device that had its own desk before ────────────────────────────────────────────────────────────────────────
type Old = { state?: Record<string, unknown> };
export const oldDesk = (): Old | null => {
  try {
    return JSON.parse(localStorage.getItem(LEGACY) || "null") as Old | null;
  } catch {
    return null;
  }
};
export const shouldAsk = () => localStorage.getItem(ASK) === "1" && Boolean(oldDesk());
export const doneAsking = () => localStorage.removeItem(ASK);

/** What the old desk has that the shared one doesn't (or has differently). */
export function whatItHas() {
  const old = oldDesk()?.state ?? {};
  const s = desk();
  const chars = ((old.custom as { id: string; name: string }[]) ?? []).filter((c) => !s.custom.some((x) => x.id === c.id));
  const oldFiles = (old.files as Record<string, Record<string, string>>) ?? {};
  const files = Object.entries(oldFiles).flatMap(([id, fs]) => Object.entries(fs).filter(([p, t]) => s.filesOf(id)[p] !== t).map(([p]) => `${id}/${p}`));
  const chats = ((old.chats as { id: string; title: string }[]) ?? []).filter((c) => !s.chats.some((x) => x.id === c.id));
  const conns = (((old.model as { connections?: { id: string; label: string }[] })?.connections) ?? []).filter((c) => !s.model.connections.some((x) => x.id === c.id));
  const keys = Object.keys((old.env as Record<string, string>) ?? {}).filter((k) => !(k in s.env));
  return { chars, files, chats, conns, keys };
}

/** Bring the chosen parts of the old desk into the shared one. A file both have differently comes in beside it. */
export function bringIn(pick: { chars: boolean; files: boolean; chats: boolean; conns: boolean; keys: boolean }) {
  const old = oldDesk()?.state ?? {};
  const s = desk();
  const has = whatItHas();
  const from = (navigator.userAgent.match(/Android|iPhone|iPad|Mac|Windows/)?.[0] ?? "device").replace("Windows", "PC");
  const patch: Record<string, unknown> = {};
  if (pick.chars && has.chars.length) patch.custom = [...s.custom, ...(has.chars as typeof s.custom)];
  if (pick.files) {
    const files = { ...s.files };
    for (const [id, fs] of Object.entries((old.files as Record<string, Record<string, string>>) ?? {})) {
      const mine = { ...(files[id] ?? {}) };
      for (const [p, t] of Object.entries(fs)) {
        if (mine[p] === undefined) mine[p] = t;
        else if (mine[p] !== t) mine[p.replace(/(\.[^./]+)?$/, ` (from the ${from})$1`)] = t;
      }
      files[id] = mine;
    }
    patch.files = files;
  }
  if (pick.chats && has.chats.length) patch.chats = [...s.chats, ...(has.chats as typeof s.chats)];
  if (pick.conns && has.conns.length) patch.model = { ...s.model, connections: [...s.model.connections, ...(has.conns as typeof s.model.connections)] };
  if (pick.keys && has.keys.length) patch.env = { ...s.env, ...Object.fromEntries(has.keys.map((k) => [k, String((old.env as Record<string, string>)[k] ?? "")])) };
  desk().set(patch as never);
  return Object.keys(patch).length;
}

/** This device keeps its own desk (legacy mode): its old desk comes back, and it stops taking part in the shared one. */
export function keepOwnDesk() {
  const blob = localStorage.getItem(LEGACY);
  if (blob) localStorage.setItem("pandora-dee-desktop", blob);
  localStorage.setItem(MODE, "legacy");
  localStorage.removeItem(ASK);
  location.reload();
}

/** Back to the shared desk after legacy mode (the old desk stays set aside, to bring things in from). */
export function joinSharedDesk() {
  const blob = localStorage.getItem("pandora-dee-desktop");
  if (blob && !localStorage.getItem(LEGACY)) localStorage.setItem(LEGACY, blob);
  localStorage.removeItem(MODE);
  localStorage.removeItem("pdd-desk-joined");
  location.reload();
}
