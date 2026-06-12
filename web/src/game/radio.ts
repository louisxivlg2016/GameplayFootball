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
// WebAudio playback: an HTMLAudioElement caps at volume 1.0 — the commentator
// needs to be LOUD, so we run through a gain (x3) into a compressor.
let radioCtx: AudioContext | null = null;
let radioOut: GainNode | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let playerBusy = false;
let playerGen = 0;

function ensureRadioCtx(): AudioContext {
  if (!radioCtx) {
    radioCtx = new AudioContext();
    const comp = radioCtx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 18;
    comp.ratio.value = 10;
    comp.attack.value = 0.002;
    comp.release.value = 0.18;
    comp.connect(radioCtx.destination);
    radioOut = radioCtx.createGain();
    radioOut.gain.value = 1;
    radioOut.connect(comp);
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
  currentSource = null;
  playerBusy = false;
}
// the latest urgent line called while a model is still loading — spoken the
// moment the voice is ready, so the radio joins with the good voice, not eSpeak
let pendingText: string | null = null;

// next play-by-play line, pre-synthesized while the current one plays so the
// commentary chains without dead air
let queuedFlow: { blob: Blob; at: number } | null = null;

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
  } catch {
    if (gen === playerGen) playerBusy = false;
  }
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
    stopCurrent();
    queuedFlow = null; // a shout supersedes any pre-baked chatter
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

let predictFails = 0;

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
      } else if (++predictFails >= 3) {
        // worker likely died (e.g. server bounce mid-fetch): respawn it
        predictFails = 0;
        console.info("[radio] worker unresponsive — restarting voice engine");
        try {
          piperWorker?.terminate();
        } catch {
          /* already gone */
        }
        piperWorker = null;
        piperState = "idle";
        warmupPiper();
      }
      resolve(wav);
    };
    sayWaiters.set(id, finish);
    // a dead worker must never lock the mic forever
    setTimeout(() => finish(null), 12000);
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
    stopCurrent();
    playerGen++;
    pendingText = null;
    queuedFlow = null;
  } else {
    say("La radio du match est de retour à l'antenne !", 2);
  }
  return enabled;
}

function say(text: string, priority = 1, fx?: VoiceFx): void {
  if (!enabled) return;

  if (piperState === "ready") {
    void sayPiper(text, priority, fx);
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
              `BUUUUUUUT ! QUEL BUT DE ${player} POUR ${team} !`,
              `AU FOND DES FILETS ! ${player} ! LE STADE EXPLOSE !`,
              `C'EST DEDANS ! ÉNORME, ${player} ! INCROYABLE !`,
            ])
          : pick([
              `BUUUUUUUT ! QUEL BUT POUR ${team} !`,
              `AU FOND DES FILETS ! ${team} FONT TREMBLER LE STADE !`,
            ])) + (score ? ` ${score[0]} à ${score[1]} !` : ""),
        2,
        SHOUT,
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
      // the rising moment: interrupt the chatter, voice climbs
      say(
        player
          ? pick([`LA FRAPPE DE ${player} !`, `${player} ARME... ÇA PART !`, `ATTENTION, ${player} TENTE SA CHANCE !`])
          : pick(["LA FRAPPE !", "ÇA PART AU BUT !"]),
        2,
        EXCITED,
      );
      break;
    case "miss":
      say(
        pick([
          "OH ! À CÔTÉ ! IL S'EN FAUT DE RIEN !",
          "AU-DESSUS ! ON A CRU AU BUT !",
          "OH LÀ LÀ, ÇA PASSE TOUT PRÈS DU POTEAU !",
        ]),
        2,
        SHOUT,
      );
      break;
    case "save":
      say(
        pick([
          "QUEL ARRÊT DU GARDIEN ! INCROYABLE !",
          "LE PORTIER DIT NON ! QUELLE PARADE !",
          "ARRÊT ÉNORME ! ON A CRU AU BUT !",
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
      say(pick(["TRANSFORMÉ ! C'EST AU FOND !", "LE TIR AU BUT EST AU FOND ! QUELLE PRESSION !"]), 2, SHOUT);
      break;
    case "penMiss":
      say(
        pick(["RATÉ ! IL PASSE À CÔTÉ !", "ARRÊTÉ ! LE GARDIEN S'ENVOLE !"]),
        2,
        SHOUT,
      );
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
