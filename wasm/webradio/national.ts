/**
 * NATIONAL screen — all national teams grouped by confederation, each card
 * showing the country flag + name (flags are Unicode emoji, nothing to fetch).
 * Same visual language as the CLUB screen. Opened from the NATIONAL sidebar item.
 */
import { startNativeMatch } from "./homemenu";
import { setAnthemOverride } from "./anthem";
import { setScoreFlags } from "./scoreflags";

interface Nation { name: string; flag: string; color: string; iso: string }
interface Confed { id: string; label: string; icon: string; teams: Nation[] }

// real flag image (renders everywhere, unlike flag emoji on Linux/Windows)
const flagImg = (iso: string): string =>
  "/img-proxy?u=" + encodeURIComponent(`https://flagcdn.com/w160/${iso}.png`);

const CONFEDS: Confed[] = [
  { id: "eu", label: "Europe", icon: "🇪🇺", teams: [
    { name: "France", flag: "🇫🇷", color: "#1a2a6c", iso: "fr" },
    { name: "Espagne", flag: "🇪🇸", color: "#c60b1e", iso: "es" },
    { name: "Italie", flag: "🇮🇹", color: "#0064aa", iso: "it" },
    { name: "Allemagne", flag: "🇩🇪", color: "#111111", iso: "de" },
    { name: "Angleterre", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", color: "#ffffff", iso: "gb-eng" },
    { name: "Portugal", flag: "🇵🇹", color: "#046a38", iso: "pt" },
    { name: "Pays-Bas", flag: "🇳🇱", color: "#f36c21", iso: "nl" },
    { name: "Belgique", flag: "🇧🇪", color: "#e30613", iso: "be" },
    { name: "Croatie", flag: "🇭🇷", color: "#ff0000", iso: "hr" },
    { name: "Norvège", flag: "🇳🇴", color: "#ba0c2f", iso: "no" },
    { name: "Danemark", flag: "🇩🇰", color: "#c60c30", iso: "dk" },
    { name: "Suisse", flag: "🇨🇭", color: "#d52b1e", iso: "ch" },
    { name: "Pologne", flag: "🇵🇱", color: "#dc143c", iso: "pl" },
    { name: "Turquie", flag: "🇹🇷", color: "#e30a17", iso: "tr" },
    { name: "Autriche", flag: "🇦🇹", color: "#ed2939", iso: "at" },
    { name: "Serbie", flag: "🇷🇸", color: "#c6363c", iso: "rs" },
    { name: "Ukraine", flag: "🇺🇦", color: "#005bbb", iso: "ua" },
    { name: "Suède", flag: "🇸🇪", color: "#006aa7", iso: "se" },
    { name: "Écosse", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", color: "#0065bf", iso: "gb-sct" },
    { name: "Pays de Galles", flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", color: "#c8102e", iso: "gb-wls" },
  ] },
  { id: "sa", label: "Amérique du Sud", icon: "🌎", teams: [
    { name: "Argentine", flag: "🇦🇷", color: "#75aadb", iso: "ar" },
    { name: "Brésil", flag: "🇧🇷", color: "#009c3b", iso: "br" },
    { name: "Uruguay", flag: "🇺🇾", color: "#7bafd4", iso: "uy" },
    { name: "Colombie", flag: "🇨🇴", color: "#fcd116", iso: "co" },
    { name: "Chili", flag: "🇨🇱", color: "#d52b1e", iso: "cl" },
    { name: "Équateur", flag: "🇪🇨", color: "#ffdd00", iso: "ec" },
    { name: "Pérou", flag: "🇵🇪", color: "#d91023", iso: "pe" },
    { name: "Paraguay", flag: "🇵🇾", color: "#d52b1e", iso: "py" },
  ] },
  { id: "af", label: "Afrique", icon: "🌍", teams: [
    { name: "Maroc", flag: "🇲🇦", color: "#c1272d", iso: "ma" },
    { name: "Sénégal", flag: "🇸🇳", color: "#00853f", iso: "sn" },
    { name: "Nigéria", flag: "🇳🇬", color: "#008751", iso: "ng" },
    { name: "Égypte", flag: "🇪🇬", color: "#ce1126", iso: "eg" },
    { name: "Cameroun", flag: "🇨🇲", color: "#007a5e", iso: "cm" },
    { name: "Ghana", flag: "🇬🇭", color: "#006b3f", iso: "gh" },
    { name: "Côte d'Ivoire", flag: "🇨🇮", color: "#f77f00", iso: "ci" },
    { name: "Algérie", flag: "🇩🇿", color: "#006233", iso: "dz" },
    { name: "Tunisie", flag: "🇹🇳", color: "#e70013", iso: "tn" },
    { name: "Mali", flag: "🇲🇱", color: "#14b53a", iso: "ml" },
  ] },
  { id: "na", label: "Amér. du Nord", icon: "🌎", teams: [
    { name: "États-Unis", flag: "🇺🇸", color: "#3c3b6e", iso: "us" },
    { name: "Mexique", flag: "🇲🇽", color: "#006847", iso: "mx" },
    { name: "Canada", flag: "🇨🇦", color: "#ff0000", iso: "ca" },
    { name: "Costa Rica", flag: "🇨🇷", color: "#002b7f", iso: "cr" },
  ] },
  { id: "as", label: "Asie / Océanie", icon: "🌏", teams: [
    { name: "Japon", flag: "🇯🇵", color: "#bc002d", iso: "jp" },
    { name: "Corée du Sud", flag: "🇰🇷", color: "#003478", iso: "kr" },
    { name: "Australie", flag: "🇦🇺", color: "#00843d", iso: "au" },
    { name: "Arabie Saoudite", flag: "🇸🇦", color: "#006c35", iso: "sa" },
    { name: "Iran", flag: "🇮🇷", color: "#239f40", iso: "ir" },
    { name: "Qatar", flag: "🇶🇦", color: "#8a1538", iso: "qa" },
  ] },
];

const CSS = `
#gpf-national { position:fixed; inset:0; z-index:2147483250; color:#fff; display:none;
  font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif; }
#gpf-national.show { display:block; }
body.gpf-national-open #gpf-menu { display:none !important; }
#gpf-national .menu-shell { position:absolute; inset:12px; display:flex; flex-direction:column; gap:12px;
  padding:18px 24px; box-sizing:border-box;
  background:linear-gradient(180deg,rgba(5,22,15,.4),rgba(5,22,15,.82)),
    url("${"/img-proxy?u=" + encodeURIComponent("https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1600&q=80")}") center 48% / cover;
  border:2px solid rgba(255,255,255,.14); border-radius:6px; box-shadow:0 20px 48px rgba(0,0,0,.45); }
#gpf-national .menu-panel-head { min-height:54px; display:flex; align-items:center; justify-content:space-between;
  gap:14px; padding:12px 14px; background:rgba(0,0,0,.28); border:2px solid rgba(255,255,255,.14); border-radius:4px; }
#gpf-national .menu-panel-head span { color:#ffe94a; font-size:13px; font-weight:900; letter-spacing:1px; }
#gpf-national .menu-panel-head b { color:#fff; font-size:15px; }
#gpf-national .nat-back { pointer-events:auto; cursor:pointer; min-height:38px; padding:0 14px; color:#fff;
  background:rgba(255,255,255,.12); border:2px solid rgba(255,255,255,.24); border-radius:6px; font:inherit; font-weight:800; }
#gpf-national .conf-tabs { display:flex; flex-wrap:wrap; gap:8px; }
#gpf-national .conf-tab { pointer-events:auto; cursor:pointer; display:flex; align-items:center; gap:7px;
  min-height:38px; padding:0 14px; color:#dfe9e2; background:rgba(5,18,12,.72); border:1px solid rgba(255,255,255,.16);
  border-radius:999px; font:inherit; font-size:12px; font-weight:900; letter-spacing:.5px; }
#gpf-national .conf-tab span { font-size:16px; }
#gpf-national .conf-tab.active { color:#08120c; background:#ffe94a; border-color:#fff3a6; }
#gpf-national .nat-grid { flex:1; min-height:0; overflow-y:auto; display:grid;
  grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px; padding-right:4px; }
#gpf-national .nat-card { display:flex; flex-direction:column; align-items:center; gap:6px; padding:14px 8px 10px;
  background:rgba(5,18,12,.72); border:1px solid rgba(255,255,255,.12); border-top:3px solid var(--nat-color);
  border-radius:10px; text-align:center; }
#gpf-national .nat-flag { width:58px; height:58px; display:grid; place-items:center; border-radius:14px;
  background:rgba(255,255,255,.1); box-shadow:inset 0 0 0 2px rgba(0,0,0,.25),0 6px 12px rgba(0,0,0,.35);
  font-size:34px; line-height:1; }
#gpf-national .nat-card b { font-size:13px; font-weight:800; line-height:1.15; }
#gpf-national .nat-actions { display:flex; gap:6px; margin-top:2px; }
#gpf-national .nat-actions button { pointer-events:auto; cursor:pointer; min-height:26px; padding:0 12px; border-radius:6px;
  border:1px solid rgba(255,255,255,.22); background:rgba(255,255,255,.08); color:#fff; font:inherit; font-size:10.5px;
  font-weight:900; letter-spacing:.5px; }
`;

let root: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let homePick: Nation | null = null; // "your team" chosen with JOUER

function updateStatus(): void {
  if (!statusEl) return;
  statusEl.innerHTML = homePick
    ? `Ton équipe : <b>${homePick.flag} ${homePick.name}</b> — choisis l'adversaire (VS)`
    : `Choisis <b>ton équipe</b> (JOUER)`;
}

export function showNational(): void {
  homePick = null; updateStatus();
  root?.classList.add("show"); document.body.classList.add("gpf-national-open");
}
export function hideNational(): void { root?.classList.remove("show"); document.body.classList.remove("gpf-national-open"); }

// home vs away picked -> the ceremony plays each country's anthem, then kickoff.
function launch(home: Nation, away: Nation): void {
  setAnthemOverride(home.name, away.name);
  // real flag images on the score-bar badges (emoji fallback if they fail)
  setScoreFlags({ img: flagImg(home.iso), emoji: home.flag }, { img: flagImg(away.iso), emoji: away.flag });
  hideNational();
  startNativeMatch();
}

function renderGrid(grid: HTMLElement, conf: Confed): void {
  grid.innerHTML = "";
  for (const nat of conf.teams) {
    const card = document.createElement("div");
    card.className = "nat-card";
    card.style.setProperty("--nat-color", nat.color);
    card.innerHTML =
      `<span class="nat-flag">${nat.flag}</span><b>${nat.name}</b>` +
      `<span class="nat-actions"><button class="nat-play" title="Jouer avec cette équipe">JOUER</button>` +
      `<button class="nat-vs" title="Affronter cette équipe">VS</button></span>`;
    card.querySelector(".nat-play")!.addEventListener("click", () => {
      homePick = nat;                 // pick your team, then choose an opponent
      updateStatus();
    });
    card.querySelector(".nat-vs")!.addEventListener("click", () => {
      if (!homePick) { homePick = nat; updateStatus(); return; } // no home yet -> treat as your team
      launch(homePick, nat);
    });
    grid.appendChild(card);
  }
}

export function initNational(): void {
  const style = document.createElement("style");
  style.id = "gpf-national-style"; style.textContent = CSS;
  document.head.appendChild(style);

  root = document.createElement("div");
  root.id = "gpf-national";
  root.innerHTML = `
    <div class="menu-shell">
      <div class="menu-panel-head">
        <button class="nat-back">← Menu</button>
        <span>Équipes nationales</span>
        <b class="nat-status">Choisis <b>ton équipe</b> (JOUER)</b>
      </div>
      <div class="conf-tabs"></div>
      <div class="nat-grid"></div>
    </div>`;

  const tabs = root.querySelector(".conf-tabs")!;
  const grid = root.querySelector<HTMLElement>(".nat-grid")!;
  let active = CONFEDS[0]!;
  const tabEls: HTMLButtonElement[] = [];
  for (const conf of CONFEDS) {
    const b = document.createElement("button");
    b.className = "conf-tab" + (conf === active ? " active" : "");
    b.innerHTML = `<span>${conf.icon}</span><b>${conf.label}</b>`;
    b.addEventListener("click", () => {
      active = conf;
      for (const e of tabEls) e.classList.toggle("active", e === b);
      renderGrid(grid, conf);
    });
    tabs.appendChild(b);
    tabEls.push(b);
  }
  root.querySelector(".nat-back")!.addEventListener("click", hideNational);
  statusEl = root.querySelector<HTMLElement>(".nat-status");
  renderGrid(grid, active);
  document.body.appendChild(root);
}
