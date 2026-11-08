// Real terminals: a shell on this computer (PowerShell on Windows, your own shell on a Mac or Linux) in a pseudo-
// terminal, shown in the Terminal window. Each starts in a workspace folder of its own (data/workspaces/<name>), so
// a resident like Claude Code has a desk to work at. Off until switched on (Privacy → A real terminal), and only
// from this computer or the tailnet; sessions outlive the window, so closing it doesn't kill what's running.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

const KEEP = 256 * 1024; // scrollback kept for a window that reattaches

export function defaultShell(platform = process.platform, env = process.env) {
  if (platform === "win32") return { file: "powershell.exe", args: ["-NoLogo"] };
  return { file: env.SHELL || (platform === "darwin" ? "/bin/zsh" : "/bin/bash"), args: ["-l"] };
}

/** A workspace's folder name: letters, digits, - and _, nothing that climbs out. */
export function workspaceName(name) {
  const n = String(name || "main").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return n || "main";
}

export function createTerminals({ dataDir, spawn, shell = defaultShell() }) {
  const dir = () => path.join(typeof dataDir === "function" ? dataDir() : dataDir, "workspaces");
  const settingsFile = () => path.join(typeof dataDir === "function" ? dataDir() : dataDir, "terminal.json");
  const sessions = new Map();

  const settings = () => {
    try {
      return { on: false, ...JSON.parse(fs.readFileSync(settingsFile(), "utf8")) };
    } catch {
      return { on: false };
    }
  };
  const setOn = (on) => {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify({ ...settings(), on: Boolean(on) }, null, 1));
    if (!on) for (const id of [...sessions.keys()]) close(id);
    return settings();
  };

  const info = (s) => ({ id: s.id, workspace: s.workspace, folder: s.folder, title: s.title, started: s.started, alive: s.alive, viewers: s.clients.size });

  function open({ workspace, cols = 100, rows = 30 } = {}) {
    if (!settings().on) throw Object.assign(new Error("The real terminal is off (Settings → Privacy)."), { status: 403 });
    const name = workspaceName(workspace);
    const folder = path.join(dir(), name);
    fs.mkdirSync(folder, { recursive: true });
    const id = crypto.randomBytes(9).toString("base64url");
    const pty = spawn(shell.file, shell.args, {
      name: "xterm-256color",
      cols: Math.max(20, Math.min(400, cols | 0 || 100)),
      rows: Math.max(5, Math.min(200, rows | 0 || 30)),
      cwd: folder,
      env: { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor", PDA_SEASIDE_WORKSPACE: folder },
    });
    const s = { id, workspace: name, folder, title: `${name} · ${path.basename(shell.file)}`, started: Date.now(), alive: true, pty, clients: new Set(), kept: "" };
    pty.onData((d) => {
      s.kept = (s.kept + d).slice(-KEEP);
      for (const c of s.clients) c.sendBinary(Buffer.from(d, "utf8"));
    });
    pty.onExit(({ exitCode }) => {
      s.alive = false;
      for (const c of s.clients) c.sendText(JSON.stringify({ type: "exit", code: exitCode }));
    });
    sessions.set(id, s);
    return info(s);
  }

  function close(id) {
    const s = sessions.get(id);
    if (!s) return false;
    try {
      if (s.alive) s.pty.kill();
    } catch {
      /* already gone */
    }
    for (const c of s.clients) c.close();
    sessions.delete(id);
    return true;
  }

  /** A window watching one session: what's been said so far, then everything new; its keys and size go in. */
  function attach(id, conn) {
    const s = sessions.get(id);
    if (!s || !settings().on) return void conn.close();
    s.clients.add(conn);
    if (s.kept) conn.sendBinary(Buffer.from(s.kept, "utf8"));
    if (!s.alive) conn.sendText(JSON.stringify({ type: "exit" }));
    conn.onmessage = (data) => {
      if (!s.alive) return;
      // keys as binary (wsduplex hands binary over as a Buffer), sizes and the rest as JSON text
      if (Buffer.isBuffer(data)) return void s.pty.write(data.toString("utf8"));
      let m;
      try {
        m = JSON.parse(String(data));
      } catch {
        return;
      }
      if (m.type === "input" && typeof m.data === "string") s.pty.write(m.data);
      else if (m.type === "resize") s.pty.resize(Math.max(20, Math.min(400, m.cols | 0)), Math.max(5, Math.min(200, m.rows | 0)));
    };
    conn.onclose = () => s.clients.delete(conn);
  }

  return {
    settings,
    setOn,
    open,
    close,
    attach,
    list: () => [...sessions.values()].map(info),
    workspaces: () => {
      try {
        return fs.readdirSync(dir(), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
      } catch {
        return [];
      }
    },
    stopAll: () => [...sessions.keys()].forEach(close),
    home: os.homedir(),
  };
}
