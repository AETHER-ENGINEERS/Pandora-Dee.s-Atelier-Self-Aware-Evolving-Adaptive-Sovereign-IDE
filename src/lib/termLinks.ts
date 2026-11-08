/** Addresses on this computer itself. The full browser's engine refuses these (server/engine.mjs `forbidden`), so a
 *  link to one opens in a normal new tab instead. Kept in step with the engine's rule. */
export function isLocalAddress(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return h === "localhost" || h.endsWith(".localhost") || h === "::1" || h === "0.0.0.0" || /^127\./.test(h);
}
