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

// Vexel's own body for an AI player (its js/body/: written by Vexel's author for exactly this). Its eyes: the scene
// in words and a map of the land about. Its options: what's possible right now, as sentences, the way a game shows a
// person what they can craft or who's near. The character chooses; the body's hands only do what she chose. It stays
// off between choices, so her own walk/turn/dig keys are hers, and it never chooses anything itself.
let menu = [];
async function theBody() {
  if (window.BODY) return window.BODY;
  const base = location.href.replace(/[^/]*$/, "");
  await import(base + "js/body/body.js");
  if (window.BODY) window.BODY.off();
  return window.BODY || null;
}
// the body speaks of its player as "Claude"; here the player is whoever sits in this seat
const yours = (s) =>
  String(s || "")
    .replace(/\bClaude has\b/g, "you have").replace(/\bClaude is\b/g, "you are").replace(/\bClaude carries\b/g, "you carry")
    .replace(/\bClaude's\b/g, "your").replace(/\bClaude\b/g, "you");
/** Ask the body what's possible now (it's switched on only for the asking). */
function optionsNow(b) {
  b.on();
  try {
    return b.tick();
  } finally {
    b.off();
  }
}

// Whether the step she's on is done: what Vexel's body had a small judging model do, done with SEASIDE's own quick
// decisions (her own models, src/lib/decide.ts), against the body's facts only (what she has and sees). At most every
// few seconds, and only for a step that says what's true when it's done; "goal done" is always hers to say too.
let judged = { key: "", at: 0 };
// her words as the body's facts put them ("I carry 12 logs" → "Claude carries 12 logs")
const asClaude = (s) =>
  String(s || "")
    .replace(/\b(?:I am|I'm)\b/gi, "Claude is").replace(/\bI have\b/gi, "Claude has").replace(/\bI carry\b/gi, "Claude carries")
    .replace(/\b(?:my|mine)\b/gi, "Claude's").replace(/\bme\b/gi, "Claude").replace(/\bI\b/g, "Claude");
async function judgeStep(b, t) {
  if (!t.check || !t.step || typeof window.__pddDecide !== "function") return "";
  const key = `${t.stepNo}|${t.state}`;
  if (key === judged.key || performance.now() - judged.at < 4000) return "";
  judged = { key, at: performance.now() };
  try {
    // the body's facts call the player "Claude"; her step is in her words, so it's put the same way, and what's under
    // her feet is added (the body's facts don't always say)
    const g = ready(), n = await lookup(), p = g.player;
    const under = n.block(g.world.get(Math.floor(p.x), Math.floor(p.y) - 1, Math.floor(p.z)));
    const facts = `${t.state}\nClaude is standing on ${under} at (${at(p)}).`;
    const [a] = await window.__pddDecide(facts, [{ kind: "yesno", ask: `Is this true of Claude now: ${asClaude(t.check)}?` }]);
    const yes = a && a.probs ? a.probs[0] : 0;
    judged.said = `${a.scored ? `${Math.round(yes * 100)}% sure it's done` : a.pick === 0 ? "done" : "not yet"} (${a.model})`;
    if (!(a.scored ? yes >= 0.8 : a.pick === 0)) return "";
    const next = b.stepDone();
    const sure = a.scored ? ` (${Math.round(yes * 100)}% sure)` : "";
    return next ? `Step done${sure}: ${yours(t.step)}. Next: ${yours(next)}.` : `Step done${sure}: ${yours(t.step)}. That was the last: your goal is done.`;
  } catch (e) {
    judged.said = `couldn't judge: ${e && e.message ? e.message : e}`;
    return "";
  }
}

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
    try {
      const b = await theBody();
      if (b) {
        let t = optionsNow(b);
        const done = await judgeStep(b, t);
        if (done) t = optionsNow(b); // (a new step: what fits it now)
        lines.push("", "Around you (Vexel's own eyes):", yours(b.look()), "", b.map(10));
        if (done) lines.push("", done);
        menu = (t.options || []).slice(0, 24);
        if (t.goal) lines.push("", `Your goal in Vexel: ${yours(t.goal)}${t.step ? `; the step you're on: ${yours(t.step)}` : ""}.`);
        if (t.last) lines.push(`Last thing you chose: ${yours(t.last.text)}: ${t.last.ok ? "done" : "it didn't work"} (${yours(t.last.what)}).`);
        if (menu.length) lines.push("", 'What you could do now (do "use", target "choose", text the number):', ...menu.map((o, i) => `${i + 1}. ${yours(o.text)}`));
      }
    } catch (e) {
      lines.push(`(Vexel's own eyes didn't open: ${e.message})`);
    }
    return lines.join("\n");
  },

  actions: {
    choose: {
      help: 'do one of the things listed under "What you could do now", by its number ("3"): your hands do it, and you hear how it went',
      async run(text) {
        const g = ready();
        const b = await theBody();
        if (!b) return "Vexel's own body isn't here, so there's nothing to choose from: use walk, turn, look and dig.";
        const t = optionsNow(b);
        menu = (t.options || []).slice(0, 24);
        const want = String(text || "").trim();
        const k = Number.parseInt(want, 10);
        const o = Number.isFinite(k) ? menu[k - 1] : menu.find((m) => yours(m.text).toLowerCase().includes(want.toLowerCase()));
        if (!o) return `There's no option ${want || "(none given)"} now. Read your screen again for what you could do.`;
        b.on();
        let r;
        try {
          b.tick(); // (the body's own list, the same as the one you were shown)
          r = b.act(o.id);
          const end = performance.now() + 40000;
          while (b.body.act && performance.now() < end) {
            g.tick(20);
            await new Promise((res) => setTimeout(res, 0));
          }
          if (b.body.act) b.stop();
        } finally {
          b.off();
        }
        if (r === "no such option now") return "That option was gone by the time you chose it. Read your screen again.";
        const last = b.body.last;
        const what = last && last.id === o.id ? `${last.ok ? "Done" : "It didn't work"}: ${yours(last.what)}` : "You stopped partway (it took too long).";
        const done = await judgeStep(b, optionsNow(b));
        return `You chose: ${yours(o.text)}. ${what}. You're at ${at(g.player)}.${done ? `\n${done}` : ""}`;
      },
    },
    goal: {
      help: 'set what you\'re working toward, and its steps, so "What you could do now" offers what fits it: "build a seaside cabin | find the sea => there is water on my map | get 12 logs => I carry 12 logs" (each step: what to do => what\'s true when it\'s done). You judge your own steps: "goal done" when you\'ve finished the one you\'re on, "goal" alone to see where you are',
      async run(text) {
        const b = await theBody();
        if (!b) return "Vexel's own body isn't here, so there's no goal to keep: just play.";
        // you judge your own steps (Vexel's body was made to have a small model judge them; here the judge is you)
        if (/^(?:done|next|step done)\b/i.test(String(text || "").trim())) {
          const m0 = b.status().mind;
          if (!m0.goal) return "You have no goal set, so there's no step to finish.";
          const was = m0.step;
          const next = b.stepDone();
          return next ? `Step done: ${yours(was)}. Next: ${yours(next)}.` : `Step done: ${yours(was)}. That was the last one: your goal is done.`;
        }
        const [goal, ...steps] = String(text || "").split("|").map((s) => s.trim()).filter(Boolean);
        if (!goal) {
          const m = b.status().mind;
          return m.goal ? `Your goal: ${yours(m.goal)}. Steps: ${m.steps.map((s, i) => `${i + 1}. ${yours(s)}${i === m.at ? " (you're here)" : ""}`).join(" ")}${judged.said ? `. Last check of your step: ${judged.said}` : ""}` : "You have no goal set yet.";
        }
        b.goal(asClaude(goal), steps.map(asClaude));
        return `Goal set: ${goal}${steps.length ? `, in ${steps.length} step${steps.length === 1 ? "" : "s"}, starting with: ${steps[0]}` : ""}. Read your screen for what you could do now.`;
      },
    },
    survey: {
      help: 'look out over the land: a wider map, up to 32 blocks each way: "survey", or "survey 32"',
      async run(text) {
        ready();
        const b = await theBody();
        if (!b) return "Vexel's own eyes aren't here.";
        const r = Math.max(8, Math.min(32, Number.parseInt(text, 10) || 24));
        return b.map(r);
      },
    },
    enter: {
      help:"step into the world from the start menu",
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
      help: 'turn, as a player turns with the mouse: "left", "right", "around", "a little left" (45°), "left 30" (degrees), a compass point ("north", "north-east"), or "toward 15 -7" to face a spot (x z) you can see on your map',
      run(text) {
        const g = ready();
        const p = g.player;
        const t = String(text || "").toLowerCase().trim();
        const rad = (d) => (d * Math.PI) / 180;
        // compass: north is -z; yaw 0 faces north and turning left adds to it
        const points = { "north-east": -45, "north-west": 45, "south-east": -135, "south-west": 135, northeast: -45, northwest: 45, southeast: -135, southwest: 135, north: 0, east: -90, south: 180, west: 90 };
        let yaw = p.yaw;
        const toward = /^(?:toward|towards|to|face)\s+-?\d/.test(t);
        const deg = t.match(/(-?\d+(?:\.\d+)?)/);
        if (toward) {
          const nums = (t.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
          if (nums.length < 2) return 'Say the spot to face as x and z, from your map: "toward 15 -7".';
          const [x, z] = nums.length >= 3 ? [nums[0], nums[2]] : nums; // (x z, or x y z)
          yaw = Math.atan2(-(x + 0.5 - p.x), -(z + 0.5 - p.z));
        } else if (/around|back/.test(t)) yaw += Math.PI;
        else if (/left|right/.test(t)) {
          const by = deg ? Number(deg[1]) : /little|bit|slight/.test(t) ? 45 : 90;
          yaw += (/left/.test(t) ? 1 : -1) * rad(by);
        } else {
          const k = Object.keys(points).find((d) => t.replace(/\s+/g, "-").includes(d));
          if (k === undefined) return 'Say left, right, around, "a little left", "left 30", a compass point like "north-east", or "toward x z".';
          yaw = rad(points[k]);
        }
        g.look(yaw, p.pitch);
        g.tick(2);
        const f = ahead(g.player.yaw);
        const bearing = Math.round(((((Math.atan2(f.x, -f.z) * 180) / Math.PI) + 360) % 360));
        return `You face ${compass(f.x, f.z)} now (${bearing}° from north, clockwise).`;
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
    chop: {
      help: 'find the nearest tree, walk up to it and dig its trunk for logs: "chop", or "chop 3" for up to 3 logs',
      async run(text) {
        const g = ready();
        const n = await lookup();
        const want = Math.max(1, Math.min(6, Number(/\d+/.exec(text || "")?.[0]) || 3));
        const w = g.world, p = g.player;
        const isLog = (id) => id > 0 && /log$/i.test(String(n.block(id)).replace(/\s+/g, "_")) && !/^stripped/i.test(n.block(id));
        const countLogs = () => g.inv.slots.reduce((s, x) => s + (x && isLog(x.id) ? x.n : 0), 0);
        const before = countLogs();
        // the nearest trunk: a log block within 16 blocks, at about her height
        let best = null;
        const fx = Math.floor(p.x), fy = Math.floor(p.y), fz = Math.floor(p.z);
        for (let dx = -16; dx <= 16; dx++)
          for (let dz = -16; dz <= 16; dz++)
            for (let dy = -3; dy <= 5; dy++) {
              const id = w.get(fx + dx, fy + dy, fz + dz);
              if (!isLog(id)) continue;
              const d = Math.hypot(dx, dz) + Math.abs(dy) * 0.3;
              if (!best || d < best.d) best = { x: fx + dx, y: fy + dy, z: fz + dz, d, id };
            }
        if (!best) return "There's no tree within 16 blocks of you. Walk somewhere new and try again.";
        const tree = n.block(best.id);
        const face = (x, z) => g.look(Math.atan2(-(x + 0.5 - g.player.x), -(z + 0.5 - g.player.z)), 0);
        // walk up to it, facing it each little stretch, hopping when something's in the way
        for (let i = 0; i < 30 && Math.hypot(best.x + 0.5 - g.player.x, best.z + 0.5 - g.player.z) > 1.9; i++) {
          face(best.x, best.z);
          const from = { x: g.player.x, z: g.player.z };
          hold(["KeyW"], 250);
          if (Math.hypot(g.player.x - from.x, g.player.z - from.z) < 0.15) hold(["KeyW", "Space"], 350);
        }
        if (Math.hypot(best.x + 0.5 - g.player.x, best.z + 0.5 - g.player.z) > 3) return `You couldn't get to the ${tree} (something's in the way). You're at ${at(g.player)}.`;
        // the trunk's logs within reach, lowest first: aim at each and dig it
        let dug = 0;
        for (let y = best.y - 1; y <= Math.floor(g.player.y) + 3 && dug < want; y++) {
          if (!isLog(w.get(best.x, y, best.z))) continue;
          const eye = g.player.y + 1.62, cx = best.x + 0.5, cz = best.z + 0.5;
          const horiz = Math.hypot(cx - g.player.x, cz - g.player.z);
          g.look(Math.atan2(-(cx - g.player.x), -(cz - g.player.z)), Math.atan2(y + 0.5 - eye, horiz));
          g.tick(2);
          const t = g.target;
          if (!t || t.x !== best.x || t.y !== y || t.z !== best.z) continue; // (something else is in the line of sight)
          g.button(0, true);
          try {
            for (let k = 0; k < 40 && isLog(w.get(best.x, y, best.z)); k++) g.tick(15);
          } finally {
            g.button(0, false);
          }
          if (!isLog(w.get(best.x, y, best.z))) dug++;
        }
        // what fell: step up to where the trunk stood to pick it up
        face(best.x, best.z);
        hold(["KeyW"], 500);
        g.tick(60);
        const got = countLogs() - before;
        if (!dug) return `You reached the ${tree} at ${best.x}, ${best.y}, ${best.z} but couldn't get a clear swing at its trunk. Try "look ahead" and "dig".`;
        return `Chopped ${dug} ${tree} block${dug === 1 ? "" : "s"}${got > 0 ? `; ${got} log${got === 1 ? "" : "s"} in your inventory now (${countLogs()} in all)` : ", but the logs haven't reached your hands yet: walk forward a step to pick them up"}. You're at ${at(g.player)}.`;
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
