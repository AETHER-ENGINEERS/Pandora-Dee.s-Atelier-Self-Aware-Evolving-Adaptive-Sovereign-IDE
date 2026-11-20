// A turn in a game lasts as long as a character's room for it, not a handful of actions: she plays on, action after
// action, while her context has space, the way a person plays until they need to stop. When it's nearly full the desk
// tells her, and she does what a person does before stepping away from a game: gets somewhere safe, then says where
// she is and what she'll do next, so the next turn (hers, with a fresh context) picks it up.

/** Most actions in one game turn, whatever the room (so a turn always ends). */
export const PLAY_STEPS = 150;
/** The share of her context at which she's told to wrap up. */
export const WRAP_AT = 0.8;
/** Actions she has, after being told, to get safe before she says her piece. */
export const WRAP_STEPS = 4;
/** When the model's window isn't known: a size most current models hold. */
export const DEFAULT_WINDOW = 32768;

/** Whether this step's prompt has used enough of her window that it's time to wrap up. */
export const timeToWrap = (prompt: number | undefined, window: number) => typeof prompt === "number" && prompt >= window * WRAP_AT;

const k = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n.toLocaleString("en"));

/** At the start of a game turn: how long she has, and how it ends. */
export const playNote = (window: number) =>
  `[Desk note] You're playing. Your turn lasts as long as you keep taking actions, up to about ${k(window * WRAP_AT)} tokens of this turn's room (of ${k(window)}): you don't need to stop after a few. A reply with no action ends your turn, so if you want to talk as you go, use the game's own chat if it has one, and keep playing. The desk will tell you when your room is nearly full.`;

/** When her room is nearly full: get safe, then say where she is and what's next. */
export const wrapNote = (prompt: number, window: number) =>
  `[Desk note] Your room for this turn is nearly full (${k(prompt)} of ${k(window)} tokens). Before you stop, make yourself safe, in up to ${WRAP_STEPS} actions: out of reach of anything hostile, not over a drop or in deep water, under cover if it's night. Then, in words, say where you are (x, y, z, from your screen), what you did this turn, and what you'll do next turn.`;
