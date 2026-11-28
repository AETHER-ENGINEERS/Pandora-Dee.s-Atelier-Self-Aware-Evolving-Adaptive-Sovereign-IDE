import { create } from "zustand";
import { X } from "lucide-react";
import { desk } from "../lib/store.ts";
import { playList, playNow, queueAs, useMusic, type Item } from "../lib/music.ts";
import { WHERE_LABEL } from "../lib/queueOps.ts";

/**
 * Someone picks a song (or an album) while music is already playing: a small card asks where it goes, without
 * stopping what's playing. With "Ask where a song goes" off (the button beside Gapless), or with nothing playing,
 * the pick just plays, as before.
 */
type Pick = { items: Item[]; at: number; inOrder: boolean };
const useAsk = create<{ pick: Pick | null }>(() => ({ pick: null }));

/** Play what was picked: straight away when nothing is playing (or the question is off), otherwise ask. */
export function playPicked(items: Item[], at = 0, inOrder = false) {
  if (!items.length) return;
  const m = useMusic.getState();
  const busy = m.playing && m.index >= 0 && m.queue.length > 0;
  const same = busy && items.length === 1 && m.queue[m.index] && JSON.stringify(m.queue[m.index]) === JSON.stringify(items[0]);
  if (!busy || same || desk().music.askWhere === false) return playList(items, at, inOrder);
  useAsk.setState({ pick: { items, at, inOrder } });
}

const name = (it: Item | undefined) => (it ? (it.kind === "track" ? it.title : it.name) : "");

export function PlayWhereHost() {
  const pick = useAsk((s) => s.pick);
  if (!pick) return null;
  const close = () => useAsk.setState({ pick: null });
  const n = pick.items.length;
  const what = n === 1 ? `“${name(pick.items[0])}”` : `${n} songs (from “${name(pick.items[pick.at] ?? pick.items[0])}”)`;
  const go = (f: () => void) => () => (close(), f());
  // from a list of songs, the picked one and the ones after it
  const fromHere = pick.items.slice(pick.at);
  return (
    <div className="play-where" role="dialog" aria-label="Where should it go?">
      <div className="row" style={{ gap: 8 }}>
        <b className="grow">Music is playing. Where should {what} go?</b>
        <button className="icon-btn" aria-label="Never mind" onClick={close}>
          <X size={14} />
        </button>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 6 }}>
        <button className="btn small primary" onClick={go(() => playNow(fromHere))}>
          Play it now
        </button>
        <button className="btn small" onClick={go(() => void queueAs(fromHere, "next"))}>
          {WHERE_LABEL.next}
        </button>
        <button className="btn small" onClick={go(() => void queueAs(fromHere, "after-album"))}>
          {WHERE_LABEL["after-album"]}
        </button>
        <button className="btn small" onClick={go(() => void queueAs(fromHere, "last"))}>
          {WHERE_LABEL.last}
        </button>
        <button className="btn small" title="Start these and set the old queue aside (Restore previous queue brings it back)" onClick={go(() => playList(pick.items, pick.at, pick.inOrder))}>
          Replace the queue
        </button>
      </div>
      <label className="row small faint" style={{ gap: 6, marginTop: 6 }}>
        <input type="checkbox" onChange={(e) => desk().set({ music: { ...desk().music, askWhere: !e.target.checked } })} /> Don't ask again (it's the button beside Gapless)
      </label>
    </div>
  );
}
