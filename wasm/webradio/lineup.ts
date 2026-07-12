/**
 * Lineup / formation screen with the "Remplaçants" panel. Shown before a match
 * so you see your XI (photo + name + position cards on the pitch), then
 * "Jouer le match" runs the caller's launch. Manchester City (with ratings +
 * bench) is the default for MATCH AMICAL; Club / National / DEFI pass their own
 * real XI via showLineup(cfg) — photos from Wikipedia, positions in a 4-3-3, no
 * invented ratings.
 */
import { startNativeMatch, show as showHome } from "./homemenu";

const prox = (u: string): string => `/img-proxy?u=${encodeURIComponent(u)}`;

export interface P { name: string; pos: string; rating?: number; photo?: string; x?: number; y?: number; focus?: boolean }
export interface LineupConfig { teamName: string; starters: P[]; subs?: P[]; onPlay: () => void }

// generic 4-3-3 slots, index-aligned with a GK-first squad array
const SLOTS: Array<{ pos: string; x: number; y: number }> = [
  { pos: "GB", x: 50, y: 90 },
  { pos: "DD", x: 82, y: 70 }, { pos: "DC", x: 60, y: 73 }, { pos: "DC", x: 40, y: 73 }, { pos: "DG", x: 18, y: 70 },
  { pos: "MDC", x: 50, y: 57 }, { pos: "MC", x: 33, y: 47 }, { pos: "MC", x: 67, y: 47 },
  { pos: "AD", x: 80, y: 22 }, { pos: "BU", x: 50, y: 14 }, { pos: "AG", x: 20, y: 22 },
];

// "T.HERNANDEZ" / "MBAPPE" / "DE.PAUL" -> "Hernandez" / "Mbappe" / "De Paul"
function niceLabel(raw: string): string {
  const parts = raw.split(".").map((t) => t.trim()).filter((t) => t.length > 1)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
  return parts.length ? parts.join(" ") : raw;
}

// build a pitch XI from a GK-first surname array (used by Club/National/DEFI)
export function squadXI(names: string[]): P[] {
  return names.slice(0, 11).map((n, i) => {
    const label = niceLabel(n);
    return { name: label, pos: SLOTS[i]!.pos, x: SLOTS[i]!.x, y: SLOTS[i]!.y, photo: label };
  });
}

// Manchester City screenshot XI (has real ratings + a bench) — the MATCH AMICAL default
const XI: P[] = [
  { name: "Omar Marmoush", pos: "BU", rating: 84, x: 50, y: 90, focus: true },
  { name: "Matheus Nunes", pos: "DD", rating: 80, x: 18, y: 69 },
  { name: "Ruben Dias", pos: "DC", rating: 87, x: 38, y: 72 },
  { name: "Josko Gvardiol", pos: "DC", rating: 86, x: 62, y: 72 },
  { name: "Rayan Ait-Nouri", pos: "DG", rating: 83, x: 82, y: 69 },
  { name: "Rodri", pos: "MDC", rating: 90, x: 34, y: 49 },
  { name: "Bernardo Silva", pos: "MC", rating: 87, x: 66, y: 49 },
  { name: "Phil Foden", pos: "MOC", rating: 87, x: 50, y: 42 },
  { name: "Jeremy Doku", pos: "AG", rating: 85, x: 24, y: 18 },
  { name: "Erling Haaland", pos: "BU", rating: 92, x: 50, y: 9 },
  { name: "Savinho", pos: "AD", rating: 82, x: 76, y: 18 },
];
const BENCH: P[] = [
  { name: "Gianluigi Donnarumma", pos: "GB", rating: 89 },
  { name: "James Trafford", pos: "GB", rating: 80 },
  { name: "John Stones", pos: "DC", rating: 85 },
  { name: "Nathan Ake", pos: "DC", rating: 82 },
  { name: "Tijjani Reijnders", pos: "MC", rating: 85 },
  { name: "Rayan Cherki", pos: "MOC", rating: 84 },
  { name: "Nico Gonzalez", pos: "MC", rating: 82 },
];

const CSS = `
#gpf-lineup { position:fixed; inset:0; z-index:2147483200; color:#fff; display:none;
  font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif; }
#gpf-lineup.show { display:block; }
body.gpf-lineup-open #gpf-menu { display:none !important; }
#gpf-lineup .menu-shell { position:absolute; inset:12px; display:flex; flex-direction:column;
  padding:18px 22px; box-sizing:border-box;
  background:linear-gradient(180deg,rgba(5,22,15,.5),rgba(5,22,15,.9)),
    url("${prox("https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1600&q=80")}") center 48% / cover;
  border:2px solid rgba(255,255,255,.14); border-radius:6px; box-shadow:0 20px 48px rgba(0,0,0,.45); }
#gpf-lineup .lineup-panel { flex:1; min-height:0; display:grid; grid-template-rows:auto minmax(0,1fr); gap:12px; }
#gpf-lineup .lineup-top { min-height:56px; display:flex; align-items:center; justify-content:space-between;
  gap:16px; padding:10px 14px; color:#fff; background:rgba(4,16,25,.72);
  border:2px solid rgba(255,255,255,.14); border-radius:6px; box-sizing:border-box; }
#gpf-lineup .lineup-top span { display:block; color:#ffe94a; font-size:13px; font-weight:900; letter-spacing:1px; }
#gpf-lineup .lineup-top b { font-size:18px; }
#gpf-lineup .lineup-start { pointer-events:auto; cursor:pointer; min-height:42px; padding:0 18px; color:#07100b;
  background:#ffe94a; border:2px solid #fff4a6; border-radius:6px; font-family:inherit; font-size:15px;
  font-weight:900; box-shadow:0 7px 0 #b58c12,0 12px 20px rgba(0,0,0,.38); }
#gpf-lineup .lineup-start:active { transform:translateY(3px); box-shadow:0 4px 0 #b58c12; }
#gpf-lineup .lineup-layout { min-height:0; display:grid; grid-template-columns:minmax(0,1fr) 320px; gap:14px; }
#gpf-lineup .lineup-layout.no-bench { grid-template-columns:minmax(0,1fr); }
#gpf-lineup .lineup-layout.no-bench .lineup-bench { display:none; }
#gpf-lineup .lineup-pitch { position:relative; min-height:0; overflow:hidden; border:3px solid rgba(255,255,255,.28);
  border-radius:8px; box-shadow:inset 0 0 0 4px rgba(0,0,0,.16);
  background:
    linear-gradient(90deg,transparent 49.7%,rgba(255,255,255,.42) 49.7% 50.3%,transparent 50.3%),
    radial-gradient(circle at 50% 50%,transparent 0 13%,rgba(255,255,255,.45) 13.3% 13.8%,transparent 14%),
    linear-gradient(90deg,rgba(255,255,255,.05) 0 10%,transparent 10% 20%,rgba(255,255,255,.05) 20% 30%,transparent 30% 40%,rgba(255,255,255,.05) 40% 50%,transparent 50% 60%,rgba(255,255,255,.05) 60% 70%,transparent 70% 80%,rgba(255,255,255,.05) 80% 90%,transparent 90%),
    linear-gradient(180deg,rgba(43,132,43,.95),rgba(16,91,31,.95)); }
#gpf-lineup .lineup-pitch::before,#gpf-lineup .lineup-pitch::after { content:""; position:absolute; left:34%;
  width:32%; height:16%; border:3px solid rgba(255,255,255,.45); }
#gpf-lineup .lineup-pitch::before { top:-3px; border-top:0; }
#gpf-lineup .lineup-pitch::after { bottom:-3px; border-bottom:0; }
#gpf-lineup .player-card { position:absolute; pointer-events:auto; cursor:pointer; width:84px; min-height:104px;
  transform:translate(-50%,-50%); display:grid; grid-template-rows:auto auto 1fr auto; align-items:center;
  justify-items:center; padding:6px 5px; color:#1b1205; background:linear-gradient(160deg,#f8b752,#c66d28);
  border:2px solid rgba(255,255,255,.48); border-radius:9px; font-family:inherit; box-shadow:0 10px 18px rgba(0,0,0,.4); }
#gpf-lineup .player-card strong { justify-self:start; font-size:18px; font-weight:900; min-height:1px; }
#gpf-lineup .player-card span { justify-self:end; margin-top:-21px; padding:2px 4px; color:#fff;
  background:rgba(30,105,55,.92); border-radius:4px; font-size:10px; font-weight:900; }
#gpf-lineup .player-card b { align-self:end; max-width:100%; color:#fff; font-size:10px; text-align:center;
  text-shadow:0 2px 8px rgba(0,0,0,.55); }
#gpf-lineup .player-card-focused { outline:3px solid #6eff7c; z-index:5; }
#gpf-lineup .player-head { width:34px; height:34px; display:inline-flex; align-items:center; justify-content:center;
  color:#3a2a17; background:#d9b188; border:2px solid rgba(255,255,255,.72); border-radius:50%; font-size:11px;
  font-style:normal; font-weight:900; overflow:hidden; box-shadow:0 5px 10px rgba(0,0,0,.3); }
#gpf-lineup .player-head img { width:100%; height:100%; display:block; object-fit:cover; object-position:center 18%; }
#gpf-lineup .lineup-bench { min-height:0; display:grid; align-content:start; gap:9px; padding:12px;
  background:rgba(23,82,125,.72); border:2px solid rgba(255,255,255,.16); border-radius:8px; overflow:auto; }
#gpf-lineup .lineup-bench > span { color:#fff; font-size:14px; font-weight:900; letter-spacing:1px; }
#gpf-lineup .bench-card { pointer-events:auto; min-height:68px; display:grid; grid-template-columns:44px 40px 1fr;
  gap:2px 9px; align-items:center; padding:8px; color:#1b1205; background:linear-gradient(160deg,#f6a852,#c95b28);
  border:2px solid rgba(255,255,255,.42); border-radius:8px; font-family:inherit; text-align:left; }
#gpf-lineup .bench-card strong { grid-row:span 2; color:#fff; font-size:22px; text-shadow:0 2px 8px rgba(0,0,0,.55); }
#gpf-lineup .bench-card .player-head { grid-row:span 2; width:38px; height:38px; font-size:13px; }
#gpf-lineup .bench-card b { color:#fff; font-size:13px; }
#gpf-lineup .bench-card em { color:rgba(255,255,255,.75); font-style:normal; font-weight:900; }
#gpf-lineup .lineup-back { pointer-events:auto; cursor:pointer; min-height:42px; padding:0 16px; color:#fff;
  background:rgba(255,255,255,.12); border:2px solid rgba(255,255,255,.24); border-radius:6px; font-family:inherit;
  font-size:14px; font-weight:800; margin-right:auto; }
@media (max-width:900px){ #gpf-lineup .lineup-layout{ grid-template-columns:1fr; } #gpf-lineup .lineup-bench{ max-height:34vh; } }
`;

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((p) => p[0] || "").join("").toUpperCase();
}

let root: HTMLElement | null = null;
let pitchEl: HTMLElement | null = null;
let benchEl: HTMLElement | null = null;
let layoutEl: HTMLElement | null = null;
let titleEl: HTMLElement | null = null;
let startBtn: HTMLButtonElement | null = null;

const DEFAULT: LineupConfig = {
  teamName: "Manchester City", starters: XI, subs: BENCH,
  onPlay: () => { hideLineup(); startNativeMatch(); },
};

function render(cfg: LineupConfig): void {
  if (!pitchEl || !benchEl || !layoutEl || !titleEl || !startBtn) return;
  titleEl.textContent = cfg.teamName;
  pitchEl.innerHTML = "";
  for (const p of cfg.starters) {
    const c = document.createElement("button");
    c.className = "player-card" + (p.focus ? " player-card-focused" : "");
    c.style.left = `${p.x ?? 50}%`; c.style.top = `${p.y ?? 50}%`;
    const head = document.createElement("i");
    head.className = "player-head"; head.textContent = initials(p.name);
    c.innerHTML = `<strong>${p.rating ?? ""}</strong><span>${p.pos}</span>`;
    c.appendChild(head);
    const nm = document.createElement("b"); nm.textContent = p.name; c.appendChild(nm);
    pitchEl.appendChild(c);
  }
  const subs = cfg.subs ?? [];
  layoutEl.classList.toggle("no-bench", subs.length === 0);
  benchEl.innerHTML = `<span>Remplaçants</span>`;
  for (const p of subs) {
    const c = document.createElement("button");
    c.className = "bench-card";
    const head = document.createElement("i");
    head.className = "player-head"; head.textContent = initials(p.name);
    c.innerHTML = `<strong>${p.rating ?? ""}</strong>`;
    c.appendChild(head);
    c.insertAdjacentHTML("beforeend", `<b>${p.name}</b><em>${p.pos}</em>`);
    benchEl.appendChild(c);
  }
  startBtn.onclick = (): void => cfg.onPlay();
}

export function showLineup(cfg?: LineupConfig): void {
  render(cfg ?? DEFAULT);
  root?.classList.add("show");
  document.body.classList.add("gpf-lineup-open");
}
export function hideLineup(): void {
  root?.classList.remove("show");
  document.body.classList.remove("gpf-lineup-open");
}

export function initLineup(): void {
  const style = document.createElement("style");
  style.id = "gpf-lineup-style"; style.textContent = CSS;
  document.head.appendChild(style);

  root = document.createElement("div");
  root.id = "gpf-lineup";
  root.innerHTML = `
    <div class="menu-shell"><div class="lineup-panel">
      <div class="lineup-top">
        <button class="lineup-back">← Menu</button>
        <div style="text-align:center">
          <span class="lineup-team">Manchester City</span><b>Choisis tes joueurs avant le match</b>
        </div>
        <button class="lineup-start">Jouer le match</button>
      </div>
      <div class="lineup-layout">
        <div class="lineup-pitch" aria-label="Composition"></div>
        <div class="lineup-bench"><span>Remplaçants</span></div>
      </div>
    </div></div>`;

  pitchEl = root.querySelector<HTMLElement>(".lineup-pitch");
  benchEl = root.querySelector<HTMLElement>(".lineup-bench");
  layoutEl = root.querySelector<HTMLElement>(".lineup-layout");
  titleEl = root.querySelector<HTMLElement>(".lineup-team");
  startBtn = root.querySelector<HTMLButtonElement>(".lineup-start");
  root.querySelector(".lineup-back")!.addEventListener("click", () => { hideLineup(); showHome(); });

  document.body.appendChild(root);
}
