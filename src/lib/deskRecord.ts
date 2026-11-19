// The desk's record of what actually ran, beside what a character says she did. It's for any agent: she rereads her
// earlier replies with what really happened next to them, so she can correct her own context without losing it, and
// she's told plainly when a reply describes tool use that didn't happen. Facts only; what she makes of them is hers.

type Use = { note: string; ok: boolean; desk?: boolean; out?: string };

/** The start of what a tool gave back, on one line: enough to carry her evidence forward, not the whole page. */
const gist = (out?: string) => {
  const t = (out ?? "").replace(/\s+/g, " ").trim();
  return t ? ` → "${t.length > 160 ? `${t.slice(0, 160)}…` : t}"` : "";
};

// first-person accounts of using a tool: "I used my browser", "I searched", "I've opened…", "I navigated to…"
const CLAIM =
  /\b(?:I|I've|I have|I just)\s+(?:used|searched|opened|navigated|visited|browsed|looked (?:it |that |this )?up|fetched|clicked|went to|ran|called|loaded|pulled up|checked (?:the|my|your|its) (?:browser|page|site|web|repo|repository|search|results|vault|keys|files))\b/i;

export function claimsTool(text: string): boolean {
  return CLAIM.test(text);
}

/** The line added to one of her earlier replies when she rereads it: what ran, or that nothing did. */
export function recordLine(tools: Use[] | undefined, text: string): string {
  const real = (tools ?? []).filter((t) => !t.desk);
  const notes = (tools ?? []).filter((t) => t.desk).map((t) => t.note);
  const ran = real.length
    ? `${real.slice(0, 8).map((t) => `${t.note} ${t.ok ? "✓" : "✗"}${gist(t.out)}`).join("; ")}${real.length > 8 ? `; and ${real.length - 8} more` : ""}`
    : notes.length || claimsTool(text)
      ? "no tools ran in this reply"
      : "";
  if (!ran) return "";
  return `[desk record: ${ran}${notes.length ? ` · desk notes: ${notes.join("; ")}` : ""}]`;
}

/** Records she writes herself, imitating the desk's: removed from her reply. */
export const stripRecords = (text: string) => text.replace(/\n*\[desk (?:record|note)[^\]\n]*\]\s*/gi, "\n").replace(/\n{3,}/g, "\n\n");

export const CLAIM_NOTE = "[Desk note] No tool ran in this reply, so what you described didn't come from one.";
/** After tools ran, a reply with no words at all: nobody in the room heard anything. */
export const SAY_NOTE = "[Desk note] Your tools ran, but your reply had no words, so nobody heard anything. Say now, in words, what you found and what you'll do next (no more tools this reply).";

/** Whether a reply said nothing after tools had run: no words, no thinking, nothing asked for. */
export const saidNothing = (text: string, thinking: string, toolsRan: number) => toolsRan > 0 && !text.trim() && !thinking.trim();

// A move in an open game told, not made: "same star, now in cyan", "my stone goes to r8 c8", "I'll take e5".
const MOVE = /\b(i(?:'ll|'m| will| am)?\s+(?:place|put|paint|repaint|draw|play|move|take|drop|claim|mark|colour|color|fill)\b|(?:my|a|the)\s+(?:move|stone|piece|pixels?|star|mark|brush\w*)\s+(?:goes|lands?|is|at|on|in|now)\b|(?:placed|painted|repainted|played|moved|dropped|drew|coloured|colored|filled)\s+(?:my|a|the|it|them|at|on|in|over)\b|\bnow in (?:proper )?\w+\b|\b(?:same|new)\s+(?:star|shape|pixels|picture|move)\b)/i;
/** Whether a reply tells of a move in the game (so, with no move sent, nothing changed). */
// A move in chess notation after its number ("18…Ne2+", "17. Qxa7", "5...exd4", "9. O-O"): case matters here.
const NUMBERED = /\b\d{1,3}\s*(?:\.{1,3}|…)\s*(?:[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h](?:x[a-h])?[1-8](?:=?[QRBN])?|O-O(?:-O)?)(?![\w-])/;
export const claimsMove = (text: string) => MOVE.test(text) || NUMBERED.test(text);
export const MOVE_NOTE = "[Desk note] No move was sent in this reply, so the game hasn't changed: describing a move doesn't make it. If you meant to make one, send it now with app_send_update (the guide shows the shape), then say a line about it.";
