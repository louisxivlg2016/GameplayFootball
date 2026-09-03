/**
 * MERCATO — spend your ballons d'or (wallet.ts) on players for a club.
 *
 * A signing is written to the transfer book (transfers.ts) and the club really
 * fields him: clubs.ts builds its line-up with clubSquad(), which splices your
 * signings in behind the keeper, so they start. You can sell a player back for
 * part of the fee.
 */
import { allClubsWithSquads } from "./clubs";
import { L, onLangChange } from "./i18n";
import { clubSquad, ownsPlayer, releasePlayer, signPlayer, signingsFor } from "./transfers";
import { addCoins, coinImg, getCoins, onWalletChange, spendCoins } from "./wallet";

interface Target { id: string; label: string; pos: string; price: number; tier: string }

// `id` is the name the engine gets (uppercase, dots for initials — same format
// as clubsquads.ts); `label` is what the menu shows.
const MARKET: Target[] = [
  // Légendes
  { id: "MESSI", label: "Lionel Messi", pos: "AD", price: 2600, tier: "Légende" },
  { id: "C.RONALDO", label: "Cristiano Ronaldo", pos: "BU", price: 2600, tier: "Légende" },
  { id: "NEYMAR", label: "Neymar", pos: "AG", price: 2200, tier: "Légende" },
  { id: "ZIDANE", label: "Zinédine Zidane", pos: "MO", price: 2400, tier: "Légende" },
  { id: "RONALDINHO", label: "Ronaldinho", pos: "MO", price: 2400, tier: "Légende" },
  { id: "MARADONA", label: "Diego Maradona", pos: "MO", price: 2600, tier: "Légende" },
  // Superstars
  { id: "MBAPPE", label: "Kylian Mbappé", pos: "BU", price: 1900, tier: "Superstar" },
  { id: "HAALAND", label: "Erling Haaland", pos: "BU", price: 1900, tier: "Superstar" },
  { id: "BELLINGHAM", label: "Jude Bellingham", pos: "MO", price: 1700, tier: "Superstar" },
  { id: "VINICIUS", label: "Vinícius Júnior", pos: "AG", price: 1700, tier: "Superstar" },
  { id: "YAMAL", label: "Lamine Yamal", pos: "AD", price: 1800, tier: "Superstar" },
  { id: "SALAH", label: "Mohamed Salah", pos: "AD", price: 1600, tier: "Superstar" },
  { id: "KANE", label: "Harry Kane", pos: "BU", price: 1500, tier: "Superstar" },
  // Stars
  { id: "DE.BRUYNE", label: "Kevin De Bruyne", pos: "MO", price: 1200, tier: "Star" },
  { id: "LEWANDOWSKI", label: "Robert Lewandowski", pos: "BU", price: 1100, tier: "Star" },
  { id: "GRIEZMANN", label: "Antoine Griezmann", pos: "MO", price: 1100, tier: "Star" },
  { id: "MODRIC", label: "Luka Modrić", pos: "MC", price: 900, tier: "Star" },
  { id: "SON", label: "Son Heung-min", pos: "AG", price: 1000, tier: "Star" },
  { id: "MUSIALA", label: "Jamal Musiala", pos: "MO", price: 1300, tier: "Star" },
  { id: "SAKA", label: "Bukayo Saka", pos: "AD", price: 1200, tier: "Star" },
  { id: "WIRTZ", label: "Florian Wirtz", pos: "MO", price: 1300, tier: "Star" },
  { id: "RODRI", label: "Rodri", pos: "MDC", price: 1200, tier: "Star" },
  { id: "PEDRI", label: "Pedri", pos: "MC", price: 1100, tier: "Star" },
  { id: "VAN.DIJK", label: "Virgil van Dijk", pos: "DC", price: 1000, tier: "Star" },
  { id: "COURTOIS", label: "Thibaut Courtois", pos: "GB", price: 900, tier: "Star" },
  // Espoirs
  { id: "OLISE", label: "Michael Olise", pos: "AD", price: 500, tier: "Espoir" },
  { id: "BARCOLA", label: "Bradley Barcola", pos: "AG", price: 450, tier: "Espoir" },
  { id: "ZAIRE.EMERY", label: "Warren Zaïre-Emery", pos: "MC", price: 400, tier: "Espoir" },
  { id: "ENDRICK", label: "Endrick", pos: "BU", price: 450, tier: "Espoir" },
  { id: "CUBARSI", label: "Pau Cubarsí", pos: "DC", price: 400, tier: "Espoir" },
  { id: "GITTENS", label: "Jamie Gittens", pos: "AG", price: 380, tier: "Espoir" },
  { id: "MAINOO", label: "Kobbie Mainoo", pos: "MC", price: 380, tier: "Espoir" },
  { id: "CHERKI", label: "Rayan Cherki", pos: "MO", price: 400, tier: "Espoir" },
];

/** You get most of the fee back when you let a player go. */
const SELL_RATE = 0.6;

const CSS = `
#gpf-market { position:fixed; inset:0; z-index:2147483250; color:#fff; display:none;
  font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif; }
#gpf-market.show { display:block; }
body.gpf-market-open #gpf-menu { display:none !important; }
#gpf-market .menu-shell { position:absolute; inset:12px; display:flex; flex-direction:column; gap:12px;
  padding:18px 24px; box-sizing:border-box;
  background:linear-gradient(180deg,rgba(4,18,12,.55),rgba(4,18,12,.9)),
    url("${"/img-proxy?u=" + encodeURIComponent("https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1600&q=80")}") center 40% / cover;
  border:2px solid rgba(255,255,255,.14); border-radius:6px; box-shadow:0 20px 48px rgba(0,0,0,.45); }
#gpf-market .mk-top { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
#gpf-market .mk-top h2 { margin:0; font-size:24px; font-weight:900; letter-spacing:1px; }
#gpf-market .mk-top h2 span { color:#ffd75a; }
#gpf-market .mk-back { pointer-events:auto; cursor:pointer; min-height:40px; padding:0 15px; color:#fff;
  background:rgba(255,255,255,.12); border:2px solid rgba(255,255,255,.24); border-radius:6px;
  font-family:inherit; font-size:14px; font-weight:800; }
#gpf-market .mk-bal { margin-left:auto; display:flex; align-items:center; gap:8px;
  padding:6px 15px 6px 8px; border-radius:999px; background:rgba(6,20,14,.8);
  border:2px solid rgba(255,214,90,.5); font-size:19px; font-weight:900; color:#ffe07a; }
#gpf-market .mk-club { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
#gpf-market .mk-club label { font-size:12px; font-weight:800; letter-spacing:1px;
  text-transform:uppercase; color:#b7c9ba; }
#gpf-market select { pointer-events:auto; min-height:38px; padding:4px 10px; border-radius:6px;
  background:#0b1a13; color:#fff; border:2px solid rgba(255,255,255,.24);
  font-family:inherit; font-size:15px; font-weight:800; }
#gpf-market .mk-xi { font-size:12px; font-weight:700; color:#9fb3a6; }
#gpf-market .mk-xi b { color:#ffe07a; }
#gpf-market .mk-body { flex:1; min-height:0; display:grid; grid-template-columns:1fr 300px; gap:14px; }
#gpf-market .mk-list { overflow:auto; display:grid;
  grid-template-columns:repeat(auto-fill,minmax(232px,1fr)); gap:10px; align-content:start; padding-right:4px; }
#gpf-market .mk-p { display:grid; grid-template-columns:1fr auto; gap:4px 10px; align-items:center;
  padding:11px 13px; border-radius:10px; background:rgba(8,22,16,.82);
  border:2px solid rgba(255,255,255,.13); border-left-width:6px; }
#gpf-market .mk-p.t-Légende { border-left-color:#ffd75a; }
#gpf-market .mk-p.t-Superstar { border-left-color:#ff7a59; }
#gpf-market .mk-p.t-Star { border-left-color:#4ad2ff; }
#gpf-market .mk-p.t-Espoir { border-left-color:#7bff9d; }
#gpf-market .mk-p b { font-size:15px; font-weight:900; }
#gpf-market .mk-p small { grid-column:1; font-size:11px; font-weight:800; color:#9fb3a6;
  text-transform:uppercase; letter-spacing:1px; }
#gpf-market .mk-p .mk-price { grid-row:1/3; display:flex; align-items:center; gap:5px;
  font-size:16px; font-weight:900; color:#ffe07a; }
#gpf-market .mk-p button { grid-column:1/3; margin-top:6px; pointer-events:auto; cursor:pointer;
  min-height:36px; border-radius:6px; border:2px solid rgba(255,255,255,.2); color:#04140c;
  background:#7bff9d; font-family:inherit; font-size:13px; font-weight:900; letter-spacing:.5px; }
#gpf-market .mk-p button:disabled { cursor:default; background:rgba(255,255,255,.14); color:#93a89a;
  border-color:rgba(255,255,255,.14); }
#gpf-market .mk-p.owned { border-color:rgba(123,255,157,.5); }
#gpf-market .mk-side { display:flex; flex-direction:column; gap:8px; min-height:0;
  padding:12px; border-radius:10px; background:rgba(4,16,11,.8);
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
  #gpf-market .mk-side{ max-height:190px; } }
`;

let root: HTMLElement | null = null;
let club = "";

export function showMarket(): void {
  root?.classList.add("show");
  document.body.classList.add("gpf-market-open");
  render();
}
export function hideMarket(): void {
  root?.classList.remove("show");
  document.body.classList.remove("gpf-market-open");
}

function paintBalance(): void {
  const el = root?.querySelector<HTMLElement>(".mk-bal");
  if (el) el.innerHTML = `${coinImg(24)}<span>${getCoins()}</span>`;
}

function render(): void {
  if (!root) return;
  paintBalance();

  const xi = root.querySelector<HTMLElement>(".mk-xi");
  if (xi) {
    const squad = clubSquad(club).slice(0, 11).map((n) => n.replace(/\./g, " "));
    xi.innerHTML = `${L("Onze de départ")} : <b>${squad.join(" · ")}</b>`;
  }

  const list = root.querySelector<HTMLElement>(".mk-list");
  if (list) {
    list.innerHTML = "";
    for (const t of MARKET) {
      const owned = ownsPlayer(club, t.id);
      const canPay = getCoins() >= t.price;
      const card = document.createElement("div");
      card.className = `mk-p t-${t.tier}` + (owned ? " owned" : "");
      card.innerHTML =
        `<b>${t.label}</b>` +
        `<span class="mk-price">${coinImg(16)}${t.price}</span>` +
        `<small>${t.pos} · ${L(t.tier)}</small>`;
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
      row.innerHTML = `<span>${t?.label ?? id}</span>`;
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
        <h2>${L("MERCATO")} <span>⚽</span></h2>
        <span class="mk-bal"></span>
      </div>
      <div class="mk-club">
        <label data-i18n="Club">${L("Club")}</label>
        <select class="mk-sel">
          ${clubs.map((c) => `<option value="${c.code}">${c.name} — ${c.country}</option>`).join("")}
        </select>
        <span class="mk-hint" data-i18n="Gagne des ballons d'or en marquant et en gagnant tes matchs.">${L("Gagne des ballons d'or en marquant et en gagnant tes matchs.")}</span>
      </div>
      <div class="mk-xi"></div>
      <div class="mk-body">
        <div class="mk-list"></div>
        <div class="mk-side">
          <h3 data-i18n="Tes recrues">${L("Tes recrues")}</h3>
          <div class="mk-own"></div>
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
  // SDL swallows key events on the window; keep them inside the picker
  sel.addEventListener("keydown", (e) => e.stopPropagation());

  root.querySelector(".mk-back")!.addEventListener("click", hideMarket);
  document.body.appendChild(root);

  onWalletChange(() => { if (root?.classList.contains("show")) { paintBalance(); render(); } });
  onLangChange(() => {
    root?.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
      const k = el.dataset.i18n; if (k) el.textContent = L(k);
    });
    if (root?.classList.contains("show")) render();
  });
}
