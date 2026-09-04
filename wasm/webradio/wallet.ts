/**
 * Ballons d'or — the game's currency. You earn them by playing (a goal, a win)
 * and spend them in the transfer market (market.ts) to sign players for a club.
 *
 * The balance lives in localStorage, so it survives reloads on the device that
 * earned it. The HUD is a small coin pill shown on the menus (never over live
 * play, which would sit on top of the pitch).
 */
import { L } from "./i18n";
import { isChallengeSession, isDrillSession } from "./homemenu";

const KEY = "gpf-coins";
const START = 800;

/** Paid once at the final whistle of a normal match, and for a challenge won. */
export const MATCH_REWARD = 1000;
export const CHALLENGE_REWARD = 1000;

/** A challenge you beat pays the same as a match (called from defi.ts). */
export function rewardChallenge(): void { addCoins(CHALLENGE_REWARD, "Défi réussi"); }

const COIN_IMG = "/menu-assets/cards/coin.png";

let cached: number | null = null;
const listeners: Array<(n: number) => void> = [];

export function getCoins(): number {
  if (cached !== null) return cached;
  try {
    const raw = localStorage.getItem(KEY);
    cached = raw === null ? START : Math.max(0, Math.round(Number(raw) || 0));
  } catch { cached = START; }
  return cached;
}

function setCoins(n: number): void {
  cached = Math.max(0, Math.round(n));
  try { localStorage.setItem(KEY, String(cached)); } catch { /* private mode */ }
  paint();
  for (const cb of listeners) { try { cb(cached); } catch { /* */ } }
}

export function onWalletChange(cb: (n: number) => void): void { listeners.push(cb); }

/** Credit the wallet and float a "+N" over the coin pill. */
export function addCoins(n: number, why?: string): void {
  if (n <= 0) return;
  setCoins(getCoins() + n);
  toast(`+${n}`, why);
}

/** Debit, if there's enough. Returns false (and changes nothing) when broke. */
export function spendCoins(n: number): boolean {
  if (n <= 0) return true;
  if (getCoins() < n) return false;
  setCoins(getCoins() - n);
  toast(`−${n}`);
  return true;
}

// ---- HUD -------------------------------------------------------------------

const CSS = `
#gpf-wallet { position:fixed; top:12px; left:150px; z-index:2147483240; display:none;
  align-items:center; gap:9px; padding:7px 16px 7px 9px; border-radius:999px;
  background:rgba(6,20,14,.78); border:2px solid rgba(255,214,90,.5);
  box-shadow:0 6px 18px rgba(0,0,0,.45); font-family:"Segoe UI",Arial,sans-serif;
  color:#fff; pointer-events:none; }
/* the market screen shows its own balance in the header, so not there */
body.gpf-home-open #gpf-wallet,
body.gpf-clubs-open #gpf-wallet, body.gpf-defi-open #gpf-wallet { display:flex; }
#gpf-wallet img { width:30px; height:30px; object-fit:contain;
  filter:drop-shadow(0 2px 4px rgba(0,0,0,.6)); }
#gpf-wallet b { font-size:19px; font-weight:900; letter-spacing:.5px; color:#ffe07a; }
#gpf-wallet i { font-style:normal; font-size:11px; font-weight:800; color:#9fb3a6;
  text-transform:uppercase; letter-spacing:1px; }
#gpf-wallet .w-pop { position:absolute; left:50%; top:-4px; transform:translate(-50%,0);
  font-size:15px; font-weight:900; color:#7bff9d; text-shadow:0 2px 8px rgba(0,0,0,.8);
  opacity:0; transition:transform .9s ease-out, opacity .9s ease-out; white-space:nowrap; }
#gpf-wallet .w-pop.go { transform:translate(-50%,-26px); opacity:1; }
@media (max-width:1000px){ #gpf-wallet { left:auto; right:12px; top:56px; } }
`;

let hud: HTMLElement | null = null;

function paint(): void {
  const b = hud?.querySelector("b");
  if (b) b.textContent = String(getCoins());
}

function toast(text: string, why?: string): void {
  if (!hud) return;
  const p = document.createElement("span");
  p.className = "w-pop";
  p.textContent = why ? `${text} · ${L(why)}` : text;
  if (text.startsWith("−")) p.style.color = "#ff9b8a";
  hud.appendChild(p);
  requestAnimationFrame(() => p.classList.add("go"));
  window.setTimeout(() => p.remove(), 1100);
}

/** Coin icon markup, for other screens (market header, buy buttons). */
export function coinImg(size = 18): string {
  return `<img src="${COIN_IMG}" alt="" style="width:${size}px;height:${size}px;` +
    `object-fit:contain;vertical-align:-3px">`;
}

export function initWallet(): void {
  if (hud) return;
  const style = document.createElement("style");
  style.id = "gpf-wallet-style"; style.textContent = CSS;
  document.head.appendChild(style);

  hud = document.createElement("div");
  hud.id = "gpf-wallet";
  hud.innerHTML = `<img src="${COIN_IMG}" alt=""><b>0</b><i data-i18n="Ballons d'or">${L("Ballons d'or")}</i>`;
  document.body.appendChild(hud);
  paint();

  // Earn by playing: a full match pays MATCH_REWARD at the final whistle. A
  // CHALLENGE pays the same, but only when you actually beat it — that one is
  // credited from defi.ts (rewardChallenge), so skip the whistle there; training
  // drills pay nothing. Chain onto whatever handler is already installed
  // (replay.ts does the same) so nobody's hook is lost.
  const w = window as unknown as {
    gpfRadioEvent?: (e: string, p: string, t: number, s0: number, s1: number) => void;
  };
  const prev = w.gpfRadioEvent;
  w.gpfRadioEvent = (event, player, team, s0, s1): void => {
    try { prev?.(event, player, team, s0, s1); } finally {
      try {
        if (event === "fulltime" && !isChallengeSession() && !isDrillSession()) {
          addCoins(MATCH_REWARD, "Match joué");
        }
      } catch { /* never break the radio */ }
    }
  };
}
