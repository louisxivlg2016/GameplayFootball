/**
 * Radio commentary: a French play-by-play voice built on the browser's
 * speechSynthesis. Urgent events (goals, cards) interrupt; chatter only
 * plays when the commentator is quiet. Toggle with R.
 */

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

export function radioEnabled(): boolean {
  return enabled;
}

export function toggleRadio(): boolean {
  enabled = !enabled;
  if (!enabled && hasTTS) window.speechSynthesis.cancel();
  else say("La radio du match est de retour à l'antenne !", 2);
  return enabled;
}

function say(text: string, priority = 1): void {
  if (!enabled || !hasTTS) return;
  const synth = window.speechSynthesis;
  if (priority >= 2) synth.cancel();
  else if (synth.speaking || synth.pending) return; // don't pile up chatter
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? "fr-FR";
  u.rate = 1.1 + Math.random() * 0.1;
  u.pitch = 0.95 + Math.random() * 0.1;
  u.volume = 1;
  synth.speak(u);
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
  info: { team?: number; score?: [number, number] } = {},
): void {
  const team = info.team !== undefined ? teamName(info.team) : "";
  const score = info.score;
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
        pick([
          `Buuuut ! Quel but pour ${team} !`,
          `Au fond des filets ! ${team} font trembler le stade !`,
          `C'est dedans ! Magnifique réalisation de ${team} !`,
        ]) +
          (score ? ` ${score[0]} à ${score[1]} !` : ""),
        2,
      );
      break;
    case "foul":
      say(pick(["Faute sifflée !", "L'arbitre arrête le jeu, faute !", "Oh la semelle ! Coup franc."]), 2);
      break;
    case "yellow":
      say(pick(["Carton jaune, il est averti !", "Le jaune sort de la poche de l'arbitre !"]), 2);
      break;
    case "red":
      say(
        pick([
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
