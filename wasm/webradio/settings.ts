/**
 * HTML SETTINGS panel — brings every knob from the native SETTINGS pages
 * (Graphics / Gameplay / Audio / Controller) into the web home menu, wired to
 * the engine through the config bridge exports in gametask.cpp
 * (gpf_get/set_config_float/bool) plus gpf_set_quality and the browser
 * Fullscreen API. Opened from the golden SETTINGS button in the sidebar.
 */
interface NativeModule {
  _gpf_set_quality?: (level: number) => void;
  _gpf_rebind_key?: (action: number, keycode: number) => void;
  _gpf_get_key?: (action: number) => number;
  ccall?: (name: string, ret: string | null, types: string[], args: unknown[]) => unknown;
}
import { L, onLangChange } from "./i18n";

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

// match settings (difficulty + duration). Read by the match at kickoff
// (match.cpp: match_difficulty, match_duration). The engine config is ephemeral
// on the web (MEMFS, no IDBFS), so we PERSIST these in localStorage and re-apply
// them on boot — exactly like the graphics quality level. They used to live on
// the old pre-match "Match options" screen (now removed); set them here instead.
const MATCH_DIFF_LS = "gpf-difficulty";
const MATCH_DUR_LS = "gpf-duration";
// "Force réaliste des équipes": scale each team by its nation's OVR so weak sides
// play worse and strong sides better (read by friendly.ts at kickoff). Persisted
// here; default off. See strengthFromOvr() in friendly.ts.
const REALISTIC_LS = "gpf-realistic";
const DEF_DIFFICULTY = 0.6;
const DEF_DURATION = 0.1;   // match.cpp maps 0.1 -> ~3 min in-play (the default)
function lsGet(key: string, def: number): number {
  try { const v = localStorage.getItem(key); if (v !== null) { const n = parseFloat(v); if (Number.isFinite(n)) return n; } } catch { /* private */ }
  return def;
}
function lsSet(key: string, val: number): void { try { localStorage.setItem(key, String(val)); } catch { /* private */ } }
// match_duration (0..1) -> whole in-play minutes (match.cpp: 1 + v*20)
function durationToMin(v: number): number { return Math.round(1 + v * 20); }

// re-apply the saved match settings to the engine on boot (config is ephemeral),
// so a fresh page loads at 3-minute matches by default and remembers any change.
export function applySavedMatchSettings(): void {
  const m = M();
  if (!m?.ccall) { window.setTimeout(applySavedMatchSettings, 2000); return; }
  setF("match_difficulty", lsGet(MATCH_DIFF_LS, DEF_DIFFICULTY));
  setF("match_duration", lsGet(MATCH_DUR_LS, DEF_DURATION));
}

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

// rebindable keyboard actions, in e_ButtonFunction order (matches the engine's
// input_keyboard_<i> config index). label + section header for the first row.
const KEYS: Array<[string, string?]> = [
  ["Haut", "Déplacement"], ["Droite"], ["Bas"], ["Gauche"],
  ["Passe en profondeur", "Avec le ballon"], ["Centre / lob"], ["Passe"], ["Tir"],
  ["Gardien à la balle", "Sans le ballon"], ["Tacle glissé"], ["Pressing"], ["Pressing d'équipe"],
  ["Changer de joueur", "Général"], ["Spécial / geste"], ["Sprint"], ["Dribble lent"],
  ["Sélection"], ["Valider / démarrer"],
];
// SDL_Keycode defaults (defaultKeyIDs in gamedefines.hpp)
const DEFAULT_KEYS = [
  1073741906, 1073741903, 1073741905, 1073741904, // up right down left
  119, 97, 115, 100,   // W A S D  (on ball)
  119, 97, 115, 100,   // W A S D  (off ball)
  113, 122, 101, 99,   // Q Z E C
  1073741882, 13,      // F1, Return
];

// map a browser KeyboardEvent to an SDL_Keycode the engine understands
function jsToSDL(e: KeyboardEvent): number | null {
  const named: Record<string, number> = {
    ArrowUp: 1073741906, ArrowDown: 1073741905, ArrowLeft: 1073741904, ArrowRight: 1073741903,
    Enter: 13, Escape: 27, " ": 32, Spacebar: 32, Tab: 9, Backspace: 8, Delete: 127,
    F1: 1073741882, F2: 1073741883, F3: 1073741884, F4: 1073741885, F5: 1073741886, F6: 1073741887,
    F7: 1073741888, F8: 1073741889, F9: 1073741890, F10: 1073741891, F11: 1073741892, F12: 1073741893,
  };
  if (e.key === "Shift") return e.code === "ShiftRight" ? 1073742053 : 1073742049;
  if (e.key === "Control") return e.code === "ControlRight" ? 1073742052 : 1073742048;
  if (e.key === "Alt") return e.code === "AltRight" ? 1073742054 : 1073742050;
  if (named[e.key] !== undefined) return named[e.key];
  if (e.key.length === 1) {
    const c = e.key.toLowerCase().charCodeAt(0);
    if (c >= 32 && c < 127) return c;
  }
  return null;
}
// SDL_Keycode -> short display name
function sdlName(kc: number): string {
  const rev: Record<number, string> = {
    1073741906: "↑", 1073741905: "↓", 1073741904: "←", 1073741903: "→",
    13: "Entrée", 27: "Échap", 32: "Espace", 9: "Tab", 8: "⌫", 127: "Suppr",
    1073742049: "Maj G", 1073742053: "Maj D", 1073742048: "Ctrl G", 1073742052: "Ctrl D",
    1073742050: "Alt", 1073742054: "Alt Gr",
    1073741882: "F1", 1073741883: "F2", 1073741884: "F3", 1073741885: "F4", 1073741886: "F5",
    1073741887: "F6", 1073741888: "F7", 1073741889: "F8", 1073741890: "F9", 1073741891: "F10",
    1073741892: "F11", 1073741893: "F12",
  };
  if (rev[kc]) return rev[kc];
  if (kc >= 33 && kc < 127) return String.fromCharCode(kc).toUpperCase();
  return "?";
}

const KEYS_LS = "gpf-keys"; // { action: keycode } overrides, persisted
function loadSavedKeys(): Record<number, number> {
  try { return JSON.parse(localStorage.getItem(KEYS_LS) || "{}"); } catch { return {}; }
}
function saveKey(action: number, keycode: number): void {
  const all = loadSavedKeys(); all[action] = keycode;
  try { localStorage.setItem(KEYS_LS, JSON.stringify(all)); } catch { /* private */ }
}
function currentKey(action: number): number {
  const saved = loadSavedKeys();
  if (saved[action] !== undefined) return saved[action];
  const live = M()?._gpf_get_key?.(action);
  return live && live > 0 ? live : DEFAULT_KEYS[action];
}
function rebind(action: number, keycode: number): void {
  M()?._gpf_rebind_key?.(action, keycode);
  saveKey(action, keycode);
}
// re-apply persisted rebinds to the engine on boot (like the quality level)
export function applySavedKeys(): void {
  const m = M();
  if (!m?._gpf_rebind_key) { window.setTimeout(applySavedKeys, 2000); return; }
  const saved = loadSavedKeys();
  for (const k of Object.keys(saved)) m._gpf_rebind_key(Number(k), saved[Number(k)]);
}

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
#gpf-settings .set-section { font-size:11px; font-weight:900; letter-spacing:1.2px; text-transform:uppercase;
  color:#9fe6b6; margin:6px 0 -4px 2px; }
#gpf-settings .set-keyrow { display:flex; align-items:center; justify-content:space-between; gap:12px;
  padding:9px 14px; background:rgba(5,18,12,.55); border:1px solid rgba(255,255,255,.1); border-radius:8px;
  font-size:13px; font-weight:700; }
#gpf-settings .set-key { pointer-events:auto; cursor:pointer; min-width:120px; min-height:34px; padding:0 14px;
  color:#08120c; background:#ffe94a; border:1px solid #fff3a6; border-radius:7px; font:inherit; font-size:12px;
  font-weight:900; letter-spacing:.5px; }
#gpf-settings .set-key.capturing { color:#fff; background:#c0392b; border-color:#e57368; animation:gpfblink 1s infinite; }
@keyframes gpfblink { 50% { opacity:.5; } }
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

// a slider persisted to localStorage (for match settings), with a custom value
// formatter (e.g. minutes) and a callback to push the value into the engine.
function persistedRow(label: string, ls: string, def: number,
                      fmt: (v: number) => string, apply: (v: number) => void): HTMLElement {
  const row = document.createElement("div");
  row.className = "set-row";
  const cur = lsGet(ls, def);
  row.innerHTML =
    `<div class="set-label"><span>${label}</span><span class="set-val">${fmt(cur)}</span></div>` +
    `<input type="range" min="0" max="100" value="${Math.round(cur * 100)}">`;
  const input = row.querySelector("input")!;
  const val = row.querySelector(".set-val")!;
  input.addEventListener("input", () => {
    const v = Number(input.value) / 100;
    val.textContent = fmt(v);
    lsSet(ls, v);
    apply(v);
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
  qRow.innerHTML = `<div class="set-label"><span>${L("Qualité graphique (CPU / GPU)")}</span></div><div class="set-btns"></div>`;
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
  note.textContent = "Potato = le plus rapide (l'image reste nette, mais se rafraîchit moins souvent). Ultra = le plus fluide visuellement.";
  qRow.appendChild(note);
  body.appendChild(qRow);
  // fullscreen
  const fRow = document.createElement("div");
  fRow.className = "set-row";
  fRow.innerHTML = `<div class="set-label"><span>${L("Plein écran")}</span></div>`;
  const tgl = document.createElement("button");
  tgl.className = "set-toggle";
  const sync = (): void => {
    const on = !!document.fullscreenElement;
    tgl.classList.toggle("on", on);
    tgl.textContent = on ? L("✔ Plein écran activé") : L("Activer le plein écran");
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

// a boolean toggle persisted to localStorage ("1"/"0"), with an optional note.
function toggleRow(label: string, ls: string, def: boolean, note?: string): HTMLElement {
  const row = document.createElement("div");
  row.className = "set-row";
  let on = def;
  try { const v = localStorage.getItem(ls); if (v !== null) on = v === "1"; } catch { /* private */ }
  row.innerHTML = `<div class="set-label"><span>${L(label)}</span></div>`;
  const tgl = document.createElement("button");
  tgl.className = "set-toggle";
  const paint = (): void => {
    tgl.classList.toggle("on", on);
    tgl.textContent = on ? L("✔ Activé") : L("Désactivé");
  };
  tgl.addEventListener("click", () => {
    on = !on;
    try { localStorage.setItem(ls, on ? "1" : "0"); } catch { /* private */ }
    paint();
  });
  paint();
  row.appendChild(tgl);
  if (note) {
    const n = document.createElement("div");
    n.className = "set-note"; n.textContent = note;
    row.appendChild(n);
  }
  return row;
}

function renderGameplay(): void {
  if (!body) return;
  body.innerHTML = "";
  const matchHdr = document.createElement("div");
  matchHdr.className = "set-section"; matchHdr.textContent = L("Match");
  body.appendChild(matchHdr);
  body.appendChild(persistedRow(L("Difficulté du CPU (Humain vs CPU)"), MATCH_DIFF_LS, DEF_DIFFICULTY,
    (v) => `${Math.round(v * 100)}%`, (v) => setF("match_difficulty", v)));
  body.appendChild(persistedRow(L("Durée du match"), MATCH_DUR_LS, DEF_DURATION,
    (v) => `≈ ${durationToMin(v)} min`, (v) => setF("match_duration", v)));
  body.appendChild(toggleRow("Force réaliste des équipes", REALISTIC_LS, false,
    L("Chaque équipe joue à son vrai niveau (selon son OVR) : les nations faibles jouent moins bien, les grandes nations mieux. Désactivé = toutes à niveau égal.")));
  const assistHdr = document.createElement("div");
  assistHdr.className = "set-section"; assistHdr.textContent = L("Assistances");
  body.appendChild(assistHdr);
  for (const [label, key, def] of GAMEPLAY) body.appendChild(sliderRow(L(label), key, def));
  const resetRow = document.createElement("div");
  resetRow.className = "set-btns set-reset";
  const reset = document.createElement("button");
  reset.textContent = L("↺ Valeurs d'usine");
  reset.addEventListener("click", () => {
    lsSet(MATCH_DIFF_LS, DEF_DIFFICULTY); setF("match_difficulty", DEF_DIFFICULTY);
    lsSet(MATCH_DUR_LS, DEF_DURATION); setF("match_duration", DEF_DURATION);
    try { localStorage.setItem(REALISTIC_LS, "0"); } catch { /* private */ }
    for (const [, key, def] of GAMEPLAY) setF(key, def);
    renderGameplay();
  });
  resetRow.appendChild(reset);
  body.appendChild(resetRow);
}

function renderAudio(): void {
  if (!body) return;
  body.innerHTML = "";
  body.appendChild(sliderRow(L("Volume du jeu"), "audio_volume", 0.5));
  const note = document.createElement("div");
  note.className = "set-note";
  note.textContent = "Astuce : les pastilles SON et RADIO STADE (en haut à droite) coupent la voix du commentateur et la musique du menu.";
  body.appendChild(note);
}

let capturing = false; // a rebind is waiting for a keypress

function renderControls(): void {
  if (!body) return;
  capturing = false;
  body.innerHTML = "";
  KEYS.forEach(([label, section], action) => {
    if (section) {
      const h = document.createElement("div");
      h.className = "set-section"; h.textContent = L(section);
      body!.appendChild(h);
    }
    const row = document.createElement("div");
    row.className = "set-keyrow";
    row.innerHTML = `<span>${L(label)}</span>`;
    const btn = document.createElement("button");
    btn.className = "set-key";
    btn.textContent = sdlName(currentKey(action));
    btn.addEventListener("click", () => {
      if (capturing) return;
      capturing = true;
      btn.classList.add("capturing");
      btn.textContent = "…appuie sur une touche";
      const onKey = (e: KeyboardEvent): void => {
        e.preventDefault(); e.stopPropagation();
        window.removeEventListener("keydown", onKey, true);
        capturing = false;
        btn.classList.remove("capturing");
        if (e.key === "Escape") { btn.textContent = sdlName(currentKey(action)); return; } // cancel
        const kc = jsToSDL(e);
        if (kc === null) { btn.textContent = sdlName(currentKey(action)); return; }
        rebind(action, kc);
        btn.textContent = sdlName(kc);
      };
      window.addEventListener("keydown", onKey, true);
    });
    row.appendChild(btn);
    body!.appendChild(row);
  });
  const resetRow = document.createElement("div");
  resetRow.className = "set-btns set-reset";
  const reset = document.createElement("button");
  reset.textContent = L("↺ Touches par défaut");
  reset.addEventListener("click", () => {
    try { localStorage.removeItem(KEYS_LS); } catch { /* */ }
    DEFAULT_KEYS.forEach((kc, a) => M()?._gpf_rebind_key?.(a, kc));
    renderControls();
  });
  resetRow.appendChild(reset);
  body.appendChild(resetRow);
  const note = document.createElement("div");
  note.className = "set-note";
  note.textContent = "Clique une touche puis appuie sur la nouvelle touche (Échap pour annuler). S'applique tout de suite.";
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
        <button class="set-back">${L("← Menu")}</button>
        <b>${L("RÉGLAGES")}</b>
        <span style="width:70px"></span>
      </div>
      <div class="set-tabs">
        <button class="set-tab" data-tab="graphics" data-i18n="🖥️ Graphique">${L("🖥️ Graphique")}</button>
        <button class="set-tab" data-tab="gameplay" data-i18n="🎮 Gameplay">${L("🎮 Gameplay")}</button>
        <button class="set-tab" data-tab="audio" data-i18n="🔊 Audio">${L("🔊 Audio")}</button>
        <button class="set-tab" data-tab="controls" data-i18n="⌨️ Commandes">${L("⌨️ Commandes")}</button>
      </div>
      <div class="set-body"></div>
    </div>`;
  body = root.querySelector<HTMLElement>(".set-body");
  root.querySelector(".set-back")!.addEventListener("click", hideSettings);
  root.querySelectorAll<HTMLElement>(".set-tab").forEach((t) =>
    t.addEventListener("click", () => { active = t.dataset.tab || "graphics"; render(); }));
  document.body.appendChild(root);

  // re-translate all visible settings text when the language picker changes:
  // re-set the fixed labels (built once here) and re-render the open tab body.
  onLangChange(() => {
    if (!root) return;
    const back = root.querySelector<HTMLElement>(".set-back");
    if (back) back.textContent = L("← Menu");
    const title = root.querySelector<HTMLElement>(".menu-panel-head b");
    if (title) title.textContent = L("RÉGLAGES");
    root.querySelectorAll<HTMLElement>(".set-tab").forEach((t) => {
      const key = t.dataset.i18n;
      if (key) t.textContent = L(key);
    });
    if (root.classList.contains("show")) render();
  });
}
