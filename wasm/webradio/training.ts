/**
 * "Entraînement" exercise picker — shown when the ENTRAINEMENT card is clicked.
 * Four image tiles (Penalty / Coup franc / Corner / Dribble). Clicking one hides
 * the menus and starts the C++ match (the native build has no separate drill
 * modes yet, so every tile launches a normal match for now).
 */
import { setPendingDrill, startNativeMatch } from "./homemenu";

// setPiece = e_SetPiece value (FreeKick=3, Corner=4, Penalty=6; 0 = open play)
interface Drill { label: string; sub: string; img: string; setPiece: number }
const DRILLS: Drill[] = [
  { label: "Penalty", sub: "Tire au but face au gardien", img: "/menu-assets/training/penalty.jpeg", setPiece: 6 },
  { label: "Coup franc", sub: "Passe le mur", img: "/menu-assets/training/freekick.jpeg", setPiece: 3 },
  { label: "Corner", sub: "Centre depuis le corner", img: "/menu-assets/training/corner.jpeg", setPiece: 4 },
  { label: "Dribble", sub: "Élimine ton adversaire", img: "/menu-assets/training-tackle.png", setPiece: 0 },
];

const CSS = `
#gpf-training { position:fixed; inset:0; z-index:2147483250; color:#fff; display:none;
  font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif; }
#gpf-training.show { display:block; }
body.gpf-training-open #gpf-menu { display:none !important; }
#gpf-training .menu-shell { position:absolute; inset:12px; display:flex; flex-direction:column; gap:14px;
  padding:20px 26px; box-sizing:border-box;
  background:linear-gradient(180deg,rgba(5,22,15,.42),rgba(5,22,15,.82)),
    url("${"/img-proxy?u=" + encodeURIComponent("https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1600&q=80")}") center 48% / cover;
  border:2px solid rgba(255,255,255,.14); border-radius:6px; box-shadow:0 20px 48px rgba(0,0,0,.45); }
#gpf-training .t-top { display:flex; align-items:center; gap:16px; }
#gpf-training .t-top h2 { margin:0; font-size:26px; font-weight:900; letter-spacing:1px; }
#gpf-training .t-top h2 span { color:#4ad2ff; }
#gpf-training .t-back { pointer-events:auto; cursor:pointer; min-height:42px; padding:0 16px; color:#fff;
  background:rgba(255,255,255,.12); border:2px solid rgba(255,255,255,.24); border-radius:6px;
  font-family:inherit; font-size:14px; font-weight:800; }
#gpf-training .t-grid { flex:1; min-height:0; display:grid; grid-template-columns:repeat(2,1fr);
  grid-template-rows:repeat(2,1fr); gap:16px; }
#gpf-training .t-card { position:relative; pointer-events:auto; cursor:pointer; overflow:hidden; border-radius:12px;
  border:3px solid rgba(255,255,255,.22); box-shadow:0 16px 30px rgba(0,0,0,.42); background:#0c1119;
  padding:0; font-family:inherit; text-align:left; }
#gpf-training .t-card img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover;
  transition:transform .25s; }
#gpf-training .t-card:hover img { transform:scale(1.05); }
#gpf-training .t-card::after { content:""; position:absolute; inset:0;
  background:linear-gradient(180deg,transparent 35%,rgba(0,4,10,.86)); }
#gpf-training .t-card .t-cap { position:absolute; left:18px; bottom:14px; right:18px; z-index:1; }
#gpf-training .t-card .t-cap b { display:block; font-size:26px; font-weight:900; text-shadow:0 3px 12px rgba(0,0,0,.8); }
#gpf-training .t-card .t-cap em { font-style:normal; font-weight:700; font-size:13px; opacity:.9;
  text-shadow:0 2px 8px rgba(0,0,0,.8); }
#gpf-training .t-card:active { transform:translateY(3px); }
@media (max-width:760px){ #gpf-training .t-grid{ grid-template-columns:1fr; grid-template-rows:none; } }
`;

let root: HTMLElement | null = null;

export function showTraining(): void {
  root?.classList.add("show");
  document.body.classList.add("gpf-training-open");
}
export function hideTraining(): void {
  root?.classList.remove("show");
  document.body.classList.remove("gpf-training-open");
}

export function initTraining(): void {
  const style = document.createElement("style");
  style.id = "gpf-training-style"; style.textContent = CSS;
  document.head.appendChild(style);

  root = document.createElement("div");
  root.id = "gpf-training";
  root.innerHTML = `
    <div class="menu-shell">
      <div class="t-top">
        <button class="t-back">← Menu</button>
        <h2>Entra<span>înement</span></h2>
      </div>
      <div class="t-grid"></div>
    </div>`;

  const grid = root.querySelector(".t-grid")!;
  for (const d of DRILLS) {
    const c = document.createElement("button");
    c.className = "t-card";
    c.innerHTML = `<img src="${d.img}" alt="${d.label}"><span class="t-cap"><b>${d.label}</b><em>${d.sub}</em></span>`;
    c.addEventListener("click", () => { hideTraining(); setPendingDrill(d.setPiece); startNativeMatch(); });
    grid.appendChild(c);
  }
  root.querySelector(".t-back")!.addEventListener("click", hideTraining);

  document.body.appendChild(root);
}
