/**
 * Radio commentary: a French play-by-play voice. Piper neural TTS
 * (fr_FR-tom-medium) synthesized in a Web Worker, WASM runtimes self-hosted
 * by serve.ts. There is deliberately NO robotic fallback: if the neural voice
 * cannot load, the radio stays silent (see console [radio] lines for why).
 * Urgent events (goals, cards) interrupt; chatter only plays when the
 * commentator is quiet. Toggle with R.
 */
import { remove as removeVoice } from "@mintplex-labs/piper-tts-web";

let enabled = true;

// ---- shared player for the neural engine ----
let playerAudio: HTMLAudioElement | null = null;
let playerBusy = false;
let playerGen = 0;
// the latest urgent line called while a model is still loading — spoken the
// moment the voice is ready, so the radio joins with the good voice, not eSpeak
let pendingText: string | null = null;

// next play-by-play line, pre-synthesized while the current one plays so the
// commentary chains without dead air
let queuedFlow: { blob: Blob; at: number } | null = null;

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
    playQueuedFlow();
  };
  audio.onended = done;
  audio.onerror = done;
  void audio.play().catch(done);
}

function playQueuedFlow(): void {
  if (!queuedFlow || playerBusy || !enabled) return;
  const fresh = Date.now() - queuedFlow.at < 8000; // stale lines are dropped
  const blob = queuedFlow.blob;
  queuedFlow = null;
  if (!fresh) return;
  const gen = takeMic(1);
  if (gen !== null) playBlob(blob, gen);
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
    // pre-bundled by serve.ts — the dev HTML bundler can't bundle worker URLs
    piperWorker = new Worker("/tts/worker.js", { type: "module" });
  } catch (err) {
    console.info("[radio] worker failed:", err);
    piperState = "failed";
    (globalThis as Record<string, unknown>).__radioEngine = "none";
    return;
  }
  piperWorker.onerror = (e) => {
    console.info("[radio] worker error:", e.message ?? e);
    piperState = "failed";
    (globalThis as Record<string, unknown>).__radioEngine = "none";
  };
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
      piperState = "failed"; // offline or unsupported: the radio stays silent
      (globalThis as Record<string, unknown>).__radioEngine = "none";
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
  return piperState === "ready" && !playerBusy;
}

/** Continuous play-by-play line. If the mic is busy, the line is synthesized
 *  right away (the worker is free while audio plays) and chained next. */
export function radioFlow(text: string): void {
  if (!enabled || piperState !== "ready") return;
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
    playerAudio?.pause();
    playerBusy = false;
    playerGen++;
    pendingText = null;
    queuedFlow = null;
  } else {
    say("La radio du match est de retour à l'antenne !", 2);
  }
  return enabled;
}

function say(text: string, priority = 1): void {
  if (!enabled) return;

  if (piperState === "ready") {
    void sayPiper(text, priority);
    return;
  }
  // still loading: hold the latest urgent line for the good voice
  if (piperState === "loading" && priority >= 2) {
    pendingText = text;
  }
  // failed: stay silent — never a robotic fallback
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
