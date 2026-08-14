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
import {
  type RadioEvent,
  audioPeak,
  enableAudioCapture,
  radio,
  radioCtxState,
  radioReset,
  radioVoicePhase,
  resumeRadio,
  setRadioLanguage,
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

w.gpfRadioReset = (): void => {
  matchGen++;
  matchEnded = false;
  onMatchStarted(); // a match started -> hide the home menu + stop the Enter driver
  radioReset();
};

// The engine hands us player last names in the in-game font's ALL-CAPS ASCII
// (e.g. "MBAPPE", "T.HERNANDEZ", "DE.BRUYNE") — the neural voice would spell
// those out like acronyms. Normalise to a spoken form: drop initials, split on
// the dot, Title-case each part ("Mbappe", "Hernandez", "De Bruyne").
function niceName(raw: string): string {
  if (!raw) return raw;
  const parts = raw.split(".").map((t) => t.trim()).filter((t) => t.length > 1)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
  return parts.length ? parts.join(" ") : raw;
}

w.gpfRadioEvent = (event, player, team, score0, score1): void => {
  bridge.events.push(event + (player ? `:${player}` : ""));
  if (bridge.events.length > 40) bridge.events.shift();
  console.log(`[gpf-radio] event: ${event}${player ? " " + player : ""}`);
  const info: { team?: number; score?: [number, number]; player?: string } = {};
  if (player) info.player = niceName(player);
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
  pushMatchState(snap);
};

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
initScoreFlags();
initSettings();
initDefi();
initTouch();
initMatches();
initFriendly();
initLoading();
initShootout();
initNetplay();
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
const wake = (): void => resumeRadio();
for (const ev of ["pointerdown", "touchstart", "touchend", "mousedown", "keydown"] as const) {
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
