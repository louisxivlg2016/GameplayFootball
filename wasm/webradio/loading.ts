/**
 * Match loading screen. Booting a match (asset load + scene build) takes a while
 * on weak hardware; instead of the bare native "loading" text we cover the screen
 * with full-bleed action photos.
 *
 * IMPORTANT: the photo slideshow is a pure-CSS @keyframes animation, NOT a JS
 * timer. During the match build the single browser thread is blocked, which
 * starves setInterval/setTimeout — so a JS-driven rotation would freeze on one
 * image exactly when the loading screen is up. CSS opacity animations run on the
 * compositor thread, so the photos keep cycling (every 5s) even while the main
 * thread is frozen.
 *
 * Shown from homemenu.startNativeMatch; hidden as soon as the match is actually
 * running (onMatchStarted / anthem, plus a ticks watchdog) with a hard cap.
 */
let root: HTMLElement | null = null;
let safety: number | null = null;
let watch: number | null = null;

const LOADING_IMAGES = [
  "/uiassets/loading.jpg", "/uiassets/loading2.jpg", "/uiassets/loading3.jpg",
  "/uiassets/loading4.jpg", "/uiassets/loading5.jpg", "/uiassets/loading6.jpg",
];
const SLIDE_MS = 5000; // each photo is shown ~5s
const CYCLE_MS = LOADING_IMAGES.length * SLIDE_MS; // full loop

const CSS = `
#gpf-loading { position:fixed; inset:0; z-index:2147483300; display:none; color:#fff;
  font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif; overflow:hidden; background:#05070a; }
#gpf-loading.show { display:block; }
body.gpf-loading-open #gpf-menu, body.gpf-loading-open #gpf-home { display:none !important; }
#gpf-loading .ld-imgs { position:absolute; inset:0; }
#gpf-loading .ld-imgs img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover;
  object-position:center 30%; opacity:0; will-change:opacity;
  animation:ld-cycle ${CYCLE_MS}ms linear infinite; }
@keyframes ld-cycle {
  0%   { opacity:0; }
  2%   { opacity:1; }   /* fade in */
  ${(100 / LOADING_IMAGES.length - 2).toFixed(2)}% { opacity:1; }  /* hold ~5s */
  ${(100 / LOADING_IMAGES.length).toFixed(2)}% { opacity:0; }      /* fade out */
  100% { opacity:0; }
}
#gpf-loading .ld-veil { position:absolute; inset:0;
  background:linear-gradient(180deg,rgba(5,7,10,.35) 0%,rgba(5,7,10,.1) 40%,rgba(5,7,10,.85) 100%); }
#gpf-loading .ld-panel { position:absolute; left:0; right:0; bottom:8%; display:flex; flex-direction:column;
  align-items:center; gap:16px; padding:0 24px; }
#gpf-loading .ld-title { font-size:clamp(22px,4vw,40px); font-weight:900; letter-spacing:2px;
  text-shadow:0 3px 14px rgba(0,0,0,.7); text-transform:uppercase; }
#gpf-loading .ld-title span { color:#ffe94a; }
#gpf-loading .ld-sub { font-size:14px; font-weight:700; color:#dfe9e2; letter-spacing:1px;
  text-shadow:0 2px 8px rgba(0,0,0,.7); }
#gpf-loading .ld-bar { width:min(420px,70vw); height:8px; border-radius:999px; overflow:hidden;
  background:rgba(255,255,255,.18); box-shadow:0 2px 10px rgba(0,0,0,.5); }
#gpf-loading .ld-fill { height:100%; width:40%; border-radius:999px;
  background:linear-gradient(90deg,#ff2e63,#ffe94a); animation:ld-slide 1.1s ease-in-out infinite; }
@keyframes ld-slide { 0%{ transform:translateX(-110%);} 100%{ transform:translateX(320%);} }
#gpf-loading .ld-dots::after { content:"…"; animation:ld-dots 1.2s steps(4,end) infinite; }
@keyframes ld-dots { 0%{ content:"";} 25%{ content:".";} 50%{ content:"..";} 75%{ content:"...";} }
`;

export function initLoading(): void {
  const style = document.createElement("style");
  style.id = "gpf-loading-style"; style.textContent = CSS;
  document.head.appendChild(style);

  root = document.createElement("div");
  root.id = "gpf-loading";
  // each photo gets a staggered negative animation-delay so they take turns
  // (image i is on screen during [i*5s, (i+1)*5s] of the loop).
  const imgs = LOADING_IMAGES.map((src, i) =>
    `<img src="${src}" alt="" style="animation-delay:${i * SLIDE_MS}ms">`).join("");
  root.innerHTML = `
    <div class="ld-imgs">${imgs}</div>
    <div class="ld-veil"></div>
    <div class="ld-panel">
      <div class="ld-title">GAMEPLAY <span>FOOTBALL</span></div>
      <div class="ld-bar"><div class="ld-fill"></div></div>
      <div class="ld-sub">Chargement du match<span class="ld-dots"></span></div>
    </div>`;
  document.body.appendChild(root);
}

export function showLoading(): void {
  if (!root) return;
  root.classList.add("show");
  document.body.classList.add("gpf-loading-open");
  // SAFETY NET: hide as soon as the match is actually running (ticks climbing),
  // in case the onMatchStarted / anthem hooks don't fire.
  const bridge = () => (window as unknown as { __gpfRadioBridge?: { ticks: number } }).__gpfRadioBridge;
  const base = bridge()?.ticks ?? 0;
  if (watch !== null) window.clearInterval(watch);
  watch = window.setInterval(() => { if ((bridge()?.ticks ?? 0) > base + 2) hideLoading(); }, 800);
  if (safety !== null) window.clearTimeout(safety);
  // hard cap: never let the loading screen cover the game forever
  safety = window.setTimeout(hideLoading, 90000);
}

export function hideLoading(): void {
  if (!root) return;
  root.classList.remove("show");
  document.body.classList.remove("gpf-loading-open");
  if (watch !== null) { window.clearInterval(watch); watch = null; }
  if (safety !== null) { window.clearTimeout(safety); safety = null; }
}
