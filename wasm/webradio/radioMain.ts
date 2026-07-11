/**
 * Entry point for the WebAssembly build's radio. Installs the window.gpfRadio*
 * hooks the C++ bridge (src/onthepitch/wasm_radio_bridge.hpp) calls, runs the
 * continuous play-by-play loop, and wires language selection + the R toggle.
 *
 * Language: ?lang=xx in the URL (falls back to English if no voice exists).
 */
import { commentaryTick, pushMatchState, type MatchSnapshot } from "./commentary";
import { initMenu } from "./menu";
import { initHomeMenu, onMatchStarted } from "./homemenu";
import { initClubs } from "./clubs";
import { initLineup } from "./lineup";
import { initNational } from "./national";
import { initTraining } from "./training";
import { initDrillAim } from "./drillaim";
import { initKeeperArrows } from "./keeperarrows";
import { initAnthem } from "./anthem";
import { initScoreFlags } from "./scoreflags";
import {
  type RadioEvent,
  audioPeak,
  enableAudioCapture,
  radio,
  radioReset,
  resumeRadio,
  setRadioLanguage,
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
warmupRadioVoice();
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
const bridge = { events: [] as string[], ticks: 0, teams: ["", ""] as string[], lastCarrier: "" };
(window as unknown as { __gpfRadioBridge: typeof bridge }).__gpfRadioBridge = bridge;

w.gpfRadioSetTeams = (home, away): void => {
  bridge.teams = [home, away];
  setRadioTeams(home, away);
};

w.gpfRadioReset = (): void => {
  matchGen++;
  matchEnded = false;
  onMatchStarted(); // a match started -> hide the home menu + stop the Enter driver
  radioReset();
};

w.gpfRadioEvent = (event, player, team, score0, score1): void => {
  bridge.events.push(event + (player ? `:${player}` : ""));
  if (bridge.events.length > 40) bridge.events.shift();
  console.log(`[gpf-radio] event: ${event}${player ? " " + player : ""}`);
  const info: { team?: number; score?: [number, number]; player?: string } = {};
  if (player) info.player = player;
  if (team >= 0) info.team = team;
  if (score0 >= 0) info.score = [score0, score1];
  radio(event as RadioEvent, info);
  if (event === "fulltime") matchEnded = true;
  if (event === "opening") matchEnded = false;
};

w.gpfRadioTick = (snap): void => {
  bridge.ticks++;
  bridge.lastCarrier = snap.carrier;
  snap.gen = matchGen;
  snap.ended = snap.ended || matchEnded;
  pushMatchState(snap);
};

w.gpfRadioToggle = (): boolean => toggleRadio();
w.gpfRadioSetLanguage = (lang): void => setRadioLanguage(lang);

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

// Re-apply the graphics quality picked in the native SETTINGS > GRAPHICS menu
// (persisted in localStorage; 4 = ultra is the engine default, nothing to do).
const applySavedQuality = (): void => {
  let level = 4;
  try { level = parseInt(localStorage.getItem("gpf-quality") ?? "4", 10); } catch { /* private mode */ }
  if (!Number.isFinite(level) || level < 0 || level > 4) level = 4;
  if (level === 4) return;
  const M = (window as unknown as { Module?: { _gpf_set_quality?: (l: number) => void } }).Module;
  if (M?._gpf_set_quality) M._gpf_set_quality(level);
  else window.setTimeout(applySavedQuality, 2000); // wasm not up yet — retry
};
applySavedQuality();

// R toggles the commentary (matches the web version); ignore when typing.
window.addEventListener("keydown", (e) => {
  if (e.key === "r" || e.key === "R") {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    toggleRadio();
  }
});

// browsers need a user gesture before audio can play — wake the radio on the
// first interaction with the page (the game canvas gets clicks/keys anyway).
const wake = (): void => resumeRadio();
window.addEventListener("pointerdown", wake, { once: false });
window.addEventListener("keydown", wake, { once: false });

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
