/**
 * Entry point for the WebAssembly build's radio. Installs the window.gpfRadio*
 * hooks the C++ bridge (src/onthepitch/wasm_radio_bridge.hpp) calls, runs the
 * continuous play-by-play loop, and wires language selection + the R toggle.
 *
 * Language: ?lang=xx in the URL (falls back to English if no voice exists).
 */
import { commentaryTick, pushMatchState, type MatchSnapshot } from "./commentary";
import { initMenu } from "./menu";
import { initHomeMenu, onMatchStarted, isDrillSession, isMatchStarting, show as showHomeMenu } from "./homemenu";
import { initClubs } from "./clubs";
import { initLineup } from "./lineup";
import { initNational } from "./national";
import { initTraining } from "./training";
import { initDrillAim } from "./drillaim";
import { initKeeperArrows } from "./keeperarrows";
import { initAnthem, getTeamOverride } from "./anthem";
import { initScoreFlags } from "./scoreflags";
import { initSettings, applySavedKeys, applySavedMatchSettings } from "./settings";
import { initDefi } from "./defi";
import { initTouch } from "./touch";
import { initReplay } from "./replay";
import { initMatches } from "./matches";
import { initFriendly } from "./friendly";
import { initLoading } from "./loading";
import { initShootout } from "./shootout";
import { initNetplay } from "./netplay";
import { initRefmode } from "./refmode";
import { initMyMarker } from "./mymarker";
import { spokenName } from "./pronounce";
import { getRadioPack } from "./radioText";
import {
  type RadioEvent,
  audioPeak,
  enableAudioCapture,
  radio,
  radioCtxState,
  radioReset,
  radioEnabled,
  radioLanguage,
  radioPundit,
  teamName,
  radioSay,
  radioVoicePhase,
  resumeRadio,
  setRadioLanguage,
  setRadioMuted,
  setRadioStoppage,
  setRadioTeams,
  toggleRadio,
  warmupRadioVoice,
} from "./radioEngine";

// pick the commentary language from the URL before warming the voice up
const params = new URLSearchParams(location.search);
const urlLang = params.get("lang");
if (urlLang) setRadioLanguage(urlLang);
// diagnostic: ?audiocap=1 routes playback through WebAudio so a test can verify
// the voice produces real (non-silent) samples
if (params.get("audiocap") === "1") enableAudioCapture();
// Register the narrow voice-rerouting service worker BEFORE warming the voice up,
// so the very first load already pulls the 63 MB Piper model from our fast Vercel
// copy instead of the slow / rate-limited huggingface origin. Best-effort: if the
// SW isn't ready within ~3.5s (or isn't supported), warm up anyway (falls back to
// huggingface, still works). The SW controls the TTS worker's fetches too.
function registerVoiceSW(): Promise<void> {
  if (!("serviceWorker" in navigator)) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = (): void => resolve();
    const t = window.setTimeout(done, 3500);
    navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready)
      .then(() => { window.clearTimeout(t); done(); })
      .catch(() => { window.clearTimeout(t); done(); });
  });
}
void registerVoiceSW().then(() => warmupRadioVoice());
console.log(`[gpf-radio] loaded — lang=${urlLang || "en"} (R toggles the commentary). ` +
  `Interact with the page once to allow audio. Check window.__radioDebug / window.__radioPeak.`);

// each new match bumps a generation so the play-by-play resets its state; the
// C++ tick doesn't know the count, so we stamp it (and the ended flag) here.
let matchGen = 0;
let matchEnded = false;

interface RadioWindow {
  gpfRadioSetTeams?: (home: string, away: string) => void;
  gpfRadioReset?: () => void;
  gpfRadioEvent?: (event: string, player: string, team: number, score0: number, score1: number) => void;
  gpfRadioTick?: (snap: MatchSnapshot) => void;
  gpfRadioToggle?: () => boolean;
  gpfRadioSetLanguage?: (lang: string) => void;
}
const w = window as unknown as RadioWindow;

// live diagnostics: inspect window.__gpfRadioBridge in the console
const bridge = { events: [] as string[], ticks: 0, teams: ["", ""] as string[], lastCarrier: "", teamId: -1, loose: true, score: [0, 0] as [number, number] };
(window as unknown as { __gpfRadioBridge: typeof bridge }).__gpfRadioBridge = bridge;

w.gpfRadioSetTeams = (home, away): void => {
  // prefer the display names the player picked (France/Italie/PSG…) over the DB
  // team names (Gunners…) the engine reports, so the commentary names them right.
  const [oh, oa] = getTeamOverride();
  const h = oh || home, a = oa || away;
  bridge.teams = [h, a];
  setRadioTeams(h, a);
};

// ---- kickoff music (user-supplied) ----------------------------------------
// Short football track played when a match starts. Stopped the moment the anthem
// ceremony begins so the two never overlap.
let introAudio: HTMLAudioElement | null = null;
function stopMatchIntro(): void {
  if (!introAudio) return;
  try { introAudio.pause(); introAudio.currentTime = 0; } catch { /* */ }
  introAudio = null;
}
function playMatchIntro(): void {
  try {
    stopMatchIntro();
    const a = new Audio("/radio/match-intro.mp3");
    a.volume = 0.9;
    introAudio = a;
    a.addEventListener("ended", () => { if (introAudio === a) introAudio = null; });
    void a.play().catch(() => { /* autoplay gate: silent, not fatal */ });
  } catch { /* no Audio */ }
}

w.gpfRadioReset = (): void => {
  matchGen++;
  matchEnded = false;
  onMatchStarted(); // a match started -> hide the home menu + stop the Enter driver
  radioReset();
  // Kickoff track: if the anthem ceremony is coming, the anthem starts ~0.3s from
  // here and would cut the music dead — so we wait and play it when the ceremony
  // ENDS instead (see the gpfAnthemEnd wrapper). With no ceremony (drill, défi,
  // anthems off) nothing follows, so play it right away.
  let ceremonyComing = false;
  try {
    const cw = (window as unknown as { gpfCeremonyWanted?: () => boolean }).gpfCeremonyWanted;
    ceremonyComing = typeof cw === "function" ? cw() : false;
  } catch { /* hook not installed */ }
  if (!ceremonyComing) playMatchIntro();
};

// The engine hands us player last names in the in-game font's ALL-CAPS ASCII
// (e.g. "MBAPPE", "T.HERNANDEZ", "DE.BRUYNE") — the neural voice would spell
// those out like acronyms. Normalise to a spoken form: drop initials, split on
// the dot, Title-case each part ("Mbappe", "Hernandez", "De Bruyne").
function niceName(raw: string): string {
  if (!raw) return raw;
  // Respell for the voice that will actually speak it: real diacritics for every
  // language ("MBAPPE" -> "Mbappé", so the final e isn't silent), plus phonetic
  // spellings so foreign names sound right ("ROBINSON" read the English way by
  // the French voice, "MBAPPE" as "Em-bapp-ay" by the English one).
  try { return spokenName(raw, radioLanguage()); } catch { return raw; }
}

w.gpfRadioEvent = (event, player, team, score0, score1): void => {
  // keep the SCORE in the event log too: the equaliser line depends on it, so when
  // it misfires we need to see exactly what the engine reported.
  bridge.events.push(event + (player ? `:${player}` : "") + (score0 >= 0 ? ` [${score0}-${score1}]` : ""));
  if (bridge.events.length > 40) bridge.events.shift();
  console.log(`[gpf-radio] event: ${event}${player ? " " + player : ""}${score0 >= 0 ? ` score=${score0}-${score1}` : ""}`);
  const info: { team?: number; score?: [number, number]; player?: string } = {};
  // "addedtime" carries a minute COUNT in `player`, not a name — never respell it
  if (player) info.player = event === "addedtime" ? player : niceName(player);
  if (team >= 0) info.team = team;
  if (score0 >= 0) info.score = [score0, score1];
  radio(event as RadioEvent, info);
  if (event === "fulltime") matchEnded = true;
  if (event === "opening") matchEnded = false;
};

w.gpfRadioTick = (snap): void => {
  bridge.ticks++;
  // mirror the live score so the HTML scoreboard overlay can show it (the native
  // scoreboard's home-score digit is hidden under the wide away-flag overlay)
  if (Array.isArray(snap.score) && snap.score.length === 2) {
    bridge.score[0] = snap.score[0]; bridge.score[1] = snap.score[1];
  }
  snap.carrier = niceName(snap.carrier);
  snap.oppName = niceName(snap.oppName);
  bridge.lastCarrier = snap.carrier;
  bridge.teamId = snap.teamId;   // carrier's team (0 = the human's home side)
  bridge.loose = snap.loose;     // no clear possession
  snap.gen = matchGen;
  snap.ended = snap.ended || matchEnded;
  // the commentator hushes for major set pieces (free kick / corner / penalty)
  // and during any training drill (incl. the keeper exercise) — but keeps talking
  // through throw-ins, goal kicks and open play. The ref's whistle still sounds.
  setRadioStoppage(snap.radioQuiet === true || isDrillSession());
  // While play is stopped the chatter is muted — but a real commentator uses the
  // pause to give his read on the match. NOT in referee mode: there the human IS
  // the referee and needs the silence to talk to players.
  maybePundit(snap.radioQuiet === true && !isDrillSession());
  pushMatchState(snap);
};

// ---- stoppage punditry -----------------------------------------------------
let lastPunditAt = 0;
let stoppageSince = 0;
function refereeModeOn(): boolean {
  try { return localStorage.getItem("gpf-referee-active") === "1"; } catch { return false; }
}
function maybePundit(stopped: boolean): void {
  if (!stopped) { stoppageSince = 0; return; }
  if (refereeModeOn()) return;             // the human referee owns the silence
  const now = Date.now();
  if (stoppageSince === 0) { stoppageSince = now; return; }
  if (now - stoppageSince < 3500) return;  // let the stoppage settle first
  if (now - lastPunditAt < 11000) return;  // one thought at a time
  lastPunditAt = now;
  try {
    const lang = radioLanguage();
    const copy = getRadioPack(lang);
    const sc = bridge.score;
    const line = copy.pundit
      ? copy.pundit(sc, teamName(0, lang), teamName(1, lang))
      : copy.scoreStatus(sc, teamName(0, lang), teamName(1, lang));
    radioPundit(line);
  } catch { /* radio not ready */ }
}

w.gpfRadioToggle = (): boolean => toggleRadio();
w.gpfRadioSetLanguage = (lang): void => setRadioLanguage(lang);

// The native C++ main menu (MATCH/CUP/LEAGUE/…) must NEVER be seen — the HTML home
// is the real menu. mainmenu.cpp fires this whenever that native page appears (boot,
// after a match, forfeit, …); we immediately cover it with the opaque HTML home.
// It never fires mid-match (the page isn't recreated while a match runs), so this
// can't cover the pitch or the loading screen.
(w as unknown as { gpfNativeMainMenu?: () => void }).gpfNativeMainMenu = (): void => {
  // Ignore while startNativeMatch is driving the native menu into a match — firing
  // here would cover the pitch AND wipe the score flags just set for the kickoff
  // (show() clears them). The native main menu is only genuinely "back at the menu"
  // when we're NOT mid-launch.
  if (isMatchStarting()) return;
  try { showHomeMenu(); } catch { /* not ready yet */ }
};

// in-page overlays: the full home menu (#52) behind, and the SON/RADIO STADE/
// LANGUE pills pinned above it (installed after the window hooks so menu.ts can
// wrap gpfRadioReset to duck the music during matches)
initLineup();
initTraining();
initClubs();
initNational();
initHomeMenu();
initMenu();
initDrillAim();
initKeeperArrows();
initAnthem();
// the anthem must never play over the kickoff track: wrap the hook initAnthem
// just installed and stop the music first.
{
  const wa = window as unknown as {
    gpfAnthem?: (i: number, n: string) => void;
    gpfAnthemEnd?: () => void;
  };
  // an anthem starting must never play over the kickoff track
  const prevAnthem = wa.gpfAnthem;
  if (prevAnthem) wa.gpfAnthem = (i, n): void => { stopMatchIntro(); prevAnthem(i, n); };
  // ceremony over -> kickoff: NOW play the track (nothing left to cut it short)
  const prevEnd = wa.gpfAnthemEnd;
  if (prevEnd) wa.gpfAnthemEnd = (): void => { prevEnd(); playMatchIntro(); };
}
initScoreFlags();
initSettings();
initDefi();
initTouch();
initMatches();
initFriendly();
initLoading();
initShootout();
initNetplay();
initRefmode();
initMyMarker();
initReplay();

// The match gallery was removed — purge any match videos previously recorded to
// IndexedDB so they no longer take up space (recording of new full matches is off).
try { indexedDB.deleteDatabase("gpf-matches"); } catch { /* private / unsupported */ }

// Re-apply the graphics quality picked in the native SETTINGS > GRAPHICS menu
// (persisted in localStorage; 4 = ultra is the engine default, nothing to do).
const applySavedQuality = (): void => {
  let level = 4;
  try { level = parseInt(localStorage.getItem("gpf-quality") ?? "4", 10); } catch { /* private mode */ }
  if (!Number.isFinite(level) || level < 0 || level > 4) level = 4;
  // Apply for EVERY level, including ultra (4): the render-rate cap that keeps the
  // sim real-time (no slow motion) lives in gpf_set_quality, so skipping it at the
  // default left ultra rendering uncapped and the game ran in slow motion.
  const M = (window as unknown as { Module?: { _gpf_set_quality?: (l: number) => void } }).Module;
  if (M?._gpf_set_quality) M._gpf_set_quality(level);
  else window.setTimeout(applySavedQuality, 2000); // wasm not up yet — retry
};
applySavedQuality();
applySavedKeys(); // re-apply any custom key bindings from a previous session
applySavedMatchSettings(); // default 3-min matches + any saved difficulty/duration

// R toggles the commentary (matches the web version); ignore when typing.
window.addEventListener("keydown", (e) => {
  if (e.key === "r" || e.key === "R") {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    toggleRadio();
  }
});

// browsers need a user gesture before audio can play — wake the radio on the
// first interaction. Use the CAPTURE phase + touch events so a tap on the game
// <canvas> (whose touch handlers preventDefault) still unlocks audio on tablets.
// Wake EVERY audio context on a gesture — the radio's, but also the GAME's
// (OpenAL crowd/whistle via Emscripten's AL, and SDL2's). Symptom seen in the
// wild: menu music + anthem (media elements) play fine while whistle/crowd AND
// radio (all AudioContext-based) are dead — the classic suspended-context state.
const wake = (): void => {
  resumeRadio();
  try {
    const g = window as unknown as {
      AL?: { currentCtx?: { audioCtx?: AudioContext } };
      SDL2?: { audioContext?: AudioContext };
    };
    const al = g.AL?.currentCtx?.audioCtx;
    if (al && al.state !== "running") void al.resume();
    const sdl = g.SDL2?.audioContext;
    if (sdl && sdl.state !== "running") void sdl.resume();
  } catch { /* game audio not up yet */ }
};
for (const ev of ["pointerdown", "touchstart", "touchend", "mousedown", "keydown", "keyup", "click"] as const) {
  window.addEventListener(ev, wake, { capture: true, passive: true });
}

// continuous play-by-play loop, dt-based like the web commentary system.
// EVERYTHING is wrapped and rAF is always re-scheduled so nothing — a commentary
// hiccup, an analyser error, a suspended context — can ever stop the loop and
// leave the commentator silent after the opening line.
let last = performance.now();
function loop(now: number): void {
  try {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    resumeRadio(); // keep the audio context awake through heavy game frames
    commentaryTick(dt);
    const pk = audioPeak();
    if (pk >= 0) {
      const g = window as unknown as { __radioPeak: number };
      g.__radioPeak = Math.max(g.__radioPeak || 0, pk);
    }
  } catch {
    /* swallow — the loop must survive every frame */
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---- ?radiodebug=1 : on-screen diagnostic the user can screenshot ----
// The radio works on tablet but not on some desktops. Rather than keep guessing
// blindly, surface the live internals: voice-download phase, audio-context state,
// which engine spoke, how many lines were emitted, and the true output peak. One
// screenshot tells us whether it's a voice-load, a suspended-context, or a
// silent-playback problem.
if (params.get("radiodebug") === "1") {
  const hud = document.createElement("div");
  hud.style.cssText =
    "position:fixed;left:8px;bottom:8px;z-index:2147483600;font:12px/1.5 monospace;" +
    "background:rgba(0,0,0,.82);color:#7dffa0;padding:8px 10px;border-radius:8px;" +
    "white-space:pre;pointer-events:none;max-width:90vw;box-shadow:0 2px 10px rgba(0,0,0,.6)";
  document.body.appendChild(hud);
  const g = window as unknown as {
    __radioDebug?: { lastSay: string; lastSayAt: number; lastPlayAt: number; ctxState: string; lastError: string };
    __radioEngine?: string;
    __radioLines?: number;
    __radioPeak?: number;
  };
  window.setInterval(() => {
    const d = g.__radioDebug ?? { lastSay: "", lastSayAt: 0, lastPlayAt: 0, ctxState: "?", lastError: "" };
    const now = Date.now();
    const age = (t: number): string => (t ? `${Math.round((now - t) / 100) / 10}s` : "—");
    hud.textContent =
      `RADIO DEBUG\n` +
      `phase   : ${radioVoicePhase()}\n` +
      `ctx     : ${radioCtxState()}\n` +
      `engine  : ${g.__radioEngine ?? "—"}\n` +
      `lines   : ${g.__radioLines ?? 0}\n` +
      `peak    : ${(g.__radioPeak ?? 0).toFixed(3)}\n` +
      `lastSay : "${d.lastSay}" (${age(d.lastSayAt)})\n` +
      `lastPlay: ${d.ctxState} (${age(d.lastPlayAt)})\n` +
      `error   : ${d.lastError ? d.lastError.slice(0, 80) : "—"}`;
  }, 500);
}

// ---- "Activate commentary" rescue button ----
// Browsers block audio until the user interacts; on some desktops the radio's
// WebAudio context stays suspended the whole match → silent commentary even though
// the game's own audio plays. This button appears if NO radio audio has been heard
// while a match is running; tapping it force-resumes the context, un-mutes, and
// speaks a test line. If they hear it → fixed; if not → it's the device's audio.
{
  const w2 = window as unknown as { Module?: { _gpf_sim_frame?: () => number }; __radioPeak?: number };
  const btn = document.createElement("button");
  btn.textContent = "🔊 Activer le commentaire";
  btn.style.cssText = [
    "position:fixed", "left:50%", "bottom:76px", "transform:translateX(-50%)",
    "z-index:2147483600", "display:none", "cursor:pointer", "pointer-events:auto",
    "background:linear-gradient(#20a34a,#127a34)", "color:#fff", "border:none",
    "border-radius:999px", "padding:12px 20px", "font:800 15px/1 system-ui,sans-serif",
    "box-shadow:0 4px 16px rgba(0,0,0,.5)", "animation:gpfpulse 1.4s ease-in-out infinite",
  ].join(";");
  const st = document.createElement("style");
  st.textContent = "@keyframes gpfpulse{0%,100%{transform:translateX(-50%) scale(1)}50%{transform:translateX(-50%) scale(1.06)}}";
  document.head.appendChild(st);
  document.body.appendChild(btn);
  let heard = false;
  btn.addEventListener("click", () => {
    try { resumeRadio(); enableAudioCapture(); setRadioMuted(false); } catch { /* */ }
    try { radioSay("Le commentaire est activé."); } catch { /* */ }
    btn.textContent = "🔊 …";
    window.setTimeout(() => { if (!heard) btn.textContent = "🔊 Réessayer le son"; }, 2500);
  });
  window.setInterval(() => {
    const peak = w2.__radioPeak ?? 0;
    if (peak > 0.005) { heard = true; btn.style.display = "none"; return; }
    const f = w2.Module?._gpf_sim_frame?.() ?? -1;
    // show it a few seconds into a match if we still haven't heard any radio audio
    btn.style.display = (f >= 0 && !heard) ? "block" : "none";
  }, 1000);
}

// ---- remote diagnosis (localhost only) ----
// Post a radio-state snapshot to the dev server every 8s so the developer can
// read the USER's live radio internals from wasm/radio-diag.log instead of
// asking the user to read a HUD. Never runs on the public deployment.
if (location.hostname === "127.0.0.1" || location.hostname === "localhost") {
  const gd = window as unknown as {
    Module?: { _gpf_sim_frame?: () => number };
    __radioDebug?: { lastSay: string; lastSayAt: number; lastPlayAt: number; ctxState: string; lastError: string };
    __radioEngine?: string; __radioLines?: number; __radioPeak?: number;
  };
  window.setInterval(() => {
    try {
      const d = gd.__radioDebug;
      const snap = {
        enabled: radioEnabled(), phase: radioVoicePhase(), ctx: radioCtxState(),
        engine: gd.__radioEngine ?? "", lines: gd.__radioLines ?? 0,
        peak: Math.round((gd.__radioPeak ?? 0) * 1000) / 1000,
        say: (d?.lastSay ?? "").slice(0, 60), sayAge: d?.lastSayAt ? Date.now() - d.lastSayAt : -1,
        playAge: d?.lastPlayAt ? Date.now() - d.lastPlayAt : -1,
        playCtx: d?.ctxState ?? "", err: (d?.lastError ?? "").slice(0, 120),
        voices: (() => { try { return window.speechSynthesis?.getVoices().length ?? -1; } catch { return -2; } })(),
        simFrame: gd.Module?._gpf_sim_frame?.() ?? -1,
        vis: document.visibilityState,
        goal: (window as unknown as { __goalDebug?: unknown }).__goalDebug ?? null,
        busy: (gd as Record<string, unknown>).__radioBusy ?? null,
        busyFor: (gd as Record<string, unknown>).__radioBusyFor ?? 0,
        piper: `${((gd as Record<string, unknown>).__piperAsk as number) ?? 0}/${((gd as Record<string, unknown>).__piperDone as number) ?? 0}`,
        unwedged: ((gd as Record<string, unknown>).__radioUnwedged as number) ?? 0,
        game: ((): string => { try {
          const gw = window as unknown as { AL?: { currentCtx?: { audioCtx?: AudioContext } }; SDL2?: { audioContext?: AudioContext } };
          return `al:${gw.AL?.currentCtx?.audioCtx?.state ?? "-"} sdl:${gw.SDL2?.audioContext?.state ?? "-"}`;
        } catch { return "err"; } })(),
      };
      void fetch("/radio-diag", { method: "POST", body: JSON.stringify(snap), keepalive: true });
    } catch { /* diagnostics must never break the page */ }
  }, 8000);
}
