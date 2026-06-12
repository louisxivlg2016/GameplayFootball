/**
 * Radio commentary: a French play-by-play voice, best engine available:
 * 1. Kokoro-82M (near-human neural TTS, run in-browser via transformers.js;
 *    kokoro-js only phonemizes English, so we phonemize French ourselves with
 *    espeak-ng WASM and call the model with the ff_siwis French voice),
 * 2. Piper neural TTS (fr_FR-tom-medium) if Kokoro fails,
 * 3. the platform's speechSynthesis voices,
 * 4. a bundled eSpeak port (mespeak) as the instant always-works fallback.
 * Urgent events (goals, cards) interrupt; chatter only plays when the
 * commentator is quiet. Toggle with R.
 */
import { remove as removeVoice } from "@mintplex-labs/piper-tts-web";
import meSpeak from "mespeak";
import meSpeakConfig from "mespeak/src/mespeak_config.json";
import frVoice from "mespeak/voices/fr.json";

let enabled = true;
let voice: SpeechSynthesisVoice | null = null;

const hasTTS = typeof window !== "undefined" && "speechSynthesis" in window;

function pickVoice(): void {
  if (!hasTTS) return;
  const voices = window.speechSynthesis.getVoices();
  voice =
    voices.find((v) => v.lang.toLowerCase().startsWith("fr")) ?? voices[0] ?? null;
}
if (hasTTS) {
  pickVoice();
  window.speechSynthesis.onvoiceschanged = pickVoice;
}

let fallbackReady = false;
let fallbackBusyUntil = 0;

function ensureFallback(): void {
  if (fallbackReady) return;
  meSpeak.loadConfig(meSpeakConfig as object);
  meSpeak.loadVoice(frVoice as object);
  fallbackReady = true;
}

// ---- shared player for the neural engines ----
let playerAudio: HTMLAudioElement | null = null;
let playerBusy = false;
let playerGen = 0;
// the latest urgent line called while a model is still loading — spoken the
// moment the voice is ready, so the radio joins with the good voice, not eSpeak
let pendingText: string | null = null;

function playBlob(wav: Blob, gen: number): void {
  if (gen !== playerGen || !enabled) {
    playerBusy = false;
    return;
  }
  const url = URL.createObjectURL(wav);
  playerAudio?.pause();
  const audio = new Audio(url);
  playerAudio = audio;
  const done = (): void => {
    if (playerAudio === audio) playerBusy = false;
    URL.revokeObjectURL(url);
  };
  audio.onended = done;
  audio.onerror = done;
  void audio.play().catch(done);
}

function takeMic(priority: number): number | null {
  if (priority >= 2) {
    playerAudio?.pause();
    playerBusy = false;
  } else if (playerBusy) {
    return null;
  }
  playerBusy = true;
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

function warmupPiper(): void {
  if (piperState !== "idle") return;
  piperState = "loading";
  try {
    piperWorker = new Worker(new URL("./ttsWorker.ts", import.meta.url), {
      type: "module",
    });
  } catch (err) {
    console.info("[radio] worker failed:", err);
    piperState = "failed";
    (globalThis as Record<string, unknown>).__radioEngine = "espeak";
    return;
  }
  piperWorker.onmessage = (e: MessageEvent) => {
    const msg = e.data as
      | { type: "ready" }
      | { type: "error"; error: string }
      | { type: "wav"; id: number; buf: ArrayBuffer }
      | { type: "sayError"; id: number };
    if (msg.type === "ready") {
      piperState = "ready";
      console.info("[radio] piper french voice on air (worker)");
      (globalThis as Record<string, unknown>).__radioEngine = "piper-fr";
      void removeVoice("fr_FR-gilles-low").catch(() => {});
      void removeVoice("fr_FR-siwis-medium").catch(() => {});
      speakPending();
    } else if (msg.type === "error") {
      console.info("[radio] piper failed:", msg.error);
      piperState = "failed"; // offline or unsupported: mespeak takes the mic
      (globalThis as Record<string, unknown>).__radioEngine = "espeak";
      speakPending();
    } else if (msg.type === "wav") {
      sayWaiters.get(msg.id)?.(new Blob([msg.buf], { type: "audio/wav" }));
      sayWaiters.delete(msg.id);
    } else if (msg.type === "sayError") {
      sayWaiters.get(msg.id)?.(null);
      sayWaiters.delete(msg.id);
    }
  };
  // tom-medium: clean male French Piper voice (22kHz). WASM runtimes are
  // served locally by serve.ts — third-party CDNs are blocked on some networks
  piperWorker.postMessage({
    type: "init",
    voiceId: "fr_FR-tom-medium",
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

function piperPredict(text: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!piperWorker) {
      resolve(null);
      return;
    }
    const id = ++sayId;
    sayWaiters.set(id, resolve);
    piperWorker.postMessage({ type: "say", id, text });
  });
}

async function sayPiper(text: string, priority: number): Promise<void> {
  const gen = takeMic(priority);
  if (gen === null) return;
  const wav = await piperPredict(text);
  if (!wav) {
    playerBusy = false;
    return;
  }
  playBlob(wav, gen);
}

export function radioEnabled(): boolean {
  return enabled;
}

/** Is the commentator free to take a play-by-play line right now? */
export function radioIdle(): boolean {
  if (!enabled) return false;
  if (piperState === "ready") return !playerBusy;
  if (hasTTS && window.speechSynthesis.getVoices().length > 0) {
    const synth = window.speechSynthesis;
    return !synth.speaking && !synth.pending;
  }
  if (fallbackReady) return Date.now() >= fallbackBusyUntil;
  return false; // engine still loading
}

/** Continuous play-by-play line — spoken only when the mic is free. */
export function radioFlow(text: string): void {
  if (!radioIdle()) return;
  const g = globalThis as Record<string, unknown>;
  g.__radioLines = ((g.__radioLines as number) ?? 0) + 1;
  say(text, 1);
}

export function toggleRadio(): boolean {
  enabled = !enabled;
  if (!enabled) {
    if (hasTTS) window.speechSynthesis.cancel();
    if (fallbackReady) meSpeak.stop();
    playerAudio?.pause();
    playerBusy = false;
    playerGen++;
    pendingText = null;
  } else {
    say("La radio du match est de retour à l'antenne !", 2);
  }
  return enabled;
}

function say(text: string, priority = 1): void {
  if (!enabled) return;

  // best neural engine first
  if (piperState === "ready") {
    void sayPiper(text, priority);
    return;
  }
  // still loading: hold the latest urgent line for the good voice instead of
  // letting a robot speak the opening minutes; chatter is simply dropped
  if (piperState === "loading") {
    if (priority >= 2) pendingText = text;
    return;
  }

  // platform voices (often robotic on Linux, decent elsewhere)
  const nativeVoices = hasTTS && window.speechSynthesis.getVoices().length > 0;
  if (nativeVoices) {
    const synth = window.speechSynthesis;
    if (priority >= 2) synth.cancel();
    else if (synth.speaking || synth.pending) return; // don't pile up chatter
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? "fr-FR";
    u.rate = 1.1 + Math.random() * 0.1;
    u.pitch = 0.95 + Math.random() * 0.1;
    u.volume = 1;
    // Chrome can swallow a speak() issued in the same tick as cancel()
    setTimeout(() => synth.speak(u), priority >= 2 ? 60 : 0);
    return;
  }

  // bundled eSpeak fallback (instant, robotic) — only when everything failed
  ensureFallback();
  const now = Date.now();
  if (priority >= 2) meSpeak.stop();
  else if (now < fallbackBusyUntil) return;
  fallbackBusyUntil = now + 500 + text.length * 70; // rough utterance length
  meSpeak.speak(text, {
    speed: 165,
    pitch: 55 + Math.floor(Math.random() * 10),
    amplitude: 100,
    variant: "m3",
  });
}

const pick = (lines: string[]): string =>
  lines[Math.floor(Math.random() * lines.length)]!;

export const teamName = (id: number): string =>
  id === 0 ? "les Rouges" : "les Bleus";

export type RadioEvent =
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
  | "save"
  | "halftime"
  | "extratime"
  | "fulltime"
  | "shootout"
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
    case "kickoff":
      say(
        pick([
          `Et c'est parti, coup d'envoi pour ${team} !`,
          `Le ballon roule, ${team} engagent !`,
        ]),
      );
      break;
    case "goal":
      say(
        (player
          ? pick([
              `Buuuut ! Quel but de ${player} pour ${team} !`,
              `Au fond des filets ! ${player} fait trembler le stade !`,
              `C'est dedans ! Magnifique réalisation de ${player} !`,
            ])
          : pick([
              `Buuuut ! Quel but pour ${team} !`,
              `Au fond des filets ! ${team} font trembler le stade !`,
            ])) + (score ? ` ${score[0]} à ${score[1]} !` : ""),
        2,
      );
      break;
    case "foul":
      say(pick(["Faute sifflée !", "L'arbitre arrête le jeu, faute !", "Oh la semelle ! Coup franc."]), 2);
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
      say(pick(["Penalty ! C'est penalty !", "L'arbitre désigne le point de penalty !"]), 2);
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
      if (Math.random() < 0.5)
        say(pick(["La frappe !", "Il tente sa chance !", "Ça part au but !"]));
      break;
    case "save":
      say(pick(["Quel arrêt du gardien !", "Le portier dit non !", "Parade superbe !"]), 2);
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
    case "penGoal":
      say(pick(["Transformé !", "Le tir au but est au fond !"]), 2);
      break;
    case "penMiss":
      say(pick(["Raté ! Il passe à côté !", "Arrêté ! Le gardien s'envole !"]), 2);
      break;
  }
}

/** Occasional score reminder between actions. */
export function radioScore(score: [number, number], gameMinute: number): void {
  const lead =
    score[0] === score[1]
      ? `toujours ${score[0]} partout`
      : score[0] > score[1]
        ? `${teamName(0)} mènent ${score[0]} à ${score[1]}`
        : `${teamName(1)} mènent ${score[1]} à ${score[0]}`;
  say(`${Math.floor(gameMinute)}e minute de jeu, ${lead}.`);
}
