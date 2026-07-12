/**
 * DEFI screen — scripted match scenarios ("challenges"). Each sets a preset
 * score + clock and a win condition; you pick a side, the engine jumps the live
 * match to that moment (gpf_start_challenge in gametask.cpp / Match::Start-
 * Challenge), and a HUD tells you the objective, then a WIN/LOSE overlay when
 * the C++ challenge monitor resolves it (window.gpfChallengeResult).
 *
 * The chosen team is always arranged as HOME (team 0, the human side), so we
 * never need to hand the player the away team.
 */
import { startNativeMatch, setPendingChallenge, endChallengeSession, show as showHome } from "./homemenu";
import { setScoreFlags } from "./scoreflags";
import { applyNationOverrides } from "./squads";

interface Team { name: string; iso: string; flag: string; color: string }
// objective: 0 = SCORE a goal, 1 = WIN (be ahead at full time), 2 = HOLD (don't concede)
interface Challenge {
  a: Team; b: Team; aScore: number; bScore: number; minute: number;
  obj: 0 | 1 | 2; play: "a" | "b" | "both"; title: string; sub: string;
}

const T: Record<string, Team> = {
  France: { name: "France", iso: "fr", flag: "🇫🇷", color: "#1a2a6c" },
  Argentine: { name: "Argentine", iso: "ar", flag: "🇦🇷", color: "#6ea9dd" },
  Angleterre: { name: "Angleterre", iso: "gb-eng", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", color: "#f2f2f2" },
  Espagne: { name: "Espagne", iso: "es", flag: "🇪🇸", color: "#c60b1e" },
  Allemagne: { name: "Allemagne", iso: "de", flag: "🇩🇪", color: "#e9e9e9" },
  Uruguay: { name: "Uruguay", iso: "uy", flag: "🇺🇾", color: "#5ba3d0" },
  Colombie: { name: "Colombie", iso: "co", flag: "🇨🇴", color: "#fcd116" },
  "Pays-Bas": { name: "Pays-Bas", iso: "nl", flag: "🇳🇱", color: "#f36c21" },
  Belgique: { name: "Belgique", iso: "be", flag: "🇧🇪", color: "#c8102e" },
  Italie: { name: "Italie", iso: "it", flag: "🇮🇹", color: "#0064aa" },
  Croatie: { name: "Croatie", iso: "hr", flag: "🇭🇷", color: "#d52b1e" },
  "Brésil": { name: "Brésil", iso: "br", flag: "🇧🇷", color: "#f7d417" },
  Portugal: { name: "Portugal", iso: "pt", flag: "🇵🇹", color: "#b31217" },
  Maroc: { name: "Maroc", iso: "ma", flag: "🇲🇦", color: "#c1272d" },
};

const OBJ_TXT = ["⚽ Marque un but pour l'emporter !", "🏆 Sois devant au coup de sifflet final !", "🛡️ Défends le résultat, ne concède rien !"];

const CH: Challenge[] = [
  { a: T.France, b: T.Argentine, aScore: 2, bScore: 2, minute: 88, obj: 0, play: "both",
    title: "France 2‑2 Argentine", sub: "88ᵉ — le but de la gagne" },
  { a: T.Angleterre, b: T.Espagne, aScore: 1, bScore: 1, minute: 90, obj: 0, play: "both",
    title: "Angleterre 1‑1 Espagne", sub: "90ᵉ — arrache la victoire" },
  { a: T.Uruguay, b: T.Colombie, aScore: 1, bScore: 1, minute: 85, obj: 0, play: "both",
    title: "Uruguay 1‑1 Colombie", sub: "85ᵉ — fais la différence" },
  { a: T.Espagne, b: T.Allemagne, aScore: 2, bScore: 2, minute: 87, obj: 0, play: "both",
    title: "Espagne 2‑2 Allemagne", sub: "87ᵉ — brise l'égalité" },
  { a: T["Pays-Bas"], b: T.Belgique, aScore: 2, bScore: 1, minute: 86, obj: 2, play: "a",
    title: "Pays‑Bas 2‑1 Belgique", sub: "86ᵉ — défends l'avantage" },
  { a: T.Italie, b: T.Croatie, aScore: 1, bScore: 0, minute: 89, obj: 2, play: "a",
    title: "Italie 1‑0 Croatie", sub: "89ᵉ — garde ta cage inviolée" },
  { a: T["Brésil"], b: T.Argentine, aScore: 0, bScore: 1, minute: 76, obj: 1, play: "a",
    title: "Brésil 0‑1 Argentine", sub: "76ᵉ — renverse le classico" },
  { a: T.Portugal, b: T.Maroc, aScore: 1, bScore: 2, minute: 80, obj: 1, play: "a",
    title: "Portugal 1‑2 Maroc", sub: "80ᵉ — comeback obligatoire" },
];

const flagImg = (iso: string): string => "/img-proxy?u=" + encodeURIComponent(`https://flagcdn.com/w160/${iso}.png`);
const isoCode = (iso: string): string => (iso.includes("-") ? iso.split("-")[1]! : iso).toUpperCase();

interface NativeModule { _gpf_start_challenge?: (h: number, a: number, min: number, obj: number, side: number) => void }
const mod = (): NativeModule | undefined => (window as unknown as { Module?: NativeModule }).Module;

const CSS = `
#gpf-defi { position:fixed; inset:0; z-index:2147483250; color:#fff; display:none;
  font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif; }
#gpf-defi.show { display:block; }
body.gpf-defi-open #gpf-home, body.gpf-defi-open #gpf-menu { display:none !important; }
#gpf-defi .menu-shell { position:absolute; inset:12px; display:flex; flex-direction:column; gap:12px;
  padding:18px 24px; box-sizing:border-box; background:linear-gradient(180deg,#0a1f16,#050f0b);
  border:2px solid rgba(255,255,255,.14); border-radius:6px; box-shadow:0 20px 48px rgba(0,0,0,.45); }
#gpf-defi .menu-panel-head { min-height:54px; display:flex; align-items:center; justify-content:space-between;
  gap:14px; padding:12px 14px; background:rgba(0,0,0,.28); border:2px solid rgba(255,255,255,.14); border-radius:4px; }
#gpf-defi .menu-panel-head b { color:#ffe94a; font-size:15px; font-weight:900; letter-spacing:1px; }
#gpf-defi .df-back { pointer-events:auto; cursor:pointer; min-height:38px; padding:0 14px; color:#fff;
  background:rgba(255,255,255,.12); border:2px solid rgba(255,255,255,.24); border-radius:6px; font:inherit; font-weight:800; }
#gpf-defi .df-grid { flex:1; min-height:0; overflow-y:auto; display:grid;
  grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:12px; padding-right:4px; }
#gpf-defi .df-card { display:flex; flex-direction:column; gap:8px; padding:14px; background:rgba(5,18,12,.72);
  border:1px solid rgba(255,255,255,.12); border-radius:12px; }
#gpf-defi .df-teams { display:flex; align-items:center; justify-content:center; gap:10px; font-size:15px; font-weight:900; }
#gpf-defi .df-teams img { width:30px; height:22px; object-fit:cover; border-radius:3px; box-shadow:0 0 0 1px rgba(0,0,0,.4); }
#gpf-defi .df-score { color:#ffe94a; }
#gpf-defi .df-sub { text-align:center; font-size:12px; color:#bfe6cf; min-height:16px; }
#gpf-defi .df-goal { text-align:center; font-size:12px; font-weight:800; color:#fff; background:rgba(255,255,255,.07);
  border-radius:6px; padding:6px; }
#gpf-defi .df-actions { display:flex; gap:8px; margin-top:2px; }
#gpf-defi .df-actions button { flex:1; pointer-events:auto; cursor:pointer; min-height:34px; border-radius:7px;
  border:1px solid rgba(255,255,255,.22); background:#ffe94a; color:#08120c; font:inherit; font-size:12px;
  font-weight:900; letter-spacing:.4px; }
/* in-match HUD + result overlay */
#gpf-defi-hud { position:fixed; top:64px; left:50%; transform:translateX(-50%); z-index:2147483240;
  display:none; padding:9px 18px; border-radius:999px; background:rgba(6,20,14,.9); color:#fff;
  border:1px solid rgba(255,233,74,.5); font:900 13px/1 "Segoe UI",Arial,sans-serif; letter-spacing:.4px;
  box-shadow:0 8px 22px rgba(0,0,0,.5); pointer-events:none; text-align:center; }
#gpf-defi-hud.show { display:block; }
#gpf-defi-hud small { display:block; margin-top:5px; font-weight:700; font-size:11px; color:#bfe6cf; letter-spacing:.2px; }
#gpf-defi-result { position:fixed; inset:0; z-index:2147483260; display:none; align-items:center; justify-content:center;
  background:rgba(0,0,0,.62); font-family:"Segoe UI",Arial,sans-serif; }
#gpf-defi-result.show { display:flex; }
#gpf-defi-result .card { text-align:center; padding:34px 46px; border-radius:16px; background:linear-gradient(180deg,#0d2418,#06120c);
  border:2px solid rgba(255,255,255,.16); box-shadow:0 26px 60px rgba(0,0,0,.6); }
#gpf-defi-result .big { font-size:34px; font-weight:900; letter-spacing:1px; }
#gpf-defi-result .win { color:#7ee787; } #gpf-defi-result .lose { color:#ff7b72; }
#gpf-defi-result .msg { margin:10px 0 20px; color:#cfe; font-size:14px; }
#gpf-defi-result button { pointer-events:auto; cursor:pointer; min-height:42px; padding:0 26px; border-radius:9px;
  border:1px solid rgba(255,255,255,.24); background:#ffe94a; color:#08120c; font:900 14px/1 inherit; }
`;

let root: HTMLElement | null = null;
let hud: HTMLElement | null = null;
let resultEl: HTMLElement | null = null;
let armed: { hs: number; as: number; min: number; obj: number; goal: string; label: string } | null = null;

export function showDefi(): void { root?.classList.add("show"); document.body.classList.add("gpf-defi-open"); }
export function hideDefi(): void { root?.classList.remove("show"); document.body.classList.remove("gpf-defi-open"); }

// pick a side of a challenge -> arrange it as home, launch the match
function launch(c: Challenge, side: "a" | "b"): void {
  const home = side === "a" ? c.a : c.b;
  const away = side === "a" ? c.b : c.a;
  const homeScore = side === "a" ? c.aScore : c.bScore;
  const awayScore = side === "a" ? c.bScore : c.aScore;
  applyNationOverrides({ name: home.name, color: home.color }, { name: away.name, color: away.color });
  setScoreFlags(
    { img: flagImg(home.iso), emoji: home.flag, code: isoCode(home.iso) },
    { img: flagImg(away.iso), emoji: away.flag, code: isoCode(away.iso) },
  );
  armed = {
    hs: homeScore, as: awayScore, min: c.minute, obj: c.obj, goal: OBJ_TXT[c.obj],
    label: `${home.flag} ${home.name} ${homeScore}‑${awayScore} ${away.name} ${away.flag} — ${c.minute}ᵉ`,
  };
  setPendingChallenge();  // skips the anthem; onMatchStarted -> __gpfFireChallenge
  hideDefi();
  startNativeMatch();
}

// called by homemenu.onMatchStarted once the match is rolling
function fireChallenge(): void {
  if (!armed) return;
  mod()?._gpf_start_challenge?.(armed.hs, armed.as, armed.min, armed.obj, 0);
  if (hud) {
    hud.innerHTML = `${armed.goal}<small>${armed.label}</small>`;
    hud.classList.add("show");
  }
}

function showResult(win: boolean): void {
  hud?.classList.remove("show");
  if (!resultEl) return;
  resultEl.querySelector(".big")!.textContent = win ? "DÉFI RÉUSSI ✅" : "DÉFI RATÉ ❌";
  resultEl.querySelector(".big")!.className = "big " + (win ? "win" : "lose");
  resultEl.querySelector(".msg")!.textContent = win
    ? "Bravo, objectif rempli !" : "Pas cette fois — réessaie un autre défi.";
  resultEl.classList.add("show");
}

function renderGrid(grid: HTMLElement): void {
  grid.innerHTML = "";
  for (const c of CH) {
    const card = document.createElement("div");
    card.className = "df-card";
    const badge = (t: Team): string => `<img src="${flagImg(t.iso)}" alt=""><span>${isoCode(t.iso)}</span>`;
    card.innerHTML =
      `<div class="df-teams">${badge(c.a)}<span class="df-score">${c.aScore} ‑ ${c.bScore}</span>${badge(c.b)}</div>` +
      `<div class="df-sub">${c.sub}</div>` +
      `<div class="df-goal">${OBJ_TXT[c.obj]}</div>` +
      `<div class="df-actions"></div>`;
    const actions = card.querySelector(".df-actions")!;
    const mkBtn = (label: string, side: "a" | "b"): void => {
      const b = document.createElement("button");
      b.textContent = label;
      b.addEventListener("click", () => launch(c, side));
      actions.appendChild(b);
    };
    if (c.play === "both") { mkBtn(`Jouer ${c.a.flag}`, "a"); mkBtn(`Jouer ${c.b.flag}`, "b"); }
    else if (c.play === "a") mkBtn(`Jouer ${c.a.flag} ${c.a.name}`, "a");
    else mkBtn(`Jouer ${c.b.flag} ${c.b.name}`, "b");
    grid.appendChild(card);
  }
}

export function initDefi(): void {
  const style = document.createElement("style");
  style.id = "gpf-defi-style"; style.textContent = CSS;
  document.head.appendChild(style);

  root = document.createElement("div");
  root.id = "gpf-defi";
  root.innerHTML = `
    <div class="menu-shell">
      <div class="menu-panel-head">
        <button class="df-back">← Menu</button>
        <b>DÉFIS</b>
        <span style="width:70px"></span>
      </div>
      <div class="df-grid"></div>
    </div>`;
  root.querySelector(".df-back")!.addEventListener("click", hideDefi);
  renderGrid(root.querySelector<HTMLElement>(".df-grid")!);
  document.body.appendChild(root);

  hud = document.createElement("div");
  hud.id = "gpf-defi-hud";
  document.body.appendChild(hud);

  resultEl = document.createElement("div");
  resultEl.id = "gpf-defi-result";
  resultEl.innerHTML = `<div class="card"><div class="big"></div><div class="msg"></div><button>Retour au menu</button></div>`;
  resultEl.querySelector("button")!.addEventListener("click", () => {
    resultEl!.classList.remove("show");
    endChallengeSession();
    showHome();
  });
  document.body.appendChild(resultEl);

  // hooks the C++ / homemenu call into
  (window as unknown as { __gpfFireChallenge?: () => void }).__gpfFireChallenge = fireChallenge;
  (window as unknown as { gpfChallengeResult?: (win: number) => void }).gpfChallengeResult = (win) => showResult(!!win);
}
