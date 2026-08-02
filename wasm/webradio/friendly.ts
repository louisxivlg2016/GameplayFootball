/**
 * "MATCH AMICAL" — a VS pre-match screen (mobile-football style): your nation on
 * the left, the opponent on the right, each with a flag, an OVR rating, the team
 * name and a full-body captain figure in the kit colours. A button on each side
 * opens the full country grid to change the nation; the big PLAY button kicks off
 * the match. Replaces the bare "pick a lineup" screen for a friendly.
 */
import { startNativeMatch, show as showHome } from "./homemenu";
import { showLoading } from "./loading";
import { radioEnabled, radioVoicePhase, warmupRadioVoice } from "./radioEngine";
import { setAnthemOverride } from "./anthem";
import { setScoreFlags } from "./scoreflags";
import { applyMatchSquads, SQUADS, kitColor, skinsFor } from "./squads";
import { teamLineup } from "./lineup";
import { showSettings } from "./settings";
import { CONFEDS, flagImg, isoCode, type Nation, type Confed } from "./national";

const ALL: Nation[] = CONFEDS.flatMap((c) => c.teams);
const byName = (n: string): Nation | undefined => ALL.find((x) => x.name === n);

// hand-set OVR for the well-known sides; a stable 76..83 hash for the rest so
// every nation shows a plausible rating.
const OVR: Record<string, number> = {
  France: 85, Argentine: 85, Espagne: 84, Angleterre: 84, "Brésil": 84, Bresil: 84,
  Portugal: 84, Allemagne: 83, "Pays-Bas": 83, Italie: 82, Belgique: 82, Croatie: 81,
  Uruguay: 81, Maroc: 80, Suisse: 79, Danemark: 79, Colombie: 80, "États-Unis": 78,
};
function ratingOf(n: Nation): number {
  if (OVR[n.name] != null) return OVR[n.name]!;
  let h = 0; for (const c of n.name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return 76 + (h % 8);
}
// "Force réaliste" mode (Réglages › Gameplay toggle): when on, each side plays at
// its real level — map the shown OVR (~76..85) to a stat multiplier. Centered on
// an average side (OVR 82 -> x1.0, unchanged); the top nations get a real BOOST
// above normal (85 -> x1.15) so a great team feels genuinely fast and superior,
// while weaker ones drop (76 -> x0.70). Off -> 1.0 for both (no effect). The C++
// bridge clamps to [0.1, 1.5]. Persisted under the same LS key as the toggle.
const REALISTIC_LS = "gpf-realistic";
function realisticOn(): boolean {
  try { return localStorage.getItem(REALISTIC_LS) === "1"; } catch { return false; }
}
function strengthFromOvr(ovr: number): number {
  const s = 1.0 + (ovr - 82) * 0.05; // 82 -> 1.0, 85 -> 1.15, 78 -> 0.80, 76 -> 0.70
  return Math.max(0.60, Math.min(1.20, s));
}
// explicit captain names for nations where we override the figure with a real
// photo (so the name matches the person shown).
const CAPTAIN_NAME: Record<string, string> = { Argentine: "Messi" };
// "MBAPPE" / "N.WILLIAMS" -> "Mbappe" / "Williams" (the star = the #10-ish slot)
function captainName(n: Nation): string {
  if (CAPTAIN_NAME[n.name]) return CAPTAIN_NAME[n.name]!;
  const sq = SQUADS[n.name];
  const raw = sq && sq.length ? (sq[9] ?? sq[sq.length - 1] ?? "") : "";
  const parts = raw.split(".").map((t) => t.trim()).filter((t) => t.length > 1)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
  return parts.length ? parts.join(" ") : "";
}

// the figure shown on each side: the kit silhouette as a base, with a real
// full-body captain photo layered on top when one exists. Photos live in
// wasm/captains/<iso>.png (served at /captains/<iso>.png) — just drop a file in
// and it's used automatically; if there's none the request 404s, onerror strips
// the <img>, and the silhouette shows through. No code change per country.
function captainFigure(n: Nation, kit: string, num: number): string {
  return `<div class="fr-figwrap">${playerSVG(kit, num)}` +
    `<img class="fr-photo" src="/captains/${n.iso}.png" alt="" onerror="this.remove()"></div>`;
}

// full-body footballer figure in the kit colour + a shirt number. Not a photo —
// a clean standing silhouette that always renders (no asset to fetch).
function playerSVG(kit: string, num: number): string {
  const shorts = "#f2f2f2", skin = "#caa07a", sock = kit, boot = "#1a1a1a";
  return `<svg viewBox="0 0 120 300" width="100%" height="100%" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
    <g>
      <ellipse cx="60" cy="292" rx="40" ry="8" fill="rgba(0,0,0,.35)"/>
      <circle cx="60" cy="34" r="20" fill="${skin}"/>
      <path d="M40 30 a20 20 0 0 1 40 0 v-4 a20 20 0 0 0 -40 0 z" fill="#2b2b2b"/>
      <rect x="52" y="52" width="16" height="14" rx="6" fill="${skin}"/>
      <path d="M34 74 q26 -14 52 0 l8 60 q-34 12 -68 0 z" fill="${kit}"/>
      <path d="M34 74 l-14 54 l14 6 l12 -50 z" fill="${kit}"/>
      <path d="M86 74 l14 54 l-14 6 l-12 -50 z" fill="${kit}"/>
      <circle cx="18" cy="132" r="7" fill="${skin}"/><circle cx="102" cy="132" r="7" fill="${skin}"/>
      <path d="M28 132 q32 16 64 0 l6 34 q-38 14 -76 0 z" fill="${shorts}"/>
      <rect x="34" y="162" width="22" height="86" rx="10" fill="${skin}"/>
      <rect x="64" y="162" width="22" height="86" rx="10" fill="${skin}"/>
      <rect x="34" y="240" width="22" height="34" rx="8" fill="${sock}"/>
      <rect x="64" y="240" width="22" height="34" rx="8" fill="${sock}"/>
      <rect x="30" y="272" width="30" height="14" rx="6" fill="${boot}"/>
      <rect x="60" y="272" width="30" height="14" rx="6" fill="${boot}"/>
      <text x="60" y="112" text-anchor="middle" font-family="Arial" font-weight="900"
            font-size="30" fill="rgba(255,255,255,.92)">${num}</text>
    </g>
  </svg>`;
}

const CSS = `
#gpf-friendly { position:fixed; inset:0; z-index:2147483100; display:none; color:#fff;
  font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif;
  background:radial-gradient(120% 90% at 50% 0%,#2a3138,#12161b 60%,#0a0d10); }
#gpf-friendly.show { display:block; }
body.gpf-friendly-open #gpf-home, body.gpf-friendly-open #gpf-menu { display:none !important; }
#gpf-friendly .fr-shell { position:absolute; inset:0; display:grid;
  grid-template-columns:minmax(120px,1fr) minmax(320px,2fr) minmax(120px,1fr);
  align-items:center; padding:18px; box-sizing:border-box; gap:8px; }
#gpf-friendly .fr-gear { position:absolute; top:18px; right:18px; z-index:3; pointer-events:auto; cursor:pointer;
  width:46px; height:46px; border-radius:12px; border:1px solid rgba(255,255,255,.2); background:#171b20;
  color:#fff; font-size:20px; }
#gpf-friendly .fr-player { align-self:end; height:min(72vh,560px); display:flex; flex-direction:column;
  align-items:center; justify-content:flex-end; min-width:0; }
#gpf-friendly .fr-player .fr-figure { flex:1; min-height:0; width:100%; display:flex; align-items:flex-end; justify-content:center; }
#gpf-friendly .fr-figwrap { position:relative; height:100%; width:100%; display:flex; align-items:flex-end; justify-content:center; }
#gpf-friendly .fr-figwrap svg { max-height:100%; }
#gpf-friendly .fr-photo { position:absolute; inset:0; margin:auto; height:100%; max-width:100%; object-fit:contain;
  object-position:bottom; filter:drop-shadow(0 12px 24px rgba(0,0,0,.55)); }
#gpf-friendly .fr-player .fr-cap { margin-top:6px; font-weight:900; font-size:15px; text-align:center;
  text-shadow:0 2px 6px rgba(0,0,0,.6); }
#gpf-friendly .fr-center { align-self:center; background:linear-gradient(180deg,rgba(10,20,15,.75),rgba(5,10,8,.85));
  border:1px solid rgba(255,255,255,.14); border-radius:16px; padding:22px 20px; box-shadow:0 24px 60px rgba(0,0,0,.5); }
#gpf-friendly .fr-title { text-align:center; font-size:26px; font-weight:900; letter-spacing:1px; margin-bottom:16px; }
#gpf-friendly .fr-vs { display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:16px; }
#gpf-friendly .fr-side { display:flex; flex-direction:column; align-items:center; gap:8px; }
#gpf-friendly .fr-flagwrap { position:relative; }
#gpf-friendly .fr-flag { width:96px; height:64px; object-fit:cover; border-radius:8px; box-shadow:0 6px 16px rgba(0,0,0,.5);
  border:1px solid rgba(255,255,255,.25); background:#333; }
#gpf-friendly .fr-ovr { position:absolute; top:-14px; right:-14px; min-width:40px; padding:4px 6px; text-align:center;
  background:#fff; color:#111; border-radius:8px; font-weight:900; line-height:1; box-shadow:0 4px 10px rgba(0,0,0,.4); }
#gpf-friendly .fr-ovr small { display:block; font-size:8px; letter-spacing:1px; color:#666; }
#gpf-friendly .fr-name { font-weight:900; font-size:18px; }
#gpf-friendly .fr-bar { width:100%; height:5px; border-radius:3px; }
#gpf-friendly .fr-change { pointer-events:auto; cursor:pointer; min-height:34px; padding:0 14px; border-radius:8px;
  border:1px solid rgba(255,255,255,.22); background:rgba(255,255,255,.1); color:#fff; font:900 12px inherit; }
#gpf-friendly .fr-mid { display:flex; flex-direction:column; align-items:center; gap:8px; }
#gpf-friendly .fr-vslabel { font-size:38px; font-weight:900; color:#fff; text-shadow:0 3px 10px rgba(0,0,0,.6); }
#gpf-friendly .fr-stadium { margin-top:16px; text-align:center; color:#cfd8d3; font-weight:800; font-size:14px; }
#gpf-friendly .fr-back { position:absolute; left:22px; bottom:22px; pointer-events:auto; cursor:pointer;
  width:64px; height:52px; border-radius:12px; border:1px solid rgba(255,255,255,.18); background:#171b20;
  color:#fff; font-size:22px; font-weight:900; }
#gpf-friendly .fr-play { position:absolute; right:22px; bottom:22px; pointer-events:auto; cursor:pointer;
  min-width:120px; height:56px; padding:0 26px; border-radius:14px; border:none;
  background:linear-gradient(180deg,#ff2e63,#d81b52); color:#fff; font:900 17px inherit; letter-spacing:1px;
  box-shadow:0 10px 26px rgba(216,27,82,.5); }

/* country picker */
#gpf-fr-pick { position:fixed; inset:0; z-index:2147483110; display:none; color:#fff;
  font-family:"Segoe UI",Arial,sans-serif; }
#gpf-fr-pick.show { display:block; }
#gpf-fr-pick .pk-shell { position:absolute; inset:12px; display:flex; flex-direction:column; gap:12px;
  padding:18px 22px; box-sizing:border-box; background:linear-gradient(180deg,#0a1f16,#050f0b);
  border:2px solid rgba(255,255,255,.14); border-radius:8px; }
#gpf-fr-pick .pk-head { display:flex; align-items:center; justify-content:space-between; padding:10px 12px;
  background:rgba(0,0,0,.28); border:2px solid rgba(255,255,255,.14); border-radius:6px; }
#gpf-fr-pick .pk-head b { color:#ffe94a; letter-spacing:1px; }
#gpf-fr-pick .pk-back { pointer-events:auto; cursor:pointer; min-height:36px; padding:0 14px; color:#fff;
  background:rgba(255,255,255,.12); border:2px solid rgba(255,255,255,.24); border-radius:6px; font:800 13px inherit; }
#gpf-fr-pick .pk-tabs { display:flex; flex-wrap:wrap; gap:8px; }
#gpf-fr-pick .pk-tab { pointer-events:auto; cursor:pointer; min-height:34px; padding:0 13px; color:#dfe9e2;
  background:rgba(5,18,12,.72); border:1px solid rgba(255,255,255,.16); border-radius:999px; font:900 12px inherit; }
#gpf-fr-pick .pk-tab.active { color:#08120c; background:#ffe94a; border-color:#fff3a6; }
#gpf-fr-pick .pk-grid { flex:1; min-height:0; overflow-y:auto; display:grid;
  grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); gap:10px; padding-right:4px; }
#gpf-fr-pick .pk-card { pointer-events:auto; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:6px;
  padding:12px 8px; background:rgba(5,18,12,.72); border:1px solid rgba(255,255,255,.12); border-top:3px solid var(--c);
  border-radius:10px; color:#fff; font:800 12px inherit; }
#gpf-fr-pick .pk-card img { width:52px; height:35px; object-fit:cover; border-radius:5px; border:1px solid rgba(255,255,255,.25); }
`;

let root: HTMLElement | null = null;
let pick: HTMLElement | null = null;
let home: Nation = byName("France") ?? ALL[0]!;
let away: Nation = byName("Espagne") ?? ALL[1]!;
const STADIUMS = ["Stade Sky", "Arena Nova", "Grand Stade", "Estadio Central", "Parc des Sports"];
let stadium = STADIUMS[0]!;

export function showFriendly(): void {
  if (!root) return;
  root.classList.add("show");
  document.body.classList.add("gpf-friendly-open");
  render();
}
function hideFriendly(): void {
  if (root) root.classList.remove("show");
  document.body.classList.remove("gpf-friendly-open");
}

function sideHTML(n: Nation, cls: string): string {
  const kit = kitColor(n.name, n.color);
  return `<div class="fr-side ${cls}">
    <div class="fr-flagwrap">
      <img class="fr-flag" src="${flagImg(n.iso)}" alt="${n.name}"
           onerror="this.style.display='none'">
      <div class="fr-ovr">${ratingOf(n)}<small>OVR</small></div>
    </div>
    <div class="fr-name">${n.name}</div>
    <div class="fr-bar" style="background:${kit}"></div>
    <button class="fr-change" data-side="${cls}">Changer le pays</button>
  </div>`;
}

function render(): void {
  if (!root) return;
  const body = root.querySelector(".fr-shell");
  if (!body) return;
  const hk = kitColor(home.name, home.color), ak = kitColor(away.name, away.color);
  body.innerHTML = `
    <div class="fr-player fr-left">
      <div class="fr-figure">${captainFigure(home, hk, 10)}</div>
      <div class="fr-cap">${captainName(home) || home.name}</div>
    </div>
    <div class="fr-center">
      <div class="fr-title">Match amical</div>
      <div class="fr-vs">
        ${sideHTML(home, "home")}
        <div class="fr-mid"><div class="fr-vslabel">VS</div></div>
        ${sideHTML(away, "away")}
      </div>
      <div class="fr-stadium">🏟️ ${stadium}</div>
    </div>
    <div class="fr-player fr-right">
      <div class="fr-figure">${captainFigure(away, ak, 9)}</div>
      <div class="fr-cap">${captainName(away) || away.name}</div>
    </div>`;
  body.querySelectorAll<HTMLElement>(".fr-change").forEach((b) =>
    b.addEventListener("click", () => openPick(b.dataset.side === "home" ? "home" : "away")));
}

function launch(): void {
  const homeSquad = SQUADS[home.name] || [];
  // like Club / National: pick your XI first (compo), then kick off. The lineup
  // may reorder players, so remap each chosen name back to its real skin tone.
  const play = (homeNames: string[]): void => {
    setAnthemOverride(home.name, away.name);
    setScoreFlags(
      { img: flagImg(home.iso), emoji: home.flag, code: isoCode(home.iso) },
      { img: flagImg(away.iso), emoji: away.flag, code: isoCode(away.iso) },
    );
    const hs = skinsFor(home.name);
    const homeSkins = hs ? homeNames.map((n) => { const i = homeSquad.indexOf(n); return i >= 0 ? (hs[i] ?? 0) : 0; }) : undefined;
    const real = realisticOn();
    const homeStr = real ? strengthFromOvr(ratingOf(home)) : 1;
    const awayStr = real ? strengthFromOvr(ratingOf(away)) : 1;
    applyMatchSquads(
      { color: kitColor(home.name, home.color), names: homeNames, skins: homeSkins, strength: homeStr },
      { color: kitColor(away.name, away.color), names: SQUADS[away.name] || [], skins: skinsFor(away.name), strength: awayStr },
    );
    void startWithRadioReady();
  };
  hideFriendly();
  if (homeSquad.length) teamLineup(`${home.flag} ${home.name}`, homeSquad, home.name, play);
  else play(homeSquad);
}

// Radio from the very first whistle: if the ~63MB neural commentator voice is
// still downloading (only ever the FIRST match — it's cached afterwards), hold on
// the loading screen until it's ready before kicking off, so the commentary is
// live from kickoff instead of joining a minute in. Capped so a slow/failed voice
// never blocks the match forever; skipped entirely when the radio is off or the
// voice is already loaded (instant on every later match).
async function startWithRadioReady(): Promise<void> {
  if (radioEnabled() && radioVoicePhase() === "loading") {
    warmupRadioVoice();          // make sure it's actively downloading
    showLoading();               // cover the wait with the loading slideshow
    const t0 = Date.now();
    const CAP_MS = 45000;
    while (radioVoicePhase() === "loading" && Date.now() - t0 < CAP_MS) {
      await new Promise((r) => window.setTimeout(r, 500));
    }
  }
  startNativeMatch();
}

// ---- country picker --------------------------------------------------------
let pickTarget: "home" | "away" = "home";
function openPick(target: "home" | "away"): void {
  pickTarget = target;
  if (!pick) return;
  pick.classList.add("show");
  renderPick(CONFEDS[0]!);
}
function closePick(): void { if (pick) pick.classList.remove("show"); }
function renderPick(conf: Confed): void {
  if (!pick) return;
  pick.querySelectorAll<HTMLElement>(".pk-tab").forEach((t) =>
    t.classList.toggle("active", t.dataset.id === conf.id));
  const grid = pick.querySelector<HTMLElement>(".pk-grid");
  if (!grid) return;
  grid.innerHTML = "";
  for (const nat of conf.teams) {
    const card = document.createElement("button");
    card.className = "pk-card";
    card.style.setProperty("--c", nat.color);
    card.innerHTML = `<img src="${flagImg(nat.iso)}" alt="" onerror="this.style.visibility='hidden'"><span>${nat.name}</span>`;
    card.addEventListener("click", () => {
      // don't allow both sides to be the same nation
      if (pickTarget === "home") { home = nat; if (away.name === nat.name) away = ALL.find((x) => x.name !== nat.name) ?? away; }
      else { away = nat; if (home.name === nat.name) home = ALL.find((x) => x.name !== nat.name) ?? home; }
      closePick();
      render();
    });
    grid.appendChild(card);
  }
}

export function initFriendly(): void {
  const style = document.createElement("style");
  style.id = "gpf-friendly-style"; style.textContent = CSS;
  document.head.appendChild(style);

  root = document.createElement("div");
  root.id = "gpf-friendly";
  root.innerHTML = `
    <button class="fr-gear" title="Réglages">⚙</button>
    <div class="fr-shell"></div>
    <button class="fr-back" title="Retour">‹</button>
    <button class="fr-play">JOUER ⚽</button>`;
  document.body.appendChild(root);
  root.querySelector(".fr-gear")!.addEventListener("click", showSettings);
  root.querySelector(".fr-back")!.addEventListener("click", () => { hideFriendly(); showHome(); });
  root.querySelector(".fr-play")!.addEventListener("click", launch);

  pick = document.createElement("div");
  pick.id = "gpf-fr-pick";
  pick.innerHTML = `
    <div class="pk-shell">
      <div class="pk-head"><button class="pk-back">← Retour</button><b>CHOISIS LE PAYS</b><span style="width:70px"></span></div>
      <div class="pk-tabs"></div>
      <div class="pk-grid"></div>
    </div>`;
  document.body.appendChild(pick);
  const tabs = pick.querySelector(".pk-tabs")!;
  for (const conf of CONFEDS) {
    const b = document.createElement("button");
    b.className = "pk-tab"; b.dataset.id = conf.id;
    b.innerHTML = `<span>${conf.icon}</span> ${conf.label}`;
    b.addEventListener("click", () => renderPick(conf));
    tabs.appendChild(b);
  }
  pick.querySelector(".pk-back")!.addEventListener("click", closePick);
}
