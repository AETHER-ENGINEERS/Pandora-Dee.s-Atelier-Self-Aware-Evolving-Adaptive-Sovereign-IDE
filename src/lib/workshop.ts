// The Workshop: a branch in the Room that keeps a log of what the residents make with the song and picture engines
// (that it started, that the engine is working, what inspired it, that it's done). Notes are appended to the
// branch's file without switching away from the chat that's open.

import { desk, uid, type ChatMeta } from "./store.ts";
import type { Message } from "./room.ts";

export const WORKSHOP_ID = "workshop";
const TITLE = "Workshop";
const fileOf = `.pandora/chats/${WORKSHOP_ID}.json`;

export { withArtist, workshopLine } from "./workshopText.ts";

let chain: Promise<void> = Promise.resolve();

/** Add a note to the Workshop. Notes are added one at a time so two makers finishing together don't overwrite each other. */
export function workshopNote(text: string): Promise<void> {
  const msg: Message = { id: uid(), kind: "notice", who: "desk", name: "Workshop", text, at: Date.now(), source: "desk" };
  chain = chain.then(() => add(msg)).catch(() => undefined);
  return chain;
}

async function add(msg: Message) {
  const s = desk();
  if (s.chatId === WORKSHOP_ID) {
    s.post({ kind: msg.kind, who: msg.who, name: msg.name, text: msg.text, source: "desk", at: msg.at });
    return;
  }
  let messages: Message[] = [];
  const res = await fetch(`/api/vault/file?path=${encodeURIComponent(fileOf)}`);
  if (res.ok) {
    try {
      const j = (await res.json()) as { messages?: Message[] };
      if (Array.isArray(j.messages)) messages = j.messages;
    } catch {
      /* start the log again */
    }
  }
  messages = [...messages, msg].slice(-500);
  const old = desk().chats.find((c) => c.id === WORKSHOP_ID);
  const meta: ChatMeta = { id: WORKSHOP_ID, title: TITLE, created: old?.created ?? Date.now(), updated: msg.at, count: messages.length };
  await fetch(`/api/vault/file?path=${encodeURIComponent(fileOf)}`, { method: "PUT", body: JSON.stringify({ meta, messages }) });
  desk().set({ chats: [...desk().chats.filter((c) => c.id !== WORKSHOP_ID), meta] });
}
