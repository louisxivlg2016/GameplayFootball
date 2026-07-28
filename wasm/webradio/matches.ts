/**
 * "MES MATCHS" — a persistent gallery of every match you've played, reachable
 * from a button in the home menu. replay.ts already films the <canvas> during a
 * match (for instant replays); at full time it hands us the accumulated video
 * segments + metadata, which we store in IndexedDB so they survive reloads. The
 * gallery lists the saved matches (newest first) and plays any of them back as a
 * full-match film — the segments can't be concatenated into one seekable webm
 * (each carries its own header), so we play them back-to-back as a playlist.
 */

const DB_NAME = "gpf-matches";
const STORE = "matches";
const MAX_MATCHES = 8;      // keep the last N matches (video is heavy) — prune older
const SEG_SECONDS = 4;      // replay.ts SEG_MS / 1000 — used only to estimate duration

export interface MatchMeta {
  home: string;
  away: string;
  score: [number, number] | null;
  goals?: number[]; // segment index of each goal (for "revoir les buts")
}
interface MatchRecord extends MatchMeta {
  id: number;          // Date.now() at save — also the sort key
  date: string;        // ISO string for display
  mime: string;
  truncated: boolean;
  segments: Blob[];
}

// ---- IndexedDB (promise-wrapped) -------------------------------------------
let dbPromise: Promise<IDBDatabase | null> | null = null;
function openDB(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (): void => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = (): void => resolve(req.result);
      req.onerror = (): void => resolve(null);
    } catch { resolve(null); }
  });
  return dbPromise;
}
function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}
function reqAsPromise<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = (): void => resolve(r.result);
    r.onerror = (): void => reject(r.error);
  });
}

export async function saveMatch(meta: MatchMeta, segments: Blob[], truncated: boolean, mime: string): Promise<void> {
  if (!segments.length) return;
  const db = await openDB();
  if (!db) return;
  const id = Date.now();
  const rec: MatchRecord = {
    id, date: new Date(id).toISOString(),
    home: meta.home, away: meta.away, score: meta.score, goals: meta.goals || [],
    mime, truncated, segments,
  };
  try { await reqAsPromise(tx(db, "readwrite").put(rec)); } catch { return; }
  await prune(db);
  refreshGalleryIfOpen();
}

async function listRecords(db: IDBDatabase): Promise<MatchRecord[]> {
  try {
    const all = await reqAsPromise(tx(db, "readonly").getAll() as IDBRequest<MatchRecord[]>);
    return all.sort((a, b) => b.id - a.id); // newest first
  } catch { return []; }
}
async function prune(db: IDBDatabase): Promise<void> {
  const all = await listRecords(db);
  for (const r of all.slice(MAX_MATCHES)) {
    try { await reqAsPromise(tx(db, "readwrite").delete(r.id)); } catch { /* */ }
  }
}
async function deleteMatch(id: number): Promise<void> {
  const db = await openDB();
  if (!db) return;
  try { await reqAsPromise(tx(db, "readwrite").delete(id)); } catch { /* */ }
}

// ---- helpers ---------------------------------------------------------------
function fmtDuration(nSegments: number): string {
  const sec = nSegments * SEG_SECONDS;
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) + " " +
      d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

// ---- gallery + player DOM --------------------------------------------------
let galleryRoot: HTMLElement | null = null;
let listEl: HTMLElement | null = null;
let galleryOpen = false;

let fmRoot: HTMLElement | null = null;
let fmVideo: HTMLVideoElement | null = null;
let fmSegments: Blob[] = [];
let fmGoals: number[] = []; // segment indices of goals, for the "⚽ but" jump chips
let fmIndex = 0;
let fmSpeed = 1;
let fmUrl: string | null = null;

const CSS = `
#gpf-matches-btn-host { display:contents; }
#gpf-matches { position:fixed; inset:0; z-index:2147483251; display:none; color:#fff;
  font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif; }
#gpf-matches.show { display:block; }
body.gpf-matches-open #gpf-home,
body.gpf-matches-open #gpf-menu { display:none !important; }
#gpf-matches .mm-shell { position:absolute; inset:12px; display:flex; flex-direction:column; gap:12px;
  padding:18px 24px; box-sizing:border-box;
  background:linear-gradient(180deg,#0a1f16,#050f0b);
  border:2px solid rgba(255,255,255,.14); border-radius:6px; box-shadow:0 20px 48px rgba(0,0,0,.45); }
#gpf-matches .mm-head { min-height:54px; display:flex; align-items:center; justify-content:space-between;
  gap:14px; padding:12px 14px; background:rgba(0,0,0,.28); border:2px solid rgba(255,255,255,.14); border-radius:4px; }
#gpf-matches .mm-head b { color:#ffe94a; font-size:15px; font-weight:900; letter-spacing:1px; }
#gpf-matches .mm-back { pointer-events:auto; cursor:pointer; min-height:38px; padding:0 14px; color:#fff;
  background:rgba(255,255,255,.12); border:2px solid rgba(255,255,255,.24); border-radius:6px; font:inherit; font-weight:800; }
#gpf-matches .mm-list { flex:1; min-height:0; overflow-y:auto; padding-right:6px; display:flex;
  flex-direction:column; gap:10px; }
#gpf-matches .mm-row { display:flex; align-items:center; gap:14px; padding:14px 16px;
  background:rgba(5,18,12,.6); border:1px solid rgba(255,255,255,.1); border-radius:10px; }
#gpf-matches .mm-teams { flex:1; min-width:0; }
#gpf-matches .mm-teams .mm-vs { font-size:15px; font-weight:900; }
#gpf-matches .mm-teams .mm-sub { font-size:12px; color:#9fb3a8; margin-top:3px; }
#gpf-matches .mm-score { font-size:20px; font-weight:900; color:#ffe94a; font-variant-numeric:tabular-nums;
  min-width:64px; text-align:center; }
#gpf-matches .mm-row button { pointer-events:auto; cursor:pointer; min-height:40px; padding:0 16px;
  border-radius:8px; font:900 13px inherit; }
#gpf-matches .mm-play { color:#08120c; background:#ffe94a; border:1px solid #fff3a6; }
#gpf-matches .mm-del { color:#ffb3a6; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.2); }
#gpf-matches .mm-goals { color:#08120c; background:#ffe94a; border:1px solid #fff3a6; }
#gpf-matches .mm-empty { margin:auto; text-align:center; color:#9fb3a8; font-size:14px; max-width:420px; line-height:1.5; }

#gpf-fullmatch { position:fixed; inset:0; z-index:2147483252; display:none; background:#000;
  flex-direction:column; font-family:"Segoe UI",Arial,sans-serif; }
#gpf-fullmatch.show { display:flex; }
#gpf-fullmatch video { flex:1; min-height:0; width:100%; object-fit:contain; background:#000; }
#gpf-fullmatch .fm-bar { display:flex; align-items:center; gap:12px; padding:12px 18px; flex-wrap:wrap;
  background:linear-gradient(0deg,#050f0b,#0a1f16); border-top:2px solid rgba(255,255,255,.14); }
#gpf-fullmatch .fm-bar button { pointer-events:auto; cursor:pointer; min-height:40px; padding:0 16px;
  border-radius:8px; border:1px solid rgba(255,255,255,.22); background:rgba(255,255,255,.1);
  color:#fff; font:900 14px inherit; }
#gpf-fullmatch .fm-close { color:#ffb3a6; }
#gpf-fullmatch .fm-title { color:#ffe94a; font-weight:900; letter-spacing:1px; }
#gpf-fullmatch .fm-pos { color:#ffe94a; font-weight:900; font-variant-numeric:tabular-nums; min-width:120px; }
#gpf-fullmatch .fm-seek { flex:1; min-width:160px; accent-color:#ffe94a; pointer-events:auto; }
#gpf-fullmatch .fm-note { color:#9fb3a8; font-size:12px; width:100%; }
#gpf-fullmatch .fm-goals { display:flex; gap:6px; flex-wrap:wrap; }
#gpf-fullmatch .fm-goal { pointer-events:auto; cursor:pointer; min-height:36px; padding:0 12px; border-radius:8px;
  border:1px solid #fff3a6; background:#ffe94a; color:#08120c; font:900 12px "Segoe UI",Arial,sans-serif; }
`;

// ---- player ----------------------------------------------------------------
function fmFmt(sec: number): string {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
function fmUpdatePos(): void {
  if (!fmRoot || !fmVideo) return;
  const played = fmIndex * SEG_SECONDS + (fmVideo.currentTime || 0);
  const total = fmSegments.length * SEG_SECONDS;
  const pos = fmRoot.querySelector(".fm-pos");
  if (pos) pos.textContent = `${fmFmt(played)} / ~${fmFmt(total)}`;
  const seek = fmRoot.querySelector<HTMLInputElement>(".fm-seek");
  if (seek && document.activeElement !== seek) seek.value = String(fmIndex);
}
function fmLoad(i: number, autoplay: boolean): void {
  if (!fmVideo) return;
  fmIndex = Math.max(0, Math.min(i, fmSegments.length - 1));
  if (fmUrl) { try { URL.revokeObjectURL(fmUrl); } catch { /* */ } fmUrl = null; }
  const blob = fmSegments[fmIndex];
  if (!blob) return;
  fmUrl = URL.createObjectURL(blob);
  fmVideo.src = fmUrl;
  fmVideo.playbackRate = fmSpeed;
  if (autoplay) { const p = fmVideo.play(); if (p) p.catch(() => {}); }
  fmUpdatePos();
}
function fmSetPlaying(on: boolean): void {
  const btn = fmRoot?.querySelector(".fm-playpause");
  if (btn) btn.textContent = on ? "⏸" : "▶";
  if (!fmVideo) return;
  if (on) { const p = fmVideo.play(); if (p) p.catch(() => {}); } else fmVideo.pause();
}
function openPlayer(segments: Blob[], truncated: boolean, title: string, goals: number[] = []): void {
  if (!fmRoot || !segments.length) return;
  fmSegments = segments;
  fmGoals = goals.filter((g) => g >= 0 && g < segments.length);
  const seek = fmRoot.querySelector<HTMLInputElement>(".fm-seek");
  if (seek) { seek.max = String(Math.max(0, segments.length - 1)); seek.value = "0"; }
  // goal jump chips: jump to ~a segment before each goal (build-up + the goal)
  const goalsBox = fmRoot.querySelector(".fm-goals");
  if (goalsBox) {
    goalsBox.innerHTML = fmGoals.length ? "" : "";
    fmGoals.forEach((seg, i) => {
      const b = document.createElement("button");
      b.className = "fm-goal"; b.textContent = `⚽ But ${i + 1}`;
      b.addEventListener("click", () => { fmLoad(Math.max(0, seg - 1), true); fmSetPlaying(true); });
      goalsBox.appendChild(b);
    });
  }
  const t = fmRoot.querySelector(".fm-title"); if (t) t.textContent = "🎬 " + title;
  const note = fmRoot.querySelector(".fm-note");
  if (note) note.textContent = truncated ? "(début du match coupé — match trop long)" : "";
  fmSpeed = 1;
  const sp = fmRoot.querySelector(".fm-speed"); if (sp) sp.textContent = "1×";
  fmRoot.classList.add("show");
  document.body.classList.add("gpf-fullmatch-open");
  fmLoad(0, true);
  fmSetPlaying(true);
}
function closePlayer(): void {
  if (!fmRoot) return;
  fmRoot.classList.remove("show");
  document.body.classList.remove("gpf-fullmatch-open");
  if (fmVideo) { try { fmVideo.pause(); } catch { /* */ } fmVideo.removeAttribute("src"); fmVideo.load(); }
  if (fmUrl) { try { URL.revokeObjectURL(fmUrl); } catch { /* */ } fmUrl = null; }
  fmSegments = [];
}

// ---- gallery ---------------------------------------------------------------
export function showMatches(): void {
  if (!galleryRoot) return;
  galleryOpen = true;
  galleryRoot.classList.add("show");
  document.body.classList.add("gpf-matches-open");
  void renderList();
}
function hideMatches(): void {
  galleryOpen = false;
  if (galleryRoot) galleryRoot.classList.remove("show");
  document.body.classList.remove("gpf-matches-open");
}
function refreshGalleryIfOpen(): void { if (galleryOpen) void renderList(); }

async function renderList(): Promise<void> {
  if (!listEl) return;
  const db = await openDB();
  const recs = db ? await listRecords(db) : [];
  listEl.innerHTML = "";
  if (!recs.length) {
    const e = document.createElement("div");
    e.className = "mm-empty";
    e.innerHTML = "Aucun match enregistré pour l'instant.<br>Joue un match jusqu'au coup de sifflet final " +
      "(qualité <b>Basse</b> ou plus — l'enregistrement est coupé en mode Potato) et il apparaîtra ici.";
    listEl.appendChild(e);
    return;
  }
  for (const r of recs) {
    const row = document.createElement("div");
    row.className = "mm-row";
    const scoreTxt = r.score ? `${r.score[0]} - ${r.score[1]}` : "–";
    const goals = r.goals || [];
    row.innerHTML =
      `<div class="mm-teams">` +
        `<div class="mm-vs">${esc(r.home)} <span style="color:#9fb3a8">vs</span> ${esc(r.away)}</div>` +
        `<div class="mm-sub">${fmtDate(r.date)} · ${fmtDuration(r.segments.length)}${goals.length ? " · ⚽ " + goals.length : ""}${r.truncated ? " (coupé)" : ""}</div>` +
      `</div>` +
      `<div class="mm-score">${scoreTxt}</div>` +
      (goals.length ? `<button class="mm-goals">⚽ Buts</button>` : "") +
      `<button class="mm-play">▶ Revoir</button>` +
      `<button class="mm-del">🗑</button>`;
    row.querySelector(".mm-play")!.addEventListener("click", () => {
      openPlayer(r.segments, r.truncated, `${r.home} ${scoreTxt} ${r.away}`, goals);
    });
    row.querySelector(".mm-goals")?.addEventListener("click", () => {
      openPlayer(r.segments, r.truncated, `${r.home} ${scoreTxt} ${r.away}`, goals);
      if (goals.length) { fmLoad(Math.max(0, goals[0]! - 1), true); fmSetPlaying(true); }
    });
    row.querySelector(".mm-del")!.addEventListener("click", async () => {
      await deleteMatch(r.id);
      void renderList();
    });
    listEl.appendChild(row);
  }
}
function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => {
    switch (c) { case "&": return "&amp;"; case "<": return "&lt;"; case ">": return "&gt;"; case '"': return "&quot;"; default: return c; }
  });
}

export function initMatches(): void {
  const style = document.createElement("style");
  style.id = "gpf-matches-style"; style.textContent = CSS;
  document.head.appendChild(style);

  galleryRoot = document.createElement("div");
  galleryRoot.id = "gpf-matches";
  galleryRoot.innerHTML = `
    <div class="mm-shell">
      <div class="mm-head">
        <button class="mm-back">← Menu</button>
        <b>🎬 MES MATCHS</b>
        <span style="width:70px"></span>
      </div>
      <div class="mm-list"></div>
    </div>`;
  document.body.appendChild(galleryRoot);
  listEl = galleryRoot.querySelector(".mm-list");
  galleryRoot.querySelector(".mm-back")!.addEventListener("click", hideMatches);

  fmRoot = document.createElement("div");
  fmRoot.id = "gpf-fullmatch";
  fmRoot.innerHTML = `
    <video playsinline></video>
    <div class="fm-bar">
      <button class="fm-close">✕ Fermer</button>
      <button class="fm-playpause">⏸</button>
      <button class="fm-speed">1×</button>
      <span class="fm-title">🎬 MATCH COMPLET</span>
      <span class="fm-pos">0:00</span>
      <input class="fm-seek" type="range" min="0" max="0" value="0" step="1">
      <span class="fm-goals"></span>
      <span class="fm-note"></span>
    </div>`;
  document.body.appendChild(fmRoot);
  fmVideo = fmRoot.querySelector("video");

  fmRoot.querySelector(".fm-close")!.addEventListener("click", closePlayer);
  fmRoot.querySelector(".fm-playpause")!.addEventListener("click", () => {
    if (!fmVideo) return; fmSetPlaying(fmVideo.paused);
  });
  fmRoot.querySelector(".fm-speed")!.addEventListener("click", (e) => {
    fmSpeed = fmSpeed === 1 ? 2 : fmSpeed === 2 ? 4 : 1;
    if (fmVideo) fmVideo.playbackRate = fmSpeed;
    (e.currentTarget as HTMLElement).textContent = `${fmSpeed}×`;
  });
  fmRoot.querySelector<HTMLInputElement>(".fm-seek")!.addEventListener("input", (e) => {
    fmLoad(Number((e.currentTarget as HTMLInputElement).value), true);
    fmSetPlaying(true);
  });
  if (fmVideo) {
    fmVideo.addEventListener("timeupdate", fmUpdatePos);
    fmVideo.addEventListener("ended", () => {
      if (fmIndex + 1 < fmSegments.length) fmLoad(fmIndex + 1, true);
      else fmSetPlaying(false); // reached the final whistle
    });
    fmVideo.addEventListener("error", () => {
      if (fmIndex + 1 < fmSegments.length) fmLoad(fmIndex + 1, true);
    });
  }
}
