// Small shared registry for things that live in components but agents need to reach.

type Reader = () => Promise<string>;
let readScreen: Reader | null = null;
// A character playing an app has her own seat: a hidden copy of it running as her, with her own screen.
const seats = new Map<string, Reader>();

export const gameScreen = {
  register(fn: Reader | null) {
    readScreen = fn;
  },
  registerSeat(id: string, fn: Reader | null) {
    if (fn) seats.set(id, fn);
    else seats.delete(id);
  },
  hasSeat: (id: string) => seats.has(id),
  /** What the game shows: the character's own seat when she has one, else the person's screen. */
  async read(id?: string): Promise<string> {
    try {
      const seat = id ? seats.get(id) : undefined;
      if (seat) return await seat();
      return readScreen ? await readScreen() : "";
    } catch {
      return "";
    }
  },
};
