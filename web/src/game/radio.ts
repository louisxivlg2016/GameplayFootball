/**
 * Radio commentary: a French play-by-play voice, best engine available:
 * 1. the browser's own speechSynthesis voices when installed,
 * 2. Piper neural TTS (free fr_FR voice fetched from Hugging Face, cached
 *    locally, synthesized in-browser via WASM) once it has loaded,
 * 3. a bundled eSpeak port (mespeak) as the instant always-works fallback.
 * Urgent events (goals, cards) interrupt; chatter only plays when the
 * commentator is quiet. Toggle with R.
 */
import { TtsSession } from "@mintplex-labs/piper-tts-web";
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

// ---- Piper neural voice (free model from huggingface.co/rhasspy/piper-voices) ----
let piper: TtsSession | null = null;
let piperState: "idle" | "loading" | "ready" | "failed" = "idle";
let piperAudio: HTMLAudioElement | null = null;
let piperBusy = false;
let piperGen = 0;
// the latest urgent line called while the model is still loading — spoken the
// moment the voice is ready, so the radio joins with the good voice, not eSpeak
let pendingText: string | null = null;

/** Load the neural voice. Runs at page load: downloading needs no user gesture. */
export function warmupRadioVoice(): void {
  if (piperState !== "idle" || typeof window === "undefined") return;
  piperState = "loading";
  TtsSession.create({ voiceId: "fr_FR-gilles-low" })
    .then((session) => {
      piper = session;
      piperState = "ready";
      if (pendingText && enabled) {
        const text = pendingText;
        pendingText = null;
        void sayPiper(text, 2);
      }
    })
    .catch(() => {
      piperState = "failed"; // offline or unsupported: mespeak takes the mic
      if (pendingText && enabled) {
        const text = pendingText;
        pendingText = null;
        say(text, 2);
      }
    });
}
if (typeof window !== "undefined") warmupRadioVoice();

async function sayPiper(text: string, priority: number): Promise<void> {
  if (!piper) return;
  if (priority >= 2) {
    piperAudio?.pause();
    piperBusy = false;
  } else if (piperBusy) {
    return;
  }
  piperBusy = true;
  const gen = ++piperGen;
  try {
    const wav = await piper.predict(text);
    if (gen !== piperGen || !enabled) {
      piperBusy = false;
      return;
    }
    const url = URL.createObjectURL(wav);
    piperAudio?.pause();
    const audio = new Audio(url);
    piperAudio = audio;
    const done = (): void => {
      if (piperAudio === audio) piperBusy = false;
      URL.revokeObjectURL(url);
    };
    audio.onended = done;
    audio.onerror = done;
    void audio.play().catch(done);
  } catch {
    piperBusy = false;
    piperState = "failed";
  }
}

export function radioEnabled(): boolean {
  return enabled;
}

export function toggleRadio(): boolean {
  enabled = !enabled;
  if (!enabled) {
    if (hasTTS) window.speechSynthesis.cancel();
    if (fallbackReady) meSpeak.stop();
    piperAudio?.pause();
    piperBusy = false;
    piperGen++;
    pendingText = null;
  } else {
    say("La radio du match est de retour à l'antenne !", 2);
  }
  return enabled;
}

function say(text: string, priority = 1): void {
  if (!enabled) return;
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

  // neural Piper voice once its model has downloaded
  if (piperState === "ready") {
    void sayPiper(text, priority);
    return;
  }
  // still loading: hold the latest urgent line for the good voice instead of
  // letting the robot speak the opening minutes; chatter is simply dropped
  if (piperState === "loading") {
    if (priority >= 2) pendingText = text;
    return;
  }

  // bundled eSpeak fallback (instant, robotic) — only when Piper failed (offline)
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
  info: { team?: number; score?: [number, number]; player?: string } = {},
): void {
  const team = info.team !== undefined ? teamName(info.team) : "";
  const score = info.score;
  const player = info.player ?? "";
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
