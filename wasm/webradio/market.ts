/**
 * MERCATO — spend your ballons d'or (wallet.ts) on players for a club.
 *
 * A signing is written to the transfer book (transfers.ts) and the club really
 * fields him: clubs.ts builds its line-up with clubSquad(), which splices your
 * signings in behind the keeper, so they start. You can sell a player back for
 * part of the fee.
 *
 * The catalogue (marketdata.ts) is real, active players only, each with his
 * country, age and position — searchable by name and filterable by position or
 * country.
 */
import { allClubsWithSquads } from "./clubs";
import { L, onLangChange } from "./i18n";
import { MARKET, POS_LABEL, marketCountries, type Pos, type Target } from "./marketdata";
import { clubSquad, ownsPlayer, releasePlayer, signPlayer, signingsFor } from "./transfers";
import { addCoins, coinImg, getCoins, onWalletChange, spendCoins } from "./wallet";

/** You get most of the fee back when you let a player go. */
const SELL_RATE = 0.6;

const POS_ORDER: Pos[] = ["GK", "DF", "MF", "FW"];

const CSS = `
#gpf-market { position:fixed; inset:0; z-index:2147483250; color:#fff; display:none;
  font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif; }
#gpf-market.show { display:block; }
body.gpf-market-open #gpf-menu { display:none !important; }
#gpf-market .menu-shell { position:absolute; inset:12px; display:flex; flex-direction:column; gap:10px;
  padding:16px 22px; box-sizing:border-box;
  background:linear-gradient(180deg,rgba(4,18,12,.55),rgba(4,18,12,.9)),
    url("${"/img-proxy?u=" + encodeURIComponent("https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1600&q=80")}") center 40% / cover;
  border:2px solid rgba(255,255,255,.14); border-radius:6px; box-shadow:0 20px 48px rgba(0,0,0,.45); }
#gpf-market .mk-top { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
#gpf-market .mk-top h2 { margin:0; font-size:23px; font-weight:900; letter-spacing:1px; }
#gpf-market .mk-back { pointer-events:auto; cursor:pointer; min-height:40px; padding:0 15px; color:#fff;
  background:rgba(255,255,255,.12); border:2px solid rgba(255,255,255,.24); border-radius:6px;
  font-family:inherit; font-size:14px; font-weight:800; }
#gpf-market .mk-bal { margin-left:auto; display:flex; align-items:center; gap:8px;
  padding:6px 15px 6px 8px; border-radius:999px; background:rgba(6,20,14,.8);
  border:2px solid rgba(255,214,90,.5); font-size:19px; font-weight:900; color:#ffe07a; }
#gpf-market .mk-bar { display:flex; align-items:center; gap:9px; flex-wrap:wrap; }
#gpf-market .mk-bar label { font-size:11px; font-weight:800; letter-spacing:1px;
  text-transform:uppercase; color:#b7c9ba; }
#gpf-market select, #gpf-market input.mk-q { pointer-events:auto; min-height:36px; padding:4px 11px;
  border-radius:6px; background:#0b1a13; color:#fff; border:2px solid rgba(255,255,255,.24);
  font-family:inherit; font-size:14px; font-weight:800; }
#gpf-market input.mk-q { min-width:190px; }
#gpf-market input.mk-q::placeholder { color:#7f9488; font-weight:700; }
#gpf-market .mk-pos { display:flex; gap:6px; flex-wrap:wrap; }
#gpf-market .mk-pos button { pointer-events:auto; cursor:pointer; min-height:36px; padding:0 12px;
  border-radius:999px; border:2px solid rgba(255,255,255,.2); background:rgba(255,255,255,.08);
  color:#cfe0d4; font-family:inherit; font-size:12px; font-weight:900; letter-spacing:.5px; }
#gpf-market .mk-pos button.on { background:#ffd75a; border-color:#ffd75a; color:#04140c; }
#gpf-market .mk-xi { font-size:12px; font-weight:700; color:#9fb3a6; }
#gpf-market .mk-xi b { color:#ffe07a; }
#gpf-market .mk-body { flex:1; min-height:0; display:grid; grid-template-columns:1fr 300px; gap:14px; }
#gpf-market .mk-list { overflow:auto; display:grid;
  grid-template-columns:repeat(auto-fill,minmax(244px,1fr)); gap:10px; align-content:start; padding-right:4px; }
#gpf-market .mk-none { grid-column:1/-1; padding:22px; font-size:14px; font-weight:800; color:#9fb3a6; }
#gpf-market .mk-p { display:grid; grid-template-columns:1fr auto; gap:3px 10px; align-items:center;
  padding:11px 13px; border-radius:10px; background:rgba(8,22,16,.85);
  border:2px solid rgba(255,255,255,.13); border-left-width:6px; }
#gpf-market .mk-p.t-Légende { border-left-color:#ffd75a; }
#gpf-market .mk-p.t-Superstar { border-left-color:#ff7a59; }
#gpf-market .mk-p.t-Star { border-left-color:#4ad2ff; }
#gpf-market .mk-p.t-Espoir { border-left-color:#7bff9d; }
#gpf-market .mk-p b { grid-column:1; grid-row:1; font-size:14px; font-weight:900; line-height:1.15;
  min-height:2.3em; display:flex; align-items:center; }
#gpf-market .mk-p .mk-meta { grid-column:1/3; grid-row:2; display:flex; gap:7px; flex-wrap:wrap;
  align-items:center; align-content:center; min-height:2.4em;
  font-size:11px; font-weight:800; color:#9fb3a6; }
#gpf-market .mk-p .mk-meta em { font-style:normal; padding:1px 7px; border-radius:999px;
  background:rgba(255,255,255,.1); color:#d8e6dc; text-transform:uppercase; letter-spacing:.5px; }
#gpf-market .mk-p .mk-price { grid-column:2; grid-row:1; display:flex; align-items:center; gap:5px;
  font-size:16px; font-weight:900; color:#ffe07a; white-space:nowrap; }
#gpf-market .mk-p button { grid-column:1/3; grid-row:3; margin-top:7px; pointer-events:auto; cursor:pointer;
  min-height:36px; border-radius:6px; border:2px solid rgba(255,255,255,.2); color:#04140c;
  background:#7bff9d; font-family:inherit; font-size:13px; font-weight:900; letter-spacing:.5px; }
#gpf-market .mk-p button:disabled { cursor:default; background:rgba(255,255,255,.14); color:#93a89a;
  border-color:rgba(255,255,255,.14); }
#gpf-market .mk-p.owned { border-color:rgba(123,255,157,.5); }
#gpf-market .mk-side { display:flex; flex-direction:column; gap:8px; min-height:0;
  padding:12px; border-radius:10px; background:rgba(4,16,11,.82);
  border:2px solid rgba(255,255,255,.13); }
#gpf-market .mk-side h3 { margin:0; font-size:13px; font-weight:900; letter-spacing:1px;
  text-transform:uppercase; color:#b7c9ba; }
#gpf-market .mk-side .mk-empty { font-size:12px; font-weight:700; color:#7f9488; }
#gpf-market .mk-own { overflow:auto; display:flex; flex-direction:column; gap:7px; }
#gpf-market .mk-own div { display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:8px;
  background:rgba(255,255,255,.07); font-size:13px; font-weight:800; }
#gpf-market .mk-own button { margin-left:auto; pointer-events:auto; cursor:pointer; min-height:30px;
  padding:0 10px; border-radius:6px; border:2px solid rgba(255,255,255,.22);
  background:rgba(255,120,100,.18); color:#ffb3a6; font-family:inherit; font-size:11px; font-weight:900; }
#gpf-market .mk-hint { font-size:12px; font-weight:700; color:#9fb3a6; }
@media (max-width:1000px){ #gpf-market .mk-body{ grid-template-columns:1fr; }
  #gpf-market .mk-side{ max-height:180px; } }
`;

let root: HTMLElement | null = null;
let club = "";
let query = "";
let posFilter: Pos | "" = "";
let natFilter = "";

export function showMarket(): void {
  root?.classList.add("show");
  document.body.classList.add("gpf-market-open");
  render();
}
export function hideMarket(): void {
  root?.classList.remove("show");
  document.body.classList.remove("gpf-market-open");
}

/** Fold accents so "seko" finds "Šeško" and "alvarez" finds "Álvarez". */
function fold(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function matches(t: Target): boolean {
  if (posFilter && t.pos !== posFilter) return false;
  if (natFilter && t.nat !== natFilter) return false;
  if (query) {
    const q = fold(query);
    if (!fold(t.label).includes(q) && !fold(t.nat).includes(q) && !fold(t.id).includes(q)) return false;
  }
  return true;
}

function paintBalance(): void {
  const el = root?.querySelector<HTMLElement>(".mk-bal");
  if (el) el.innerHTML = `${coinImg(24)}<span>${getCoins()}</span>`;
}

function render(): void {
  if (!root) return;
  paintBalance();

  root.querySelectorAll<HTMLElement>(".mk-pos button").forEach((b) => {
    b.classList.toggle("on", (b.dataset.pos ?? "") === posFilter);
  });

  const xi = root.querySelector<HTMLElement>(".mk-xi");
  if (xi) {
    const squad = clubSquad(club).slice(0, 11).map((n) => n.replace(/\./g, " "));
    xi.innerHTML = `${L("Onze de départ")} : <b>${squad.join(" · ")}</b>`;
  }

  const list = root.querySelector<HTMLElement>(".mk-list");
  if (list) {
    list.innerHTML = "";
    const shown = MARKET.filter(matches)
      .sort((a, b) => POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos) || b.price - a.price);
    if (!shown.length) {
      list.innerHTML = `<div class="mk-none">${L("Aucun joueur ne correspond.")}</div>`;
    }
    for (const t of shown) {
      const owned = ownsPlayer(club, t.id);
      const canPay = getCoins() >= t.price;
      const card = document.createElement("div");
      card.className = `mk-p t-${t.tier}` + (owned ? " owned" : "");
      card.innerHTML =
        `<b>${t.label}</b>` +
        `<span class="mk-price">${coinImg(16)}${t.price}</span>` +
        `<span class="mk-meta"><em>${L(POS_LABEL[t.pos])}</em>` +
        `<span>${t.flag} ${L(t.nat)}</span>` +
        `<span>${t.age} ${L("ans")}</span>` +
        `<span>${L(t.tier)}</span></span>`;
      const btn = document.createElement("button");
      btn.textContent = owned ? L("DÉJÀ DANS L'ÉQUIPE") : canPay ? L("ACHETER") : L("PAS ASSEZ");
      btn.disabled = owned || !canPay;
      btn.addEventListener("click", () => {
        if (ownsPlayer(club, t.id)) return;
        if (!spendCoins(t.price)) { render(); return; }
        signPlayer(club, t.id);
        render();
      });
      card.appendChild(btn);
      list.appendChild(card);
    }
  }

  const own = root.querySelector<HTMLElement>(".mk-own");
  if (own) {
    own.innerHTML = "";
    const mine = signingsFor(club);
    if (!mine.length) {
      own.innerHTML = `<span class="mk-empty">${L("Aucune recrue pour ce club.")}</span>`;
    }
    for (const id of mine) {
      const t = MARKET.find((m) => m.id === id);
      const back = Math.round((t?.price ?? 400) * SELL_RATE);
      const row = document.createElement("div");
      row.innerHTML = `<span>${t ? `${t.flag} ${t.label}` : id}</span>`;
      const sell = document.createElement("button");
      sell.textContent = `${L("VENDRE")} ${back}`;
      sell.addEventListener("click", () => {
        releasePlayer(club, id);
        addCoins(back, "Vente");
        render();
      });
      row.appendChild(sell);
      own.appendChild(row);
    }
  }
}

export function initMarket(): void {
  const style = document.createElement("style");
  style.id = "gpf-market-style"; style.textContent = CSS;
  document.head.appendChild(style);

  const clubs = allClubsWithSquads();
  club = localStorage.getItem("gpf-market-club") ?? clubs[0]?.code ?? "";
  if (!clubs.some((c) => c.code === club)) club = clubs[0]?.code ?? "";

  root = document.createElement("div");
  root.id = "gpf-market";
  root.innerHTML = `
    <div class="menu-shell">
      <div class="mk-top">
        <button class="mk-back" data-i18n="← Menu">${L("← Menu")}</button>
        <h2 data-i18n="MERCATO">${L("MERCATO")}</h2>
        <span class="mk-bal"></span>
      </div>
      <div class="mk-bar">
        <label data-i18n="Club">${L("Club")}</label>
        <select class="mk-sel">
          ${clubs.map((c) => `<option value="${c.code}">${c.name} — ${c.country}</option>`).join("")}
        </select>
        <input class="mk-q" type="search" placeholder="${L("Chercher un joueur…")}" autocomplete="off"
               autocapitalize="off" spellcheck="false">
        <span class="mk-pos">
          <button data-pos="" data-i18n="TOUS">${L("TOUS")}</button>
          ${POS_ORDER.map((p) => `<button data-pos="${p}" data-i18n="${POS_LABEL[p]}">${L(POS_LABEL[p])}</button>`).join("")}
        </span>
        <select class="mk-nat">
          <option value="" data-i18n="Tous les pays">${L("Tous les pays")}</option>
          ${marketCountries().map((c) => `<option value="${c}">${c}</option>`).join("")}
        </select>
      </div>
      <div class="mk-xi"></div>
      <div class="mk-body">
        <div class="mk-list"></div>
        <div class="mk-side">
          <h3 data-i18n="Tes recrues">${L("Tes recrues")}</h3>
          <div class="mk-own"></div>
          <span class="mk-hint" data-i18n="Gagne des ballons d'or en marquant et en gagnant tes matchs.">${L("Gagne des ballons d'or en marquant et en gagnant tes matchs.")}</span>
        </div>
      </div>
    </div>`;

  const sel = root.querySelector<HTMLSelectElement>(".mk-sel")!;
  sel.value = club;
  sel.addEventListener("change", () => {
    club = sel.value;
    try { localStorage.setItem("gpf-market-club", club); } catch { /* private mode */ }
    render();
  });

  const nat = root.querySelector<HTMLSelectElement>(".mk-nat")!;
  nat.addEventListener("change", () => { natFilter = nat.value; render(); });

  // The game (SDL) grabs keydown on the window and preventDefault()s it, so the
  // browser never types into the field. Rebuild the value from the key events
  // ourselves (same trick as the netplay code field) and keep them out of SDL.
  const q = root.querySelector<HTMLInputElement>(".mk-q")!;
  const sync = (): void => { query = q.value; render(); };
  q.addEventListener("keydown", (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Backspace") { q.value = q.value.slice(0, -1); e.preventDefault(); sync(); }
    else if (e.key === "Escape") { q.value = ""; e.preventDefault(); sync(); }
    else if (e.key.length === 1) { q.value += e.key; e.preventDefault(); sync(); }
  });
  q.addEventListener("keyup", (e) => e.stopPropagation());
  q.addEventListener("keypress", (e) => e.stopPropagation());
  q.addEventListener("input", sync);          // on-screen keyboards / paste / the ⨯ button

  for (const b of Array.from(root.querySelectorAll<HTMLButtonElement>(".mk-pos button"))) {
    b.addEventListener("click", () => { posFilter = (b.dataset.pos ?? "") as Pos | ""; render(); });
  }
  for (const s of Array.from(root.querySelectorAll<HTMLElement>("select"))) {
    s.addEventListener("keydown", (e) => e.stopPropagation());
  }

  root.querySelector(".mk-back")!.addEventListener("click", hideMarket);
  document.body.appendChild(root);

  onWalletChange(() => { if (root?.classList.contains("show")) render(); });
  onLangChange(() => {
    root?.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
      const k = el.dataset.i18n; if (k) el.textContent = L(k);
    });
    if (root?.classList.contains("show")) render();
  });
}
