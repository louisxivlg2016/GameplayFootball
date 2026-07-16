/**
 * Full "GAMEPLAY FOOTBALL" home menu (a faithful static reproduction of the web
 * version's #52 screen) shown as a fullscreen overlay over the wasm game canvas.
 * Sidebar + title + player hero photos + 3 mode cards + players strip.
 * Clicking a mode card hides the menu and drives the native C++ game into a match.
 * The SON/RADIO STADE/LANGUE pills (menu.ts) stay pinned above this on top-right.
 *
 * CSS + DOM extracted verbatim from web/index.html + Hud.tsx (see MENU_SPEC.md).
 */
import { hideClubs, showClubs } from "./clubs";
import { hideLineup, showLineup } from "./lineup";
import { hideNational, showNational } from "./national";
import { hideTraining, showTraining } from "./training";
import { showSettings } from "./settings";
import { showDefi, hideDefi } from "./defi";
import { setAnthemOverride } from "./anthem";
import { resumeMenuMusic } from "./menu";
import { clearScoreFlags } from "./scoreflags";

const prox = (u: string): string => `/img-proxy?u=${encodeURIComponent(u)}`;
const PITCH_BG = prox(
  "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1600&q=80",
);
const LEGENDS = [
  "https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Erling_Haaland_Morocco_v_Norway_7_June_2026-51.jpg/500px-Erling_Haaland_Morocco_v_Norway_7_June_2026-51.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Kylian_Mbappe_France_v_Senegal_16_June_2026-391_%28cropped%29.jpg/500px-Kylian_Mbappe_France_v_Senegal_16_June_2026-391_%28cropped%29.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Cristiano_Ronaldo_2275_%28cropped%29.jpg/500px-Cristiano_Ronaldo_2275_%28cropped%29.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Lionel_Messi_NE_Revolution_Inter_Miami_7.9.25-178_%28cropped_2%29.jpg/500px-Lionel_Messi_NE_Revolution_Inter_Miami_7.9.25-178_%28cropped_2%29.jpg",
].map(prox);

const CSS = `
#gpf-home { position:fixed; inset:0; z-index:2147483000; color:#fff;
  font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif; }
#gpf-home .menu { position:absolute; inset:0; display:flex; flex-direction:column;
  align-items:center; justify-content:center; background:#06120b; overflow:hidden; }
#gpf-home .menu::before { content:""; position:absolute; inset:12px;
  border:2px solid rgba(255,255,255,.08); pointer-events:none; }
#gpf-home .menu-shell { width:min(1380px,calc(100vw - 32px)); max-height:calc(100vh - 24px);
  min-height:calc(100vh - 32px); pointer-events:auto; display:flex; flex-direction:column;
  align-items:center; gap:14px; padding:28px 44px 28px 12px;
  background:linear-gradient(180deg,rgba(5,22,15,.18),rgba(5,22,15,.62)),
    url("${PITCH_BG}") center 48% / cover;
  border:2px solid rgba(255,255,255,.14); border-radius:6px;
  box-shadow:0 20px 48px rgba(0,0,0,.45); box-sizing:border-box; position:relative; overflow:hidden; }
#gpf-home .menu-shell::before { content:""; position:absolute; inset:0;
  background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(2,8,7,.34)),
    radial-gradient(circle at 50% 24%,rgba(255,233,74,.18),transparent 28%); pointer-events:none; }
#gpf-home .menu-shell > * { position:relative; z-index:1; }
#gpf-home .menu-layout { width:100%; min-height:0; flex:1; display:grid;
  grid-template-columns:86px minmax(0,1fr); gap:12px; }
#gpf-home .menu-sidebar { min-height:100%; display:grid; align-content:start; gap:0;
  background:linear-gradient(180deg,rgba(4,18,10,.94),rgba(2,10,8,.96));
  border:1px solid rgba(255,255,255,.08); border-radius:10px; overflow:hidden;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.04),0 18px 26px rgba(0,0,0,.35); }
#gpf-home .menu-sidebar-button { pointer-events:auto; cursor:pointer; min-height:92px; display:grid;
  justify-items:center; align-content:center; gap:7px; color:#fff; background:transparent; border:0;
  border-bottom:1px solid rgba(255,255,255,.08); font-family:inherit; font-size:12px; font-weight:900; text-align:center; }
#gpf-home .menu-sidebar-button.active { background:linear-gradient(180deg,#ff1c67,#d71753); }
#gpf-home .menu-sidebar-icon { width:34px; height:34px; display:grid; place-items:center;
  background:rgba(255,255,255,.12); border-radius:8px; font-size:22px; line-height:1; }
#gpf-home .menu-sidebar-button.active .menu-sidebar-icon { background:rgba(255,255,255,.18); }
#gpf-home .menu-sidebar-button b { font-size:10px; letter-spacing:.9px; text-transform:uppercase; }
#gpf-home .menu-content { position:relative; min-width:0; min-height:0; display:flex;
  flex-direction:column; gap:14px; overflow:hidden; }
#gpf-home .menu-title-row { display:grid; grid-template-columns:minmax(0,1fr); align-items:center; gap:18px; width:100%; }
#gpf-home h1 { font-size:clamp(32px,5vw,58px); font-weight:900; color:#fff; letter-spacing:2px;
  margin:0; text-align:center; text-shadow:0 4px 24px rgba(0,0,0,.9); }
#gpf-home h1 span { color:#ffe94a; }
#gpf-home .menu-hero-legends { position:absolute; inset:92px 80px auto 80px; z-index:0; width:auto;
  height:430px; display:grid; grid-template-columns:.98fr 1.18fr 1.1fr 1fr; gap:clamp(14px,2.1vw,34px);
  align-items:end; opacity:.98; pointer-events:none; }
#gpf-home .legend-card { min-height:430px; overflow:hidden; display:grid; grid-template-rows:1fr auto; place-items:center;
  border-radius:44% 44% 18px 18px / 24% 24% 18px 18px;
  -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 10%,#000 90%,transparent 100%),linear-gradient(180deg,#000 0,#000 82%,transparent 100%);
  -webkit-mask-composite:source-in;
  mask-image:linear-gradient(90deg,transparent 0,#000 10%,#000 90%,transparent 100%),linear-gradient(180deg,#000 0,#000 82%,transparent 100%);
  mask-composite:intersect; }
#gpf-home .legend-photo { width:100%; height:430px; object-fit:cover; object-position:center 6%;
  filter:saturate(1.1) contrast(1.06) drop-shadow(0 24px 18px rgba(0,0,0,.42)); }
#gpf-home .menu-hero-legends .legend-card:nth-child(1){ transform:translateX(16px) translateY(10px) scale(1.04); z-index:1; }
#gpf-home .menu-hero-legends .legend-card:nth-child(2){ transform:translateX(-2px) translateY(-18px) scale(1.12); z-index:3; }
#gpf-home .menu-hero-legends .legend-card:nth-child(3){ transform:translateX(2px) translateY(0) scale(1.08); z-index:2; }
#gpf-home .menu-hero-legends .legend-card:nth-child(4){ transform:translateX(-16px) translateY(8px) scale(1.04); z-index:1; }
#gpf-home .menu-main-actions { width:100%; display:grid; grid-template-columns:repeat(3,minmax(0,1fr));
  gap:12px; z-index:2; margin-top:auto; margin-bottom:0; transform:translateY(200px); }
#gpf-home .menu-mode-button { pointer-events:auto; cursor:pointer; min-height:148px; padding:0; position:relative;
  display:grid; place-items:center; text-align:left; color:#fff; background:transparent; border:0; overflow:hidden;
  font-family:inherit; }
#gpf-home .menu-mode-button img { width:100%; height:100%; object-fit:contain; display:block;
  filter:drop-shadow(0 16px 20px rgba(0,0,0,.34)); }
#gpf-home .menu-main-actions .menu-mode-button:nth-child(3) img { width:74%; height:74%; justify-self:center; align-self:center; }
#gpf-home .menu-mode-button:active { transform:translateY(3px); }
#gpf-home .image-mode-caption,#gpf-home .image-mode-note { position:absolute; left:18px; right:18px;
  text-align:left; color:#fff; text-shadow:0 3px 12px rgba(0,0,0,.7); pointer-events:none; }
#gpf-home .image-mode-caption { bottom:20px; font-size:clamp(20px,2vw,28px); font-weight:900; line-height:.95; }
#gpf-home .image-mode-note { bottom:4px; font-size:12px; font-weight:800; opacity:.92; }
#gpf-home .home-settings-strip { margin-top:auto; display:grid; grid-template-columns:1fr; gap:12px; z-index:3; }
#gpf-home .menu-option { pointer-events:auto; cursor:pointer; min-height:64px; display:grid;
  grid-template-columns:38px 1fr; align-items:center; gap:8px 12px; padding:12px; text-align:left; color:#fff;
  background:rgba(5,18,12,.72); backdrop-filter:blur(4px); border:2px solid rgba(255,255,255,.16);
  border-left-width:8px; border-left-color:#4ad2ff; border-radius:4px; font-family:inherit; font-size:15px; font-weight:800; }
#gpf-home .menu-option:hover { background:rgba(255,255,255,.13); }
#gpf-home .menu-key { grid-row:span 2; width:34px; height:34px; display:inline-flex; align-items:center;
  justify-content:center; background:#111b16; border:2px solid rgba(255,255,255,.26); border-radius:4px; color:#fff; font-weight:900; }
#gpf-home .menu-option-label { color:#b7c9ba; font-size:12px; text-transform:uppercase; letter-spacing:1px; }
#gpf-home .menu-choice-line { grid-column:2; display:flex; align-items:center; flex-wrap:wrap; gap:4px 8px; }
#gpf-home .active-choice { color:#fff; margin-right:8px; }
#gpf-home .yellow-choice { color:#ffe94a; }
#gpf-home .muted-choice { color:#8fa094; opacity:.72; margin-right:8px; }
#gpf-home .gpf-hint { position:absolute; bottom:14px; left:0; right:0; text-align:center; z-index:4;
  color:rgba(255,255,255,.66); font-size:13px; font-weight:700; text-shadow:0 2px 8px rgba(0,0,0,.8); }
#gpf-home.hidden { display:none; }
@media (max-height:820px){ #gpf-home .menu-hero-legends{ height:340px; inset:70px 80px auto 80px; }
  #gpf-home .legend-card,#gpf-home .legend-photo{ min-height:340px; height:340px; }
  #gpf-home .menu-main-actions{ transform:translateY(150px); } }
`;

let root: HTMLElement | null = null;
let driveTimer: number | null = null;

/** Tap Enter on the native menu via the C++ SDL hook (synthetic DOM key events
 *  don't reach emscripten/SDL, so we push a real SDL Enter from C++). */
function pressEnter(): void {
  const M = (window as unknown as { Module?: { _gpf_menu_key?: (d: number) => void } }).Module;
  if (M?._gpf_menu_key) {
    M._gpf_menu_key(1);
    window.setTimeout(() => { try { M._gpf_menu_key!(0); } catch { /* gone */ } }, 130);
  }
}

/** Hide the menu overlays and reveal the native C++ menu so the player picks
 *  teams etc. Only when ?debug-skip-all=1 do we auto-drive Enter through the
 *  native menu to skip all selection (used for quick testing). A pending drill
 *  still fires once the match actually starts (onMatchStarted), whichever way
 *  the match was started. */
export function startNativeMatch(): void {
  hide();
  hideLineup();

  // We select teams from the HTML menus (Club / National / Lineup), so drive the
  // native menu straight through its competition/team-select pages into the
  // match — the player never sees the native selection screen.
  // hammer Enter through the native menu until the match is created; the
  // gpfRadioReset hook (match start) clears this timer.
  let taps = 0;
  const tap = (): void => {
    pressEnter();
    if (++taps > 20 && driveTimer !== null) { clearInterval(driveTimer); driveTimer = null; }
  };
  if (driveTimer !== null) clearInterval(driveTimer);
  driveTimer = window.setInterval(tap, 1100);
  tap();
}

// a training drill (e_SetPiece value) to force once the match is up, or 0 = none
let pendingDrill = 0;
let pendingKeeper = false;
// true from picking a training tile until the drill session ends — the anthem
// ceremony is skipped for drills (see anthem.ts gpfCeremonyWanted)
let drillSession = false;
export function isDrillSession(): boolean { return drillSession; }
export function setPendingDrill(setPiece: number): void { pendingDrill = setPiece; pendingKeeper = false; drillSession = true; }
export function setPendingKeeper(): void { pendingKeeper = true; pendingDrill = 0; drillSession = true; }
// DEFI: a real match (keep the touch controls + instant replay) that just skips
// the anthem and fires the challenge once live. It must NOT reuse drillSession,
// or it would hide the touch buttons/replay — and a stale drillSession would then
// poison every later match too.
let challengeSession = false;
export function isChallengeSession(): boolean { return challengeSession; }
let pendingChallenge = false;
export function setPendingChallenge(): void { pendingChallenge = true; challengeSession = true; }
export function endChallengeSession(): void { challengeSession = false; pendingChallenge = false; }
function fireDrill(sp: number): void {
  const M = (window as unknown as { Module?: { _gpf_start_drill?: (n: number) => void } }).Module;
  M?._gpf_start_drill?.(sp);
}
function fireKeeper(): void {
  const M = (window as unknown as { Module?: { _gpf_start_keeper_drill?: () => void } }).Module;
  M?._gpf_start_keeper_drill?.();
}
// the C++ referee calls this when a drill session's reps are all done -> menu
(window as unknown as { gpfDrillDone?: () => void }).gpfDrillDone = (): void => { drillSession = false; show(); };

/** Called (via the wrapped gpfRadioReset) when a match actually starts. */
export function onMatchStarted(): void {
  if (driveTimer !== null) { clearInterval(driveTimer); driveTimer = null; }
  hide();
  hideLineup();
  hideTraining();
  hideClubs();
  hideNational();
  hideDefi();
  if (pendingKeeper) {
    pendingKeeper = false;
    // let the match settle, then start the keeper drill (bot takes penalties).
    window.setTimeout(() => fireKeeper(), 3000);
  } else if (pendingDrill) {
    const sp = pendingDrill;
    pendingDrill = 0;
    // let the match kick off + settle, then start the drill session. The C++
    // referee then re-forces the same set piece 10x and calls window.gpfDrillDone.
    window.setTimeout(() => fireDrill(sp), 3000);
  } else if (pendingChallenge) {
    pendingChallenge = false;
    // let the match kick off, then the DEFI panel arms the challenge (score/clock)
    window.setTimeout(() => { (window as unknown as { __gpfFireChallenge?: () => void }).__gpfFireChallenge?.(); }, 3200);
  }
}

export function hide(): void { root?.classList.add("hidden"); }
export function show(): void {
  root?.classList.remove("hidden"); resumeMenuMusic(); clearScoreFlags();
  setAnthemOverride(null, null); // don't leak a picked team name into a plain match
}

function iconBtn(icon: string, label: string, active: boolean, onClick?: () => void): HTMLElement {
  const b = document.createElement("button");
  b.className = "menu-sidebar-button" + (active ? " active" : "");
  const s = document.createElement("span");
  s.className = "menu-sidebar-icon"; s.textContent = icon;
  const t = document.createElement("b"); t.textContent = label;
  b.append(s, t);
  if (onClick) b.addEventListener("click", onClick);
  return b;
}

/** Sidebar button whose icon is an image (used for the golden SETTINGS button). */
function imgBtn(src: string, label: string, onClick?: () => void): HTMLElement {
  const b = document.createElement("button");
  b.className = "menu-sidebar-button";
  const s = document.createElement("span");
  s.className = "menu-sidebar-icon"; s.style.background = "transparent"; s.style.borderRadius = "6px";
  const im = document.createElement("img");
  im.src = src; im.alt = label;
  im.style.cssText = "width:100%;height:100%;object-fit:contain;border-radius:6px";
  s.appendChild(im);
  const t = document.createElement("b"); t.textContent = label;
  b.append(s, t);
  if (onClick) b.addEventListener("click", onClick);
  return b;
}

function card(img: string, label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = "menu-mode-button";
  b.title = label;
  const im = document.createElement("img"); im.src = img; im.alt = label;
  b.append(im); // the card art (PNG) already carries its own baked-in text
  b.addEventListener("click", onClick);
  return b;
}

export function initHomeMenu(): void {
  const style = document.createElement("style");
  style.id = "gpf-home-style"; style.textContent = CSS;
  document.head.appendChild(style);

  root = document.createElement("div");
  root.id = "gpf-home";
  root.innerHTML = `
    <div class="menu"><div class="menu-shell">
      <div class="menu-layout">
        <aside class="menu-sidebar"></aside>
        <div class="menu-content">
          <div class="menu-hero-legends" aria-hidden="true">
            ${LEGENDS.map((u) => `<div class="legend-card"><img class="legend-photo" src="${u}" alt=""></div>`).join("")}
          </div>
          <div class="menu-title-row"><h1>GAMEPLAY <span>FOOTBALL</span></h1></div>
          <div class="menu-main-actions"></div>
          <div class="home-settings-strip"></div>
        </div>
      </div>
      <div class="gpf-hint">Clique sur une carte pour lancer le match</div>
    </div></div>`;

  const sidebar = root.querySelector(".menu-sidebar")!;
  sidebar.append(
    iconBtn("⌂", "Main", true), iconBtn("◎", "Club", false, showClubs),
    iconBtn("◔", "National", false, showNational), iconBtn("◌", "Defi", false, showDefi),
    imgBtn("/menu-assets/settings-button.png", "Settings", showSettings),
  );

  const actions = root.querySelector(".menu-main-actions")!;
  actions.append(
    card("/menu-assets/play-button.png", "Match amical", () => showLineup()),
    card("/menu-assets/training-button.png", "Entraînement", showTraining),
    card("/menu-assets/worldcup-button.png", "Coupe du monde", startNativeMatch),
  );

  const strip = root.querySelector(".home-settings-strip")!;
  let players = 1;
  const opt = document.createElement("button");
  opt.className = "menu-option";
  const render = (): void => {
    opt.innerHTML =
      `<span class="menu-key">J</span>` +
      `<span class="menu-option-label">Joueurs</span>` +
      `<span class="menu-choice-line">` +
      `<span class="${players === 1 ? "active-choice yellow-choice" : "muted-choice"}">1 JOUEUR</span>` +
      `<span class="${players === 2 ? "active-choice yellow-choice" : "muted-choice"}">2 JOUEURS</span>` +
      `</span>`;
  };
  render();
  opt.addEventListener("click", () => { players = players === 1 ? 2 : 1; render(); });
  strip.append(opt);

  document.body.appendChild(root);
}
