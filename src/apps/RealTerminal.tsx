import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { openPrivacyAt, Sensitive } from "../ui/common.tsx";
import { isLocalAddress } from "../lib/termLinks.ts";
import { openInFullBrowser } from "./FullBrowser.tsx";
import { termClose, termOpen, termSocketUrl, termState, useTerminalAllowed, type TermSession } from "../lib/terminal.ts";

/** A real shell on the computer running the desktop, in a workspace folder of its own (server/terminal.mjs). */
export function RealTerminal() {
  const allowedHere = useTerminalAllowed();
  const [sessions, setSessions] = useState<TermSession[]>([]);
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [current, setCurrent] = useState<string>(() => sessionStorage.getItem("pdd-term") || "");
  const [space, setSpace] = useState("main");
  const [note, setNote] = useState("");
  const [serverOn, setServerOn] = useState(false);

  const refresh = async () => {
    try {
      const s = await termState();
      setServerOn(s.on);
      setSessions(s.sessions);
      setWorkspaces(s.workspaces);
      // against the terminal shown now (this runs from a timer, so a remembered `current` would be an old one)
      setCurrent((c) => (c && !s.sessions.some((x) => x.id === c) ? "" : c));
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    }
  };
  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(t);
  }, [allowedHere]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => sessionStorage.setItem("pdd-term", current), [current]);

  const start = async () => {
    setNote("");
    try {
      const s = await termOpen(space, 100, 30);
      setCurrent(s.id);
      void refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    }
  };

  if (!allowedHere)
    return (
      <div className="pad">
        <h3>
          A real terminal <Sensitive feature="terminal" />
        </h3>
        <p className="small muted">
          A real shell on the computer running the desktop (PowerShell on Windows, your own shell on a Mac or Linux), each in a workspace folder of its own: a desk for building things, and for
          residents like Claude Code. It's off until you turn it on in Privacy, after reading what it allows.
        </p>
        <button className="btn primary small" onClick={() => openPrivacyAt("terminal")}>
          Open Privacy
        </button>
      </div>
    );

  return (
    <div className="real-term">
      <div className="row real-term-bar">
        {sessions.map((s) => (
          <button key={s.id} className={`btn small${s.id === current ? " primary" : ""}`} onClick={() => setCurrent(s.id)} title={s.folder}>
            {s.title}
            {s.alive ? "" : " (ended)"}
          </button>
        ))}
        <span className="grow" />
        <input className="input small" style={{ width: 130 }} list="pdd-workspaces" value={space} onChange={(e) => setSpace(e.target.value)} aria-label="Workspace" title="Workspace folder" />
        <datalist id="pdd-workspaces">
          {workspaces.map((w) => (
            <option key={w} value={w} />
          ))}
        </datalist>
        <button className="btn small" onClick={() => void start()} disabled={!serverOn}>
          New terminal
        </button>
        {current ? (
          <button className="btn small" onClick={() => void termClose(current).then(() => (setCurrent(""), refresh()))} title="End this shell">
            End
          </button>
        ) : null}
      </div>
      {!serverOn ? (
        <div className="note warn small">The desktop's server hasn't switched the terminal on. Switching it on works from the desktop's own computer: open SEASIDE there once with Privacy allowing it.</div>
      ) : null}
      {note ? <div className="note small">{note}</div> : null}
      {current ? <TermView key={current} id={current} /> : <div className="pad small muted">{sessions.length ? "Pick a terminal above, or start a new one." : "No terminals yet: pick a workspace and press New terminal."}</div>}
    </div>
  );
}

function TermView({ id }: { id: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const css = getComputedStyle(document.documentElement);
    // web addresses the shell prints are links: they open in SEASIDE's own Browser window, except this computer's own
    // addresses, which its engine refuses, so those open in a normal new tab
    const openLink = (e: MouseEvent, uri: string) => {
      e.preventDefault();
      const tab = () => void window.open(uri, "_blank", "noopener");
      if (isLocalAddress(uri)) tab();
      else void openInFullBrowser(uri).catch(tab);
    };
    const term = new Terminal({
      // hidden links some programs print (OSC 8), sent the same way as plain addresses
      linkHandler: { activate: (e, uri) => /^https?:/i.test(uri) && openLink(e, uri) },
      cursorBlink: true,
      fontFamily: "ui-monospace, SFMono-Regular, Consolas, 'Cascadia Mono', monospace",
      fontSize: 13,
      scrollback: 5000,
      theme: { background: "#0b0912", foreground: css.getPropertyValue("--text").trim() || "#eee", cursor: css.getPropertyValue("--accent").trim() || "#c9a6ff" },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon(openLink));
    term.open(el);
    const ws = new WebSocket(termSocketUrl(id));
    ws.binaryType = "arraybuffer";
    const size = () => {
      try {
        fit.fit();
      } catch {
        /* not laid out yet */
      }
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
    };
    ws.onopen = () => (size(), term.focus());
    ws.onmessage = (e) => {
      if (typeof e.data === "string") {
        try {
          const m = JSON.parse(e.data) as { type?: string; code?: number };
          if (m.type === "exit") term.write(`\r\n\x1b[2m[The shell ended${m.code !== undefined ? ` (${m.code})` : ""}.]\x1b[0m\r\n`);
        } catch {
          /* not ours */
        }
      } else term.write(new Uint8Array(e.data as ArrayBuffer));
    };
    ws.onclose = () => term.write("\r\n\x1b[2m[Disconnected. The shell keeps running; open it again from the bar.]\x1b[0m\r\n");
    const enc = new TextEncoder();
    const typed = term.onData((d) => ws.readyState === WebSocket.OPEN && ws.send(enc.encode(d)));
    const ro = new ResizeObserver(() => size());
    ro.observe(el);
    return () => {
      ro.disconnect();
      typed.dispose();
      ws.close();
      term.dispose();
    };
  }, [id]);
  return <div ref={box} className="real-term-view" />;
}
