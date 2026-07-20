/**
 * Browser-side instant replay. The engine's own replay path doesn't render under
 * the wasm port, so we do it ourselves: continuously record the game <canvas>
 * with MediaRecorder while a match is live, and when the radio reports a GOAL or
 * a FOUL/PENALTY, play the last few seconds back as a zoomed-in slow-motion
 * overlay ("RALENTI"). The live match keeps running underneath — we never pause
 * the engine — so when the overlay hides, play just continues.
 *
 * Design notes:
 *  - A webm blob is only playable if it contains the recorder's first (header)
 *    chunk, so we can't cherry-pick an arbitrary time window. Instead we keep the
 *    recording bounded by rotating it every SEG_MS: each rotation stops the
 *    recorder (yielding a complete, self-contained blob = the "previous" segment)
 *    and immediately starts a fresh one. On an event we flush the current segment
 *    (which ends exactly at the goal/foul) and play [previous?, current].
 *  - MediaRecorder webm often reports duration=Infinity, so we never seek; we
 *    just play each blob to its "ended" event, with a hard wall-clock cap.
 */
import { isDrillSession } from "./homemenu";

const CANVAS_ID = "canvas";
const SEG_MS = 4000;          // rotate the recording every 4s (bounds segment length)
const RECENT_MIN_MS = 2200;   // if the current segment already holds this much, replay it alone
const SLOWMO = 0.6;           // playback speed of the replay
const ZOOM = 1.7;             // "much closer camera" — center zoom on the replay
const MAX_REPLAY_MS = 8000;   // hard cap so a replay can never drag on
const COOLDOWN_MS = 2500;     // ignore new triggers right after a replay
const MIME = pickMime();

// Recording the canvas continuously (MediaRecorder) is heavy on weak hardware, so
// scale it by the chosen graphics quality (localStorage gpf-quality, 0=potato ..
// 4=ultra) and turn the replay OFF in potato so the game stays smooth there.
function gpfQuality(): number {
  try { const q = parseInt(localStorage.getItem("gpf-quality") ?? "4", 10); return Number.isFinite(q) ? q : 4; }
  catch { return 4; }
}
function captureFps(): number { const q = gpfQuality(); return q <= 1 ? 15 : q === 2 ? 20 : 24; }

function pickMime(): string {
  const cands = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  const MR = (window as unknown as { MediaRecorder?: { isTypeSupported?: (t: string) => boolean } }).MediaRecorder;
  if (MR?.isTypeSupported) for (const c of cands) if (MR.isTypeSupported(c)) return c;
  return "video/webm";
}

// ---- recorder state --------------------------------------------------------
let canvas: HTMLCanvasElement | null = null;
let stream: MediaStream | null = null;
let rec: MediaRecorder | null = null;
let chunks: BlobPart[] = [];
let segStart = 0;
let prevBlob: Blob | null = null;
let rotateTimer: number | null = null;
let recording = false;
let replaying = false;
let lastReplayEnd = 0;
let supported = true;

function beginSegment(): void {
  if (!stream) return;
  chunks = [];
  segStart = performance.now();
  try {
    rec = new MediaRecorder(stream, { mimeType: MIME });
  } catch { supported = false; return; }
  rec.ondataavailable = (e): void => { if (e.data && e.data.size) chunks.push(e.data); };
  rec.start(); // data delivered in one go on stop()
  if (rotateTimer !== null) clearTimeout(rotateTimer);
  rotateTimer = window.setTimeout(rotate, SEG_MS);
}

// stop the current segment -> keep it as prevBlob, start a fresh one
function rotate(): void {
  if (!rec || rec.state === "inactive") return;
  rec.onstop = (): void => { prevBlob = new Blob(chunks, { type: MIME }); beginSegment(); };
  try { rec.stop(); } catch { /* already */ }
}

function startRecording(): void {
  if (recording || !supported) return;
  if (gpfQuality() <= 0) return; // potato: no instant replay — keep the game smooth
  const c = document.getElementById(CANVAS_ID) as HTMLCanvasElement | null;
  if (!c || typeof c.captureStream !== "function") { supported = false; return; }
  canvas = c;
  try { stream = c.captureStream(captureFps()); } catch { supported = false; return; }
  prevBlob = null;
  recording = true;
  beginSegment();
}

function stopRecording(): void {
  recording = false;
  if (rotateTimer !== null) { clearTimeout(rotateTimer); rotateTimer = null; }
  if (rec && rec.state !== "inactive") { rec.onstop = null; try { rec.stop(); } catch { /* */ } }
  rec = null;
  if (stream) { for (const t of stream.getTracks()) try { t.stop(); } catch { /* */ } }
  stream = null; chunks = [];
}

// ---- overlay ---------------------------------------------------------------
let root: HTMLElement | null = null;
let video: HTMLVideoElement | null = null;
let skipped = false;

const CSS = `
#gpf-replay { position:fixed; inset:0; z-index:2147483250; display:none; background:#000;
  align-items:center; justify-content:center; overflow:hidden;
  font-family:"Segoe UI",Arial,sans-serif; }
#gpf-replay.show { display:flex; }
#gpf-replay video { width:100%; height:100%; object-fit:cover; transform:scale(${ZOOM}); transform-origin:center center; }
#gpf-replay .rp-tag { position:absolute; top:22px; left:26px; display:flex; align-items:center; gap:10px;
  padding:8px 16px; border-radius:999px; background:rgba(0,0,0,.55); border:1px solid rgba(255,255,255,.3);
  color:#fff; font-weight:900; letter-spacing:2px; font-size:15px; text-transform:uppercase; }
#gpf-replay .rp-dot { width:12px; height:12px; border-radius:50%; background:#ff2e63; box-shadow:0 0 10px #ff2e63;
  animation:rp-blink 1s steps(2,start) infinite; }
@keyframes rp-blink { 50% { opacity:.25; } }
#gpf-replay .rp-scan { position:absolute; inset:0; pointer-events:none; box-shadow:inset 0 0 180px rgba(0,0,0,.7);
  background:repeating-linear-gradient(0deg,rgba(255,255,255,.03) 0 2px,transparent 2px 4px); }
#gpf-replay .rp-skip { position:absolute; bottom:26px; right:28px; pointer-events:auto; cursor:pointer;
  padding:9px 18px; border-radius:999px; border:2px solid rgba(255,255,255,.4); background:rgba(255,255,255,.14);
  color:#ffe94a; font:800 14px inherit; }
`;

let overlayShownAt = 0;
function showOverlay(label: string): void {
  if (!root) return;
  const tag = root.querySelector<HTMLElement>(".rp-label");
  if (tag) tag.textContent = label;
  root.classList.add("show");
  overlayShownAt = performance.now();
}
function hideOverlay(): void {
  if (root) root.classList.remove("show");
  if (video) { try { video.pause(); } catch { /* */ } video.removeAttribute("src"); video.load(); }
  overlayShownAt = 0;
}

// resolver for the segment currently playing — lets the cap timer / "Passer"
// button END the playback promise. Without this, pausing the <video> never fires
// "ended", so the await here would hang forever and the overlay would cover the
// screen and eat all input ("plus rien ne marche" after a foul replay).
let endCurrent: (() => void) | null = null;

function stopPlayback(): void {
  skipped = true;
  if (video) { try { video.pause(); } catch { /* */ } }
  if (endCurrent) { const r = endCurrent; endCurrent = null; r(); }
}

// Hard teardown, independent of the playback loop: guarantees the overlay closes
// and input is released even if the main thread was too busy for the loop to run
// (this is what the "Passer" button and the watchdog use, so it can NEVER stick).
function forceEnd(): void {
  skipped = true;
  if (endCurrent) { const r = endCurrent; endCurrent = null; try { r(); } catch { /* */ } }
  hideOverlay();
  replaying = false;
  lastReplayEnd = performance.now();
}

function playOne(blob: Blob): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!video || !blob || blob.size < 1000) { resolve(); return; }
    const url = URL.createObjectURL(blob);
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      if (endCurrent === finish) endCurrent = null;
      try { URL.revokeObjectURL(url); } catch { /* */ }
      resolve();
    };
    endCurrent = finish;          // cap/skip can force us to finish
    video.onended = finish;
    video.onerror = finish;
    video.src = url;
    video.playbackRate = SLOWMO;
    // hard safety net: never let a single segment hold the overlay open
    const guard = window.setTimeout(finish, MAX_REPLAY_MS + 1500);
    const clearGuard = (): void => window.clearTimeout(guard);
    void Promise.resolve().then(() => { const p = video!.play(); if (p) p.catch(finish); });
    video.addEventListener("ended", clearGuard, { once: true });
    video.addEventListener("error", clearGuard, { once: true });
  });
}

async function playReplay(label: string): Promise<void> {
  const recentMs = performance.now() - segStart;
  // flush the current segment so it ends exactly at the goal/foul, then resume
  const recent: Blob = await flushCurrent();
  const segs: Blob[] = [];
  if (recentMs < RECENT_MIN_MS && prevBlob) segs.push(prevBlob); // top up with the previous seconds
  segs.push(recent);

  skipped = false;
  replaying = true;
  showOverlay(label);
  const cap = window.setTimeout(stopPlayback, MAX_REPLAY_MS);
  try {
    for (const s of segs) { if (skipped) break; await playOne(s); }
  } catch { /* never let a playback error strand the overlay */ }
  window.clearTimeout(cap);
  hideOverlay();
  replaying = false;
  lastReplayEnd = performance.now();
}

// stop the current recorder and resolve with its blob, then immediately begin a
// fresh segment so we keep recording for the next replay.
function flushCurrent(): Promise<Blob> {
  return new Promise<Blob>((resolve) => {
    if (!rec || rec.state === "inactive") { resolve(new Blob(chunks, { type: MIME })); beginSegment(); return; }
    if (rotateTimer !== null) { clearTimeout(rotateTimer); rotateTimer = null; }
    rec.onstop = (): void => { const b = new Blob(chunks, { type: MIME }); beginSegment(); resolve(b); };
    try { rec.stop(); } catch { resolve(new Blob(chunks, { type: MIME })); beginSegment(); }
  });
}

// ---- triggers --------------------------------------------------------------
function anyOverlay(): boolean {
  return /gpf-(home|national|clubs|defi|lineup|settings|training)-open/.test(document.body.className) ||
    !document.querySelector("#gpf-home.hidden");
}
function isLive(): boolean {
  const bridge = (window as unknown as { __gpfRadioBridge?: { ticks: number } }).__gpfRadioBridge;
  return (bridge?.ticks ?? 0) > 0 && !anyOverlay() && !isDrillSession();
}

function trigger(kind: "goal" | "foul"): void {
  if (!supported || replaying || !recording || !isLive()) return;
  if (performance.now() - lastReplayEnd < COOLDOWN_MS) return;
  const label = kind === "goal" ? "⚽ Ralenti — But" : "🟨 Ralenti — Faute";
  // goals: let the net ripple / celebration read for a beat before cutting to the replay
  window.setTimeout(() => { if (isLive() && !replaying) void playReplay(label); }, kind === "goal" ? 900 : 350);
}

export function initReplay(): void {
  const style = document.createElement("style");
  style.id = "gpf-replay-style"; style.textContent = CSS;
  document.head.appendChild(style);

  root = document.createElement("div");
  root.id = "gpf-replay";
  root.innerHTML = `
    <video muted playsinline></video>
    <div class="rp-scan"></div>
    <div class="rp-tag"><span class="rp-dot"></span><span class="rp-label">Ralenti</span></div>
    <button class="rp-skip">Passer ▶</button>`;
  document.body.appendChild(root);
  video = root.querySelector("video");
  // "Passer" force-closes the overlay outright — don't depend on the async loop.
  const skipBtn = root.querySelector(".rp-skip")!;
  skipBtn.addEventListener("click", forceEnd);
  skipBtn.addEventListener("pointerdown", forceEnd);
  // tapping anywhere on the overlay also dismisses it (belt and braces)
  root.addEventListener("pointerdown", forceEnd);

  // hook the radio events (wrap whatever radioMain already installed)
  const w = window as unknown as { gpfRadioEvent?: (e: string, p: string, t: number, s0: number, s1: number) => void };
  const prev = w.gpfRadioEvent;
  w.gpfRadioEvent = (event, player, team, s0, s1): void => {
    try { prev?.(event, player, team, s0, s1); } finally {
      if (event === "goal") trigger("goal");
      else if (event === "foul" || event === "penalty") trigger("foul");
    }
  };

  // start/stop the canvas recorder as matches come and go + WATCHDOG: if the
  // overlay has been up too long (loop starved by a busy main thread), force it
  // closed so the game is never left un-clickable.
  window.setInterval(() => {
    if (overlayShownAt && performance.now() - overlayShownAt > MAX_REPLAY_MS + 2500) forceEnd();
    if (!supported) return;
    const live = isLive();
    if (live && !recording) startRecording();
    else if (!live && recording && !replaying) stopRecording();
  }, 700);
}
