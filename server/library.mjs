// Linked folders: a folder somewhere else (a network share like \\ALICEMOVIES\texts, or any folder on this computer)
// that characters can read as part of their files, under library/<name>/…, without it being copied into SEASIDE.
// Read-only: they list, read and search it; it stays where it is. A link is made on the desktop's own computer (it
// decides what this computer reads); the characters can read through it from any device.

import fs from "node:fs";
import path from "node:path";

const TEXT = /\.(txt|md|markdown|json|jsonl|csv|tsv|xml|html?|yml|yaml|toml|ini|log|srt|vtt|rtf|tex|org|adoc|rst)$/i;
const READ_MAX = 2_000_000; // one file read whole
const SEARCH_FILES = 4000; // files looked through by one search
const SEARCH_HITS = 60;

const clean = (s, n) => String(s ?? "").replace(/[\x00-\x1f]/g, "").trim().slice(0, n);
export const linkName = (s) => clean(s, 60).replace(/[\\/:*?"<>|]/g, "-").replace(/^\.+/, "") || "linked";

export function createLibrary({ dataDir }) {
  const file = () => path.join(dataDir(), "library-links.json");
  const read = () => {
    try {
      const j = JSON.parse(fs.readFileSync(file(), "utf8"));
      return Array.isArray(j) ? j.filter((l) => l && typeof l.name === "string" && typeof l.path === "string") : [];
    } catch {
      return [];
    }
  };
  const write = (links) => fs.writeFileSync(file(), JSON.stringify(links, null, 2));

  /** The links one character may read ("all" links, and the ones made for them). */
  const forChar = (who) => read().filter((l) => !l.for?.length || l.for.includes(String(who)));

  /** Link a folder (from the computer itself): for everyone, or for the characters named. Same folder: updated. */
  function link({ path: p, name, for: whom }) {
    const full = path.resolve(String(p || ""));
    if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) throw Object.assign(new Error("Only a folder can be linked."), { status: 400 });
    const links = read().filter((l) => path.resolve(l.path).toLowerCase() !== full.toLowerCase());
    let n = linkName(name || path.basename(full) || full);
    const taken = new Set(links.map((l) => l.name.toLowerCase()));
    for (let i = 2; taken.has(n.toLowerCase()); i++) n = `${linkName(name || path.basename(full))} ${i}`;
    const entry = { name: n, path: full, for: Array.isArray(whom) ? whom.map(String).filter(Boolean) : [], at: Date.now() };
    write([...links, entry]);
    return entry;
  }
  function unlink(p) {
    const full = path.resolve(String(p || "")).toLowerCase();
    write(read().filter((l) => path.resolve(l.path).toLowerCase() !== full && l.name !== p));
    return { ok: true };
  }

  /** "name/a/b" for this character → the link and the full path inside it (or an error a character can read). */
  function resolve(who, rel) {
    const parts = String(rel || "").replace(/\\/g, "/").split("/").filter((x) => x && x !== "." && x !== "..");
    const l = forChar(who).find((x) => x.name.toLowerCase() === String(parts[0] || "").toLowerCase());
    if (!l) throw Object.assign(new Error(`There's no linked folder called "${parts[0] || ""}". Your linked folders: ${forChar(who).map((x) => x.name).join(", ") || "none yet"}.`), { status: 404 });
    const full = path.join(l.path, ...parts.slice(1));
    const base = path.resolve(l.path).toLowerCase();
    if (!(path.resolve(full).toLowerCase() === base || path.resolve(full).toLowerCase().startsWith(base + path.sep))) throw Object.assign(new Error("That's outside the linked folder."), { status: 403 });
    return { l, full, rel: parts.join("/") };
  }

  /** A folder inside a link (or the links themselves, for "" ): names, folders marked with a trailing /. */
  function list(who, rel) {
    if (!String(rel || "").replace(/[\\/]/g, "")) return forChar(who).map((l) => ({ name: `${l.name}/`, dir: true }));
    const { full } = resolve(who, rel);
    return fs
      .readdirSync(full, { withFileTypes: true })
      .filter((e) => !e.name.startsWith("."))
      .map((e) => ({ name: e.isDirectory() ? `${e.name}/` : e.name, dir: e.isDirectory() }))
      .sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  }

  /** A text file inside a link (up to 2 MB). */
  function readFile(who, rel) {
    const { full } = resolve(who, rel);
    const st = fs.statSync(full);
    if (st.isDirectory()) throw Object.assign(new Error("That's a folder: list it to see what's inside."), { status: 400 });
    if (st.size > READ_MAX) throw Object.assign(new Error(`That file is ${Math.round(st.size / 1e6)} MB, more than can be read at once.`), { status: 413 });
    const buf = fs.readFileSync(full);
    if (!TEXT.test(full) && buf.subarray(0, 4000).includes(0)) throw Object.assign(new Error("That isn't a text file."), { status: 415 });
    return buf.toString("utf8");
  }

  /** Lines containing the words, through the text files of one link (or all of them), "path:line: text". */
  function search(who, query, within = "") {
    const q = String(query || "").toLowerCase().trim();
    if (!q) return [];
    const roots = within ? [resolve(who, within)] : forChar(who).map((l) => ({ l, full: l.path, rel: l.name }));
    const hits = [];
    let seen = 0;
    const walk = (dir, rel, depth) => {
      if (depth > 12 || hits.length >= SEARCH_HITS || seen >= SEARCH_FILES) return;
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (hits.length >= SEARCH_HITS || seen >= SEARCH_FILES || e.name.startsWith(".")) continue;
        const full = path.join(dir, e.name), r = `${rel}/${e.name}`;
        if (e.isDirectory()) walk(full, r, depth + 1);
        else if (TEXT.test(e.name)) {
          seen++;
          let text;
          try {
            if (fs.statSync(full).size > READ_MAX) continue;
            text = fs.readFileSync(full, "utf8");
          } catch {
            continue;
          }
          if (!text.toLowerCase().includes(q)) continue;
          text.split(/\r?\n/).forEach((line, i) => {
            if (hits.length < SEARCH_HITS && line.toLowerCase().includes(q)) hits.push(`${r}:${i + 1}: ${line.trim().slice(0, 240)}`);
          });
        }
      }
    };
    for (const { full, rel } of roots) walk(full, rel, 0);
    return hits;
  }

  return { links: read, forChar, link, unlink, list, readFile, search };
}
