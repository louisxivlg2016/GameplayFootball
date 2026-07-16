/**
 * On-screen touch controls for phones/tablets: a directional joystick on the
 * left (→ arrow keys) and four action buttons on the right (→ the game's
 * W/S/D/E keys), pushed into SDL via Module._gpf_game_key. Shown only during
 * live open play on a touch device (or with ?touch=1), hidden in menus/drills.
 */
import { isDrillSession } from "./homemenu";

const KEY = {
  UP: 1073741906, DOWN: 1073741905, LEFT: 1073741904, RIGHT: 1073741903,
  W: 119, S: 115, D: 100, E: 101, A: 97, Q: 113,
};
interface BtnCfg { label: string; code: number }
// 4 slots: [top-left, top-right, bottom-left, bottom-right]
const ATTACK: BtnCfg[] = [
  { label: "PASSER EN PROFONDEUR", code: KEY.W }, // through pass
  { label: "TIRER", code: KEY.D },                // shot
  { label: "PASSER", code: KEY.S },               // short pass
  { label: "ACCÉLÉRER & GESTES", code: KEY.E },   // sprint
];
const DEFEND: BtnCfg[] = [
  { label: "PRESSER", code: KEY.S },              // pressure
  { label: "TACLE", code: KEY.A },                // sliding tackle
  { label: "CHANGER DE JOUEUR", code: KEY.Q },    // switch player
  { label: "ACCÉLÉRER", code: KEY.E },            // sprint
];
interface Mod { _gpf_game_key?: (keycode: number, down: number) => void }
const gk = (code: number, down: boolean): void => {
  const m = (window as unknown as { Module?: Mod }).Module;
  m?._gpf_game_key?.(code, down ? 1 : 0);
};

const CSS = `
#gpf-touch { position:fixed; inset:0; z-index:2147483180; display:none; pointer-events:none;
  font-family:"Segoe UI",Arial,sans-serif; touch-action:none; user-select:none; -webkit-user-select:none; }
#gpf-touch.show { display:block; }
#gpf-touch .stick-base { position:absolute; left:38px; bottom:34px; width:150px; height:150px; border-radius:50%;
  pointer-events:auto; background:radial-gradient(circle at 50% 42%,rgba(255,255,255,.14),rgba(0,0,0,.28));
  border:2px solid rgba(255,255,255,.35); box-shadow:0 8px 26px rgba(0,0,0,.4); }
#gpf-touch .stick-knob { position:absolute; left:50%; top:50%; width:70px; height:70px; margin:-35px 0 0 -35px;
  border-radius:50%; background:radial-gradient(circle at 42% 38%,#f5f5f5,#c9c9c9); border:2px solid rgba(255,255,255,.8);
  box-shadow:0 6px 14px rgba(0,0,0,.45); transition:transform .04s linear; }
#gpf-touch .btns { position:absolute; right:34px; bottom:34px; width:280px; height:280px; pointer-events:none; }
#gpf-touch .abtn { position:absolute; width:118px; height:118px; border-radius:50%; pointer-events:auto;
  display:flex; align-items:center; justify-content:center; text-align:center; padding:0 10px; box-sizing:border-box;
  color:#fff; font-size:12px; font-weight:900; letter-spacing:.3px; line-height:1.1;
  background:radial-gradient(circle at 50% 34%,rgba(255,255,255,.16),rgba(10,26,18,.72));
  border:2px solid rgba(255,255,255,.42); box-shadow:0 8px 22px rgba(0,0,0,.45); }
#gpf-touch .abtn:active,#gpf-touch .abtn.on { background:radial-gradient(circle at 50% 34%,rgba(255,233,74,.5),rgba(10,26,18,.85));
  border-color:#ffe94a; transform:scale(.94); }
#gpf-touch .abtn.b-through { left:0;   top:0; }      /* passe en profondeur */
#gpf-touch .abtn.b-shoot   { right:0;  top:0; }      /* tir */
#gpf-touch .abtn.b-pass    { left:0;   bottom:0; }   /* passe */
#gpf-touch .abtn.b-sprint  { right:0;  bottom:0; }   /* accélérer */
`;

let root: HTMLElement | null = null;
let knob: HTMLElement | null = null;
let enabled = false;

// arrow-key state so we only send changes
const dir = { UP: false, DOWN: false, LEFT: false, RIGHT: false };
function setDir(k: keyof typeof dir, on: boolean, code: number): void {
  if (dir[k] === on) return;
  dir[k] = on; gk(code, on);
}
function clearDir(): void {
  setDir("UP", false, KEY.UP); setDir("DOWN", false, KEY.DOWN);
  setDir("LEFT", false, KEY.LEFT); setDir("RIGHT", false, KEY.RIGHT);
}

function initStick(base: HTMLElement): void {
  let active = false, cx = 0, cy = 0;
  const R = 75, TH = 22; // radius, dead-zone
  const move = (clientX: number, clientY: number): void => {
    let dx = clientX - cx, dy = clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > R) { dx = dx / len * R; dy = dy / len * R; }
    if (knob) knob.style.transform = `translate(${dx}px,${dy}px)`;
    setDir("UP", dy < -TH, KEY.UP);
    setDir("DOWN", dy > TH, KEY.DOWN);
    setDir("LEFT", dx < -TH, KEY.LEFT);
    setDir("RIGHT", dx > TH, KEY.RIGHT);
  };
  const end = (): void => {
    active = false; clearDir();
    if (knob) knob.style.transform = "translate(0,0)";
  };
  base.addEventListener("pointerdown", (e) => {
    active = true;
    const r = base.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    base.setPointerCapture(e.pointerId);
    move(e.clientX, e.clientY); e.preventDefault();
  });
  base.addEventListener("pointermove", (e) => { if (active) { move(e.clientX, e.clientY); e.preventDefault(); } });
  base.addEventListener("pointerup", (e) => { end(); e.preventDefault(); });
  base.addEventListener("pointercancel", () => end());
  base.addEventListener("lostpointercapture", () => end());
}

// the four action buttons, re-labelled/re-keyed by possession
const slots: Array<{ el: HTMLElement; code: number; held: boolean }> = [];
function initBtn(el: HTMLElement): void {
  const st = { el, code: 0, held: false };
  slots.push(st);
  el.addEventListener("pointerdown", (e) => { el.classList.add("on"); st.held = true; gk(st.code, true); e.preventDefault(); });
  const up = (e: Event): void => { if (st.held) { st.held = false; gk(st.code, false); } el.classList.remove("on"); e.preventDefault(); };
  el.addEventListener("pointerup", up);
  el.addEventListener("pointerleave", up);
  el.addEventListener("pointercancel", up);
}
let mode = "";
function setMode(hasBall: boolean): void {
  const m = hasBall ? "atk" : "def";
  if (m === mode || slots.length < 4) return;
  mode = m;
  const cfg = hasBall ? ATTACK : DEFEND;
  slots.forEach((st, i) => {
    if (st.held) { st.held = false; gk(st.code, false); st.el.classList.remove("on"); } // release across the switch
    st.code = cfg[i]!.code;
    st.el.textContent = cfg[i]!.label;
  });
}

export function initTouch(): void {
  const params = new URLSearchParams(location.search);
  const forced = params.get("touch");
  const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  enabled = forced === "1" || (forced !== "0" && isTouch);
  if (!enabled) return;

  const style = document.createElement("style");
  style.id = "gpf-touch-style"; style.textContent = CSS;
  document.head.appendChild(style);

  root = document.createElement("div");
  root.id = "gpf-touch";
  root.innerHTML = `
    <div class="stick-base"><div class="stick-knob"></div></div>
    <div class="btns">
      <button class="abtn b-through">PASSER EN PROFONDEUR</button>
      <button class="abtn b-shoot">TIRER</button>
      <button class="abtn b-pass">PASSER</button>
      <button class="abtn b-sprint">ACCÉLÉRER &amp; GESTES</button>
    </div>`;
  document.body.appendChild(root);
  knob = root.querySelector(".stick-knob");
  initStick(root.querySelector(".stick-base")!);
  initBtn(root.querySelector(".b-through")!);   // top-left
  initBtn(root.querySelector(".b-shoot")!);     // top-right
  initBtn(root.querySelector(".b-pass")!);      // bottom-left
  initBtn(root.querySelector(".b-sprint")!);    // bottom-right
  setMode(true); // default attacking labels

  // show during live open play; hide in menus / drills (those have their own UI)
  const anyOverlay = (): boolean =>
    /gpf-(home|national|clubs|defi|lineup|settings|training)-open/.test(document.body.className) ||
    document.body.classList.contains("gpf-aim-active") || // free-kick trace has the screen
    !document.querySelector("#gpf-home.hidden");
  window.setInterval(() => {
    if (!root) return;
    const bridge = (window as unknown as { __gpfRadioBridge?: { ticks: number; teamId?: number; loose?: boolean } }).__gpfRadioBridge;
    const live = (bridge?.ticks ?? 0) > 0;
    // attacking buttons when the human's team (0) has the ball, else defensive
    if (live) setMode(!bridge!.loose && bridge!.teamId === 0);
    const show = live && !anyOverlay() && !isDrillSession();
    if (show === root.classList.contains("show")) return;
    root.classList.toggle("show", show);
    if (!show) { clearDir(); } // release any held keys when hiding
  }, 350);
}
