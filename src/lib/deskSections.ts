// Which parts of SEASIDE's state are the shared desk and which belong to one device, and how the shared part is cut
// into sections (each character's files a section of its own, so two devices editing different characters never meet).
// Pure: no store, no page; used before the store loads (deskBoot.ts) and by the live sync (deskSync.ts).

export const KEY = "pandora-dee-desktop";

/** How this device looks and is used: never shared. */
export const PER_DEVICE = [
  "wins", "zTop", "menuBar", "bar", "clock", "wallpaper", "fontSize", "uiScale", "firstRun", "focus", "hangout", "dock",
  "touch", "memory", "libView", "libSort", "libSection", "appPrefs", "studioPkg", "toddler",
] as const;
const DEVICE = new Set<string>(PER_DEVICE);

/** The shared desk as sections: every shared key its own, and files split per character ("files:<id>"). */
export function toSections(state: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(state)) {
    if (DEVICE.has(k) || typeof v === "function" || v === undefined) continue;
    if (k === "files" && v && typeof v === "object") for (const [id, files] of Object.entries(v as Record<string, unknown>)) out[`files:${id}`] = files;
    else out[k] = v;
  }
  return out;
}

/** Sections laid back into a state (over what's given: this device's own parts, or the current state). */
export function applySections(state: Record<string, unknown>, sections: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...state };
  let files = { ...((state.files as Record<string, unknown>) ?? {}) };
  for (const [k, v] of Object.entries(sections)) {
    if (k.startsWith("files:")) {
      const id = k.slice(6);
      if (v === null) {
        const { [id]: _gone, ...rest } = files;
        void _gone;
        files = rest;
      } else files[id] = v;
    } else if (!DEVICE.has(k)) next[k] = v;
  }
  next.files = files;
  return next;
}

/** How many things an old desk has that the shared desk's sections don't (characters, chats, files, keys): worth asking
 *  about only when this is more than nothing. */
export function extraIn(state: Record<string, unknown>, sections: Record<string, unknown>): number {
  const ids = (v: unknown) => new Set(Array.isArray(v) ? v.map((x) => (x as { id?: string })?.id) : []);
  const theirChars = ids(sections.custom);
  const theirChats = ids(sections.chats);
  let n = 0;
  for (const c of (state.custom as { id?: string }[]) ?? []) if (!theirChars.has(c?.id)) n++;
  for (const c of (state.chats as { id?: string }[]) ?? []) if (!theirChats.has(c?.id)) n++;
  const theirEnv = (sections.env as Record<string, unknown>) ?? {};
  for (const k of Object.keys((state.env as object) ?? {})) if (!(k in theirEnv)) n++;
  for (const [id, files] of Object.entries((state.files as Record<string, Record<string, string>>) ?? {})) {
    const theirs = (sections[`files:${id}`] as Record<string, string>) ?? {};
    for (const [p, t] of Object.entries(files ?? {})) if (theirs[p] !== t) n++;
  }
  return n;
}

/** Whether a desk holds anything a person made (worth asking about before it's set aside). */
export function hasOwnStuff(state: Record<string, unknown>): boolean {
  const n = (v: unknown) => (Array.isArray(v) ? v.length : 0);
  return n(state.custom) > 0 || n(state.chats) > 0 || n(state.messages) > 0 || n(state.accounts) > 0 || Object.keys((state.env as object) ?? {}).length > 0;
}
