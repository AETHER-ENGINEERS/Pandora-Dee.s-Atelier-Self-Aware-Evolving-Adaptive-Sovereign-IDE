import type { Row } from "./xdc.ts";

/** Updates for a character, a page at a time: the latest ones (since 0), or the next ones after a serial, with a
 *  line saying what was left out and how to read it. */
export function pageRows(rows: Row[], since: number, limit = 30) {
  if (!rows.length) return { shown: rows, note: "" };
  const shown = since > 0 ? rows.slice(0, limit) : rows.slice(-limit);
  if (shown.length === rows.length) return { shown, note: "" };
  const first = shown[0].serial, last = shown[shown.length - 1].serial;
  const before = since > 0 ? "" : ` Earlier ones: call again with since: ${Math.max(0, first - limit - 1)}.`;
  const after = since > 0 && last < rows[rows.length - 1].serial ? ` Later ones: call again with since: ${last}.` : "";
  return { shown, note: `Showing #${first} to #${last} of ${rows.length} updates.${before}${after}` };
}

/** Board games that send moves (a `uci` or `move` field with a `ply`): every game's moves in order, in one line
 *  each, so a player knows the whole game even when the updates are too many to show. */
export function moveDigest(rows: Row[]) {
  const games = new Map<string, Map<number, string>>();
  for (const r of rows) {
    const p = r.update.payload as Record<string, unknown> | null;
    if (!p || typeof p !== "object") continue;
    const mv = typeof p.uci === "string" ? p.uci : typeof p.move === "string" ? p.move : "";
    if (!mv || typeof p.ply !== "number") continue;
    const id = String(p.gameId ?? p.game ?? "game");
    if (!games.has(id)) games.set(id, new Map());
    const plies = games.get(id)!;
    if (!plies.has(p.ply)) plies.set(p.ply, mv); // the first move sent for a ply is the one that counts
  }
  return [...games].map(([id, plies]) => {
    const list = [...plies].sort((a, b) => a[0] - b[0]);
    const next = list.length ? list[list.length - 1][0] + 1 : 0;
    return `${id}: ${list.map(([n, m]) => `${n}:${m}`).join(" ")} (next is ply ${next}, ${next % 2 ? "black" : "white"} to move if it's chess)`;
  }).join("\n");
}
