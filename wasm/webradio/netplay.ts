/**
 * Online multiplayer — STAGE 1 (experimental).
 *
 * Peer-to-peer WebRTC via COPY-PASTE signalling (no server): host makes an offer
 * code, sends it to a friend (WhatsApp/etc), the friend pastes it and returns an
 * answer code, host pastes that back → connected. STUN handles most home NATs.
 *
 * On top of the link runs a DETERMINISM MONITOR — the one thing Stage 1 must
 * answer: is the wasm sim identical on both machines in lockstep? Both peers seed
 * the RNG from a shared value (gpf_set_rng_seed), then exchange a checksum of the
 * sim state (gpf_state_checksum) keyed by the sim frame (gpf_sim_frame). If, while
 * both run the SAME match untouched, the checksums stay equal → deterministic →
 * real net play (input sync, lobby…) is feasible in later stages. If they diverge,
 * we learn it now and fall back to local (same-screen) multiplayer.
 */
import { L } from "./i18n";

interface NetModule {
  _gpf_set_rng_seed?: (s: number) => void;
  _gpf_sim_frame?: () => number;
  _gpf_state_checksum?: () => number;
}
const M = (): NetModule | undefined => (window as unknown as { Module?: NetModule }).Module;

let pc: RTCPeerConnection | null = null;
let dc: RTCDataChannel | null = null;
let isHost = false;
let seed = 0;

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
let seedEl: HTMLElement | null = null;
let syncEl: HTMLElement | null = null;
let outArea: HTMLTextAreaElement | null = null;
let inArea: HTMLTextAreaElement | null = null;
let step2: HTMLElement | null = null;

const rtcConfig: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

function setConn(t: string): void { if (connEl) connEl.textContent = t; }
function encode(o: unknown): string { return btoa(JSON.stringify(o)); }
function decode(s: string): RTCSessionDescriptionInit { return JSON.parse(atob(s.trim())); }

// wait for ICE gathering to finish so the single copy-pasted code is complete
async function gatherComplete(p: RTCPeerConnection): Promise<void> {
  if (p.iceGatheringState === "complete") return;
  await new Promise<void>((res) => {
    const check = (): void => {
      if (p.iceGatheringState === "complete") { p.removeEventListener("icegatheringstatechange", check); res(); }
    };
    p.addEventListener("icegatheringstatechange", check);
    window.setTimeout(res, 4000);
  });
}

function send(o: unknown): void { if (dc && dc.readyState === "open") dc.send(JSON.stringify(o)); }

function wireChannel(ch: RTCDataChannel): void {
  dc = ch;
  ch.onopen = (): void => {
    setConn(L("Connecté ✓"));
    if (isHost) send({ t: "seed", seed });
    if (seedEl) seedEl.textContent = `${L("Graine")}: ${seed >>> 0}`;
    startMonitor();
  };
  ch.onclose = (): void => setConn(L("Déconnecté"));
  ch.onmessage = (e: MessageEvent): void => {
    const m = JSON.parse(e.data as string) as { t: string; seed?: number; f?: number; s?: number };
    if (m.t === "seed") { seed = (m.seed ?? 0) >>> 0; if (seedEl) seedEl.textContent = `${L("Graine")}: ${seed}`; }
    else if (m.t === "chk") onPeerChecksum(m.f ?? -1, (m.s ?? 0) >>> 0);
  };
}

async function createGame(): Promise<void> {
  isHost = true;
  seed = Math.floor(Math.random() * 0x7fffffff) >>> 0;
  pc = new RTCPeerConnection(rtcConfig);
  wireChannel(pc.createDataChannel("gpf"));
  setConn(L("Génération du code…"));
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await gatherComplete(pc);
  if (outArea) outArea.value = encode(pc.localDescription);
  setConn(L("Envoie ton code, puis colle la réponse ci-dessous"));
  if (step2) step2.style.display = "block";
}

async function joinGame(code: string): Promise<void> {
  isHost = false;
  pc = new RTCPeerConnection(rtcConfig);
  pc.ondatachannel = (e): void => wireChannel(e.channel);
  await pc.setRemoteDescription(decode(code));
  const ans = await pc.createAnswer();
  await pc.setLocalDescription(ans);
  await gatherComplete(pc);
  if (outArea) outArea.value = encode(pc.localDescription);
  setConn(L("Renvoie ce code à l'hôte"));
}

async function hostAcceptAnswer(code: string): Promise<void> {
  if (!pc) return;
  await pc.setRemoteDescription(decode(code));
  setConn(L("Connexion…"));
}

// ---- determinism monitor ----
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
  if (compared === 0) { syncEl.textContent = L("En attente d'un match (lance le MÊME match des deux côtés, sans toucher au clavier)"); syncEl.style.color = "#dfe9e2"; return; }
  if (firstDesync >= 0) {
    syncEl.textContent = `❌ ${L("DÉSYNC")} — frame ${firstDesync} (${matched}/${compared} ${L("ok")})`;
    syncEl.style.color = "#ff6b6b";
  } else {
    syncEl.textContent = `✅ ${L("EN SYNC")} — ${matched}/${compared} ${L("frames identiques")}`;
    syncEl.style.color = "#37d67a";
  }
}

function applySeed(): void {
  M()?._gpf_set_rng_seed?.(seed >>> 0);
  compared = 0; matched = 0; firstDesync = -1; own.clear();
  paintSync();
}

// ---- panel ----
const CSS = `
#gpf-net-btn { position:fixed; right:12px; bottom:12px; z-index:2147483400; pointer-events:auto;
  background:linear-gradient(#1e6fff,#0b47c2); color:#fff; border:none; border-radius:999px;
  padding:9px 14px; font:700 13px/1 "Segoe UI",Arial,sans-serif; cursor:pointer; box-shadow:0 3px 10px rgba(0,0,0,.4); }
#gpf-net { position:fixed; inset:0; z-index:2147483450; display:none; align-items:center; justify-content:center;
  background:rgba(3,5,8,.72); pointer-events:auto; font-family:"Segoe UI",Arial,sans-serif; }
#gpf-net.show { display:flex; }
#gpf-net .np-card { width:min(560px,94vw); max-height:92vh; overflow:auto; background:#0e141c; color:#eaf1f6;
  border:1px solid rgba(255,255,255,.1); border-radius:14px; padding:18px 18px 20px; box-shadow:0 10px 40px rgba(0,0,0,.6); }
#gpf-net h3 { margin:0 0 4px; font-size:18px; }
#gpf-net .np-beta { display:inline-block; font-size:11px; font-weight:800; color:#0b1220; background:#ffe94a; border-radius:4px; padding:1px 6px; margin-left:6px; }
#gpf-net p { font-size:12.5px; color:#b9c6d1; margin:8px 0; line-height:1.5; }
#gpf-net .np-row { display:flex; gap:8px; margin:10px 0; flex-wrap:wrap; }
#gpf-net button.np { background:#1e6fff; color:#fff; border:none; border-radius:8px; padding:9px 12px; font-weight:700; cursor:pointer; }
#gpf-net button.np.ghost { background:#223; }
#gpf-net textarea { width:100%; height:64px; box-sizing:border-box; background:#060a10; color:#9fe0b0; border:1px solid #223;
  border-radius:8px; padding:8px; font:11px/1.4 monospace; resize:vertical; }
#gpf-net .np-lbl { font-size:11px; font-weight:800; letter-spacing:1px; text-transform:uppercase; color:#8aa; margin:10px 0 3px; }
#gpf-net .np-stat { font-size:13px; font-weight:700; margin-top:6px; }
#gpf-net .np-sync { font-size:14px; font-weight:800; margin-top:6px; }
#gpf-net .np-x { position:absolute; top:14px; right:16px; color:#8aa; cursor:pointer; font-size:22px; }
`;

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
    <div class="np-card" style="position:relative">
      <span class="np-x">×</span>
      <h3>🌐 ${L("Multijoueur en ligne")}<span class="np-beta">BETA — TEST</span></h3>
      <p>${L("Étape 1 : on vérifie que le jeu reste synchronisé entre deux ordinateurs. Connecte-toi à un ami, lancez le MÊME match des deux côtés (mêmes équipes) sans toucher au clavier, et regarde l'état plus bas.")}</p>
      <div class="np-row">
        <button class="np" data-act="create">${L("Créer une partie")}</button>
        <button class="np ghost" data-act="join">${L("Rejoindre (colle le code reçu)")}</button>
      </div>
      <div class="np-lbl">${L("Ton code (envoie-le à ton ami)")}</div>
      <textarea class="np-out" readonly placeholder="—"></textarea>
      <div class="np-step2" style="display:none">
        <div class="np-lbl">${L("Colle ici le code de réponse de ton ami")}</div>
        <textarea class="np-in" placeholder="..."></textarea>
        <div class="np-row"><button class="np" data-act="accept">${L("Connecter")}</button></div>
      </div>
      <div class="np-lbl">${L("Pour REJOINDRE : colle le code de l'hôte ci-dessus puis clique Rejoindre — un code de réponse apparaît, renvoie-le à l'hôte.")}</div>
      <div class="np-stat np-conn">${L("Non connecté")}</div>
      <div class="np-stat np-seed"></div>
      <div class="np-row" style="margin-top:12px"><button class="np" data-act="seed">${L("Appliquer la graine (avant de lancer le match)")}</button></div>
      <div class="np-sync"></div>
    </div>`;
  document.body.appendChild(panel);

  connEl = panel.querySelector(".np-conn");
  seedEl = panel.querySelector(".np-seed");
  syncEl = panel.querySelector(".np-sync");
  outArea = panel.querySelector(".np-out");
  inArea = panel.querySelector(".np-in");
  step2 = panel.querySelector(".np-step2");

  const open = (): void => { panel?.classList.add("show"); paintSync(); };
  const close = (): void => panel?.classList.remove("show");
  btn.addEventListener("click", open);
  panel.querySelector(".np-x")?.addEventListener("click", close);

  panel.addEventListener("click", (e) => {
    const act = (e.target as HTMLElement)?.dataset?.act;
    if (!act) return;
    if (act === "create") void createGame();
    else if (act === "join") { const c = inArea?.value || outArea?.value || ""; if (c) void joinGame(c); }
    else if (act === "accept") { if (inArea?.value) void hostAcceptAnswer(inArea.value); }
    else if (act === "seed") applySeed();
  });
}
