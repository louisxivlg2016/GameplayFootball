// Goalkeeper drill UI. In a keeper drill the AI takes penalties and the human
// is the keeper. The C++ referee calls window.gpfKeeperReady() when a penalty is
// live; we show two big arrows (⬅️ ➡️). Tapping one calls Module._gpf_keeper_dive
// (-1 left / +1 right), which binds a dive controller to the keeper so it commits
// to that side and attempts the real save. A new attempt restores the AI keeper
// (dive 0). gpfDrillDone (session over) hides everything.

interface KeeperModule {
  _gpf_keeper_dive?: (dir: number) => void;
  _gpf_start_keeper_drill?: () => void;
}

let root: HTMLElement | null = null;
let hint: HTMLElement | null = null;
let armed = false;

function mod(): KeeperModule | undefined {
  return (window as unknown as { Module?: KeeperModule }).Module;
}
function dive(dir: number): void { mod()?._gpf_keeper_dive?.(dir); }
function setPillsHidden(hidden: boolean): void {
  const m = document.getElementById("gpf-menu");
  if (m) m.style.display = hidden ? "none" : "";
}

function show(): void { if (root) root.style.display = "flex"; if (hint) hint.style.opacity = "1"; }
function hideUI(): void { if (root) root.style.display = "none"; if (hint) hint.style.opacity = "0"; }

function arm(): void {
  armed = true;
  dive(0);            // fresh attempt -> hand the keeper back to the AI until the user commits
  setPillsHidden(true);
  show();
}

function fired(dir: number): void {
  if (!armed) return;
  armed = false;      // one dive per attempt
  dive(dir);          // bind the dive controller -> keeper dives that side now
  hideUI();           // arrows away once committed; re-shown by the next gpfKeeperReady
  // let the dive play out, then hand the keeper back to the AI
  window.setTimeout(() => dive(0), 1600);
}

function arrowBtn(dir: number, glyph: string): HTMLElement {
  const b = document.createElement("button");
  b.className = "gpf-kb";
  b.textContent = glyph;
  const go = (e: Event): void => { e.preventDefault(); fired(dir); };
  b.addEventListener("touchstart", go, { passive: false });
  b.addEventListener("mousedown", go);
  return b;
}

export function initKeeperArrows(): void {
  if (root) return;

  const style = document.createElement("style");
  style.id = "gpf-keeper-style";
  style.textContent = `
#gpf-keeper { position:fixed; inset:0; z-index:44; display:none; pointer-events:none;
  align-items:center; justify-content:space-between; padding:0 4vw; box-sizing:border-box; }
#gpf-keeper .gpf-kb { pointer-events:auto; touch-action:none; cursor:pointer;
  width:min(26vw,170px); height:min(26vw,170px); border-radius:50%;
  font-size:min(15vw,90px); line-height:1; color:#fff;
  background:rgba(10,20,16,.42); border:4px solid rgba(255,255,255,.72);
  box-shadow:0 10px 30px rgba(0,0,0,.5); display:flex; align-items:center; justify-content:center; }
#gpf-keeper .gpf-kb:active { transform:scale(.9); background:rgba(110,240,255,.35); }
#gpf-keeper-hint { position:fixed; left:50%; top:22px; transform:translateX(-50%); z-index:45;
  padding:8px 18px; border-radius:999px; background:rgba(0,0,0,.55); color:#6ef0ff;
  font:800 16px system-ui,sans-serif; letter-spacing:.02em; pointer-events:none; opacity:0;
  transition:opacity .2s ease; white-space:nowrap; }`;
  document.head.appendChild(style);

  root = document.createElement("div");
  root.id = "gpf-keeper";
  root.append(arrowBtn(-1, "⬅️"), arrowBtn(1, "➡️"));

  hint = document.createElement("div");
  hint.id = "gpf-keeper-hint";
  hint.textContent = "Plonge à gauche ou à droite !";

  document.body.append(root, hint);

  const w = window as unknown as { gpfKeeperReady?: () => void; gpfDrillDone?: () => void };
  w.gpfKeeperReady = arm;
  const prevDone = w.gpfDrillDone;
  w.gpfDrillDone = (): void => {
    armed = false; hideUI(); dive(0); setPillsHidden(false);
    try { prevDone?.(); } catch { /* ignore */ }
  };
}
