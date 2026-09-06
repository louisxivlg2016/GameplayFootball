/**
 * Online multiplayer — STAGE 1 (experimental), SIMPLE version.
 *
 * No code pasting: the host gets a SHORT code (e.g. "K7FQ9"), sends it to a
 * friend by any chat, the friend types it in, and PeerJS's public broker wires
 * the two browsers together automatically over WebRTC (STUN handles home NATs).
 *
 * On top of the link runs the DETERMINISM MONITOR — the one thing Stage 1 must
 * answer: is the wasm sim identical on both machines? Both peers seed the RNG
 * from a shared value (gpf_set_rng_seed), then exchange a checksum of the sim
 * state (gpf_state_checksum) keyed by the sim frame (gpf_sim_frame). If both run
 * the SAME match untouched and the checksums stay equal → deterministic → real
 * net play is feasible later. If they diverge, we learn it now.
 */
import { Peer, type DataConnection } from "peerjs";
import { L } from "./i18n";
import { startNativeMatch } from "./homemenu";

interface NetModule {
  _gpf_set_rng_seed?: (s: number) => void;
  _gpf_sim_frame?: () => number;
  _gpf_state_checksum?: () => number;
  _gpf_net_start?: (role: number) => void;
  _gpf_net_stop?: () => void;
  _gpf_net_feed?: (frame: number, mask: number, dx: number, dy: number) => void;
  _gpf_net_apply_snapshot?: (data: string) => void;
  _gpf_set_freeze?: (on: number) => void;
  ccall?: (name: string, ret: string | null, argTypes: string[], args: unknown[]) => string;
}
const M = (): NetModule | undefined => (window as unknown as { Module?: NetModule }).Module;

let peer: Peer | null = null;
let conn: DataConnection | null = null;
let isHost = false;
let seed = 0;
let myCode = "";
let inviteUrl = "";
let joinWatch: number | null = null;
let joinAttempts = 0;

// Explicit ICE — a couple of public STUN servers so NAT traversal has options
// (the free broker only handles signalling; ICE is what actually links the two).
const ICE: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

// our recent checksums, keyed by sim frame, compared against the peer's
const own = new Map<number, number>();
const OWN_CAP = 600;
let compared = 0;
let matched = 0;
let firstDesync = -1;
let monTimer: number | null = null;

// ---- UI refs ----
let panel: HTMLElement | null = null;
let connEl: HTMLElement | null = null;
let codeEl: HTMLElement | null = null;
let seedEl: HTMLElement | null = null;
let syncEl: HTMLElement | null = null;
let inEl: HTMLInputElement | null = null;
let launchRow: HTMLElement | null = null;

// short, unambiguous code (no 0/O/1/I) — collision-safe enough for two friends
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newCode(): string {
  let c = "";
  for (let i = 0; i < 5; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return c;
}
const roomId = (code: string): string => "gpf-" + code.trim().toUpperCase();

function setConn(t: string): void { if (connEl) connEl.textContent = t; }
function send(o: unknown): void { if (conn && conn.open) conn.send(o); }

// Called from C++ (EM_ASM) once per sim tick with the local player's input for a
// future frame — relay it to the peer so their sim can apply it in lockstep.
(window as unknown as { gpfNetSend?: (f: number, mask: number, dx: number, dy: number) => void }).gpfNetSend =
  (f, mask, dx, dy): void => { if (conn && conn.open) conn.send({ t: "in", f, m: mask, x: dx, y: dy }); };

function wireConn(c: DataConnection): void {
  conn = c;
  c.on("open", () => {
    if (joinWatch !== null) { clearTimeout(joinWatch); joinWatch = null; }
    joinAttempts = 0;
    setConn(L("Connecté ✓ — clique « Lancer ensemble »"));
    if (isHost) send({ t: "seed", seed });
    if (seedEl) seedEl.textContent = `${L("Graine")}: ${seed >>> 0}`;
    if (launchRow) launchRow.style.display = "flex"; // reveal the big start button
    startMonitor();
  });
  c.on("close", () => setConn(L("Déconnecté")));
  c.on("data", (raw: unknown) => {
    const m = raw as { t: string; seed?: number; f?: number; s?: number; m?: number; x?: number; y?: number; d?: string };
    if (m.t === "seed") { seed = (m.seed ?? 0) >>> 0; if (seedEl) seedEl.textContent = `${L("Graine")}: ${seed}`; }
    else if (m.t === "chk") onPeerChecksum(m.f ?? -1, (m.s ?? 0) >>> 0);
    else if (m.t === "launch") doLaunch(); // peer pressed "Lancer ensemble" → start here too
    else if (m.t === "in") M()?._gpf_net_feed?.(m.f ?? 0, (m.m ?? 0) >>> 0, m.x ?? 0, m.y ?? 0); // peer's per-tick input
    else if (m.t === "ready") { peerReady = true; tryStartTogether(); }
    else if (m.t === "snap" && !isHost) { try { M()?.ccall?.("gpf_net_apply_snapshot", null, ["string"], [m.d ?? ""]); } catch { /* not ready */ } } // host authority → correct our sim
  });
}

function freshPeer(id?: string): Peer {
  const p = new Peer(id as string, { debug: 1, config: ICE });
  // the free broker sometimes drops the signalling socket — reconnect quietly
  p.on("disconnected", () => { try { p.reconnect(); } catch { /* destroyed */ } });
  p.on("error", (err: { type?: string }) => {
    const t = err?.type || "";
    if (t === "unavailable-id") { setConn(L("Code déjà pris — réessaie « Créer »")); }
    else if (t === "peer-unavailable") { setConn(L("Code introuvable — vérifie que l'hôte a créé la partie")); }
    else if (t === "network" || t === "server-error" || t === "socket-error" || t === "socket-closed") { setConn(L("Serveur injoignable — réessaie dans un instant")); }
    else if (t === "browser-incompatible") { setConn(L("Navigateur incompatible avec le WebRTC")); }
    else setConn(L("Erreur") + ": " + t);
  });
  return p;
}

function createGame(): void {
  isHost = true;
  seed = Math.floor(Math.random() * 0x7fffffff) >>> 0;
  myCode = newCode();
  peer?.destroy();
  peer = freshPeer(roomId(myCode));
  setConn(L("Connexion au serveur…"));
  peer.on("open", () => {
    if (codeEl) codeEl.textContent = myCode;
    inviteUrl = location.origin + location.pathname + "?gpfjoin=" + myCode;
    setConn(L("Donne le code (ou le lien) à ton ami et attends…"));
  });
  peer.on("connection", (c: DataConnection) => wireConn(c));
}

function joinGame(code: string): void {
  isHost = false;
  joinAttempts = 0;
  doJoin(code.trim().toUpperCase());
}

function doJoin(code: string): void {
  if (joinWatch !== null) { clearTimeout(joinWatch); joinWatch = null; }
  peer?.destroy();
  peer = freshPeer();
  if (codeEl) codeEl.textContent = "—";
  setConn(L("Connexion au serveur…"));
  peer.on("open", () => {
    setConn(L("Recherche de ") + code + "…");
    const c = peer!.connect(roomId(code), { reliable: true });
    wireConn(c);
    // the broker occasionally drops a connection request — retry a few times
    // instead of leaving the user stuck on "Recherche…"
    joinWatch = window.setTimeout(() => {
      if (conn && conn.open) return;
      if (joinAttempts < 3) {
        joinAttempts++;
        setConn(L("Personne à ce code pour l'instant — nouvel essai ") + joinAttempts + "…");
        doJoin(code);
      } else {
        setConn(L("Personne n'attend avec ce code. Sur l'AUTRE appareil, clique « Créer une partie » et donne-moi le code affiché."));
      }
    }, 5000);
  });
}

// ---- determinism monitor ----
// ---- start handshake -------------------------------------------------------
// The two machines finish loading at very different speeds (a PC is ready long
// before a tablet). Without this the fast side kicked off and played alone while
// the other was still loading — "je n'ai pas le temps de tirer". So after the
// launch BOTH freeze, each says "ready" once its match is actually running, and
// play only starts when both have reported in.
let iAmReady = false;
let peerReady = false;
let waitingEl: HTMLElement | null = null;

function setFrozen(on: boolean): void {
  try { M()?._gpf_set_freeze?.(on ? 1 : 0); } catch { /* bridge missing */ }
}
function showWaiting(text: string | null): void {
  if (!waitingEl) {
    const d = document.createElement("div");
    d.id = "gpf-net-wait";
    d.style.cssText = [
      "position:fixed", "top:50%", "left:50%", "transform:translate(-50%,-50%)",
      "z-index:2147483500", "display:none", "pointer-events:none",
      "background:rgba(8,12,18,.9)", "color:#fff", "border-radius:14px",
      "padding:18px 26px", "font:800 18px/1.4 system-ui,sans-serif",
      "box-shadow:0 6px 24px rgba(0,0,0,.6)", "text-align:center",
    ].join(";");
    document.body.appendChild(d);
    waitingEl = d;
  }
  if (text === null) { waitingEl.style.display = "none"; return; }
  waitingEl.textContent = text;
  waitingEl.style.display = "block";
}

/** Both sides in? unfreeze and let the match run. */
function tryStartTogether(): void {
  if (!iAmReady || !peerReady) return;
  setFrozen(false);
  showWaiting(null);
}

/** Poll until OUR match is actually live, then tell the peer. */
function reportReadyWhenLive(): void {
  iAmReady = false;
  peerReady = false;
  setFrozen(true);
  showWaiting(L("⏳ Chargement… on attend ton ami"));
  let tries = 0;
  const t = window.setInterval(() => {
    tries++;
    const live = (M()?._gpf_sim_frame?.() ?? -1) >= 0;
    if (live) {
      window.clearInterval(t);
      iAmReady = true;
      setFrozen(true); // stay frozen until the peer reports too
      showWaiting(peerReady ? null : L("⏳ On attend ton ami…"));
      send({ t: "ready" });
      tryStartTogether();
    } else if (tries > 240) { // ~2 min: don't hang forever
      window.clearInterval(t);
      iAmReady = true; peerReady = true;
      tryStartTogether();
    }
  }, 500);
}

let snapTick = 0;
function startMonitor(): void {
  if (monTimer !== null) return;
  monTimer = window.setInterval(() => {
    const m = M();
    if (!m?._gpf_sim_frame || !m._gpf_state_checksum) return;
    const f = m._gpf_sim_frame();
    if (f < 0) return; // no match running
    const s = m._gpf_state_checksum() >>> 0;
    own.set(f, s);
    if (own.size > OWN_CAP) { const k = own.keys().next().value as number; own.delete(k); }
    send({ t: "chk", f, s });
    // HOST AUTHORITY: every ~750ms (3 × 250ms) stream the true ball+player positions
    // so the joiner (the tablet) stays close — the native side only hard-snaps the
    // players that actually drifted (>1.5m), so more frequent = tighter sync without
    // the whole team jumping. This shrinks the "one screen in the future" gap.
    if (isHost && (++snapTick % 3 === 0)) {
      try { const d = m.ccall?.("gpf_net_snapshot", "string", [], []); if (d) send({ t: "snap", d }); } catch { /* not ready */ }
    }
    paintSync();
  }, 250);
}

function onPeerChecksum(f: number, s: number): void {
  const mine = own.get(f);
  if (mine === undefined) return; // haven't reached that frame locally yet
  compared++;
  if ((mine >>> 0) === (s >>> 0)) matched++;
  else if (firstDesync < 0) firstDesync = f;
  paintSync();
}

function paintSync(): void {
  if (!syncEl) return;
  // The netcode no longer relies on frame-perfect determinism — the two machines
  // sim freely and the host re-aligns the joiner every ~2s (correction auto). So a
  // raw checksum mismatch is EXPECTED between corrections; showing "DÉSYNC" would
  // just scare the user. Report a friendly status instead.
  if (!conn || !conn.open) { syncEl.textContent = L("Non connecté"); syncEl.style.color = "#dfe9e2"; return; }
  if (isHost) { syncEl.textContent = "🖥️ " + L("Hôte — tu recales l'autre écran (correction auto)"); syncEl.style.color = "#7ee0a0"; }
  else { syncEl.textContent = "🔄 " + L("Connecté — correction auto depuis l'hôte"); syncEl.style.color = "#7ee0a0"; }
}

function applySeed(): void {
  M()?._gpf_set_rng_seed?.(seed >>> 0);
  compared = 0; matched = 0; firstDesync = -1; own.clear();
  paintSync();
}

// Start the SAME match here (apply the shared seed first so both sims are
// identical), close the panel, and drive the native menu into a match. Called on
// both peers — locally by the button and remotely by the "launch" message — so the
// match appears on BOTH screens with nothing to coordinate.
function doLaunch(): void {
  applySeed();
  // Competitive lockstep — host controls team 0, joiner team 1. The sim now resumes
  // cleanly after waiting for the peer (ResetTaskSequenceTime keeps the scheduler
  // from stalling). Verified in-engine; real two-device sync watched via EN SYNC.
  // Host = team 0 + AUTHORITY (streams position snapshots); joiner = team 1 and
  // snaps to them. Each machine sims freely at its own speed (no more waiting), so
  // the weaker device no longer drags the other down.
  M()?._gpf_net_start?.(isHost ? 0 : 1);
  setConn(L("Lancement du match…"));
  reportReadyWhenLive(); // freeze until BOTH sides have finished loading
  panel?.classList.remove("show");
  window.setTimeout(() => {
    // click the "Coupe du monde" home card (proven start path) rather than calling
    // startNativeMatch directly — same effect, but robust to import timing.
    const cards = Array.from(document.querySelectorAll<HTMLElement>(".menu-mode-button"));
    const wc = cards.find((c) => /coupe du monde|world/i.test((c.title || "") + c.innerHTML));
    if (wc) wc.click(); else { try { startNativeMatch(); } catch { /* menu not ready */ } }
  }, 400);
}

// The "Lancer ensemble" button: tell the peer to start too, then start here.
function launchTogether(): void {
  if (!conn || !conn.open) { setConn(L("Connecte-toi d'abord à ton ami")); return; }
  send({ t: "launch" });
  doLaunch();
}

// ---- panel ----
const CSS = `
#gpf-net-btn { position:fixed; right:12px; bottom:12px; z-index:2147483400; pointer-events:auto;
  background:linear-gradient(#1e6fff,#0b47c2); color:#fff; border:none; border-radius:999px;
  padding:9px 14px; font:700 13px/1 "Segoe UI",Arial,sans-serif; cursor:pointer; box-shadow:0 3px 10px rgba(0,0,0,.4); }
#gpf-net { position:fixed; inset:0; z-index:2147483450; display:none; align-items:center; justify-content:center;
  background:rgba(3,5,8,.72); pointer-events:auto; font-family:"Segoe UI",Arial,sans-serif; }
#gpf-net.show { display:flex; }
#gpf-net .np-card { width:min(460px,94vw); max-height:92vh; overflow:auto; background:#0e141c; color:#eaf1f6;
  border:1px solid rgba(255,255,255,.1); border-radius:14px; padding:18px 18px 20px; box-shadow:0 10px 40px rgba(0,0,0,.6); position:relative; }
#gpf-net h3 { margin:0 0 4px; font-size:18px; }
#gpf-net .np-beta { display:inline-block; font-size:11px; font-weight:800; color:#0b1220; background:#ffe94a; border-radius:4px; padding:1px 6px; margin-left:6px; }
#gpf-net p { font-size:12.5px; color:#b9c6d1; margin:8px 0; line-height:1.5; }
#gpf-net .np-row { display:flex; gap:8px; margin:12px 0; flex-wrap:wrap; align-items:center; }
#gpf-net button.np { background:#1e6fff; color:#fff; border:none; border-radius:8px; padding:11px 14px; font-weight:700; cursor:pointer; font-size:14px; }
#gpf-net button.np.ghost { background:#223; }
#gpf-net button.np.np-big { width:100%; background:linear-gradient(#20a34a,#127a34); padding:15px; font-size:17px; font-weight:900; box-shadow:0 4px 14px rgba(0,0,0,.4); }
#gpf-net input.np-in { flex:1; min-width:120px; background:#060a10; color:#eaf1f6; border:1px solid #2a3646;
  border-radius:8px; padding:11px; font:800 18px/1 monospace; letter-spacing:3px; text-transform:uppercase; }
#gpf-net .np-code { font:900 34px/1 monospace; letter-spacing:8px; color:#7ee0a0; text-align:center; margin:10px 0 4px; user-select:all; }
#gpf-net .np-lbl { font-size:11px; font-weight:800; letter-spacing:1px; text-transform:uppercase; color:#8aa; margin:14px 0 3px; }
#gpf-net .np-stat { font-size:13px; font-weight:700; margin-top:8px; }
#gpf-net .np-sync { font-size:14px; font-weight:800; margin-top:6px; }
#gpf-net .np-x { position:absolute; top:14px; right:16px; color:#8aa; cursor:pointer; font-size:22px; }
`;

/** Opened from the home menu's "En ligne" card (set up in initNetplay). */
let openPanel: (() => void) | null = null;
export function openNetplay(): void { openPanel?.(); }

export function initNetplay(): void {
  const style = document.createElement("style");
  style.id = "gpf-net-style"; style.textContent = CSS;
  document.head.appendChild(style);

  const btn = document.createElement("button");
  btn.id = "gpf-net-btn";
  btn.textContent = "🌐 " + L("En ligne");
  document.body.appendChild(btn);

  panel = document.createElement("div");
  panel.id = "gpf-net";
  panel.innerHTML = `
    <div class="np-card">
      <span class="np-x">×</span>
      <h3>🌐 ${L("Multijoueur en ligne")}<span class="np-beta">BETA — TEST</span></h3>
      <p>${L("Il faut DEUX appareils. Sur le premier, clique « Créer une partie » : un code s'affiche. Donne-le à ton ami (WhatsApp, etc.) : sur SON appareil il le tape et clique « Rejoindre ». Ensuite lancez le MÊME match des deux côtés (mêmes équipes) sans toucher au clavier.")}</p>

      <div class="np-row">
        <button class="np" data-act="create">${L("Créer une partie")}</button>
      </div>
      <div class="np-lbl">${L("Ton code (donne-le à ton ami)")}</div>
      <div class="np-code">—</div>
      <div class="np-row"><button class="np ghost" data-act="copylink">${L("📋 Copier le lien d'invitation")}</button></div>

      <div class="np-lbl">${L("Ou tape le code de ton ami")}</div>
      <div class="np-row">
        <input class="np-in" maxlength="5" placeholder="XXXXX" inputmode="latin" autocomplete="off" autocapitalize="characters" spellcheck="false" />
        <button class="np ghost" data-act="join">${L("Rejoindre")}</button>
      </div>

      <div class="np-stat np-conn">${L("Non connecté")}</div>
      <div class="np-stat np-seed"></div>
      <div class="np-row np-launch" style="margin-top:12px; display:none"><button class="np np-big" data-act="launch">🚀 ${L("Lancer le match ensemble")}</button></div>
      <div class="np-sync"></div>
    </div>`;
  document.body.appendChild(panel);

  connEl = panel.querySelector(".np-conn");
  codeEl = panel.querySelector(".np-code");
  seedEl = panel.querySelector(".np-seed");
  syncEl = panel.querySelector(".np-sync");
  inEl = panel.querySelector(".np-in");
  launchRow = panel.querySelector(".np-launch");

  const open = (): void => { panel?.classList.add("show"); paintSync(); };
  const close = (): void => panel?.classList.remove("show");
  openPanel = open;
  btn.addEventListener("click", open);
  panel.querySelector(".np-x")?.addEventListener("click", close);

  // The game (SDL) grabs keydown on the window and preventDefault()s it, so the
  // browser never inserts the typed char into the field. We rebuild the value
  // ourselves from the key events (they still fire — only the default is blocked),
  // and also filter the `input` event for the tablet's on-screen keyboard.
  const submit = (): void => { const c = (inEl?.value || "").trim(); if (c.length >= 4) joinGame(c); else setConn(L("Tape le code de ton ami d'abord")); };
  if (inEl) {
    inEl.addEventListener("keydown", (e: KeyboardEvent) => {
      e.stopPropagation();
      const k = (e.key || "").toUpperCase();
      if (/^[A-Z0-9]$/.test(k)) { if (inEl!.value.length < 5) inEl!.value += k; e.preventDefault(); }
      else if (e.key === "Backspace") { inEl!.value = inEl!.value.slice(0, -1); e.preventDefault(); }
      else if (e.key === "Enter") { submit(); e.preventDefault(); }
    });
    inEl.addEventListener("keyup", (e) => e.stopPropagation());
    inEl.addEventListener("keypress", (e) => e.stopPropagation());
    inEl.addEventListener("input", () => { inEl!.value = inEl!.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5); });
  }

  panel.addEventListener("click", (e) => {
    const act = (e.target as HTMLElement)?.dataset?.act;
    if (!act) return;
    if (act === "create") createGame();
    else if (act === "join") submit();
    else if (act === "launch") launchTogether();
    else if (act === "copylink") {
      if (!inviteUrl) { setConn(L("Clique d'abord « Créer une partie »")); return; }
      navigator.clipboard?.writeText(inviteUrl).then(
        () => setConn(L("Lien copié ✓ — envoie-le à ton ami")),
        () => setConn(inviteUrl),
      );
    }
  });

  // Opened via an invite link → auto-join that code.
  const joinParam = new URLSearchParams(location.search).get("gpfjoin");
  if (joinParam && /^[A-Z0-9]{4,5}$/i.test(joinParam)) {
    open();
    if (inEl) inEl.value = joinParam.toUpperCase();
    joinGame(joinParam);
  }
}
