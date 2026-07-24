/**
 * Match loading screen. Booting a match (asset load + scene build) takes a while
 * on weak hardware; instead of the bare native "loading" text, we cover the
 * screen with a full-bleed action photo + a progress bar. Shown when a match is
 * launched (homemenu.startNativeMatch) and hidden as soon as the match/ceremony
 * is actually up (onMatchStarted, or the anthem banner appearing) — with a hard
 * safety timeout so it can never get stuck.
 */
let root: HTMLElement | null = null;
let safety: number | null = null;
let rotTimer: number | null = null;
let imgIdx = 0;
const ROTATE_MS = 5000; // switch to another photo every 5s while loading

// a full-bleed action photo is picked at random each time the screen shows, so
// every match load looks a bit different. Add files to wasm/uiassets to grow it.
const LOADING_IMAGES = [
  "/uiassets/loading.jpg", "/uiassets/loading2.jpg", "/uiassets/loading3.jpg",
  "/uiassets/loading4.jpg", "/uiassets/loading5.jpg", "/uiassets/loading6.jpg",
];

const CSS = `
#gpf-loading { position:fixed; inset:0; z-index:2147483300; display:none; color:#fff;
  font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif; overflow:hidden; background:#05070a; }
#gpf-loading.show { display:block; }
body.gpf-loading-open #gpf-menu, body.gpf-loading-open #gpf-home { display:none !important; }
#gpf-loading .ld-img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover;
  object-position:center 30%; transition:opacity .55s ease; }
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

  // preload every photo so the 5s rotation swaps are instant (no flash)
  for (const src of LOADING_IMAGES) { const im = new Image(); im.src = src; }

  root = document.createElement("div");
  root.id = "gpf-loading";
  root.innerHTML = `
    <img class="ld-img" src="/uiassets/loading.jpg" alt="">
    <div class="ld-veil"></div>
    <div class="ld-panel">
      <div class="ld-title">GAMEPLAY <span>FOOTBALL</span></div>
      <div class="ld-bar"><div class="ld-fill"></div></div>
      <div class="ld-sub">Chargement du match<span class="ld-dots"></span></div>
    </div>`;
  document.body.appendChild(root);
}

function setImage(i: number): void {
  const img = root?.querySelector<HTMLImageElement>(".ld-img");
  if (!img) return;
  imgIdx = ((i % LOADING_IMAGES.length) + LOADING_IMAGES.length) % LOADING_IMAGES.length;
  // gentle fade-in on swap (photos are preloaded, so the new one is ready instantly)
  img.style.opacity = "0";
  img.src = LOADING_IMAGES[imgIdx]!;
  window.requestAnimationFrame(() => { img.style.opacity = "1"; });
}

export function showLoading(): void {
  if (!root) return;
  setImage(Math.floor(Math.random() * LOADING_IMAGES.length)); // random first photo
  root.classList.add("show");
  document.body.classList.add("gpf-loading-open");
  // rotate to the next photo every 5s while the match loads
  if (rotTimer !== null) window.clearInterval(rotTimer);
  rotTimer = window.setInterval(() => setImage(imgIdx + 1), ROTATE_MS);
  if (safety !== null) window.clearTimeout(safety);
  // hard cap: never let the loading screen cover the game forever
  safety = window.setTimeout(hideLoading, 90000);
}

export function hideLoading(): void {
  if (!root) return;
  root.classList.remove("show");
  document.body.classList.remove("gpf-loading-open");
  if (rotTimer !== null) { window.clearInterval(rotTimer); rotTimer = null; }
  if (safety !== null) { window.clearTimeout(safety); safety = null; }
}
