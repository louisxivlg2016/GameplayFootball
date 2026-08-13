/**
 * Penalty-shootout scoreboard overlay. The C++ referee (Referee::ProcessShootout)
 * drives the kicks and calls these window hooks:
 *   gpfShootoutStart()                          — a shootout has begun
 *   gpfShootoutUpdate(s0,s1,t0,t1,kicker)       — tallies changed / next kicker
 *   gpfShootoutEnd(s0,s1)                        — decided; show the result
 * We only get running TOTALS (goals + kicks taken) per side, so the dots show
 * `score` greens + `(taken-score)` reds + greys for the remaining first-five — the
 * counts are exact even though the per-kick order isn't tracked.
 */
import { L } from "./i18n";

let root: HTMLElement | null = null;
let scoreEl: HTMLElement | null = null;
let row0: HTMLElement | null = null;
let row1: HTMLElement | null = null;
let resultEl: HTMLElement | null = null;
let hideTimer: number | null = null;

const CSS = `
#gpf-shootout { position:fixed; left:50%; top:12%; transform:translateX(-50%); z-index:2147483200;
  display:none; min-width:min(420px,86vw); padding:14px 20px 16px; border-radius:14px; color:#fff;
  font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif; text-align:center; pointer-events:none;
  background:linear-gradient(180deg,rgba(10,14,20,.92),rgba(6,9,13,.92));
  box-shadow:0 8px 30px rgba(0,0,0,.6); border:1px solid rgba(255,255,255,.08); }
#gpf-shootout.show { display:block; }
#gpf-shootout .so-title { font-size:13px; font-weight:900; letter-spacing:3px; text-transform:uppercase;
  color:#ffe94a; margin-bottom:6px; }
#gpf-shootout .so-score { font-size:40px; font-weight:900; line-height:1; letter-spacing:2px; }
#gpf-shootout .so-rows { margin-top:10px; display:flex; flex-direction:column; gap:6px; align-items:center; }
#gpf-shootout .so-row { display:flex; gap:5px; align-items:center; justify-content:center; }
#gpf-shootout .so-dot { width:13px; height:13px; border-radius:50%; box-sizing:border-box;
  border:1px solid rgba(255,255,255,.25); }
#gpf-shootout .so-dot.g { background:#37d67a; border-color:#37d67a; }
#gpf-shootout .so-dot.m { background:#e64c4c; border-color:#e64c4c; }
#gpf-shootout .so-dot.p { background:rgba(255,255,255,.10); }
#gpf-shootout .so-result { margin-top:10px; font-size:16px; font-weight:900; color:#ffe94a;
  letter-spacing:1px; min-height:0; }
`;

function dotsFor(score: number, taken: number): string {
  const total = Math.max(5, taken);
  let html = "";
  for (let i = 0; i < total; i++) {
    let cls = "p";
    if (i < score) cls = "g";
    else if (i < taken) cls = "m";
    html += `<span class="so-dot ${cls}"></span>`;
  }
  return html;
}

function build(): void {
  if (root) return;
  const style = document.createElement("style");
  style.id = "gpf-shootout-style";
  style.textContent = CSS;
  document.head.appendChild(style);
  root = document.createElement("div");
  root.id = "gpf-shootout";
  root.innerHTML =
    `<div class="so-title">${L("Tirs au but")}</div>` +
    `<div class="so-score">0 – 0</div>` +
    `<div class="so-rows"><div class="so-row"></div><div class="so-row"></div></div>` +
    `<div class="so-result"></div>`;
  document.body.appendChild(root);
  scoreEl = root.querySelector(".so-score");
  const rows = root.querySelectorAll(".so-row");
  row0 = rows[0] as HTMLElement;
  row1 = rows[1] as HTMLElement;
  resultEl = root.querySelector(".so-result");
}

function paint(s0: number, s1: number, t0: number, t1: number): void {
  if (scoreEl) scoreEl.textContent = `${s0} – ${s1}`;
  if (row0) row0.innerHTML = dotsFor(s0, t0);
  if (row1) row1.innerHTML = dotsFor(s1, t1);
}

export function initShootout(): void {
  build();
  const w = window as unknown as Record<string, unknown>;
  w.gpfShootoutStart = (): void => {
    build();
    if (hideTimer !== null) { window.clearTimeout(hideTimer); hideTimer = null; }
    if (resultEl) resultEl.textContent = "";
    paint(0, 0, 0, 0);
    root?.classList.add("show");
  };
  w.gpfShootoutUpdate = (s0: number, s1: number, t0: number, t1: number): void => {
    build();
    paint(s0, s1, t0, t1);
    root?.classList.add("show");
  };
  w.gpfShootoutEnd = (s0: number, s1: number): void => {
    build();
    paint(s0, s1, Math.max(s0, 5), Math.max(s1, 5));
    if (resultEl) {
      resultEl.textContent =
        s0 === s1 ? "" : `${s0 > s1 ? L("Victoire à domicile") : L("Victoire à l'extérieur")} ${Math.max(s0, s1)}–${Math.min(s0, s1)}`;
    }
    root?.classList.add("show");
    // fade out after a few seconds so the game-over screen shows through
    if (hideTimer !== null) window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => root?.classList.remove("show"), 9000);
  };
}
