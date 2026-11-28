// Every side panel (the `.side` column of Music, Files, Notes, Settings, the Theatre…) can be dragged wider or
// narrower by its right edge. One listener for all of them, so a new app's side panel gets it by being a `.side`.
// Widths are kept per panel (by its own class name) on this device.

import { toCss } from "./zoom.ts";

const EDGE = 6;
const MIN = 140;
const KEY = "pdd-side-widths";

const keyOf = (el: Element) => [...el.classList].filter((c) => c !== "side").join(".") || "side";

function widths(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}
function remember(key: string, w: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...widths(), [key]: w }));
  } catch {
    /* blocked: it just won't be kept */
  }
}
function forget(key: string) {
  try {
    const w = widths();
    delete w[key];
    localStorage.setItem(KEY, JSON.stringify(w));
  } catch {
    /* blocked */
  }
}

/** The side panel whose right edge the pointer is on, if any. */
function edgeOf(e: PointerEvent): HTMLElement | null {
  const side = (e.target as Element | null)?.closest?.(".side") as HTMLElement | null;
  if (!side) return null;
  const r = side.getBoundingClientRect();
  return e.clientX >= r.right - EDGE && e.clientX <= r.right + 2 ? side : null;
}

let started = false;
export function startSideGrips() {
  if (started || typeof document === "undefined") return;
  started = true;
  const apply = (el: Element) => {
    const w = widths()[keyOf(el)];
    if (w && el instanceof HTMLElement && !el.style.width) el.style.width = `${w}px`;
  };
  const seen = (n: Node) => {
    if (!(n instanceof Element)) return;
    if (n.matches(".side")) apply(n);
    n.querySelectorAll(".side").forEach(apply);
  };
  seen(document.body);
  new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach(seen))).observe(document.body, { childList: true, subtree: true });

  let hot: HTMLElement | null = null;
  document.addEventListener("pointermove", (e) => {
    if (e.buttons) return;
    const el = edgeOf(e);
    if (el === hot) return;
    hot?.classList.remove("side-grip");
    hot = el;
    hot?.classList.add("side-grip");
  });
  document.addEventListener(
    "pointerdown",
    (e) => {
      const side = edgeOf(e);
      if (!side || e.button !== 0) return;
      e.preventDefault();
      const start = e.clientX;
      const from = toCss(side.getBoundingClientRect().width);
      const row = side.parentElement?.getBoundingClientRect();
      const most = Math.max(MIN + 40, toCss(row?.width ?? 800) - 240);
      const key = keyOf(side);
      document.body.classList.add("side-dragging");
      const move = (ev: PointerEvent) => {
        side.style.width = `${Math.round(Math.max(MIN, Math.min(most, from + toCss(ev.clientX - start))))}px`;
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        document.body.classList.remove("side-dragging");
        remember(key, Math.round(toCss(side.getBoundingClientRect().width)));
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    true,
  );
  // double-click the edge: back to the usual width
  document.addEventListener("dblclick", (e) => {
    const side = edgeOf(e as PointerEvent);
    if (!side) return;
    side.style.width = "";
    forget(keyOf(side));
  });
}
