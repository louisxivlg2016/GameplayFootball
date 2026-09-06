/**
 * CLUB screen — country/league tabs + a grid of club cards, each showing the
 * club's REAL crest fetched at runtime from Wikipedia (exactly like the web
 * version; no images are bundled — logos load live via /img-proxy). A faithful
 * static reproduction of the web #club screen (see CLUBS_SPEC.md).
 */
import { startNativeMatch } from "./homemenu";
import { setAnthemOverride } from "./anthem";
import { setScoreFlags } from "./scoreflags";
import { applyMatchSquads } from "./squads";
import { CLUB_SQUADS } from "./clubsquads";
import { clubSquad } from "./transfers";
import { teamLineup } from "./lineup";
import { L, onLangChange } from "./i18n";

interface Club { name: string; code: string; city: string; color: string; wiki: string }
interface League { id: string; country: string; flag: string; clubs: Club[] }

const LEAGUES: League[] = [
  { id: "fr", country: "France", flag: "🇫🇷", clubs: [
    { name: "Paris Saint-Germain", code: "PSG", city: "Paris", color: "#004170", wiki: "Paris_Saint-Germain_FC" },
    { name: "Olympique de Marseille", code: "OM", city: "Marseille", color: "#2faee0", wiki: "Olympique_de_Marseille" },
    { name: "Olympique Lyonnais", code: "OL", city: "Lyon", color: "#da001a", wiki: "Olympique_Lyonnais" },
    { name: "AS Monaco", code: "ASM", city: "Monaco", color: "#e51b22", wiki: "AS_Monaco_FC" },
    { name: "LOSC Lille", code: "LOSC", city: "Lille", color: "#e01e13", wiki: "Lille_OSC" },
    { name: "OGC Nice", code: "OGCN", city: "Nice", color: "#d00027", wiki: "OGC_Nice" },
    { name: "RC Lens", code: "RCL", city: "Lens", color: "#fff200", wiki: "RC_Lens" },
    { name: "Stade Rennais", code: "SRFC", city: "Rennes", color: "#e13327", wiki: "Stade_Rennais_FC" },
    { name: "RC Strasbourg", code: "RCSA", city: "Strasbourg", color: "#009fe3", wiki: "RC_Strasbourg_Alsace" },
    { name: "Toulouse FC", code: "TFC", city: "Toulouse", color: "#6a2c91", wiki: "Toulouse_FC" },
    { name: "FC Nantes", code: "FCN", city: "Nantes", color: "#fcd405", wiki: "FC_Nantes" },
    { name: "Stade Brestois", code: "SB29", city: "Brest", color: "#e30613", wiki: "Stade_Brestois_29" },
  ] },
  { id: "en", country: "Angleterre", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", clubs: [
    { name: "Arsenal", code: "ARS", city: "Londres", color: "#ef0107", wiki: "Arsenal_F.C." },
    { name: "Liverpool", code: "LIV", city: "Liverpool", color: "#c8102e", wiki: "Liverpool_F.C." },
    { name: "Manchester City", code: "MCI", city: "Manchester", color: "#6cabdd", wiki: "Manchester_City_F.C." },
    { name: "Manchester United", code: "MUN", city: "Manchester", color: "#da291c", wiki: "Manchester_United_F.C." },
    { name: "Chelsea", code: "CHE", city: "Londres", color: "#034694", wiki: "Chelsea_F.C." },
    { name: "Tottenham Hotspur", code: "TOT", city: "Londres", color: "#ffffff", wiki: "Tottenham_Hotspur_F.C." },
  ] },
  { id: "es", country: "Espagne", flag: "🇪🇸", clubs: [
    { name: "Real Madrid", code: "RMA", city: "Madrid", color: "#ffffff", wiki: "Real_Madrid_CF" },
    { name: "FC Barcelone", code: "BAR", city: "Barcelone", color: "#a50044", wiki: "FC_Barcelona" },
    { name: "Atlético Madrid", code: "ATM", city: "Madrid", color: "#cb3524", wiki: "Atlético_Madrid" },
  ] },
  { id: "it", country: "Italie", flag: "🇮🇹", clubs: [
    { name: "Inter Milan", code: "INT", city: "Milan", color: "#0068a8", wiki: "Inter_Milan" },
    { name: "AC Milan", code: "MIL", city: "Milan", color: "#fb090b", wiki: "AC_Milan" },
    { name: "Juventus", code: "JUV", city: "Turin", color: "#ffffff", wiki: "Juventus_FC" },
    { name: "Napoli", code: "NAP", city: "Naples", color: "#12a0d7", wiki: "SSC_Napoli" },
  ] },
  { id: "de", country: "Allemagne", flag: "🇩🇪", clubs: [
    { name: "Bayern Munich", code: "FCB", city: "Munich", color: "#dc052d", wiki: "FC_Bayern_Munich" },
    { name: "Borussia Dortmund", code: "BVB", city: "Dortmund", color: "#fde100", wiki: "Borussia_Dortmund" },
    { name: "Bayer Leverkusen", code: "B04", city: "Leverkusen", color: "#e32221", wiki: "Bayer_04_Leverkusen" },
  ] },
  { id: "eu", country: "Autres pays", flag: "🌍", clubs: [
    { name: "Galatasaray", code: "GAL", city: "Istanbul 🇹🇷", color: "#a90432", wiki: "Galatasaray_S.K._(football)" },
    { name: "Al-Nassr", code: "NAS", city: "Riyad 🇸🇦", color: "#ffe500", wiki: "Al-Nassr_FC" },
    { name: "Inter Miami", code: "MIA", city: "Miami 🇺🇸", color: "#f7b5cd", wiki: "Inter_Miami_CF" },
  ] },
];

const CSS = `
#gpf-clubs { position:fixed; inset:0; z-index:2147483250; color:#fff; display:none;
  font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif; }
#gpf-clubs.show { display:block; }
body.gpf-clubs-open #gpf-menu { display:none !important; }
#gpf-clubs .menu-shell { position:absolute; inset:12px; display:flex; flex-direction:column; gap:12px;
  padding:18px 24px; box-sizing:border-box;
  background:linear-gradient(180deg,rgba(5,22,15,.4),rgba(5,22,15,.82)),
    url("${"/img-proxy?u=" + encodeURIComponent("https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1600&q=80")}") center 48% / cover;
  border:2px solid rgba(255,255,255,.14); border-radius:6px; box-shadow:0 20px 48px rgba(0,0,0,.45); }
#gpf-clubs .menu-panel-head { min-height:54px; display:flex; align-items:center; justify-content:space-between;
  gap:14px; padding:12px 14px; background:rgba(0,0,0,.28); border:2px solid rgba(255,255,255,.14); border-radius:4px; }
#gpf-clubs .menu-panel-head span { color:#ffe94a; font-size:13px; font-weight:900; letter-spacing:1px; }
#gpf-clubs .menu-panel-head b { color:#fff; font-size:15px; }
#gpf-clubs .club-back { pointer-events:auto; cursor:pointer; min-height:38px; padding:0 14px; color:#fff;
  background:rgba(255,255,255,.12); border:2px solid rgba(255,255,255,.24); border-radius:6px; font:inherit; font-weight:800; }
#gpf-clubs .club-league-tabs { display:flex; flex-wrap:wrap; gap:8px; }
#gpf-clubs .club-league-tab { pointer-events:auto; cursor:pointer; display:flex; align-items:center; gap:7px;
  min-height:38px; padding:0 13px; color:#dfe9e2; background:rgba(5,18,12,.72); border:1px solid rgba(255,255,255,.16);
  border-radius:999px; font:inherit; font-size:12px; font-weight:900; letter-spacing:.5px; }
#gpf-clubs .club-league-tab span { font-size:16px; }
#gpf-clubs .club-league-tab.active { color:#08120c; background:#ffe94a; border-color:#fff3a6; }
#gpf-clubs .club-play-now { pointer-events:auto; cursor:pointer; margin-left:auto; min-height:38px; padding:0 18px;
  border-radius:999px; border:2px solid #ff9db2; background:#ff2e63; color:#fff; font:inherit; font-size:13px;
  font-weight:900; letter-spacing:.6px; box-shadow:0 5px 0 #a01038,0 10px 18px rgba(0,0,0,.35); }
#gpf-clubs .club-grid { flex:1; min-height:0; overflow-y:auto; display:grid;
  grid-template-columns:repeat(auto-fill,minmax(148px,1fr)); gap:10px; padding-right:4px; }
#gpf-clubs .club-card { display:flex; flex-direction:column; align-items:center; gap:6px; padding:12px 8px 10px;
  background:rgba(5,18,12,.72); border:1px solid rgba(255,255,255,.12); border-top:3px solid var(--club-color);
  border-radius:10px; text-align:center; }
#gpf-clubs .club-crest { width:52px; height:52px; display:grid; place-items:center; border-radius:50%;
  background:radial-gradient(circle at 35% 35%,rgba(255,255,255,.98),rgba(224,232,238,.88));
  box-shadow:inset 0 0 0 3px rgba(0,0,0,.25),0 6px 12px rgba(0,0,0,.35); overflow:hidden; }
#gpf-clubs .club-crest-img { width:42px; height:42px; object-fit:contain; filter:drop-shadow(0 4px 8px rgba(0,0,0,.28)); }
#gpf-clubs .club-crest > span { font-size:13px; font-weight:900; letter-spacing:.5px; color:#3a3a3a; text-shadow:0 1px 2px rgba(255,255,255,.6); }
#gpf-clubs .club-card b { font-size:12.5px; font-weight:800; line-height:1.15; }
#gpf-clubs .club-card small { font-size:10.5px; color:#9fb8a6; font-weight:700; }
#gpf-clubs .club-actions { display:flex; gap:6px; margin-top:2px; }
#gpf-clubs .club-actions button { pointer-events:auto; cursor:pointer; min-height:26px; padding:0 10px; border-radius:6px;
  border:1px solid rgba(255,255,255,.22); background:rgba(255,255,255,.08); color:#fff; font:inherit; font-size:10.5px;
  font-weight:900; letter-spacing:.5px; }
`;

const VS_CSS = `
#gpf-club-vs { position:fixed; inset:0; z-index:2147483260; display:none;
  background:rgba(3,10,7,.9); font-family:"Segoe UI",Arial,sans-serif; color:#fff; }
#gpf-club-vs.show { display:block; }
#gpf-club-vs .vs-shell { position:absolute; inset:16px; display:flex; flex-direction:column; gap:12px;
  padding:16px 20px; box-sizing:border-box; background:rgba(6,20,14,.96);
  border:2px solid rgba(255,255,255,.16); border-radius:10px; }
#gpf-club-vs .vs-head { display:flex; align-items:center; gap:14px; }
#gpf-club-vs .vs-back { pointer-events:auto; cursor:pointer; min-height:40px; padding:0 15px; color:#fff;
  background:rgba(255,255,255,.12); border:2px solid rgba(255,255,255,.24); border-radius:6px;
  font-family:inherit; font-size:14px; font-weight:800; }
#gpf-club-vs .vs-title { font-size:18px; font-weight:800; }
#gpf-club-vs .vs-title b { color:#ffe07a; }
#gpf-club-vs .vs-grid { flex:1; min-height:0; overflow-y:auto; display:grid;
  grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px; padding-right:4px; }
#gpf-club-vs .vs-card { pointer-events:auto; cursor:pointer; display:flex; flex-direction:column;
  align-items:center; gap:5px; padding:12px 8px; color:#fff; text-align:center;
  background:rgba(5,18,12,.8); border:1px solid rgba(255,255,255,.12);
  border-top:3px solid var(--club-color); border-radius:10px; font-family:inherit; }
#gpf-club-vs .vs-card:hover { background:rgba(255,255,255,.12); }
#gpf-club-vs .vs-card b { font-size:13px; font-weight:800; line-height:1.15; }
#gpf-club-vs .vs-card small { font-size:11px; color:#9fb3a6; font-weight:700; }
#gpf-club-vs .vs-crest { width:46px; height:46px; display:grid; place-items:center; border-radius:8px;
  background:rgba(255,255,255,.1); font-size:12px; font-weight:900; overflow:hidden; }
#gpf-club-vs .vs-crest img { width:100%; height:100%; object-fit:contain; }
`;

let root: HTMLElement | null = null;
const logoCache = new Map<string, string>();

async function fetchLogo(club: Club): Promise<string | null> {
  if (logoCache.has(club.wiki)) return logoCache.get(club.wiki)!;
  try {
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(club.wiki)}`);
    if (!r.ok) return null;
    const d = await r.json();
    const src: string | undefined = d?.thumbnail?.source ?? d?.originalimage?.source;
    if (!src) return null;
    const u = `/img-proxy?u=${encodeURIComponent(src)}`;
    logoCache.set(club.wiki, u);
    return u;
  } catch { return null; }
}

export function showClubs(): void {
  homePick = null; updateClubStatus();
  root?.classList.add("show");
  document.body.classList.add("gpf-clubs-open");
}
export function hideClubs(): void {
  root?.classList.remove("show");
  document.body.classList.remove("gpf-clubs-open");
}

/** Every club that has a real squad, for the transfer market's club picker. */
export function allClubsWithSquads(): Array<{ name: string; code: string; color: string; country: string }> {
  const out: Array<{ name: string; code: string; color: string; country: string }> = [];
  for (const lg of LEAGUES) {
    for (const c of lg.clubs) {
      if ((CLUB_SQUADS[c.code] ?? []).length) {
        out.push({ name: c.name, code: c.code, color: c.color, country: lg.country });
      }
    }
  }
  return out;
}

let homePick: Club | null = null;
function updateClubStatus(): void {
  const s = root?.querySelector<HTMLElement>(".club-status");
  if (s) s.innerHTML = homePick ? `Ton club : <b>${homePick.name}</b> — choisis l'adversaire (VS)` : `<b>JOUER</b> = match direct · <b>VS</b> + <b>VS</b> = choisis l'adversaire`;
}
async function doPlayClubs(home: Club, away: Club, homeNames: string[]): Promise<void> {
  setAnthemOverride(home.name, away.name); // club name -> anthem + radio team name
  // the CHOSEN home XI + the away club squad, with kit colours
  applyMatchSquads(
    { color: home.color, names: homeNames },
    { color: away.color, names: clubSquad(away.code) },
  );
  hideClubs();
  startNativeMatch();
  const [lh, la] = await Promise.all([fetchLogo(home), fetchLogo(away)]);
  setScoreFlags(
    lh ? { img: lh, code: home.code } : { emoji: "🛡️", code: home.code },
    la ? { img: la, code: away.code } : { emoji: "🛡️", code: away.code },
  );
}
// a random club different from the given one (for "JOUER" = play now)
function randomClubOpponent(home: Club): Club {
  const all = LEAGUES.flatMap((l) => l.clubs).filter((c) => c.code !== home.code);
  return all[Math.floor(Math.random() * all.length)] ?? home;
}

function launchClubs(home: Club, away: Club): void {
  // pick your XI first (your club is home), then play
  const squad = clubSquad(home.code); // includes the players you bought
  hideClubs();
  const play = (names: string[]): void => { void doPlayClubs(home, away, names); };
  if (squad && squad.length) teamLineup(home.name, squad, home.name, play);
  else play(squad || []);
}

// VS = "play THIS club against one I choose". Used to be two clicks on two
// different cards with only a status line to explain it, which nobody found;
// now it opens a proper opponent screen listing every other club.
let vsRoot: HTMLElement | null = null;
function openOpponentPicker(home: Club): void {
  if (!vsRoot) return;
  const grid = vsRoot.querySelector<HTMLElement>(".vs-grid");
  const title = vsRoot.querySelector<HTMLElement>(".vs-title");
  if (title) title.innerHTML = `${L("Choisis l'adversaire de")} <b>${home.name}</b>`;
  if (grid) {
    grid.innerHTML = "";
    for (const lg of LEAGUES) {
      for (const c of lg.clubs) {
        if (c.code === home.code) continue;
        const b = document.createElement("button");
        b.className = "vs-card";
        b.style.setProperty("--club-color", c.color);
        b.innerHTML = `<span class="vs-crest"><span>${c.code}</span></span>` +
          `<b>${c.name}</b><small>${lg.country}</small>`;
        b.addEventListener("click", () => { closeOpponentPicker(); void launchClubs(home, c); });
        grid.appendChild(b);
        void fetchLogo(c).then((src) => {
          if (src) {
            const crest = b.querySelector(".vs-crest");
            if (crest) crest.innerHTML = `<img src="${src}" alt="" loading="lazy">`;
          }
        });
      }
    }
  }
  vsRoot.classList.add("show");
}
function closeOpponentPicker(): void { vsRoot?.classList.remove("show"); }

function renderGrid(grid: HTMLElement, league: League): void {
  grid.innerHTML = "";
  for (const club of league.clubs) {
    const card = document.createElement("div");
    card.className = "club-card";
    card.style.setProperty("--club-color", club.color);
    card.innerHTML =
      `<span class="club-crest"><span>${club.code}</span></span>` +
      `<b>${club.name}</b><small>${club.city}</small>` +
      `<span class="club-actions"><button class="club-play" title="Jouer avec ce club">JOUER</button>` +
      `<button class="club-vs" title="${L("Affronter ce club")}">VS</button></span>`;
    // JOUER = play now: kick off straight away against an auto-picked club.
    // (Use VS on two clubs to choose the opponent yourself.)
    card.querySelector(".club-play")!.addEventListener("click", () => { void launchClubs(club, randomClubOpponent(club)); });
    card.querySelector(".club-vs")!.addEventListener("click", () => { openOpponentPicker(club); });
    grid.appendChild(card);
    void fetchLogo(club).then((src) => {
      if (src) {
        const crest = card.querySelector(".club-crest")!;
        crest.innerHTML = `<img class="club-crest-img" src="${src}" alt="Blason ${club.name}" loading="lazy">`;
      }
    });
  }
}

export function initClubs(): void {
  const style = document.createElement("style");
  style.id = "gpf-clubs-style"; style.textContent = CSS + VS_CSS;
  document.head.appendChild(style);

  root = document.createElement("div");
  root.id = "gpf-clubs";
  root.innerHTML = `
    <div class="menu-shell">
      <div class="menu-panel-head">
        <button class="club-back">${L("← Menu")}</button>
        <span>Clubs · effectifs réels</span>
        <b class="club-status"><b>JOUER</b> = match direct · <b>VS</b> + <b>VS</b> = choisis l'adversaire</b>
      </div>
      <div class="club-league-tabs"></div>
      <div class="club-grid"></div>
    </div>`;

  const tabs = root.querySelector(".club-league-tabs")!;
  const grid = root.querySelector<HTMLElement>(".club-grid")!;
  let active = LEAGUES[0]!;
  const tabEls: HTMLButtonElement[] = [];
  for (const lg of LEAGUES) {
    const b = document.createElement("button");
    b.className = "club-league-tab" + (lg === active ? " active" : "");
    b.innerHTML = `<span>${lg.flag}</span><b>${L(lg.country)}</b>`;
    b.addEventListener("click", () => {
      active = lg;
      for (const e of tabEls) e.classList.toggle("active", e === b);
      renderGrid(grid, lg);
    });
    tabs.appendChild(b);
    tabEls.push(b);
  }
  const play = document.createElement("button");
  play.className = "club-play-now"; play.textContent = "JOUER ⚽";
  play.addEventListener("click", () => {
    // your picked club (or a random one) vs an auto-picked opponent — with real
    // squads/kits, not the bare default teams.
    const home = homePick ?? randomClubOpponent({ code: "" } as Club);
    void launchClubs(home, randomClubOpponent(home));
  });
  tabs.appendChild(play);

  vsRoot = document.createElement("div");
  vsRoot.id = "gpf-club-vs";
  vsRoot.innerHTML =
    `<div class="vs-shell"><div class="vs-head">` +
    `<button class="vs-back">${L("← Retour")}</button><span class="vs-title"></span></div>` +
    `<div class="vs-grid"></div></div>`;
  vsRoot.addEventListener("click", (e) => {
    if ((e.target as HTMLElement)?.classList.contains("vs-back") || e.target === vsRoot) closeOpponentPicker();
  });
  document.body.appendChild(vsRoot);

  root.querySelector(".club-back")!.addEventListener("click", hideClubs);
  renderGrid(grid, active);
  document.body.appendChild(root);

  // Screen is built once; re-translate the visible action labels on language change.
  onLangChange(() => {
    if (!root) return;
    const back = root.querySelector<HTMLElement>(".club-back");
    if (back) back.textContent = L("← Menu");
    tabEls.forEach((b, i) => {
      const label = b.querySelector<HTMLElement>("b");
      if (label && LEAGUES[i]) label.textContent = L(LEAGUES[i]!.country);
    });
    renderGrid(grid, active); // refreshes the "Affronter ce club" VS-button titles
  });
}
