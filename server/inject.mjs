// Scripts placed at the top of every app and game page served on the app origin.

/** Lets the desktop read what's on screen and keeps desktop shortcuts working while a game has focus. */
export function helperScript() {
  return `(${helper.toString()})();`;
}

function helper() {
  if (window.__pddHelper) return;
  window.__pddHelper = true;
  // An app's warnings and errors go to the desktop too: a game that refuses a move often says why only there
  // ("rejected place: word must connect"), and a character who sent it needs to hear it.
  ["warn", "error"].forEach((level) => {
    const original = console[level];
    console[level] = function (...args) {
      try {
        const text = args.map((a) => (typeof a === "string" ? a : (() => { try { return JSON.stringify(a); } catch (err) { return String(a); } })())).join(" ");
        window.parent.postMessage({ __pdd: "console", level, text: text.slice(0, 400) }, "*");
      } catch (err) {
        /* nothing to tell */
      }
      return original.apply(this, args);
    };
  });
  window.addEventListener("message", (e) => {
    if (e.source !== window.parent || !e.data || e.data.__pdd !== "screen") return;
    let text = "";
    try {
      text = (document.body && document.body.innerText) || "";
    } catch (err) {
      text = "";
    }
    // A board made of cells that know their place (data-row and data-col): its text alone loses where each piece
    // is, so draw it as rows first, with the column numbers on top. "." is an empty cell.
    let grid = "";
    try {
      const cells = document.querySelectorAll("[data-row][data-col]");
      if (cells.length >= 4) {
        const at = new Map();
        let rows = 0;
        let cols = 0;
        // what a cell holds: its first word ("O" from a tile "O 1", "TW" from a bonus square), shown or not
        const label = (el) => {
          const shown = String(el.innerText || "").trim().split(/\s+/)[0] || "";
          if (shown) return shown;
          const raw = String(el.textContent || "").trim();
          return (/^[^\d\s]+/.exec(raw) || [""])[0];
        };
        cells.forEach((el) => {
          rows = Math.max(rows, parseInt(el.getAttribute("data-row"), 10) + 1 || 0);
          cols = Math.max(cols, parseInt(el.getAttribute("data-col"), 10) + 1 || 0);
        });
        // a filled cell often loses its coordinates (it's drawn as a piece instead); when the board's container holds
        // exactly rows × cols children, place every child by its order instead
        const box = cells[0].parentElement;
        const kids = box ? Array.from(box.children) : [];
        const byOrder = rows > 0 && cols > 0 && rows < 100 && cols < 100 && kids.length === rows * cols;
        (byOrder ? kids : Array.from(cells)).forEach((el, i) => {
          const r = byOrder ? Math.floor(i / cols) : parseInt(el.getAttribute("data-row"), 10);
          const c = byOrder ? i % cols : parseInt(el.getAttribute("data-col"), 10);
          if (!(r >= 0 && c >= 0 && r < 100 && c < 100)) return;
          const first = label(el);
          if (!at.has(r * 100 + c) || first) at.set(r * 100 + c, first.slice(0, 2));
        });
        const pad = (s) => (s + "   ").slice(0, 3);
        const lines = [`   ${Array.from({ length: cols }, (_, c) => pad(String(c))).join("")}`];
        for (let r = 0; r < rows; r++) lines.push(pad(String(r)) + Array.from({ length: cols }, (_, c) => pad(at.get(r * 100 + c) || ".")).join(""));
        grid = `The board, row by row (rows down the side, columns along the top, both from 0; "." is empty):\n${lines.join("\n")}\n\n`;
      }
    } catch (err) {
      grid = "";
    }
    let controls = "";
    try {
      const list = usable().slice(0, 30).map(describe).filter(Boolean);
      if (list.length) controls = `\n\nControls on this screen (a player in their own seat can use them with game_seat_act):\n${list.join("\n")}`;
    } catch (err) {
      controls = "";
    }
    window.parent.postMessage({ __pdd: "screen-reply", rid: e.data.rid, text: (grid + text).slice(0, 6000 - controls.length) + controls, title: document.title }, "*");
  });

  // ---- a seat's own controls: what a player can type, click or choose on their own screen ----
  // (sent only by the desktop that holds this frame, for a character's own seat: what she does here is as private as
  // what a person does on their own screen; only what the game itself sends out reaches anyone else)
  const shown = (el) => {
    try {
      return !el.disabled && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
    } catch (err) {
      return false;
    }
  };
  const FIELDS = "input:not([type=hidden]):not([type=button]):not([type=submit]):not([type=reset]):not([type=checkbox]):not([type=radio]), textarea, [contenteditable=true]";
  const usable = () => Array.from(document.querySelectorAll(`${FIELDS}, select, button, [role=button], input[type=button], input[type=submit], input[type=checkbox], input[type=radio], a[href]`)).filter(shown);
  const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const labelOf = (el) => {
    const byFor = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
    const wrap = el.closest && el.closest("label");
    const own = el.matches("button, [role=button], a") ? el.innerText : el.matches("input[type=button], input[type=submit]") ? el.value : "";
    return clean(el.getAttribute("aria-label") || (byFor && byFor.innerText) || own || (wrap && wrap.innerText) || el.getAttribute("placeholder") || el.getAttribute("title") || el.getAttribute("name") || el.id);
  };
  const describe = (el) => {
    const name = labelOf(el).slice(0, 60);
    if (!name && !el.matches("select, " + FIELDS)) return "";
    if (el.matches("select")) return `[choice] "${name}": ${Array.from(el.options).map((o) => clean(o.text)).slice(0, 12).join(" | ")} (now: ${clean(el.options[el.selectedIndex] && el.options[el.selectedIndex].text)})`;
    if (el.matches("input[type=checkbox], input[type=radio]")) return `[${el.type}] "${name}" (${el.checked ? "on" : "off"})`;
    if (el.matches(FIELDS)) {
      const v = el.matches("[contenteditable=true]") ? el.innerText : el.value;
      return `[field] "${name}"${el.type === "password" ? "" : v ? ` (now: "${clean(v).slice(0, 40)}")` : " (empty)"}`;
    }
    return `[button] "${name}"`;
  };
  /** The control a player means: by id, by its exact label, then by a label that contains the words; a board cell as
   *  "row,col" (from the board drawn above it). */
  const find = (target, kind) => {
    const t = clean(target).toLowerCase();
    const cell = /^(?:cell\s*)?(\d+)\s*[, ]\s*(\d+)$/i.exec(clean(target));
    if (cell) return document.querySelector(`[data-row="${cell[1]}"][data-col="${cell[2]}"]`);
    const all = usable().filter((el) => (kind === "type" ? el.matches(FIELDS) : kind === "choose" ? el.matches("select") : true));
    return all.find((el) => el.id && el.id.toLowerCase() === t) || all.find((el) => labelOf(el).toLowerCase() === t) || all.find((el) => labelOf(el).toLowerCase().includes(t)) || (kind === "type" && !t && all.length === 1 ? all[0] : null);
  };
  window.addEventListener("message", (e) => {
    if (e.source !== window.parent || !e.data || e.data.__pdd !== "act") return;
    const a = e.data.act || {};
    const reply = (ok, said) => window.parent.postMessage({ __pdd: "act-reply", rid: e.data.rid, ok, said }, "*");
    try {
      const kind = String(a.do || "click");
      const el = find(a.target || "", kind);
      if (!el) return reply(false, `No ${kind === "type" ? "field" : kind === "choose" ? "choice" : "control"} called "${a.target || ""}" on your screen. game_screen lists the controls.`);
      if (kind === "type") {
        el.focus();
        if (el.matches("[contenteditable=true]")) el.innerText = String(a.text ?? "");
        else {
          const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(proto, "value").set.call(el, String(a.text ?? ""));
        }
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        if (a.enter) {
          ["keydown", "keypress", "keyup"].forEach((type) => el.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true })));
          if (el.form && el.form.requestSubmit) el.form.requestSubmit();
        }
        return reply(true, `Typed into "${labelOf(el) || a.target}"${a.enter ? " and pressed Enter" : ""}.`);
      }
      if (kind === "choose") {
        const want = clean(a.text).toLowerCase();
        const opt = Array.from(el.options).find((o) => clean(o.text).toLowerCase() === want || o.value.toLowerCase() === want) || Array.from(el.options).find((o) => clean(o.text).toLowerCase().includes(want));
        if (!opt) return reply(false, `"${labelOf(el)}" has no choice "${a.text}". It offers: ${Array.from(el.options).map((o) => clean(o.text)).join(" | ")}.`);
        el.value = opt.value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return reply(true, `Chose "${clean(opt.text)}" in "${labelOf(el)}".`);
      }
      ["pointerdown", "mousedown", "pointerup", "mouseup"].forEach((type) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window })));
      el.click();
      return reply(true, `Clicked "${labelOf(el) || a.target}".`);
    } catch (err) {
      return reply(false, `That didn't work: ${err && err.message ? err.message : err}`);
    }
  });
  // Sound from games follows the desktop's app volume (audio and video elements, and Web Audio).
  let volume = 1;
  const apply = (el) => {
    try {
      el.volume = Math.min(1, (el.__pddBase ?? (el.__pddBase = el.volume)) * volume);
    } catch (err) {
      /* not a media element */
    }
  };
  const all = () => document.querySelectorAll("audio, video").forEach(apply);
  const NativeAudio = window.Audio;
  if (NativeAudio) {
    window.Audio = function (src) {
      const a = new NativeAudio(src);
      a.__pddBase = 1;
      a.volume = volume;
      return a;
    };
    window.Audio.prototype = NativeAudio.prototype;
  }
  const gains = [];
  const proto = window.BaseAudioContext ? window.BaseAudioContext.prototype : window.AudioContext && window.AudioContext.prototype;
  const realDest = proto && Object.getOwnPropertyDescriptor(proto, "destination");
  if (realDest && realDest.get) {
    // Everything a game plays through Web Audio passes one gain node per context.
    Object.defineProperty(proto, "destination", {
      configurable: true,
      get() {
        if (!this.__pddGain) {
          const real = realDest.get.call(this);
          const g = this.createGain();
          g.gain.value = volume;
          g.connect(real);
          g.__pddReal = real;
          this.__pddGain = g;
          gains.push(g);
        }
        return this.__pddGain;
      },
    });
  }
  new MutationObserver(all).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("message", (e) => {
    if (e.source !== window.parent || !e.data || e.data.__pdd !== "volume") return;
    volume = Math.max(0, Math.min(1, Number(e.data.volume)));
    all();
    gains.forEach((g) => (g.gain.value = volume));
  });
  window.parent.postMessage({ __pdd: "volume-ready" }, "*");
  window.addEventListener(
    "keydown",
    (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        window.parent.postMessage({ __pdd: "key", key: e.key, code: e.code, ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey, alt: e.altKey }, "*");
      }
    },
    true,
  );
}

/** The webxdc API, storage kept per app, plus the helper. */
export function webxdcScript({ scope, addr, name, lan }) {
  const cfg = JSON.stringify({ scope, addr, name, lan: Boolean(lan) }).replace(/</g, "\\u003c");
  return `(${helper.toString()})();(${webxdc.toString()})(${cfg});`;
}

function webxdc(cfg) {
  if (window.webxdc && window.webxdc.__pdd) return;
  // Refuse to run beside the desktop itself: there, an app could read the desktop's keys.
  let sameOrigin = false;
  try {
    sameOrigin = Boolean(window.parent !== window && window.parent.document);
  } catch (e) {
    sameOrigin = false;
  }
  if (sameOrigin && !cfg.lan) {
    window.stop();
    document.documentElement.innerHTML = "<body style='font:15px sans-serif;padding:24px'>This app has to run on its own address. Open the desktop at http://localhost to use apps.</body>";
    throw new Error("webxdc app blocked: same origin as the desktop");
  }

  // ---- storage, kept separate for each app ----
  // (a character's seat keeps its own, apart from the person's on the same device: a secret word or a hand of cards
  // saved by one player's copy mustn't show up in another's; a person's own key stays as it always was)
  const prefix = "xdc:" + cfg.scope + ":" + (/^ai:/.test(cfg.addr) ? cfg.addr + ":" : "");
  function wrap(real) {
    const keys = () => {
      const out = [];
      for (let i = 0; i < real.length; i++) {
        const k = real.key(i);
        if (k && k.indexOf(prefix) === 0) out.push(k.slice(prefix.length));
      }
      return out;
    };
    const api = {
      getItem: (k) => real.getItem(prefix + k),
      setItem: (k, v) => real.setItem(prefix + k, String(v)),
      removeItem: (k) => real.removeItem(prefix + k),
      clear: () => keys().forEach((k) => real.removeItem(prefix + k)),
      key: (i) => keys()[i] ?? null,
      get length() {
        return keys().length;
      },
    };
    return new Proxy(api, {
      get: (t, p) => (p in t ? t[p] : typeof p === "string" ? t.getItem(p) : undefined),
      set: (t, p, v) => {
        t.setItem(p, v);
        return true;
      },
      deleteProperty: (t, p) => {
        t.removeItem(p);
        return true;
      },
      ownKeys: () => keys(),
      getOwnPropertyDescriptor: (t, p) => (t.getItem(p) !== null ? { value: t.getItem(p), enumerable: true, configurable: true } : undefined),
    });
  }
  try {
    const local = wrap(window.localStorage);
    const session = wrap(window.sessionStorage);
    Object.defineProperty(window, "localStorage", { value: local, configurable: true });
    Object.defineProperty(window, "sessionStorage", { value: session, configurable: true });
  } catch (e) {
    /* storage not available */
  }
  try {
    const open = indexedDB.open.bind(indexedDB);
    const del = indexedDB.deleteDatabase.bind(indexedDB);
    indexedDB.open = (n, v) => (v === undefined ? open(prefix + n) : open(prefix + n, v));
    indexedDB.deleteDatabase = (n) => del(prefix + n);
  } catch (e) {
    /* no IndexedDB */
  }

  // ---- the webxdc API, carried to the desktop by postMessage ----
  const parent = window.parent;
  let seq = 0;
  const waiting = new Map();
  let listener = null;
  let lastSerial = 0;
  let rtListener = null;
  const post = (msg) => parent.postMessage(Object.assign({ __pdd: "xdc" }, msg), "*");
  const ask = (msg) =>
    new Promise((resolve) => {
      const rid = ++seq;
      waiting.set(rid, resolve);
      post(Object.assign({ rid }, msg));
    });
  const deliver = (updates) => {
    for (const u of updates) {
      if (u.serial <= lastSerial) continue;
      lastSerial = u.serial;
      if (listener) {
        try {
          listener(u);
        } catch (e) {
          console.error(e);
        }
      }
    }
  };
  window.addEventListener("message", (e) => {
    if (e.source !== parent || !e.data || e.data.__pdd !== "xdc") return;
    const m = e.data;
    if (m.type === "updates") deliver(m.updates || []);
    if (m.type === "rt" && rtListener) rtListener(new Uint8Array(m.data));
    if (m.rid && waiting.has(m.rid)) {
      waiting.get(m.rid)(m.value);
      waiting.delete(m.rid);
    }
  });

  window.webxdc = {
    __pdd: true,
    selfAddr: cfg.addr,
    selfName: cfg.name,
    sendUpdateInterval: 1000,
    sendUpdateMaxSize: 128000,
    sendUpdate(update, descr) {
      post({ type: "send", update: JSON.parse(JSON.stringify(update)), descr: descr || "" });
    },
    setUpdateListener(cb, serial) {
      listener = cb;
      lastSerial = serial || 0;
      return ask({ type: "listen", since: lastSerial }).then((updates) => {
        deliver(updates || []);
      });
    },
    getAllUpdates() {
      return ask({ type: "listen", since: 0 });
    },
    sendToChat(content) {
      const out = Object.assign({}, content);
      const file = out.file;
      if (file && file.blob) {
        return new Promise((resolve) => {
          const r = new FileReader();
          r.onload = () => {
            out.file = { name: file.name, dataUrl: r.result };
            ask({ type: "chat", content: out }).then(resolve);
          };
          r.readAsDataURL(file.blob);
        });
      }
      return ask({ type: "chat", content: out });
    },
    importFiles(filter) {
      return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = Boolean(filter && filter.multiple);
        const accept = [].concat((filter && filter.mimeTypes) || [], (filter && filter.extensions) || []);
        if (accept.length) input.accept = accept.join(",");
        input.onchange = () => resolve(Array.from(input.files || []));
        input.click();
      });
    },
    joinRealtimeChannel() {
      post({ type: "rt-join" });
      return {
        setListener(cb) {
          rtListener = cb;
        },
        send(data) {
          post({ type: "rt-send", data: Array.from(data) });
        },
        leave() {
          rtListener = null;
          post({ type: "rt-leave" });
        },
      };
    },
  };
  post({ type: "hello" });
}

/**
 * For the Classic pages: send their outside requests through the desktop's relay (no CORS problems),
 * unless Settings → Classic says to send them from the browser. The desktop page provides __pddRelay.
 */
export function classicRelayScript() {
  return `(${classicRelay.toString()})();`;
}

function classicRelay() {
  try {
    const P = window.parent;
    if (!P || P === window || !P.__pddRelay) return;
    const own = window.fetch.bind(window);
    window.fetch = function (input, init) {
      try {
        const url = new URL(typeof input === "string" || input instanceof URL ? String(input) : input.url, location.href);
        const outside = (url.protocol === "http:" || url.protocol === "https:") && url.origin !== location.origin;
        if (outside && P.__pddRelay.via(url.href) !== "browser") return P.__pddRelay.fetch(url.href, input, init);
        // the browser route: if the server blocks the page (CORS), the desktop relay sends it instead, when the
        // desktop can tell that won't send it twice (older desktops without afterBlock just report the error)
        if (outside && P.__pddRelay.afterBlock)
          return own(input, init).catch((e) => {
            if (init?.signal?.aborted || (input && input.signal?.aborted)) throw e;
            return P.__pddRelay.afterBlock(url.href, input, init);
          });
      } catch {
        /* fall through to the browser */
      }
      return own(input, init);
    };
  } catch {
    /* not inside the desktop */
  }
}
