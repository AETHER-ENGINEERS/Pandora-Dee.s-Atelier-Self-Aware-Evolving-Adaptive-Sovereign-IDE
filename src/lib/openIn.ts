// "Open in…" from Explorer: a file handed to the app made for its kind. Audio goes to Music (the library's own copy
// when the file is in a music folder, so its cover, tags and .wma conversion come with it), video to the Theater,
// and any file can open in a new tab of this device's browser, which shows PDFs, pictures and text itself.

import { desk } from "./store.ts";
import { rawUrl, baseName } from "./explorer.ts";
import { enqueue, loadLibrary, playList, useMusic, type Item, type Track } from "./music.ts";
import { askTheater } from "./theater.ts";

const norm = (p: string) => p.replace(/\\/g, "/").toLowerCase();
const pathOf = (t: Track) => (t.rel ? `${t.folder}/${t.rel}` : "");

/** The song for this file: the library's when it's in a music folder, or the file played as it is. */
export async function songFor(path: string): Promise<Item> {
  if (!useMusic.getState().loaded) await loadLibrary().catch(() => {});
  const want = norm(path);
  const t = useMusic.getState().tracks.find((x) => !x.src && norm(pathOf(x)) === want);
  if (t) return { kind: "track", ...t };
  const name = baseName(path);
  return { kind: "track", id: `file:${path}`, title: name.replace(/\.[^.]+$/, ""), artist: "", album: "", year: 0, track: 0, genre: "", duration: 0, cover: false, bitrate: 0, size: 0, folder: "", file: name, src: rawUrl(path) };
}

export async function openInMusic(path: string, how: "play" | "next" | "queue" = "play") {
  const it = await songFor(path);
  if (how === "play") playList([it], 0, true);
  else if (how === "queue") enqueue([it]);
  else {
    const s = useMusic.getState();
    if (s.index < 0) playList([it], 0, true);
    else useMusic.setState({ queue: [...s.queue.slice(0, s.index + 1), it, ...s.queue.slice(s.index + 1)] });
  }
  desk().openApp("music");
}

export function openInTheater(path: string) {
  askTheater(path);
  desk().openApp("theater");
}

export function openInTab(path: string) {
  window.open(rawUrl(path), "_blank", "noopener");
}
