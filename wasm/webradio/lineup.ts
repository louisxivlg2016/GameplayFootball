/**
 * Pre-match lineup screen. Shows your XI on a 4-3-3 pitch + a "Remplaçants"
 * bench; click a player then another to SWAP them (starter↔starter or
 * starter↔sub). "Jouer le match" hands the chosen XI (in shirt order) to the
 * caller, which pushes it to the engine. Photos come from Wikipedia (search by
 * name + team), initials while they load / if none. Manchester City (with
 * ratings) is the MATCH AMICAL default; Club / National / DEFI pass a real
 * squad via teamLineup().
 */
import { startNativeMatch, show as showHome } from "./homemenu";
import { POS } from "./positions";
import { L, onLangChange } from "./i18n";

const prox = (u: string): string => `/img-proxy?u=${encodeURIComponent(u)}`;

export interface P { name: string; pos: string; raw?: string; rating?: number; hint?: string; year?: string; x?: number; y?: number; focus?: boolean }
export interface LineupConfig { teamName: string; starters: P[]; subs: P[]; onPlay: (names: string[]) => void }

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

// bench positions — the squads list subs GK→defenders→midfielders→forwards, so
// index maps to a plausible role (approximate; the real spot is taken from the
// starter it replaces on swap-in).
const SUB_POS = ["GB", "DC", "DG", "MC", "MC", "BU", "AD"];

// build a config from a full GK-first squad: first 11 = XI, rest = bench.
// year (DEFI) makes the cards use an era photo of the player when available.
export function teamLineup(teamName: string, squad: string[], hint: string, onPlay: (names: string[]) => void, year?: string): void {
  const starters: P[] = squad.slice(0, 11).map((n, i) => ({
    name: niceLabel(n), raw: n, pos: SLOTS[i]!.pos, x: SLOTS[i]!.x, y: SLOTS[i]!.y, hint, year,
  }));
  const subs: P[] = squad.slice(11).map((n, i) => ({ name: niceLabel(n), raw: n, pos: POS[n] ?? SUB_POS[i] ?? "REMP", hint, year }));
  showLineup({ teamName, starters, subs, onPlay });
}

// Manchester City screenshot XI (has real ratings + bench) — the MATCH AMICAL default
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
#gpf-lineup .lineup-top .lineup-team { display:block; color:#ffe94a; font-size:16px; font-weight:900; letter-spacing:.5px; }
#gpf-lineup .lineup-top small { display:block; color:rgba(255,255,255,.72); font-size:12px; font-weight:700; }
#gpf-lineup .lineup-start { pointer-events:auto; cursor:pointer; min-height:42px; padding:0 18px; color:#07100b;
  background:#ffe94a; border:2px solid #fff4a6; border-radius:6px; font-family:inherit; font-size:15px;
  font-weight:900; box-shadow:0 7px 0 #b58c12,0 12px 20px rgba(0,0,0,.38); }
#gpf-lineup .lineup-start:active { transform:translateY(3px); box-shadow:0 4px 0 #b58c12; }
#gpf-lineup .lineup-layout { min-height:0; display:grid; grid-template-columns:minmax(0,1fr) 320px; gap:14px; }
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
#gpf-lineup .sel { outline:3px solid #ffe94a !important; box-shadow:0 0 0 4px rgba(255,233,74,.35),0 10px 18px rgba(0,0,0,.4); z-index:6; }
#gpf-lineup .player-head { width:36px; height:36px; display:inline-flex; align-items:center; justify-content:center;
  color:#3a2a17; background:#d9b188; border:2px solid rgba(255,255,255,.72); border-radius:50%; font-size:11px;
  font-style:normal; font-weight:900; overflow:hidden; box-shadow:0 5px 10px rgba(0,0,0,.3); }
#gpf-lineup .player-head img { width:100%; height:100%; display:block; object-fit:cover; object-position:center 15%; }
#gpf-lineup .lineup-bench { min-height:0; display:grid; align-content:start; gap:9px; padding:12px;
  background:rgba(23,82,125,.72); border:2px solid rgba(255,255,255,.16); border-radius:8px; overflow:auto; }
#gpf-lineup .lineup-bench > span { color:#fff; font-size:14px; font-weight:900; letter-spacing:1px; }
#gpf-lineup .bench-card { pointer-events:auto; cursor:pointer; min-height:60px; display:grid; grid-template-columns:44px 1fr;
  gap:2px 9px; align-items:center; padding:8px; color:#1b1205; background:linear-gradient(160deg,#f6a852,#c95b28);
  border:2px solid rgba(255,255,255,.42); border-radius:8px; font-family:inherit; text-align:left; }
#gpf-lineup .bench-card .player-head { grid-row:span 2; width:40px; height:40px; font-size:13px; }
#gpf-lineup .bench-card b { color:#fff; font-size:14px; }
#gpf-lineup .bench-card em { color:rgba(255,255,255,.78); font-style:normal; font-weight:900; font-size:11px; }
#gpf-lineup .lineup-back { pointer-events:auto; cursor:pointer; min-height:42px; padding:0 16px; color:#fff;
  background:rgba(255,255,255,.12); border:2px solid rgba(255,255,255,.24); border-radius:6px; font-family:inherit;
  font-size:14px; font-weight:800; margin-right:auto; }
@media (max-width:900px){ #gpf-lineup .lineup-layout{ grid-template-columns:1fr; } #gpf-lineup .lineup-bench{ max-height:34vh; } }
`;

const photoCache = new Map<string, string>();
// Commons files that aren't a photo of the player himself
const JUNK = /collage|troph|museum|stadium|ballon|logo|coin|stamp|award|\.pdf|\.svg|champion|\bsquad\b|\bteam\b|banner|mural|graffiti|statue|\bwax\b|autograph|shirt|jersey|\bboot|panini|sticker|signature|memorial|funeral|grave|plaque/i;

// DEFI: an era photo of the player — Commons file whose title names BOTH the
// player and the year (so we never show a trophy, a collage or the wrong guy).
async function loadEraPhoto(p: P, head: HTMLElement): Promise<boolean> {
  if (!p.year) return false;
  const surname = (p.name.split(" ").pop() ?? p.name).toLowerCase();
  const key = `era:${p.name}:${p.year}`;
  if (photoCache.has(key)) { head.innerHTML = `<img src="${photoCache.get(key)}" alt="">`; return true; }
  try {
    const term = `${p.name} ${p.year} football`;
    const api = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(term)}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url&iiurlwidth=200&format=json&origin=*`;
    const data = await (await fetch(api)).json();
    const pages: Array<{ title?: string; imageinfo?: Array<{ thumburl?: string }> }> = Object.values(data?.query?.pages ?? {});
    for (const pg of pages) {
      const title = (pg.title ?? "").replace(/^File:/, "");
      const low = title.toLowerCase();
      const url = pg.imageinfo?.[0]?.thumburl;
      if (!url || JUNK.test(low)) continue;
      if (low.includes(surname) && low.includes(p.year)) {
        const u = prox(url); photoCache.set(key, u); head.innerHTML = `<img src="${u}" alt="">`; return true;
      }
    }
  } catch { /* fall through to the recent photo */ }
  return false;
}

async function loadPhoto(p: P, head: HTMLElement): Promise<void> {
  if (await loadEraPhoto(p, head)) return; // DEFI era photo when confidently found
  const term = `${p.name}${p.hint ? " " + p.hint : ""} footballer`;
  if (photoCache.has(term)) { head.innerHTML = `<img src="${photoCache.get(term)}" alt="">`; return; }
  try {
    // search for the best-matching page, then take its lead image
    const api = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(term)}&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=160&format=json&origin=*`;
    const data = await (await fetch(api)).json();
    const pages: Record<string, { thumbnail?: { source?: string } }> = data?.query?.pages ?? {};
    const src = Object.values(pages).find((q) => q?.thumbnail?.source)?.thumbnail?.source;
    if (src) { const u = prox(src); photoCache.set(term, u); head.innerHTML = `<img src="${u}" alt="">`; }
  } catch { /* keep initials fallback */ }
}
function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((p) => p[0] || "").join("").toUpperCase();
}

let root: HTMLElement | null = null;
let pitchEl: HTMLElement | null = null;
let benchEl: HTMLElement | null = null;
let titleEl: HTMLElement | null = null;
let startBtn: HTMLButtonElement | null = null;

let curStarters: P[] = [];
let curSubs: P[] = [];
let curPlay: (names: string[]) => void = () => { /* set on show */ };
let selected: P | null = null;

const DEFAULT: LineupConfig = {
  teamName: "Manchester City", starters: XI, subs: BENCH,
  onPlay: () => { hideLineup(); startNativeMatch(); },
};

// swap the player identity between two slots/bench entries (positions stay put)
function swap(a: P, b: P): void {
  const t = { name: a.name, raw: a.raw, rating: a.rating, hint: a.hint };
  a.name = b.name; a.raw = b.raw; a.rating = b.rating; a.hint = b.hint;
  b.name = t.name; b.raw = t.raw; b.rating = t.rating; b.hint = t.hint;
}
function onPick(p: P): void {
  if (selected === p) { selected = null; renderCards(); return; }
  if (!selected) { selected = p; renderCards(); return; }
  swap(selected, p);
  selected = null;
  renderCards();
}

function renderCards(): void {
  if (!pitchEl || !benchEl) return;
  pitchEl.innerHTML = "";
  for (const p of curStarters) {
    const c = document.createElement("button");
    c.className = "player-card" + (p.focus ? " player-card-focused" : "") + (selected === p ? " sel" : "");
    c.style.left = `${p.x ?? 50}%`; c.style.top = `${p.y ?? 50}%`;
    const head = document.createElement("i");
    head.className = "player-head"; head.textContent = initials(p.name);
    c.innerHTML = `<strong>${p.rating ?? ""}</strong><span>${p.pos}</span>`;
    c.appendChild(head);
    const nm = document.createElement("b"); nm.textContent = p.name; c.appendChild(nm);
    c.addEventListener("click", () => onPick(p));
    pitchEl.appendChild(c);
    void loadPhoto(p, head);
  }
  benchEl.innerHTML = `<span>${L("Remplaçants")}${curSubs.length ? " — clique un titulaire puis un remplaçant pour échanger" : ""}</span>`;
  for (const p of curSubs) {
    const c = document.createElement("button");
    c.className = "bench-card" + (selected === p ? " sel" : "");
    const head = document.createElement("i");
    head.className = "player-head"; head.textContent = initials(p.name);
    c.appendChild(head);
    c.insertAdjacentHTML("beforeend", `<b>${p.name}</b><em>${p.pos}</em>`);
    c.addEventListener("click", () => onPick(p));
    benchEl.appendChild(c);
    void loadPhoto(p, head);
  }
}

export function showLineup(cfg?: LineupConfig): void {
  const c = cfg ?? DEFAULT;
  if (titleEl) titleEl.textContent = c.teamName;
  curStarters = c.starters;
  curSubs = c.subs;
  curPlay = c.onPlay;
  selected = null;
  renderCards();
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
          <span class="lineup-team">Manchester City</span>
          <small>Choisis tes joueurs avant le match</small>
        </div>
        <button class="lineup-start">${L("Jouer le match")}</button>
      </div>
      <div class="lineup-layout">
        <div class="lineup-pitch" aria-label="${L("Composition")}"></div>
        <div class="lineup-bench"><span>${L("Remplaçants")}</span></div>
      </div>
    </div></div>`;

  pitchEl = root.querySelector<HTMLElement>(".lineup-pitch");
  benchEl = root.querySelector<HTMLElement>(".lineup-bench");
  titleEl = root.querySelector<HTMLElement>(".lineup-team");
  startBtn = root.querySelector<HTMLButtonElement>(".lineup-start");
  startBtn!.addEventListener("click", () => curPlay(curStarters.map((p) => p.raw ?? p.name)));
  root.querySelector(".lineup-back")!.addEventListener("click", () => { hideLineup(); showHome(); });

  document.body.appendChild(root);
}
