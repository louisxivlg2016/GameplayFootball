/**
 * HTML SETTINGS panel — brings every knob from the native SETTINGS pages
 * (Graphics / Gameplay / Audio / Controller) into the web home menu, wired to
 * the engine through the config bridge exports in gametask.cpp
 * (gpf_get/set_config_float/bool) plus gpf_set_quality and the browser
 * Fullscreen API. Opened from the golden SETTINGS button in the sidebar.
 */
interface NativeModule {
  _gpf_set_quality?: (level: number) => void;
  ccall?: (name: string, ret: string | null, types: string[], args: unknown[]) => unknown;
}
const M = (): NativeModule | undefined => (window as unknown as { Module?: NativeModule }).Module;

const getF = (key: string, def: number): number => {
  const m = M();
  if (!m?.ccall) return def;
  try { return m.ccall("gpf_get_config_float", "number", ["string", "number"], [key, def]) as number; }
  catch { return def; }
};
const setF = (key: string, val: number): void => {
  const m = M();
  try { m?.ccall?.("gpf_set_config_float", null, ["string", "number"], [key, val]); } catch { /* not up */ }
};

// gameplay assist sliders (label, config key, factory default) — 0..1
const GAMEPLAY: Array<[string, string, number]> = [
  ["Passe courte — assistance direction", "gameplay_shortpass_autodirection", 0.4],
  ["Passe courte — assistance puissance", "gameplay_shortpass_autopower", 0.7],
  ["Passe en profondeur — direction", "gameplay_throughpass_autodirection", 0.2],
  ["Passe en profondeur — puissance", "gameplay_throughpass_autopower", 0.7],
  ["Centre / lob — direction", "gameplay_highpass_autodirection", 0.2],
  ["Centre / lob — puissance", "gameplay_highpass_autopower", 0.5],
  ["Tir — assistance direction", "gameplay_shot_autodirection", 0.2],
  ["Agilité des joueurs", "gameplay_agilityfactor", 0.5],
  ["Accélération des joueurs", "gameplay_accelerationfactor", 0.5],
  ["Quantification directionnelle (plus « D-pad »)", "gameplay_quantizeddirectionbias", 0.0],
];

// controller reference (default keyboard bindings from gamedefines.hpp)
const CONTROLS: Array<[string, string]> = [
  ["Se déplacer", "Flèches ↑ ↓ ← →"],
  ["Passe (au ballon)", "S"],
  ["Passe en profondeur", "W"],
  ["Centre / lob", "A"],
  ["Tir", "D"],
  ["Changer de joueur", "Q"],
  ["Sprint", "E"],
  ["Spécial / geste", "Z"],
  ["Dribble lent", "C"],
  ["Gardien / tacle / pressing (sans ballon)", "W / A / S / D"],
  ["Sélection", "F1"],
  ["Valider / démarrer", "Entrée"],
  ["Radio commentaire (activer/couper)", "R"],
];

const QUALITY = ["Potato", "Basse", "Moyenne", "Haute", "Ultra"];

const CSS = `
#gpf-settings { position:fixed; inset:0; z-index:2147483250; color:#fff; display:none;
  font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif; }
#gpf-settings.show { display:block; }
body.gpf-settings-open #gpf-home,
body.gpf-settings-open #gpf-menu { display:none !important; }
#gpf-settings .menu-shell { position:absolute; inset:12px; display:flex; flex-direction:column; gap:12px;
  padding:18px 24px; box-sizing:border-box;
  background:linear-gradient(180deg,#0a1f16,#050f0b);
  border:2px solid rgba(255,255,255,.14); border-radius:6px; box-shadow:0 20px 48px rgba(0,0,0,.45); }
#gpf-settings .menu-panel-head { min-height:54px; display:flex; align-items:center; justify-content:space-between;
  gap:14px; padding:12px 14px; background:rgba(0,0,0,.28); border:2px solid rgba(255,255,255,.14); border-radius:4px; }
#gpf-settings .menu-panel-head b { color:#ffe94a; font-size:15px; font-weight:900; letter-spacing:1px; }
#gpf-settings .set-back { pointer-events:auto; cursor:pointer; min-height:38px; padding:0 14px; color:#fff;
  background:rgba(255,255,255,.12); border:2px solid rgba(255,255,255,.24); border-radius:6px; font:inherit; font-weight:800; }
#gpf-settings .set-tabs { display:flex; flex-wrap:wrap; gap:8px; }
#gpf-settings .set-tab { pointer-events:auto; cursor:pointer; min-height:38px; padding:0 16px; color:#dfe9e2;
  background:rgba(5,18,12,.72); border:1px solid rgba(255,255,255,.16); border-radius:999px; font:inherit;
  font-size:12px; font-weight:900; letter-spacing:.5px; }
#gpf-settings .set-tab.active { color:#08120c; background:#ffe94a; border-color:#fff3a6; }
#gpf-settings .set-body { flex:1; min-height:0; overflow-y:auto; padding-right:6px; display:flex;
  flex-direction:column; gap:14px; }
#gpf-settings .set-row { display:flex; flex-direction:column; gap:6px; padding:12px 14px;
  background:rgba(5,18,12,.55); border:1px solid rgba(255,255,255,.1); border-radius:8px; }
#gpf-settings .set-row .set-label { display:flex; justify-content:space-between; align-items:center;
  font-size:13px; font-weight:700; }
#gpf-settings .set-row .set-val { color:#ffe94a; font-weight:900; font-variant-numeric:tabular-nums; }
#gpf-settings input[type=range] { pointer-events:auto; width:100%; accent-color:#ffe94a; }
#gpf-settings .set-btns { display:flex; flex-wrap:wrap; gap:8px; }
#gpf-settings .set-btns button { pointer-events:auto; cursor:pointer; min-height:36px; padding:0 16px;
  color:#fff; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.2); border-radius:8px;
  font:inherit; font-size:12px; font-weight:900; letter-spacing:.5px; }
#gpf-settings .set-btns button.on { color:#08120c; background:#ffe94a; border-color:#fff3a6; }
#gpf-settings .set-toggle { pointer-events:auto; cursor:pointer; min-height:38px; padding:0 18px; align-self:flex-start;
  color:#fff; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.22); border-radius:8px;
  font:inherit; font-size:13px; font-weight:900; }
#gpf-settings .set-toggle.on { color:#08120c; background:#7ee787; border-color:#b6f5bd; }
#gpf-settings .set-reset { align-self:flex-start; }
#gpf-settings .set-ref { display:grid; grid-template-columns:1fr auto; gap:6px 18px; padding:12px 14px;
  background:rgba(5,18,12,.55); border:1px solid rgba(255,255,255,.1); border-radius:8px; font-size:13px; }
#gpf-settings .set-ref .k { color:#ffe94a; font-weight:900; text-align:right; }
#gpf-settings .set-note { font-size:12px; color:#9fb3a8; }
`;

let root: HTMLElement | null = null;
let body: HTMLElement | null = null;
let active = "graphics";

export function showSettings(): void {
  root?.classList.add("show");
  document.body.classList.add("gpf-settings-open");
  render();
}
export function hideSettings(): void {
  root?.classList.remove("show");
  document.body.classList.remove("gpf-settings-open");
}

function sliderRow(label: string, key: string, def: number): HTMLElement {
  const row = document.createElement("div");
  row.className = "set-row";
  const cur = getF(key, def);
  row.innerHTML =
    `<div class="set-label"><span>${label}</span><span class="set-val">${Math.round(cur * 100)}%</span></div>` +
    `<input type="range" min="0" max="100" value="${Math.round(cur * 100)}">`;
  const input = row.querySelector("input")!;
  const val = row.querySelector(".set-val")!;
  input.addEventListener("input", () => {
    const v = Number(input.value);
    val.textContent = `${v}%`;
    setF(key, v / 100);
  });
  return row;
}

function renderGraphics(): void {
  if (!body) return;
  body.innerHTML = "";
  // quality
  const qRow = document.createElement("div");
  qRow.className = "set-row";
  let level = 4;
  try { level = parseInt(localStorage.getItem("gpf-quality") ?? "4", 10); } catch { /* */ }
  if (!Number.isFinite(level) || level < 0 || level > 4) level = 4;
  qRow.innerHTML = `<div class="set-label"><span>Qualité graphique (CPU / GPU)</span></div><div class="set-btns"></div>`;
  const btns = qRow.querySelector(".set-btns")!;
  QUALITY.forEach((name, i) => {
    const b = document.createElement("button");
    b.textContent = `${i + 1}. ${name}`;
    if (i === level) b.classList.add("on");
    b.addEventListener("click", () => {
      M()?._gpf_set_quality?.(i);
      try { localStorage.setItem("gpf-quality", String(i)); } catch { /* */ }
      btns.querySelectorAll("button").forEach((x, xi) => x.classList.toggle("on", xi === i));
    });
    btns.appendChild(b);
  });
  const note = document.createElement("div");
  note.className = "set-note";
  note.textContent = "Potato = le plus fluide (rend en basse résolution puis agrandit). Ultra = le plus beau.";
  qRow.appendChild(note);
  body.appendChild(qRow);
  // fullscreen
  const fRow = document.createElement("div");
  fRow.className = "set-row";
  fRow.innerHTML = `<div class="set-label"><span>Plein écran</span></div>`;
  const tgl = document.createElement("button");
  tgl.className = "set-toggle";
  const sync = (): void => {
    const on = !!document.fullscreenElement;
    tgl.classList.toggle("on", on);
    tgl.textContent = on ? "✔ Plein écran activé" : "Activer le plein écran";
  };
  tgl.addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
    window.setTimeout(sync, 120);
  });
  document.addEventListener("fullscreenchange", sync);
  sync();
  fRow.appendChild(tgl);
  body.appendChild(fRow);
}

function renderGameplay(): void {
  if (!body) return;
  body.innerHTML = "";
  for (const [label, key, def] of GAMEPLAY) body.appendChild(sliderRow(label, key, def));
  const resetRow = document.createElement("div");
  resetRow.className = "set-btns set-reset";
  const reset = document.createElement("button");
  reset.textContent = "↺ Valeurs d'usine";
  reset.addEventListener("click", () => {
    for (const [, key, def] of GAMEPLAY) setF(key, def);
    renderGameplay();
  });
  resetRow.appendChild(reset);
  body.appendChild(resetRow);
}

function renderAudio(): void {
  if (!body) return;
  body.innerHTML = "";
  body.appendChild(sliderRow("Volume du jeu", "audio_volume", 0.5));
  const note = document.createElement("div");
  note.className = "set-note";
  note.textContent = "Astuce : les pastilles SON et RADIO STADE (en haut à droite) coupent la voix du commentateur et la musique du menu.";
  body.appendChild(note);
}

function renderControls(): void {
  if (!body) return;
  body.innerHTML = "";
  const ref = document.createElement("div");
  ref.className = "set-ref";
  ref.innerHTML = CONTROLS.map(([a, k]) => `<div>${a}</div><div class="k">${k}</div>`).join("");
  body.appendChild(ref);
  const note = document.createElement("div");
  note.className = "set-note";
  note.textContent = "Commandes clavier par défaut (comme la version native).";
  body.appendChild(note);
}

function render(): void {
  if (!root || !body) return;
  root.querySelectorAll(".set-tab").forEach((t) =>
    t.classList.toggle("active", (t as HTMLElement).dataset.tab === active));
  if (active === "graphics") renderGraphics();
  else if (active === "gameplay") renderGameplay();
  else if (active === "audio") renderAudio();
  else renderControls();
}

export function initSettings(): void {
  const style = document.createElement("style");
  style.id = "gpf-settings-style"; style.textContent = CSS;
  document.head.appendChild(style);

  root = document.createElement("div");
  root.id = "gpf-settings";
  root.innerHTML = `
    <div class="menu-shell">
      <div class="menu-panel-head">
        <button class="set-back">← Menu</button>
        <b>RÉGLAGES</b>
        <span style="width:70px"></span>
      </div>
      <div class="set-tabs">
        <button class="set-tab" data-tab="graphics">🖥️ Graphique</button>
        <button class="set-tab" data-tab="gameplay">🎮 Gameplay</button>
        <button class="set-tab" data-tab="audio">🔊 Audio</button>
        <button class="set-tab" data-tab="controls">⌨️ Commandes</button>
      </div>
      <div class="set-body"></div>
    </div>`;
  body = root.querySelector<HTMLElement>(".set-body");
  root.querySelector(".set-back")!.addEventListener("click", hideSettings);
  root.querySelectorAll<HTMLElement>(".set-tab").forEach((t) =>
    t.addEventListener("click", () => { active = t.dataset.tab || "graphics"; render(); }));
  document.body.appendChild(root);
}
