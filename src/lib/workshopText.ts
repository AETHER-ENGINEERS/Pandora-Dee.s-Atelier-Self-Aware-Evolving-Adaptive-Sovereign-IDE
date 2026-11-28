// The words of the Workshop log (kept apart from workshop.ts so they can be tested without the store).

/** "Artist - Title", unless the title already says who made it. */
export function withArtist(artist: string, title: string): string {
  const t = title.trim() || "Untitled";
  const a = artist.trim();
  if (!a) return t;
  const lead = t.toLowerCase();
  return lead.startsWith(`${a.toLowerCase()} -`) || lead.startsWith(`${a.toLowerCase()} –`) ? t : `${a} - ${t}`;
}

/** The line for the log: what happened, and in the maker's words what inspired it. */
export function workshopLine(who: string, what: string, inspiration = ""): string {
  const why = inspiration.trim().replace(/\s+/g, " ");
  return why ? `${who} ${what}\n> ${why}` : `${who} ${what}`;
}
