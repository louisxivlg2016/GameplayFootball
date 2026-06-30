/**
 * Radio commentary: a French play-by-play voice. Piper neural TTS
 * (fr_FR-tom-medium) synthesized in a Web Worker, WASM runtimes self-hosted
 * by serve.ts. There is deliberately NO robotic fallback: if the neural voice
 * cannot load, the radio stays silent (see console [radio] lines for why).
 * Urgent events (goals, cards) interrupt; chatter only plays when the
 * commentator is quiet. Toggle with R.
 */
import { remove as removeVoice } from "@mintplex-labs/piper-tts-web";
import goalButButUrl from "../assets/audio/goal-but-but.mp3";
import { audioMuted, sharedAudioContext, sharedAudioOutput } from "./audio";

let enabled = true;
export const RADIO_STATE_EVENT = "gpf-radio-statechange";

function dispatchRadioState(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<{ enabled: boolean }>(RADIO_STATE_EVENT, {
      detail: { enabled },
    }),
  );
}

// ---- shared player for the neural engine ----
// WebAudio playback: an HTMLAudioElement caps at volume 1.0 — the commentator
// needs to be LOUD, so we run through a gain (x3) into a compressor.
let radioCtx: AudioContext | null = null;
let radioOut: GainNode | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let playerBusy = false;
// when the mic was taken / last made progress. If `onended` never fires (the
// context was suspended mid-clip, a decode quirk, a lost event) the mic would
// stay busy forever and the commentary would go permanently silent after a few
// lines. The stuck-mic guard in takeMic steals it back once it's been held this
// long with no progress, so the radio can never lock up for good.
let playerBusyAt = 0;
const MIC_STUCK_MS = 20000;
let playerGen = 0;
let speechToken = 0;

function speechFallbackAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.speechSynthesis !== "undefined" &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

function preferredSpeechVoice(): SpeechSynthesisVoice | null {
  if (!speechFallbackAvailable()) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((voice) => voice.lang.toLowerCase().startsWith("fr") && /thomas|am[eé]lie|hortense/i.test(voice.name)) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("fr")) ??
    null
  );
}

function stopSpeechFallback(): void {
  if (!speechFallbackAvailable()) return;
  speechToken++;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* no-op */
  }
}

function ensureRadioCtx(): AudioContext {
  if (!radioCtx) {
    // share the page-wide context: a fresh AudioContext per hot reload hits
    // Chrome's 6-context limit and kills ALL sound until a full page reload
    const shared = globalThis as {
      __gpfRadioOut?: { ctx: AudioContext; out: GainNode } | null;
    };
    if (shared.__gpfRadioOut) {
      radioCtx = shared.__gpfRadioOut.ctx;
      radioOut = shared.__gpfRadioOut.out;
    } else {
      radioCtx = sharedAudioContext() ?? new AudioContext();
      const comp = radioCtx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 18;
      comp.ratio.value = 10;
      comp.attack.value = 0.002;
      comp.release.value = 0.18;
      const sharedOut = sharedAudioOutput();
      if (sharedOut && sharedOut.context === radioCtx) comp.connect(sharedOut);
      else comp.connect(radioCtx.destination);
      radioOut = radioCtx.createGain();
      radioOut.gain.value = 1;
      radioOut.connect(comp);
      shared.__gpfRadioOut = { ctx: radioCtx, out: radioOut };
    }
  }
  void radioCtx.resume();
  return radioCtx;
}

function stopCurrent(): void {
  try {
    currentSource?.stop();
  } catch {
    /* already stopped */
  }
  stopSpeechFallback();
  currentSource = null;
  playerBusy = false;
}
// the latest urgent line called while a model is still loading — spoken the
// moment the voice is ready, so the radio joins with the good voice, not eSpeak
let pendingText: string | null = null;

// next play-by-play line, pre-synthesized while the current one plays so the
// commentary chains without dead air
let queuedFlow: { blob: Blob; at: number } | null = null;
let goalClipBytes: Promise<ArrayBuffer | null> | null = null;
let goalClipBuffer: Promise<AudioBuffer | null> | null = null;

/** Excitement: louder + faster with pitch riding up = the commentator shouts. */
interface VoiceFx {
  rate?: number;
  volume?: number;
}

async function playBlob(wav: Blob, gen: number, fx?: VoiceFx): Promise<void> {
  // only the LATEST mic owner may free the mic — a superseded line returning
  // late must not release it while a long goal scream is still synthesizing
  if (gen !== playerGen) return;
  if (!enabled) {
    playerBusy = false;
    return;
  }
  try {
    const ctx = ensureRadioCtx();
    const pcm = await ctx.decodeAudioData(await wav.arrayBuffer());
    if (gen !== playerGen) return;
    if (!enabled) {
      playerBusy = false;
      return;
    }
    try {
      currentSource?.stop();
    } catch {
      /* already stopped */
    }
    const src = ctx.createBufferSource();
    src.buffer = pcm;
    src.playbackRate.value = fx?.rate ?? 1; // pitch rides up with rate: the shout
    const gain = ctx.createGain();
    gain.gain.value = (fx?.volume ?? 1) * 3.4; // LOUD — compressor catches peaks
    src.connect(gain);
    gain.connect(radioOut!);
    currentSource = src;
    src.onended = (): void => {
      // onended also fires when an interrupt stop()s us — only a natural end
      // frees the mic and chains the queued line, else we talk over the shout
      if (currentSource === src) {
        playerBusy = false;
        currentSource = null;
        playQueuedFlow();
      }
    };
    src.start();
    playerBusyAt = Date.now(); // real playback started — mic is making progress
    radioDebug.lastPlayAt = Date.now();
    radioDebug.ctxState = ctx.state;
  } catch (err) {
    radioDebug.lastError = String(err);
    if (gen === playerGen) playerBusy = false;
  }
}

function playSpeechFallback(text: string, gen: number, fx?: VoiceFx): void {
  if (gen !== playerGen) return;
  if (!enabled || !speechFallbackAvailable()) {
    playerBusy = false;
    return;
  }
  const synth = window.speechSynthesis;
  const token = ++speechToken;
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = preferredSpeechVoice();
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || "fr-FR";
  utterance.rate = Math.max(0.8, Math.min(1.25, fx?.rate ?? 1));
  utterance.pitch = 1;
  utterance.volume = audioMuted() ? 0 : Math.max(0.35, Math.min(1, fx?.volume ?? 1));
  utterance.onend = (): void => {
    if (token !== speechToken || gen !== playerGen) return;
    playerBusy = false;
    playQueuedFlow();
  };
  utterance.onerror = (): void => {
    if (token !== speechToken || gen !== playerGen) return;
    playerBusy = false;
  };
  try {
    synth.cancel();
    synth.speak(utterance);
    playerBusyAt = Date.now();
    radioDebug.lastPlayAt = Date.now();
    radioDebug.ctxState = "speech";
    (globalThis as Record<string, unknown>).__radioEngine = "speech-fr";
  } catch (err) {
    radioDebug.lastError = String(err);
    if (gen === playerGen) playerBusy = false;
  }
}

/** Wake the playback context — browsers may suspend it; call on user gestures. */
export function resumeRadio(): void {
  if (radioCtx && radioCtx.state !== "running") void radioCtx.resume();
}

// Safety net: a backgrounded tab suspends the AudioContext, and coming back
// without a fresh click would leave the radio green-but-silent. Re-wake it
// whenever the tab regains visibility/focus (sticky activation lets resume()
// succeed without a new gesture once the user has interacted once).
if (typeof window !== "undefined") {
  const wake = (): void => resumeRadio();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") wake();
  });
  window.addEventListener("focus", wake);
}

/** Live diagnostics: inspect with __radioDebug in the console. */
const radioDebug = {
  lastSay: "",
  lastSayAt: 0,
  lastPlayAt: 0,
  ctxState: "none",
  lastError: "",
};
(globalThis as Record<string, unknown>).__radioDebug = radioDebug;

function playQueuedFlow(): void {
  if (!queuedFlow || playerBusy || !enabled) return;
  const fresh = Date.now() - queuedFlow.at < 8000; // stale lines are dropped
  const blob = queuedFlow.blob;
  queuedFlow = null;
  if (!fresh) return;
  const gen = takeMic(1);
  if (gen !== null) playBlob(blob, gen);
}

function fetchGoalClipBytes(): Promise<ArrayBuffer | null> {
  goalClipBytes ??= fetch(goalButButUrl)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .catch((err: unknown) => {
      radioDebug.lastError = String(err);
      return null;
    });
  return goalClipBytes;
}

async function loadGoalClip(ctx: AudioContext): Promise<AudioBuffer | null> {
  goalClipBuffer ??= fetchGoalClipBytes().then((buf) => (buf ? ctx.decodeAudioData(buf.slice(0)) : null));
  return goalClipBuffer;
}

async function playGoalClip(): Promise<void> {
  const gen = takeMic(3);
  if (gen === null) return;
  try {
    const ctx = ensureRadioCtx();
    const pcm = await loadGoalClip(ctx);
    if (!pcm || gen !== playerGen || !enabled) {
      playerBusy = false;
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = pcm;
    const gain = ctx.createGain();
    gain.gain.value = 3.2;
    src.connect(gain).connect(radioOut!);
    currentSource = src;
    src.onended = (): void => {
      if (currentSource === src) {
        playerBusy = false;
        currentSource = null;
        playQueuedFlow();
      }
    };
    src.start();
    playerBusyAt = Date.now(); // real playback started — mic is making progress
    radioDebug.lastSay = "goal-but-but sample";
    radioDebug.lastSayAt = Date.now();
    radioDebug.lastPlayAt = Date.now();
    radioDebug.ctxState = ctx.state;
  } catch (err) {
    radioDebug.lastError = String(err);
    if (gen === playerGen) playerBusy = false;
  }
}

function takeMic(priority: number): number | null {
  if (priority >= 2) {
    stopCurrent();
    queuedFlow = null; // a shout supersedes any pre-baked chatter
  } else if (playerBusy) {
    // legitimately busy with a recent line — let it finish. But if the mic has
    // been held far too long with no progress, it's wedged (a lost onended):
    // steal it back so the commentary recovers instead of dying for good.
    if (Date.now() - playerBusyAt < MIC_STUCK_MS) return null;
    stopCurrent();
  }
  playerBusy = true;
  playerBusyAt = Date.now();
  return ++playerGen;
}

function speakPending(): void {
  if (pendingText && enabled) {
    const text = pendingText;
    pendingText = null;
    say(text, 2);
  }
}

// ---- Piper neural voice (free model from huggingface.co/rhasspy/piper-voices) ----
// Runs inside a Web Worker: multi-second WASM inference must never block the
// game loop. Note: Kokoro-82M was evaluated for an even more natural voice,
// but its browser phonemizer builds are English-only — no French possible.
let piperWorker: Worker | null = null;
let piperState: "idle" | "loading" | "ready" | "failed" = "idle";
let sayId = 0;
const sayWaiters = new Map<number, (wav: Blob | null) => void>();

// A load that fails once (worker fetched mid server-restart, a transient HF
// hiccup, a half-written OPFS cache) used to leave the radio silent for the
// WHOLE page session — there was no retry. Now a failure self-heals: tear the
// worker down and warm up again with a backoff, so the voice comes back on its
// own without needing a manual hard-reload.
//
// The nastiest case is a CORRUPT OPFS cache — a model half-written by an
// earlier interrupted download. Every load then throws the same way forever,
// and a plain reload won't help because the bad bytes are still cached. So
// once a couple of retries have failed we PURGE the cached voice from OPFS
// before the next attempt: the model re-downloads clean and the radio heals
// itself, with no "clear site data" needed from the user.
const VOICE_ID = "fr_FR-tom-medium";
let warmAttempts = 0;
function scheduleWarmupRetry(why: string): void {
  if (warmAttempts >= 10) return; // a couple of minutes of tries, then give up
  warmAttempts++;
  const delay = Math.min(1500 * warmAttempts, 10000);
  // a model-load (session create) failure that survives the first couple of
  // transient retries is most likely a corrupt cache — wipe it and re-fetch
  const purge = why === "session create" && warmAttempts >= 2;
  console.info(
    `[radio] voice load failed (${why}) — retry ${warmAttempts}/10 in ${delay}ms${purge ? " (purging cached model)" : ""}`,
  );
  setTimeout(() => {
    if (piperState !== "failed") return; // recovered some other way
    const restart = (): void => {
      try {
        piperWorker?.terminate();
      } catch {
        /* already gone */
      }
      piperWorker = null;
      piperState = "idle";
      warmupPiper();
    };
    if (purge) void removeVoice(VOICE_ID).catch(() => {}).finally(restart);
    else restart();
  }, delay);
}

function warmupPiper(): void {
  if (piperState !== "idle") return;
  piperState = "loading";
  try {
    // pre-bundled by serve.ts — the dev HTML bundler can't bundle worker URLs
    piperWorker = new Worker("/tts/worker.js", { type: "module" });
  } catch (err) {
    console.info("[radio] worker failed:", err);
    piperState = "failed";
    (globalThis as Record<string, unknown>).__radioEngine = "none";
    scheduleWarmupRetry("worker construct");
    return;
  }
  piperWorker.onerror = (e) => {
    console.info("[radio] worker error:", e.message ?? e);
    piperState = "failed";
    (globalThis as Record<string, unknown>).__radioEngine = "none";
    scheduleWarmupRetry("worker error");
  };
  piperWorker.onmessage = (e: MessageEvent) => {
    const msg = e.data as
      | { type: "ready" }
      | { type: "error"; error: string }
      | { type: "wav"; id: number; buf: ArrayBuffer }
      | { type: "sayError"; id: number };
    if (msg.type === "ready") {
      piperState = "ready";
      warmAttempts = 0; // proven alive — reset the retry budget
      console.info("[radio] piper french voice on air (worker)");
      (globalThis as Record<string, unknown>).__radioEngine = "piper-fr";
      void removeVoice("fr_FR-gilles-low").catch(() => {});
      void removeVoice("fr_FR-siwis-medium").catch(() => {});
      speakPending();
    } else if (msg.type === "error") {
      console.info("[radio] piper failed:", msg.error);
      piperState = "failed"; // offline or unsupported: the radio stays silent
      (globalThis as Record<string, unknown>).__radioEngine = "none";
      scheduleWarmupRetry("session create"); // transient failures self-heal
      speakPending();
    } else if (msg.type === "wav") {
      sayWaiters.get(msg.id)?.(new Blob([msg.buf], { type: "audio/wav" }));
      sayWaiters.delete(msg.id);
    } else if (msg.type === "sayError") {
      sayWaiters.get(msg.id)?.(null);
      sayWaiters.delete(msg.id);
    }
  };
  // tom-medium: 44.1kHz French Piper voice from Hugging Face. The other free
  // French Piper options we checked (siwis/upmc) stay at 22.05kHz, so tom
  // remains the cleanest default here. WASM runtimes are served locally by
  // serve.ts — third-party CDNs are blocked on some networks.
  piperWorker.postMessage({
    type: "init",
    voiceId: VOICE_ID,
    wasmPaths: {
      onnxWasm: "/tts/onnx/",
      piperData: "/tts/piper_phonemize.data",
      piperWasm: "/tts/piper_phonemize.wasm",
    },
  });
}

/** Load the neural voice. Runs at page load: downloading needs no user gesture. */
export function warmupRadioVoice(): void {
  if (typeof window === "undefined") return;
  warmupPiper();
}
if (typeof window !== "undefined") warmupRadioVoice();
if (typeof window !== "undefined") void fetchGoalClipBytes();

let predictFails = 0;
// `workerEverSpoke` tightens the mic watchdog once the worker is warm (a cold
// start can take ~15s; a warm sentence is a couple seconds).
let workerEverSpoke = false;
let lastWorkerReplyAt = 0; // when the worker last produced a real clip
// bounded respawns: a worker that worked and then crashes/hangs (the "talks at
// first, then goes silent" bug) gets restarted — but cap it so a genuinely
// broken engine can't respawn forever.
let workerRespawns = 0;

function restartWorker(reason: string): void {
  workerRespawns++;
  workerEverSpoke = false; // the fresh worker is cold again — give it grace
  predictFails = 0;
  lastWorkerReplyAt = 0;
  console.info(`[radio] voice worker ${reason} — restarting (#${workerRespawns})`);
  try {
    piperWorker?.terminate();
  } catch {
    /* already gone */
  }
  piperWorker = null;
  piperState = "idle";
  warmupPiper();
}

function piperPredict(text: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!piperWorker) {
      resolve(null);
      return;
    }
    const id = ++sayId;
    let settled = false;
    const finish = (wav: Blob | null): void => {
      if (settled) return;
      settled = true;
      sayWaiters.delete(id);
      if (wav) {
        predictFails = 0;
        workerEverSpoke = true;
        lastWorkerReplyAt = Date.now();
      } else if (workerRespawns < 8) {
        // a timeout. Respawn ONLY on genuine death, not a transient stall:
        //  - a once-healthy worker that has produced NOTHING for a sustained
        //    stretch (40s) has crashed/hung — this is the "talks then goes
        //    silent" bug. Time-based so a burst of concurrent timeouts hitting
        //    one slow moment (radioFlow fires synths without awaiting) doesn't
        //    trip a false restart.
        //  - a worker that has NEVER spoken and keeps timing out (3x) never
        //    started at all (server bounce mid-fetch); restart it cold.
        const silentFor = workerEverSpoke ? Date.now() - lastWorkerReplyAt : 0;
        if (workerEverSpoke && silentFor > 40000) restartWorker("went silent");
        else if (!workerEverSpoke && ++predictFails >= 3) restartWorker("never responded");
      }
      resolve(wav);
    };
    sayWaiters.set(id, finish);
    // the watchdog frees the MIC so chatter never locks up; cold start can take
    // ~15s so an unproven worker gets longer. Restart is decided separately,
    // time-based, above.
    setTimeout(() => finish(null), workerEverSpoke ? 18000 : 30000);
    piperWorker.postMessage({ type: "say", id, text });
  });
}

async function sayPiper(text: string, priority: number, fx?: VoiceFx): Promise<void> {
  const gen = takeMic(priority);
  if (gen === null) return;
  const wav = await piperPredict(text);
  if (!wav) {
    if (gen === playerGen) playerBusy = false; // only the owner frees the mic
    return;
  }
  void playBlob(wav, gen, fx);
}

export function radioEnabled(): boolean {
  return enabled;
}

/** Clean slate for a new match. The radio is a module singleton that outlives
 *  the React match tree, so a mic left BUSY at the previous full-time (a clip
 *  whose onended never landed once the mode flipped to menu, a half-spoken
 *  buffered line) would carry over and start the new match silent. Reset the
 *  player + queue, wake the context, and make sure the engine is warming. */
export function radioReset(): void {
  enabled = true; // a new match always re-enables the radio (R may have cut it)
  stopCurrent(); // frees currentSource + playerBusy
  playerBusy = false;
  playerBusyAt = 0;
  queuedFlow = null;
  pendingText = null;
  predictFails = 0;
  playerGen++; // orphan any in-flight clip that resolves late
  resumeRadio();
  if (piperState === "idle" || piperState === "failed") {
    warmAttempts = 0;
    workerRespawns = 0;
    piperState = "idle";
    warmupPiper(); // engine died/never started — bring it back for this match
  }
  dispatchRadioState();
}

/** Is the commentator free to take a play-by-play line right now? */
export function radioIdle(): boolean {
  if (!enabled) return false;
  return (piperState === "ready" || speechFallbackAvailable()) && !playerBusy;
}

/** Continuous play-by-play line. If the mic is busy, the line is synthesized
 *  right away (the worker is free while audio plays) and chained next. */
export function radioFlow(text: string): void {
  if (!enabled) return;
  if (piperState !== "ready") {
    if (speechFallbackAvailable() && !playerBusy) say(text, 1);
    return;
  }
  const g = globalThis as Record<string, unknown>;
  g.__radioLines = ((g.__radioLines as number) ?? 0) + 1;
  if (!playerBusy) {
    say(text, 1);
    return;
  }
  void piperPredict(text).then((blob) => {
    if (blob) {
      queuedFlow = { blob, at: Date.now() };
      playQueuedFlow(); // mic may have freed while we were synthesizing
    }
  });
}

export function toggleRadio(): boolean {
  enabled = !enabled;
  if (!enabled) {
    stopCurrent();
    playerGen++;
    pendingText = null;
    queuedFlow = null;
  } else {
    say("La radio du match est de retour à l'antenne !", 2);
  }
  dispatchRadioState();
  return enabled;
}

function say(text: string, priority = 1, fx?: VoiceFx): void {
  if (!enabled) return;
  radioDebug.lastSay = text.slice(0, 60);
  radioDebug.lastSayAt = Date.now();

  if (piperState === "ready") {
    void sayPiper(text, priority, fx);
    return;
  }
  if (speechFallbackAvailable()) {
    const gen = takeMic(priority);
    if (gen !== null) playSpeechFallback(text, gen, fx);
    return;
  }
  // still loading: hold the latest urgent line for the good voice
  if (piperState === "loading" && priority >= 2) {
    pendingText = text;
  }
  // failed: stay silent — never a robotic fallback
}

/** The commentator on his feet: louder, barely faster — same man, same voice.
 *  (Bigger rate shifts pitch the voice up enough to sound like a second person.) */
const SHOUT: VoiceFx = { rate: 1.04, volume: 1.3 };
/** Rising excitement, not quite full scream. */
const EXCITED: VoiceFx = { rate: 1.02, volume: 1.15 };

const pick = (lines: string[]): string =>
  lines[Math.floor(Math.random() * lines.length)]!;

export const teamName = (id: number): string =>
  id === 0 ? "les Rouges" : "les Bleus";

export type RadioEvent =
  | "opening"
  | "kickoff"
  | "goal"
  | "foul"
  | "yellow"
  | "red"
  | "penalty"
  | "offside"
  | "corner"
  | "goalkick"
  | "throwin"
  | "pass"
  | "shot"
  | "miss"
  | "save"
  | "halftime"
  | "extratime"
  | "fulltime"
  | "shootout"
  | "penTaker"
  | "penGoal"
  | "penMiss";

export function radio(
  event: RadioEvent,
  info: {
    team?: number;
    score?: [number, number];
    player?: string;
    target?: string;
  } = {},
): void {
  const team = info.team !== undefined ? teamName(info.team) : "";
  const score = info.score;
  const player = info.player ?? "";
  const target = info.target ?? "";
  switch (event) {
    case "opening":
      say(
        pick([
          "Bienvenue à toutes et à tous ! Aujourd'hui, nous allons assister à un match passionnant !",
          "Bonjour à toutes et à tous ! Installez-vous bien, ce match s'annonce passionnant !",
          "Bienvenue en direct du stade ! Aujourd'hui, on vous promet une rencontre passionnante !",
        ]),
        2,
      );
      break;
    case "kickoff":
      say(
        pick([
          `Et c'est parti, coup d'envoi pour ${team} !`,
          `Le ballon roule, ${team} engagent !`,
        ]),
      );
      break;
    case "goal":
      void playGoalClip();
      break;
    case "foul":
      say(
        team
          ? pick([`Faute ! Coup franc pour ${team}.`, `L'arbitre siffle, coup franc pour ${team} !`])
          : pick(["Faute sifflée !", "L'arbitre arrête le jeu, faute !"]),
        2,
      );
      break;
    case "yellow":
      say(
        player
          ? `Carton jaune pour ${player} !`
          : pick(["Carton jaune, il est averti !", "Le jaune sort de la poche de l'arbitre !"]),
        2,
      );
      break;
    case "red":
      say(
        player
          ? `Carton rouge ! ${player} prend la direction des vestiaires !`
          : pick([
              "Carton rouge ! Il prend la direction des vestiaires !",
              "Expulsé ! Son match s'arrête là !",
            ]),
        2,
      );
      break;
    case "penalty":
      say(
        team
          ? pick([`Penalty pour ${team} !`, `L'arbitre désigne le point de penalty, penalty pour ${team} !`])
          : pick(["Penalty ! C'est penalty !", "L'arbitre désigne le point de penalty !"]),
        2,
      );
      break;
    case "offside":
      say(pick(["Signalé hors-jeu !", "Le drapeau se lève, hors-jeu !"]), 2);
      break;
    case "corner":
      say(pick([`Corner pour ${team}.`, `Le ballon sort, corner ${team}.`]));
      break;
    case "goalkick":
      if (Math.random() < 0.4) say("Six mètres, le gardien va relancer.");
      break;
    case "throwin":
      if (Math.random() < 0.25) say(`Touche pour ${team}.`);
      break;
    case "pass":
      if (player && target && radioIdle())
        say(
          pick([
            `${player} pour ${target}.`,
            `${player} trouve ${target}.`,
            `${player}... ${target}.`,
          ]),
        );
      break;
    case "shot":
      // the rising moment: interrupt the chatter, voice climbs
      say(
        player
          ? pick([`La frappe de ${player} !`, `${player} arme... ça part !`, `Attention, ${player} tente sa chance !`])
          : pick(["La frappe !", "Ça part au but !"]),
        2,
        EXCITED,
      );
      break;
    case "miss":
      say(
        pick([
          "Oh ! À côté ! Il s'en faut de rien !",
          "Au-dessus ! On a cru au but !",
          "Oh là là, ça passe tout près du poteau !",
        ]),
        2,
        SHOUT,
      );
      break;
    case "save":
      say(
        pick([
          "Quel arrêt du gardien ! Incroyable !",
          "Le portier dit non ! Quelle parade !",
          "Arrêt énorme ! On a cru au but !",
        ]),
        2,
        SHOUT,
      );
      break;
    case "halftime":
      say(
        `Mi-temps${score ? `, ${score[0]} à ${score[1]}` : ""}. On se retrouve dans quelques instants.`,
        2,
      );
      break;
    case "extratime":
      say("Et nous voilà en prolongation !", 2);
      break;
    case "fulltime":
      say(
        `C'est terminé !${score ? ` Score final, ${score[0]} à ${score[1]}.` : ""} Merci de nous avoir suivis à la radio du match !`,
        2,
      );
      break;
    case "shootout":
      say("Tout va se jouer aux tirs au but, accrochez-vous !", 2);
      break;
    case "penTaker":
      say(
        pick([
          `C'est ${player} qui s'avance... Le stade retient son souffle.`,
          `${player} face au gardien... Silence dans les tribunes.`,
          `Tout repose sur les épaules de ${player}...`,
        ]),
        2,
      );
      break;
    case "penGoal":
      say(pick(["Transformé ! C'est au fond !", "Le tir au but est au fond ! Quelle pression !"]), 2, SHOUT);
      break;
    case "penMiss":
      say(
        pick(["Raté ! Il passe à côté !", "Arrêté ! Le gardien s'envole !"]),
        2,
        SHOUT,
      );
      break;
  }
}

/** Occasional score reminder between actions. */
export function radioScore(score: [number, number], gameMinute: number): void {
  // no ordinal ("Xe minute") — Piper mangles it; a round-minute phrase reads clean
  const lead =
    score[0] === score[1]
      ? score[0] === 0
        ? "toujours zéro à zéro"
        : `toujours ${score[0]} partout`
      : score[0] > score[1]
        ? `${teamName(0)} mènent ${score[0]} à ${score[1]}`
        : `${teamName(1)} mènent ${score[1]} à ${score[0]}`;
  say(`Après ${Math.max(1, Math.floor(gameMinute))} minutes de jeu, ${lead}.`);
}
