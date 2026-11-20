// Vexel, for a character's seat: words for what she'd see, and actions she can take, through the game's own test
// hooks (window.G) and its own modules. Loaded only in characters' seats (server/inject.mjs); Vexel itself is
// unchanged. A seat runs out of sight, where the browser slows its frames, so actions run the game's frames
// themselves (G.tick) while a key is held, the way a person's held key would.

const G = () => window.G;
let names = null; // block and item names, from Vexel's own modules
async function lookup() {
  if (names) return names;
  const base = location.href.replace(/[^/]*$/, "");
  const [b, i] = await Promise.all([import(base + "js/blocks.js"), import(base + "js/items.js").catch(() => ({}))]);
  names = { block: (id) => (b.BLOCKS[id] ? b.BLOCKS[id].label : `block ${id}`), item: (id) => (i.ITEMS && i.ITEMS[id] ? i.ITEMS[id].label : b.BLOCKS[id] ? b.BLOCKS[id].label : `item ${id}`) };
  return names;
}
const ready = () => {
  const g = G();
  if (!g) throw new Error("Vexel is still loading.");
  return g;
};

// the way she faces: her yaw as a unit step on the ground, and its compass name
const ahead = (yaw) => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });
const compass = (dx, dz) => {
  const a = (Math.atan2(dx, -dz) * 180) / Math.PI; // 0 = north (-z), 90 = east (+x)
  return ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"][Math.round(((a + 360) % 360) / 45) % 8];
};
/** Where something is from her: "4 blocks ahead and a little left", with the compass. */
function whereFrom(p, x, z) {
  const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
  if (d < 1) return "right beside you";
  const f = ahead(p.yaw), fwd = dx * f.x + dz * f.z, side = dx * -f.z + dz * f.x; // (side > 0: to her right)
  const rel = Math.abs(fwd) >= Math.abs(side) * 1.7 ? (fwd > 0 ? "ahead" : "behind you") : Math.abs(side) >= Math.abs(fwd) * 1.7 ? (side > 0 ? "to your right" : "to your left") : `${fwd > 0 ? "ahead" : "behind"} and to your ${side > 0 ? "right" : "left"}`;
  return `${Math.round(d)} blocks ${rel} (${compass(dx, dz)})`;
}
const timeWord = (f) => (f < 0.22 || f > 0.8 ? "night" : f < 0.3 ? "dawn" : f < 0.45 ? "morning" : f < 0.55 ? "midday" : f < 0.72 ? "afternoon" : "dusk");

/** Hold keys for a while, running the game's own frames, then let go. */
function hold(codes, ms) {
  const g = ready();
  const keys = g.input.keys;
  codes.forEach((c) => keys.add(c));
  try {
    g.tick(Math.max(1, Math.round(ms / 16.7)));
  } finally {
    codes.forEach((c) => keys.delete(c));
    g.tick(2);
  }
}
const at = (p) => `${Math.floor(p.x)}, ${Math.floor(p.y)}, ${Math.floor(p.z)}`;

export default {
  async describe() {
    const g = ready();
    const n = await lookup();
    if (!g.inGame) return "Vexel (a 3D block world). You're at its start menu: use the action \"enter\" to step into the world.";
    const p = g.player, w = g.world;
    const f = ahead(p.yaw);
    const lines = [`Vexel: you stand at ${at(p)}, facing ${compass(f.x, f.z)}${p.pitch > 0.5 ? ", looking up" : p.pitch < -0.5 ? ", looking down" : ""}. It's ${timeWord(g.dayFrac)}${g.weather && g.weather.rain > 0.35 ? (g.weather.snow > 0.5 ? ", snowing" : ", raining") : ""}. Mode: ${g.mode}.`];
    const v = g.vitals || {};
    if (g.mode === "survival" && v.hp !== undefined) lines.push(`Health ${Math.round(v.hp)} of 20, food ${Math.round(v.food ?? 20)} of 20.`);
    const fx = Math.floor(p.x), fy = Math.floor(p.y), fz = Math.floor(p.z);
    lines.push(`Under your feet: ${n.block(w.get(fx, fy - 1, fz))}.`);
    // what's ahead: the first few blocks in front, at your feet and at your head
    const row = [];
    for (let k = 1; k <= 4; k++) {
      const x = Math.floor(p.x + f.x * k), z = Math.floor(p.z + f.z * k);
      const feet = w.get(x, fy, z), head = w.get(x, fy + 1, z), ground = w.get(x, fy - 1, z);
      row.push(`${k}: ${feet > 0 ? n.block(feet) : head > 0 ? `open at your feet, ${n.block(head)} at head height` : ground > 0 ? "open" : "a drop"}`);
    }
    lines.push(`Ahead of you, block by block: ${row.join("; ")}.`);
    if (g.target) lines.push(`You're pointing at: ${n.block(g.target.id)} at ${g.target.x}, ${g.target.y}, ${g.target.z} (dig breaks it).`);
    // who and what is near
    const near = [];
    for (const m of (g.mobs && g.mobs.list ? [...g.mobs.list.values()] : []).slice(0, 200)) {
      if (m.dying || Math.hypot(m.x - p.x, m.z - p.z) > 24) continue;
      near.push(`${(m.def && (m.def.label || m.def.name)) || m.type}: ${whereFrom(p, m.x, m.z)}`);
    }
    for (const [, q] of g.peers || []) if (q && q.x !== undefined) near.push(`${q.name || "a player"}: ${whereFrom(p, q.x, q.z)}`);
    lines.push(near.length ? `Near you: ${near.slice(0, 8).join("; ")}.` : "Nobody and nothing moving near you.");
    // the hotbar
    const slots = (g.inv && g.inv.slots ? g.inv.slots.slice(0, 9) : []).map((s, i) => (s ? `${i + 1} ${n.item(s.id)}${s.n > 1 ? ` x${s.n}` : ""}${g.sel === i ? " (in hand)" : ""}` : null)).filter(Boolean);
    lines.push(slots.length ? `Hotbar: ${slots.join(", ")}.` : "Your hands and hotbar are empty.");
    return lines.join("\n");
  },

  actions: {
    enter: {
      help: "step into the world from the start menu",
      run() {
        const g = ready();
        if (g.inGame) return "You're already in the world.";
        g.enter();
        g.tick(30);
        return g.inGame ? `You're in, at ${at(g.player)}.` : "Vexel is still getting the world ready; try again in a moment.";
      },
    },
    walk: {
      help: 'walk some blocks: "forward 5", "back 2", "left 3", "right 3" (it climbs one-block steps by itself)',
      run(text) {
        const g = ready();
        const m = /(forward|ahead|back|backward|left|right)\D*(\d+)?/i.exec(text) || [];
        const dir = (m[1] || "forward").toLowerCase();
        const blocks = Math.max(1, Math.min(20, Number(m[2]) || 3));
        const key = { forward: "KeyW", ahead: "KeyW", back: "KeyS", backward: "KeyS", left: "KeyA", right: "KeyD" }[dir];
        const from = { ...g.player };
        hold([key], (blocks / 4.3) * 1000);
        const moved = Math.round(Math.hypot(g.player.x - from.x, g.player.z - from.z));
        return `Walked ${dir}: ${moved} block${moved === 1 ? "" : "s"}, now at ${at(g.player)}.${moved < blocks - 1 ? " Something stopped you: maybe a wall or a step too high (try jump)." : ""}`;
      },
    },
    jump: {
      help: 'jump (or "jump forward" to hop up a step ahead)',
      run(text) {
        const g = ready();
        hold(/forward|ahead/i.test(text) ? ["Space", "KeyW"] : ["Space"], 420);
        return `Jumped; now at ${at(g.player)}.`;
      },
    },
    turn: {
      help: 'turn: "left", "right", "around", or a compass point like "north"',
      run(text) {
        const g = ready();
        const p = g.player;
        const t = text.toLowerCase();
        const dirs = { north: 0, east: -Math.PI / 2, south: Math.PI, west: Math.PI / 2 };
        let yaw = p.yaw;
        if (/around|back/.test(t)) yaw += Math.PI;
        else if (/left/.test(t)) yaw += Math.PI / 2;
        else if (/right/.test(t)) yaw -= Math.PI / 2;
        else {
          const k = Object.keys(dirs).find((d) => t.includes(d));
          if (k === undefined) return 'Say left, right, around, or north, east, south or west.';
          yaw = dirs[k];
        }
        g.look(yaw, p.pitch);
        g.tick(2);
        const f = ahead(g.player.yaw);
        return `You face ${compass(f.x, f.z)} now.`;
      },
    },
    look: {
      help: 'look "up", "down", "ahead" (where you point decides what dig and place reach)',
      run(text) {
        const g = ready();
        const t = text.toLowerCase();
        const pitch = /up/.test(t) ? 0.9 : /down|feet|ground/.test(t) ? -1.2 : /slightly down|a bit down/.test(t) ? -0.5 : 0;
        g.look(g.player.yaw, pitch);
        g.tick(2);
        return g.target ? `You're pointing at a block ${pitch < 0 ? "below" : pitch > 0 ? "above" : "ahead"}.` : "You're not pointing at any block (nothing in reach that way).";
      },
    },
    dig: {
      help: "break the block you're pointing at (it takes a moment in survival; what drops, you pick up)",
      async run() {
        const g = ready();
        const t = g.target;
        if (!t) return "You're not pointing at a block. Turn or look (up, down, ahead) first.";
        const n = await lookup();
        const name = n.block(t.id);
        g.button(0, true);
        try {
          for (let i = 0; i < 40 && g.world.get(t.x, t.y, t.z) === t.id; i++) g.tick(15);
        } finally {
          g.button(0, false);
        }
        g.tick(20);
        return g.world.get(t.x, t.y, t.z) === t.id ? `The ${name} didn't break (it may be too hard for your hands, or need a tool).` : `Broke the ${name}.`;
      },
    },
    place: {
      help: "place what's in your hand on the block you're pointing at",
      async run() {
        const g = ready();
        const t = g.target;
        if (!t) return "You're not pointing at a block to place against. Look down or ahead first.";
        const slot = g.inv.slots[g.sel];
        if (!slot) return "Your hand is empty: choose a hotbar slot with something in it (select).";
        const n = await lookup();
        g.button(2, true);
        g.tick(3);
        g.button(2, false);
        g.tick(3);
        return `Placed ${n.item(slot.id)} (if there was room).`;
      },
    },
    select: {
      help: 'hold a hotbar slot: "3", or an item\'s name like "planks"',
      async run(text) {
        const g = ready();
        const n = await lookup();
        let i = Number(text) - 1;
        if (!(i >= 0 && i < 9)) i = g.inv.slots.slice(0, 9).findIndex((s) => s && n.item(s.id).toLowerCase().includes(text.toLowerCase().trim()));
        if (!(i >= 0 && i < 9)) return `No hotbar slot like "${text}".`;
        g.selectSlot(i);
        const s = g.inv.slots[i];
        return s ? `Holding ${n.item(s.id)}.` : `Slot ${i + 1} is empty: your hand is empty now.`;
      },
    },
    say: {
      help: 'say something in Vexel\'s own chat (others in the world see it over your head), or a command starting with "/", like "/time day"',
      run(text) {
        const g = ready();
        const words = String(text).trim().slice(0, 200);
        if (!words) return "Say what?";
        g.openChat(words.startsWith("/") ? "" : "");
        const box = document.getElementById("chatin");
        if (!box) return "Vexel's chat isn't open.";
        box.value = words;
        box.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
        g.tick(2);
        return words.startsWith("/") ? `Ran ${words}.` : `Said: ${words}`;
      },
    },
  },
};
