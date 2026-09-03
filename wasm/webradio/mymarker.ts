// Floating "Toi" marker over the player the LOCAL human currently controls.
// In online co-op each machine drives its own team via its local net device, so
// the C++ side (gpf_my_player_screen) resolves the right player per screen — your
// friend sees "Toi" over HIS player, you see it over yours. Also works in solo
// and local-2P (marks the keyboard-controlled player).

type ModuleT = { _gpf_my_player_screen?: () => number; _gpf_net_state?: () => number; ccall?: (n: string, r: string, a: string[], v: unknown[]) => string };
const M = (): ModuleT | undefined => (window as unknown as { Module?: ModuleT }).Module;

export function initMyMarker(): void {
  const el = document.createElement("div");
  el.id = "gpf-me-marker";
  el.textContent = "Toi";
  el.style.cssText = [
    "position:fixed", "left:0", "top:0", "z-index:9",
    "transform:translate(-50%,-100%)",
    "padding:2px 9px", "border-radius:999px",
    "background:rgba(20,120,255,0.92)", "color:#fff",
    "font:700 13px/1.15 system-ui,sans-serif",
    "box-shadow:0 2px 8px rgba(0,0,0,0.4)",
    "pointer-events:none", "opacity:0",
    "transition:opacity 0.15s", "white-space:nowrap",
    "text-shadow:0 1px 2px rgba(0,0,0,0.5)",
  ].join(";");
  // little downward pointer under the pill
  const tip = document.createElement("div");
  tip.style.cssText = [
    "position:absolute", "left:50%", "top:100%", "transform:translateX(-50%)",
    "width:0", "height:0",
    "border-left:6px solid transparent", "border-right:6px solid transparent",
    "border-top:7px solid rgba(20,120,255,0.92)",
  ].join(";");
  el.appendChild(tip);
  document.body.appendChild(el);

  const canvas = (): HTMLCanvasElement | null =>
    document.querySelector("#canvas") as HTMLCanvasElement | null;

  function tick(): void {
    try {
      const m = M();
      // Only show "Toi" in ONLINE multiplayer (bit 1 of gpf_net_state = online
      // active). In solo you always control a player, so the marker is pointless.
      const online = ((m?._gpf_net_state?.() ?? 0) & 1) !== 0;
      const fn = m?.ccall;
      let s = "";
      if (online && fn) s = fn("gpf_my_player_screen", "string", [], []);
      if (s && s.indexOf(",") > 0) {
        const [nxS, nyS] = s.split(",");
        const nx = parseFloat(nxS), ny = parseFloat(nyS);
        const c = canvas();
        const r = c ? c.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        el.style.left = (r.left + nx * r.width) + "px";
        el.style.top = (r.top + ny * r.height) + "px";
        el.style.opacity = "1";
      } else {
        el.style.opacity = "0";
      }
    } catch { el.style.opacity = "0"; }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
