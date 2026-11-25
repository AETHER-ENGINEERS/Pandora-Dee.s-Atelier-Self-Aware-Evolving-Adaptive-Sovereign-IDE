// Reading a song a character wrote: "TITLE: …", "STYLE: …", then "LYRICS:" and the words.

export function parseSong(raw: string, instrumental = false): { title: string; style: string; lyrics: string } | null {
  const text = raw.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/\*\*(TITLE|STYLE|LYRICS)\s*(:?)\s*\*\*/gi, "$1$2").trim();
  const title = /^\s*#*\s*TITLE\s*:\s*(.+)$/im.exec(text)?.[1]?.trim().replace(/^["*“]+|["*”]+$/g, "") ?? "";
  const style = /^\s*#*\s*STYLE\s*:\s*(.+)$/im.exec(text)?.[1]?.trim().replace(/^["*]+|["*]+$/g, "") ?? "";
  const lyrics = /^\s*#*\s*LYRICS\s*:\s*\n?([\s\S]+)$/im.exec(text)?.[1]?.trim().replace(/^```\w*\n?|\n?```$/g, "").trim() ?? "";
  if (!style) return null;
  return { title: title || "Untitled", style, lyrics: instrumental ? "" : lyrics };
}

/** A length that fits these lyrics, in seconds: about four and a half seconds a sung line and eight for each section
 *  (intros, breaks, the build into a chorus), never under `least` (four minutes unless said) nor over `most`.
 *  An engine cuts a song off at the length it's given, so a guess on the long side is the safer one. */
export function fitLength(lyrics: string, least = 240, most = 360): number {
  const lines = lyrics.split("\n").map((l) => l.trim()).filter(Boolean);
  const tags = lines.filter((l) => /^\[[^\]]*\]$/.test(l)).length;
  const sung = lines.length - tags;
  const guess = Math.round((sung * 4.5 + tags * 8 + 10) / 10) * 10;
  return Math.max(least, Math.min(most, guess));
}
