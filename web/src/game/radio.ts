/**
 * Radio commentary: one play-by-play voice per language when Piper has a
 * matching model, otherwise the browser voice for that language. Urgent events
 * interrupt; chatter only plays when the commentator is quiet. Toggle with R.
 */
import { remove as removeVoice } from "@mintplex-labs/piper-tts-web";
import goalButButUrl from "../assets/audio/goal-but-but.mp3";
import { getCurrentLanguage, type AppLanguage } from "../i18n";
import { audioMuted, sharedAudioContext, sharedAudioOutput } from "./audio";
import { getGoalCall, getPiperVoiceId, getRadioPack, getSpeechLocale, getTeamDisplayName } from "./radioI18n";
import { getConfiguredMatchTeam } from "./teams";

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
let currentAudioEl: HTMLAudioElement | null = null;
let currentAudioUrl: string | null = null;
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
let lastOpeningAt = 0;

/** Can this language actually SPEAK here? A Piper model, or a real browser
 *  voice for it. Languages with neither fall back to the English commentary —
 *  spoken beats silent. */
function radioSpeakable(language: AppLanguage): boolean {
  if (getPiperVoiceId(language)) return true;
  return preferredSpeechVoice(language) !== null;
}

function currentLanguage(): AppLanguage {
  const ui = getCurrentLanguage();
  return radioSpeakable(ui) ? ui : "en";
}

/** The language the radio will actually speak (UI language, or English when
 *  no voice exists for it) — commentary text must match the voice. */
export function radioLanguage(): AppLanguage {
  return currentLanguage();
}

// some Piper voices are mastered much quieter than tom/fr — per-voice boost
// so every commentator hits the same broadcast loudness
const VOICE_GAIN: Record<string, number> = {
  "de_DE-thorsten-high": 1.5,
  "no_NO-talesyntese-medium": 1.75,
  "it_IT-paola-medium": 1.45,
  "sr_RS-serbski_institut-medium": 1.4,
  "nl_BE-rdh-medium": 1.25,
};

function speechFallbackAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.speechSynthesis !== "undefined" &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

function preferredSpeechVoice(language: AppLanguage): SpeechSynthesisVoice | null {
  if (!speechFallbackAvailable()) return null;
  const wanted = getSpeechLocale(language).toLowerCase();
  const wantedPrefix = wanted.split("-")[0]!;
  const voices = window.speechSynthesis.getVoices();
  const scoreVoice = (voice: SpeechSynthesisVoice): number => {
    const name = voice.name.toLowerCase();
    const lang = voice.lang.toLowerCase();
    let score = 0;
    if (lang === wanted) score += 120;
    else if (lang.startsWith(`${wantedPrefix}-`) || lang === wantedPrefix) score += 100;
    if (voice.localService) score += 10;
    if (
      /(male|man|masc|thomas|tom|daniel|nicolas|paul|vincent|antoine|xavier|alexandre|yann|julien|thorsten|alan|ryan|kareem|denis|dmitri|fahrettin|riccardo|faber)/i.test(
        name,
      )
    ) {
      score += 40;
    }
    if (/(female|femme|woman|amelie|amélie|hortense|audrey|claire|julie|marie|eva|kerstin|nathalie|paola|lada|amy|jenny|irina)/i.test(name)) {
      score -= 60;
    }
    return score;
  };
  const matching = voices.filter((voice) => {
    const lang = voice.lang.toLowerCase();
    return lang === wanted || lang.startsWith(`${wantedPrefix}-`) || lang === wantedPrefix;
  });
  if (!matching.length) return null;
  const ranked = [...matching].sort((a, b) => scoreVoice(b) - scoreVoice(a));
  return ranked[0] ?? null;
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

function clearCurrentAudioElement(): void {
  if (currentAudioEl) {
    currentAudioEl.onended = null;
    currentAudioEl.onerror = null;
    try {
      currentAudioEl.pause();
      currentAudioEl.removeAttribute("src");
      currentAudioEl.load();
    } catch {
      /* already gone */
    }
    currentAudioEl = null;
  }
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }
}

function stopCurrent(): void {
  try {
    currentSource?.stop();
  } catch {
    /* already stopped */
  }
  stopSpeechFallback();
  clearCurrentAudioElement();
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
    // Mobile browsers are much more reliable with HTMLMediaElement than with
    // WebAudio for spoken clips, so prefer this path first.
    if (typeof Audio !== "undefined") {
      clearCurrentAudioElement();
      const url = URL.createObjectURL(wav);
      const audio = new Audio(url);
      currentAudioEl = audio;
      currentAudioUrl = url;
      audio.preload = "auto";
      audio.setAttribute("playsinline", "true");
      audio.playbackRate = fx?.rate ?? 1;
      audio.volume = audioMuted() ? 0 : Math.max(0.4, Math.min(1, (fx?.volume ?? 1) * 0.95));
      audio.onended = (): void => {
        if (currentAudioEl !== audio) return;
        clearCurrentAudioElement();
        playerBusy = false;
        playQueuedFlow();
      };
      audio.onerror = (): void => {
        if (currentAudioEl !== audio) return;
        clearCurrentAudioElement();
        playerBusy = false;
      };
      await audio.play();
      playerBusyAt = Date.now();
      radioDebug.lastPlayAt = Date.now();
      radioDebug.ctxState = "media";
      return;
    }
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
    const boost = VOICE_GAIN[requestedVoiceId ?? ""] ?? 1;
    gain.gain.value = (fx?.volume ?? 1) * 3.4 * boost; // LOUD — compressor catches peaks
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

function playSpeechFallback(text: string, gen: number, language: AppLanguage, fx?: VoiceFx): void {
  if (gen !== playerGen) return;
  if (!enabled || !speechFallbackAvailable()) {
    playerBusy = false;
    return;
  }
  const synth = window.speechSynthesis;
  const token = ++speechToken;
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = preferredSpeechVoice(language);
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || getSpeechLocale(language);
  utterance.rate = Math.max(0.8, Math.min(1.25, fx?.rate ?? 1));
  utterance.pitch = 0.82;
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
    (globalThis as Record<string, unknown>).__radioEngine = `speech-${utterance.lang}`;
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
    if (typeof Audio !== "undefined") {
      clearCurrentAudioElement();
      const audio = new Audio(goalButButUrl);
      currentAudioEl = audio;
      currentAudioUrl = null;
      audio.preload = "auto";
      audio.setAttribute("playsinline", "true");
      audio.volume = audioMuted() ? 0 : 1;
      audio.onended = (): void => {
        if (currentAudioEl !== audio) return;
        clearCurrentAudioElement();
        playerBusy = false;
        playQueuedFlow();
      };
      audio.onerror = (): void => {
        if (currentAudioEl !== audio) return;
        clearCurrentAudioElement();
        playerBusy = false;
      };
      await audio.play();
      playerBusyAt = Date.now();
      radioDebug.lastSay = "goal-but-but sample";
      radioDebug.lastSayAt = Date.now();
      radioDebug.lastPlayAt = Date.now();
      radioDebug.ctxState = "media";
      return;
    }
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

// ---- Piper neural voice (free models from huggingface.co/rhasspy/piper-voices) ----
// Runs inside a Web Worker: multi-second WASM inference must never block the
// game loop.
let piperWorker: Worker | null = null;
let piperState: "idle" | "loading" | "ready" | "failed" = "idle";
let sayId = 0;
const sayWaiters = new Map<number, (wav: Blob | null) => void>();
let requestedVoiceId: string | null = null;
let predictFails = 0;
// `workerEverSpoke` tightens the mic watchdog once the worker is warm (a cold
// start can take ~15s; a warm sentence is a couple seconds).
let workerEverSpoke = false;
let lastWorkerReplyAt = 0; // when the worker last produced a real clip
// bounded respawns: a worker that worked and then crashes/hangs (the "talks at
// first, then goes silent" bug) gets restarted — but cap it so a genuinely
// broken engine can't respawn forever.
let workerRespawns = 0;

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
let warmAttempts = 0;
let piperLoadStartedAt = 0;
const PIPER_FALLBACK_DELAY_MS = 12000;

function piperReadyForLanguage(language: AppLanguage): boolean {
  const voiceId = getPiperVoiceId(language);
  return !!voiceId && piperState === "ready" && requestedVoiceId === voiceId;
}

function ensureVoiceForCurrentLanguage(): AppLanguage {
  const language = currentLanguage();
  const voiceId = getPiperVoiceId(language);
  if (!voiceId) return language;
  if (requestedVoiceId !== voiceId || piperState === "idle" || piperState === "failed") {
    if (piperState === "failed") warmAttempts = 0;
    warmupPiper(language);
  }
  return language;
}

function scheduleWarmupRetry(why: string): void {
  if (!requestedVoiceId) return;
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
    if (purge && requestedVoiceId) void removeVoice(requestedVoiceId).catch(() => {}).finally(restart);
    else restart();
  }, delay);
}

function warmupPiper(language: AppLanguage = currentLanguage()): void {
  const voiceId = getPiperVoiceId(language);
  if (!voiceId) {
    requestedVoiceId = null;
    return;
  }
  if (requestedVoiceId !== voiceId) {
    try {
      piperWorker?.terminate();
    } catch {
      /* already gone */
    }
    piperWorker = null;
    piperState = "idle";
    workerEverSpoke = false;
    lastWorkerReplyAt = 0;
    predictFails = 0;
  }
  requestedVoiceId = voiceId;
  if (piperState === "failed") {
    try {
      piperWorker?.terminate();
    } catch {
      /* already gone */
    }
    piperWorker = null;
    piperState = "idle";
  }
  if (piperState !== "idle") return;
  piperState = "loading";
  piperLoadStartedAt = Date.now();
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
      console.info(`[radio] piper voice on air (${voiceId})`);
      (globalThis as Record<string, unknown>).__radioEngine = `piper-${voiceId}`;
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
  piperWorker.postMessage({
    type: "init",
    voiceId,
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
  const language = currentLanguage();
  enabled = true; // a new match always re-enables the radio (R may have cut it)
  stopCurrent(); // frees currentSource + playerBusy
  playerBusy = false;
  playerBusyAt = 0;
  queuedFlow = null;
  pendingText = null;
  predictFails = 0;
  playerGen++; // orphan any in-flight clip that resolves late
  resumeRadio();
  const voiceId = getPiperVoiceId(language);
  if (voiceId && (requestedVoiceId !== voiceId || piperState === "idle" || piperState === "failed")) {
    warmAttempts = 0;
    workerRespawns = 0;
    warmupPiper(language); // engine died/never started — bring it back for this match
  }
  dispatchRadioState();
}

/** Is the commentator free to take a play-by-play line right now? */
export function radioIdle(): boolean {
  if (!enabled) return false;
  const language = ensureVoiceForCurrentLanguage();
  return (piperReadyForLanguage(language) || speechFallbackAvailable()) && !playerBusy;
}

/** Continuous play-by-play line. If the mic is busy, the line is synthesized
 *  right away (the worker is free while audio plays) and chained next. */
export function radioFlow(text: string): void {
  if (!enabled) return;
  const language = ensureVoiceForCurrentLanguage();
  const usingPiper = !!getPiperVoiceId(language);
  if (!piperReadyForLanguage(language)) {
    if (
      speechFallbackAvailable() &&
      !playerBusy &&
      (!usingPiper || piperState === "failed" || Date.now() - piperLoadStartedAt > PIPER_FALLBACK_DELAY_MS)
    ) {
      say(text, 1);
    }
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
    say(getRadioPack(ensureVoiceForCurrentLanguage()).rejoin, 2);
  }
  dispatchRadioState();
  return enabled;
}

function say(text: string, priority = 1, fx?: VoiceFx): void {
  if (!enabled) return;
  const language = ensureVoiceForCurrentLanguage();
  const usingPiper = !!getPiperVoiceId(language);
  radioDebug.lastSay = text.slice(0, 60);
  radioDebug.lastSayAt = Date.now();

  if (piperReadyForLanguage(language)) {
    void sayPiper(text, priority, fx);
    return;
  }
  if (
    speechFallbackAvailable() &&
    (!usingPiper || piperState === "failed" || Date.now() - piperLoadStartedAt > PIPER_FALLBACK_DELAY_MS)
  ) {
    const gen = takeMic(priority);
    if (gen !== null) playSpeechFallback(text, gen, language, fx);
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

export const teamName = (id: number, language: AppLanguage = currentLanguage()): string =>
  getTeamDisplayName(language, getConfiguredMatchTeam(id as 0 | 1).id);

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
  const language = ensureVoiceForCurrentLanguage();
  const copy = getRadioPack(language);
  const team = info.team !== undefined ? teamName(info.team, language) : "";
  const score = info.score;
  const player = info.player ?? "";
  const target = info.target ?? "";
  switch (event) {
    case "opening":
      if (Date.now() - lastOpeningAt < 4500) break;
      lastOpeningAt = Date.now();
      say(copy.opening, 2);
      break;
    case "kickoff":
      if (team) say(copy.kickoff(team));
      break;
    case "goal":
      if (language === "fr") void playGoalClip();
      else say(getGoalCall(language, team || undefined), 3, SHOUT);
      break;
    case "foul":
      say(copy.foul(team || undefined), 2);
      break;
    case "yellow":
      say(copy.yellow(player || undefined), 2);
      break;
    case "red":
      say(copy.red(player || undefined), 2);
      break;
    case "penalty":
      say(copy.penalty(team || undefined), 2, SHOUT);
      break;
    case "offside":
      say(copy.offside, 2);
      break;
    case "corner":
      if (team) say(copy.corner(team));
      break;
    case "goalkick":
      if (Math.random() < 0.4) say(copy.goalkick);
      break;
    case "throwin":
      if (team && Math.random() < 0.25) say(copy.throwin(team));
      break;
    case "pass":
      if (player && target && radioIdle()) say(copy.pass(player, target));
      break;
    case "shot":
      say(copy.shot(player || undefined), 2, EXCITED);
      break;
    case "miss":
      say(copy.miss, 2, SHOUT);
      break;
    case "save":
      say(copy.save, 2, SHOUT);
      break;
    case "halftime":
      say(copy.halftime(score), 2);
      break;
    case "extratime":
      say(copy.extratime, 2);
      break;
    case "fulltime":
      say(copy.fulltime(score), 2);
      break;
    case "shootout":
      say(copy.shootout, 2);
      break;
    case "penTaker":
      if (player) say(copy.penTaker(player), 2);
      break;
    case "penGoal":
      say(copy.penGoal, 2, SHOUT);
      break;
    case "penMiss":
      say(copy.penMiss, 2, SHOUT);
      break;
  }
}

/** Occasional score reminder between actions. */
export function radioScore(score: [number, number], gameMinute: number): void {
  const language = ensureVoiceForCurrentLanguage();
  const copy = getRadioPack(language);
  const minute = Math.max(1, Math.floor(gameMinute));
  say(copy.scoreReminder(score, minute, teamName(0, language), teamName(1, language)));
}
