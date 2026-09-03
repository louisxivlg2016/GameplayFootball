import type { AppLanguage } from "../i18n";
import { getNationalTeam, type NationalTeamId } from "./teams";

export interface RadioPack {
  rejoin: string;
  opening: string;
  kickoff: (team: string) => string;
  foul: (team?: string) => string;
  yellow: (player?: string) => string;
  red: (player?: string) => string;
  penalty: (team?: string) => string;
  offside: string;
  corner: (team: string) => string;
  goalkick: string;
  throwin: (team: string) => string;
  pass: (player: string, target: string) => string;
  shot: (player?: string) => string;
  miss: string;
  save: string;
  halftime: (score?: [number, number]) => string;
  extratime: string;
  fulltime: (score?: [number, number]) => string;
  shootout: string;
  penTaker: (player: string) => string;
  penGoal: string;
  penMiss: string;
  scoreStatus: (score: [number, number], homeTeam: string, awayTeam: string) => string;
  scoreReminder: (score: [number, number], minute: number, homeTeam: string, awayTeam: string) => string;
  loose: string;
  keeper: (name: string, team: string) => string;
  duel: (name: string, oppName: string) => string;
  run: (name: string, team: string) => string;
  danger: (name: string) => string;
  build: (name: string, team: string) => string;
  carry: (name: string, team: string) => string;
  /** alternate phrasings so the commentator never parrots himself */
  looseAlt?: string[];
  keeperAlt?: Array<(name: string, team: string) => string>;
  duelAlt?: Array<(name: string, oppName: string) => string>;
  runAlt?: Array<(name: string, team: string) => string>;
  dangerAlt?: Array<(name: string) => string>;
  buildAlt?: Array<(name: string, team: string) => string>;
  carryAlt?: Array<(name: string, team: string) => string>;
}

const SPEECH_LOCALE_BY_LANGUAGE: Record<AppLanguage, string> = {
  ro: "ro-RO",
  fr: "fr-FR",
  en: "en-US",
  es: "es-ES",
  pt: "pt-BR",
  de: "de-DE",
  nb: "nb-NO",
  it: "it-IT",
  ga: "ga-IE",
  nl: "nl-NL",
  hr: "hr-HR",
  pl: "pl-PL",
  tr: "tr-TR",
  ru: "ru-RU",
  uk: "uk-UA",
  ar: "ar-JO",
  hi: "hi-IN",
  id: "id-ID",
  vi: "vi-VN",
  th: "th-TH",
  ja: "ja-JP",
  ko: "ko-KR",
  "zh-CN": "zh-CN",
  "zh-TW": "zh-TW",
};

const PIPER_VOICE_BY_LANGUAGE: Partial<Record<AppLanguage, string>> = {
  fr: "fr_FR-tom-medium",
  en: "en_GB-northern_english_male-medium",
  es: "es_ES-davefx-medium",
  pt: "pt_BR-faber-medium",
  de: "de_DE-thorsten-high",
  nb: "no_NO-talesyntese-medium",
  it: "it_IT-paola-medium",
  nl: "nl_BE-rdh-medium",
  // Croatian has no Piper model; the Serbian voice reads Croatian Latin fine
  hr: "sr_RS-serbski_institut-medium",
  // hi/id only exist on the UPSTREAM rhasspy repo — ttsWorker rewrites the URL
  hi: "hi_IN-pratham-medium",
  id: "id_ID-news_tts-medium",
  // Thai/Korean run on the worker's MMS-VITS engine (Piper has no models)
  th: "mms-tha",
  ko: "mms-kor",
  ro: "ro_RO-mihai-medium",
  pl: "pl_PL-darkman-medium",
  tr: "tr_TR-fahrettin-medium",
  ru: "ru_RU-denis-medium",
  uk: "uk_UA-ukrainian_tts-medium",
  ar: "ar_JO-kareem-medium",
  vi: "vi_VN-vais1000-medium",
  "zh-CN": "zh_CN-huayan-medium",
  "zh-TW": "zh_CN-huayan-medium",
};

const REGION_BY_TEAM: Record<Exclude<NationalTeamId, "england">, string> = {
  france: "FR",
  argentina: "AR",
  portugal: "PT",
  norway: "NO",
};

const FALLBACK_TEAM_NAMES: Record<NationalTeamId, string> = {
  france: "France",
  england: "England",
  argentina: "Argentina",
  portugal: "Portugal",
  norway: "Norway",
};

const ENGLAND_NAMES: Record<AppLanguage, string> = {
  ro: "Anglia",
  fr: "Angleterre",
  en: "England",
  es: "Inglaterra",
  pt: "Inglaterra",
  de: "England",
  nb: "England",
  it: "Inghilterra",
  ga: "Sasana",
  nl: "Engeland",
  hr: "Engleska",
  pl: "Anglia",
  tr: "Ingiltere",
  ru: "Англия",
  uk: "Англія",
  ar: "إنجلترا",
  hi: "इंग्लैंड",
  id: "Inggris",
  vi: "Anh",
  th: "อังกฤษ",
  ja: "イングランド",
  ko: "잉글랜드",
  "zh-CN": "英格兰",
  "zh-TW": "英格蘭",
};

export function getSpeechLocale(language: AppLanguage): string {
  return SPEECH_LOCALE_BY_LANGUAGE[language];
}

export function getPiperVoiceId(language: AppLanguage): string | null {
  return PIPER_VOICE_BY_LANGUAGE[language] ?? null;
}

export function getGoalCall(language: AppLanguage, team?: string): string {
  switch (language) {
    case "fr":
      return team ? `But ! But pour ${team} !` : "But !";
    case "en":
      return team ? `Goal! Goal for ${team}!` : "Goal!";
    case "es":
      return team ? `¡Gol! ¡Gol de ${team}!` : "¡Gol!";
    case "pt":
      return team ? `Gol! Gol do ${team}!` : "Gol!";
    case "de":
      return team ? `Tor! Tor für ${team}!` : "Tor!";
    case "nb":
      return team ? `Mål! Mål for ${team}!` : "Mål!";
    case "it":
      return team ? `Gol! Gol per ${team}!` : "Gol!";
    case "ga":
      return team ? `Cúl! Cúl do ${team}!` : "Cúl!";
    case "nl":
      return team ? `Doelpunt! Doelpunt voor ${team}!` : "Doelpunt!";
    case "hr":
      return team ? `Gol! Gol za ${team}!` : "Gol!";
    case "ro":
      return team ? `Gol! Gol pentru ${team}!` : "Gol!";
    case "pl":
      return team ? `Gol! Gol dla ${team}!` : "Gol!";
    case "tr":
      return team ? `Gol! ${team} golü buldu!` : "Gol!";
    case "ru":
      return team ? `Гол! Забивает ${team}!` : "Гол!";
    case "uk":
      return team ? `Гол! Забиває ${team}!` : "Гол!";
    case "ar":
      return team ? `هدف! هدف لصالح ${team}!` : "هدف!";
    case "hi":
      return team ? `गोल! ${team} के लिए गोल!` : "गोल!";
    case "id":
      return team ? `Gol! Gol untuk ${team}!` : "Gol!";
    case "vi":
      return team ? `Vào! Bàn thắng cho ${team}!` : "Vào!";
    case "th":
      return team ? `ประตู! ${team} ได้ประตู!` : "ประตู!";
    case "ja":
      return team ? `ゴール! ${team} のゴール!` : "ゴール!";
    case "ko":
      return team ? `골! ${team}의 골입니다!` : "골!";
    case "zh-CN":
      return team ? `进球了! ${team} 进球了!` : "进球了!";
    case "zh-TW":
      return team ? `進球了! ${team} 進球了!` : "進球了!";
    default:
      return team ? `Goal! Goal for ${team}!` : "Goal!";
  }
}

export function getTeamDisplayName(language: AppLanguage, teamId: NationalTeamId): string {
  if (teamId === "england") return ENGLAND_NAMES[language];
  const regionCode = REGION_BY_TEAM[teamId];
  // club sides have no region — the commentator says the club's name as-is
  if (!regionCode) return getNationalTeam(teamId).label;
  if (typeof Intl !== "undefined" && typeof Intl.DisplayNames !== "undefined") {
    try {
      const name = new Intl.DisplayNames([getSpeechLocale(language)], {
        type: "region",
      }).of(regionCode);
      if (name) return name;
    } catch {
      /* ignore locale/displayname mismatch */
    }
  }
  return FALLBACK_TEAM_NAMES[teamId];
}

const en: RadioPack = {
  rejoin: "Match radio is back on air!",
  opening: "Welcome everyone! We are about to watch a thrilling match!",
  kickoff: (team) => `${team} get us underway!`,
  foul: (team) => (team ? `Foul. Free kick for ${team}.` : "Foul given."),
  yellow: (player) => (player ? `Yellow card for ${player}!` : "Yellow card!"),
  red: (player) => (player ? `Red card for ${player}!` : "Red card!"),
  penalty: (team) => (team ? `Penalty for ${team}!` : "Penalty!"),
  offside: "Offside is given!",
  corner: (team) => `${team} win a corner.`,
  goalkick: "Goal kick. The keeper will restart.",
  throwin: (team) => `Throw-in for ${team}.`,
  pass: (player, target) => `${player} finds ${target}.`,
  shot: (player) => (player ? `The shot from ${player}!` : "The shot!"),
  miss: "Just wide!",
  save: "What a save from the keeper!",
  halftime: (score) => (score ? `Half-time, ${score[0]}-${score[1]}.` : "Half-time."),
  extratime: "We are going to extra time!",
  fulltime: (score) =>
    score
      ? `Full-time! Final score, ${score[0]}-${score[1]}. Thanks for listening to match radio!`
      : "Full-time! Thanks for listening to match radio!",
  shootout: "It will be decided by penalties!",
  penTaker: (player) => `${player} steps up to take it.`,
  penGoal: "Scored!",
  penMiss: "Missed!",
  scoreStatus: (score, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? "Still 0-0." : `It is ${score[0]}-${score[1]} in this match.`;
    return score[0] > score[1] ? `${homeTeam} lead ${score[0]}-${score[1]}.` : `${awayTeam} lead ${score[1]}-${score[0]}.`;
  },
  scoreReminder: (score, minute, homeTeam, awayTeam) => {
    if (score[0] === score[1]) {
      return score[0] === 0 ? `After ${minute} minutes, it is still 0-0.` : `After ${minute} minutes, it is ${score[0]}-${score[1]}.`;
    }
    return score[0] > score[1]
      ? `After ${minute} minutes, ${homeTeam} lead ${score[0]}-${score[1]}.`
      : `After ${minute} minutes, ${awayTeam} lead ${score[1]}-${score[0]}.`;
  },
  loose: "Loose ball!",
  keeper: (name, team) => `${name} has it safely for ${team}.`,
  duel: (name, oppName) => `${name} is under pressure from ${oppName}.`,
  run: (name, team) => `${name} drives forward for ${team}.`,
  danger: (name) => `${name} is getting close to the box.`,
  build: (name, team) => `${team} build from the back with ${name}.`,
  carry: (name, team) => `${name} is on the ball for ${team}.`,
  looseAlt: [
    "Nobody owns this ball!",
    "The ball breaks free in midfield!",
    "Loose in the middle — anyone's ball!",
    "It's a scramble for the second ball!",
    "The ball's spilled — who wants it?",
  ],
  keeperAlt: [
    (name, team) => `${name} gathers it and looks up for ${team}.`,
    (name, team) => `Calm from ${name}, ${team} restart from the back.`,
    (name) => `${name} claims it and slows the game down.`,
    (name, team) => `Safe in the gloves of ${name}, ${team} will build again.`,
    (name) => `${name} holds it, taking the sting out of play.`,
  ],
  duelAlt: [
    (name, oppName) => `${oppName} snaps at the heels of ${name}!`,
    (name, oppName) => `Tight battle — ${name} shields it from ${oppName}.`,
    (name, oppName) => `${oppName} won't give ${name} a moment's peace!`,
    (name, oppName) => `Shoulder to shoulder, ${name} holds off ${oppName}.`,
    (name, oppName) => `${name} rides the challenge from ${oppName}!`,
  ],
  runAlt: [
    (name, team) => `${name} turns on the pace for ${team}!`,
    (name, team) => `Space opens and ${name} attacks it!`,
    (name, team) => `${name} eats up the ground for ${team}!`,
    (name) => `What a surge from ${name}!`,
    (name, team) => `${name} breaks away on the counter for ${team}!`,
  ],
  dangerAlt: [
    (name) => `${name} within shooting range now!`,
    (name) => `Careful here — ${name} edges toward the area!`,
    (name) => `This is dangerous, ${name} closing on goal!`,
    (name) => `${name} is in a shooting position!`,
    (name) => `Warning signs for the defence as ${name} arrives!`,
  ],
  buildAlt: [
    (name, team) => `${name} starts the move for ${team}.`,
    (name, team) => `Patient stuff from ${team}, ${name} on the ball deep.`,
    (name, team) => `${team} take control, ${name} dictating from deep.`,
    (name) => `${name} slows it down and lets his side breathe.`,
    (name, team) => `A patient reset from ${team} through ${name}.`,
  ],
  carryAlt: [
    (name, team) => `${name} keeps it moving for ${team}.`,
    (name, team) => `Possession for ${team} — ${name} probing.`,
    (name) => `${name} looks for an option.`,
    (name, team) => `${name} carries it forward for ${team}.`,
    (name, team) => `It all runs through ${name} for ${team}.`,
  ],
};

const fr: RadioPack = {
  rejoin: "La radio du match est de retour à l'antenne !",
  opening: "Bienvenue à toutes et à tous ! Aujourd'hui, nous allons assister à un match passionnant !",
  kickoff: (team) => `${team} donnent le coup d'envoi !`,
  foul: (team) => (team ? `Faute. Coup franc pour ${team}.` : "Faute sifflée."),
  yellow: (player) => (player ? `Carton jaune pour ${player} !` : "Carton jaune !"),
  red: (player) => (player ? `Carton rouge pour ${player} !` : "Carton rouge !"),
  penalty: (team) => (team ? `Penalty pour ${team} !` : "Penalty !"),
  offside: "Hors-jeu signalé !",
  corner: (team) => `Corner pour ${team}.`,
  goalkick: "Six mètres. Le gardien va relancer.",
  throwin: (team) => `Touche pour ${team}.`,
  pass: (player, target) => `${player} trouve ${target}.`,
  shot: (player) => (player ? `La frappe de ${player} !` : "La frappe !"),
  miss: "À côté !",
  save: "Quel arrêt du gardien !",
  halftime: (score) => (score ? `Mi-temps, ${score[0]} à ${score[1]}.` : "Mi-temps."),
  extratime: "Place à la prolongation !",
  fulltime: (score) =>
    score
      ? `C'est terminé ! Score final, ${score[0]} à ${score[1]}. Merci de nous avoir suivis à la radio du match !`
      : "C'est terminé ! Merci de nous avoir suivis à la radio du match !",
  shootout: "Tout va se jouer aux tirs au but !",
  penTaker: (player) => `${player} s'avance pour tirer.`,
  penGoal: "Transformé !",
  penMiss: "Raté !",
  scoreStatus: (score, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? "Toujours zéro à zéro." : `${score[0]} partout dans ce match.`;
    return score[0] > score[1] ? `${homeTeam} mènent ${score[0]} à ${score[1]}.` : `${awayTeam} mènent ${score[1]} à ${score[0]}.`;
  },
  scoreReminder: (score, minute, homeTeam, awayTeam) => {
    if (score[0] === score[1]) {
      return score[0] === 0
        ? `Après ${minute} minutes de jeu, toujours zéro à zéro.`
        : `Après ${minute} minutes de jeu, ${score[0]} partout.`;
    }
    return score[0] > score[1]
      ? `Après ${minute} minutes de jeu, ${homeTeam} mènent ${score[0]} à ${score[1]}.`
      : `Après ${minute} minutes de jeu, ${awayTeam} mènent ${score[1]} à ${score[0]}.`;
  },
  loose: "Ballon libre !",
  keeper: (name, team) => `${name} a le ballon pour ${team}.`,
  duel: (name, oppName) => `${name} est pressé par ${oppName}.`,
  run: (name, team) => `${name} accélère pour ${team}.`,
  danger: (name) => `${name} approche de la surface.`,
  build: (name, team) => `${team} repartent de derrière avec ${name}.`,
  carry: (name, team) => `${name} a le ballon pour ${team}.`,
  looseAlt: [
    "Personne ne contrôle ce ballon !",
    "Le ballon traîne au milieu, il est à prendre !",
    "Ballon à la lutte, tout le monde le veut !",
    "Le cuir file en zone neutre, à qui saura le saisir !",
    "Deuxième ballon à récupérer !",
  ],
  keeperAlt: [
    (name, team) => `${name} s'en saisit et relance pour ${team}.`,
    (name, team) => `Ballon capté, ${team} repartent de derrière avec ${name}.`,
    (name, team) => `${name} tient bon dans ses gants et temporise pour ${team}.`,
    (name, team) => `Le portier ${name} garde précieusement le cuir avant de relancer ${team}.`,
    (name) => `${name} calme le jeu, ballon en main.`,
  ],
  duelAlt: [
    (name, oppName) => `${oppName} vient mordre les chevilles de ${name} !`,
    (name, oppName) => `Gros duel — ${name} protège son ballon devant ${oppName}.`,
    (name, oppName) => `Ça frotte ! ${name} résiste au retour de ${oppName}.`,
    (name, oppName) => `${oppName} ne lâche pas ${name} d'une semelle !`,
    (name, oppName) => `Épaule contre épaule, ${name} tient tête à ${oppName}.`,
  ],
  runAlt: [
    (name, team) => `${name} met le turbo pour ${team} !`,
    (name, team) => `L'espace est là et ${name} s'y engouffre !`,
    (name, team) => `${name} avale les mètres pour ${team} !`,
    (name) => `Quelle chevauchée de ${name} !`,
    (name, team) => `${name} part en contre pour ${team} !`,
  ],
  dangerAlt: [
    (name) => `${name} entre dans la zone de vérité !`,
    (name) => `Attention, ${name} arrive aux abords de la surface !`,
    (name) => `Ça sent le but, ${name} se rapproche des cages !`,
    (name) => `Position de frappe pour ${name} !`,
    (name) => `${name} est en danger de mort pour la défense !`,
  ],
  buildAlt: [
    (name, team) => `${name} lance la construction pour ${team}.`,
    (name, team) => `${team} font tourner, ${name} à la baguette derrière.`,
    (name, team) => `${team} prennent le jeu à leur compte, ${name} oriente.`,
    (name) => `${name} temporise et fait respirer son équipe.`,
    (name, team) => `Relance patiente de ${team} par ${name}.`,
  ],
  carryAlt: [
    (name, team) => `${name} fait avancer le jeu pour ${team}.`,
    (name, team) => `Possession ${team}, ${name} cherche la faille.`,
    (name) => `${name} lève la tête et cherche une solution.`,
    (name, team) => `${name} conduit le ballon pour ${team}.`,
    (name, team) => `Le jeu passe par ${name} pour ${team}.`,
  ],
};

const es: RadioPack = {
  rejoin: "¡La radio del partido vuelve al aire!",
  opening: "¡Bienvenidos a todos! ¡Hoy vamos a vivir un partido apasionante!",
  kickoff: (team) => `¡${team} pone el balón en juego!`,
  foul: (team) => (team ? `Falta. Tiro libre para ${team}.` : "Falta señalada."),
  yellow: (player) => (player ? `¡Tarjeta amarilla para ${player}!` : "¡Tarjeta amarilla!"),
  red: (player) => (player ? `¡Tarjeta roja para ${player}!` : "¡Tarjeta roja!"),
  penalty: (team) => (team ? `¡Penalti para ${team}!` : "¡Penalti!"),
  offside: "¡Fuera de juego!",
  corner: (team) => `Corner para ${team}.`,
  goalkick: "Saque de puerta. Va a salir el portero.",
  throwin: (team) => `Saque de banda para ${team}.`,
  pass: (player, target) => `${player} encuentra a ${target}.`,
  shot: (player) => (player ? `¡El disparo de ${player}!` : "¡El disparo!"),
  miss: "¡Fuera por poco!",
  save: "¡Qué parada del portero!",
  halftime: (score) => (score ? `Descanso, ${score[0]}-${score[1]}.` : "Descanso."),
  extratime: "¡Nos vamos a la prórroga!",
  fulltime: (score) =>
    score
      ? `¡Final del partido! Marcador final, ${score[0]}-${score[1]}. ¡Gracias por seguir la radio del partido!`
      : "¡Final del partido! ¡Gracias por seguir la radio del partido!",
  shootout: "¡Todo se decidirá en los penaltis!",
  penTaker: (player) => `${player} se prepara para lanzar.`,
  penGoal: "¡Gol!",
  penMiss: "¡Falló!",
  scoreStatus: (score, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? "Sigue el cero a cero." : `Empate a ${score[0]}.`;
    return score[0] > score[1] ? `${homeTeam} gana ${score[0]}-${score[1]}.` : `${awayTeam} gana ${score[1]}-${score[0]}.`;
  },
  scoreReminder: (score, minute, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? `Tras ${minute} minutos, sigue el cero a cero.` : `Tras ${minute} minutos, están ${score[0]}-${score[1]}.`;
    return score[0] > score[1]
      ? `Tras ${minute} minutos, ${homeTeam} gana ${score[0]}-${score[1]}.`
      : `Tras ${minute} minutos, ${awayTeam} gana ${score[1]}-${score[0]}.`;
  },
  loose: "¡Balón suelto!",
  keeper: (name, team) => `${name} tiene el balón para ${team}.`,
  duel: (name, oppName) => `${name} está presionado por ${oppName}.`,
  run: (name, team) => `${name} acelera para ${team}.`,
  danger: (name) => `${name} se acerca al área.`,
  build: (name, team) => `${team} sale jugando con ${name}.`,
  carry: (name, team) => `${name} conduce para ${team}.`,  looseAlt: ["¡Nadie controla ese balón!", "¡Balón dividido en el mediocampo!"],
  keeperAlt: [(name, team) => `${name} la atrapa y saca para ${team}.`, (name, team) => `Con calma, ${team} salen desde atrás con ${name}.`],
  duelAlt: [(name, oppName) => `¡${oppName} muerde los tobillos de ${name}!`, (name, oppName) => `Duelo intenso: ${name} protege el balón ante ${oppName}.`],
  runAlt: [(name, team) => `¡${name} pisa el acelerador para ${team}!`, (name, team) => `¡Se abre el espacio y ${name} lo ataca!`],
  dangerAlt: [(name) => `¡${name} ya está en zona de disparo!`, (name) => `¡Cuidado, ${name} se acerca al área!`],
  buildAlt: [(name, team) => `${name} inicia la jugada para ${team}.`, (name, team) => `${team} tocan con paciencia, ${name} desde atrás.`],
  carryAlt: [(name, team) => `${name} mueve el balón para ${team}.`, (name, team) => `Posesión de ${team}, ${name} busca el hueco.`, (name, team) => `${name} levanta la cabeza y busca opción.`, (name, team) => `${name} conduce para ${team}.`, (name) => `El juego pasa por ${name}.`],
};

const pt: RadioPack = {
  rejoin: "A radio do jogo está de volta ao ar!",
  opening: "Bem-vindos a todos! Hoje vamos acompanhar uma partida emocionante!",
  kickoff: (team) => `${team} dão a saída!`,
  foul: (team) => (team ? `Falta. Bola parada para ${team}.` : "Falta marcada."),
  yellow: (player) => (player ? `Cartão amarelo para ${player}!` : "Cartão amarelo!"),
  red: (player) => (player ? `Cartão vermelho para ${player}!` : "Cartão vermelho!"),
  penalty: (team) => (team ? `Pênalti para ${team}!` : "Pênalti!"),
  offside: "Impedimento marcado!",
  corner: (team) => `Escanteio para ${team}.`,
  goalkick: "Tiro de meta. O goleiro vai repor.",
  throwin: (team) => `Lateral para ${team}.`,
  pass: (player, target) => `${player} acha ${target}.`,
  shot: (player) => (player ? `O chute de ${player}!` : "O chute!"),
  miss: "Foi para fora!",
  save: "Que defesa do goleiro!",
  halftime: (score) => (score ? `Intervalo, ${score[0]}-${score[1]}.` : "Intervalo."),
  extratime: "Vamos para a prorrogação!",
  fulltime: (score) =>
    score
      ? `Fim de jogo! Placar final, ${score[0]}-${score[1]}. Obrigado por acompanhar a radio do jogo!`
      : "Fim de jogo! Obrigado por acompanhar a radio do jogo!",
  shootout: "Tudo será decidido nos pênaltis!",
  penTaker: (player) => `${player} vai para a cobrança.`,
  penGoal: "Converteu!",
  penMiss: "Perdeu!",
  scoreStatus: (score, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? "Segue zero a zero." : `${score[0]} a ${score[0]} na partida.`;
    return score[0] > score[1] ? `${homeTeam} vencem por ${score[0]} a ${score[1]}.` : `${awayTeam} vencem por ${score[1]} a ${score[0]}.`;
  },
  scoreReminder: (score, minute, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? `Depois de ${minute} minutos, segue zero a zero.` : `Depois de ${minute} minutos, está ${score[0]} a ${score[1]}.`;
    return score[0] > score[1]
      ? `Depois de ${minute} minutos, ${homeTeam} vencem por ${score[0]} a ${score[1]}.`
      : `Depois de ${minute} minutos, ${awayTeam} vencem por ${score[1]} a ${score[0]}.`;
  },
  loose: "Bola solta!",
  keeper: (name, team) => `${name} segura a bola para ${team}.`,
  duel: (name, oppName) => `${name} está pressionado por ${oppName}.`,
  run: (name, team) => `${name} acelera para ${team}.`,
  danger: (name) => `${name} chega perto da área.`,
  build: (name, team) => `${team} começam de trás com ${name}.`,
  carry: (name, team) => `${name} conduz a bola para ${team}.`,  looseAlt: ["Ninguém domina essa bola!", "Bola solta no meio-campo!"],
  keeperAlt: [(name, team) => `${name} agarra e repõe para o ${team}.`, (name, team) => `Com calma, o ${team} sai jogando com ${name}.`],
  duelAlt: [(name, oppName) => `${oppName} cola na marcação de ${name}!`, (name, oppName) => `Duelo duro: ${name} protege a bola de ${oppName}.`],
  runAlt: [(name, team) => `${name} acelera pelo ${team}!`, (name, team) => `Abriu espaço e ${name} ataca!`],
  dangerAlt: [(name) => `${name} chega na zona de perigo!`, (name) => `Atenção: ${name} se aproxima da área!`],
  buildAlt: [(name, team) => `${name} arma a jogada para o ${team}.`, (name, team) => `O ${team} troca passes, ${name} organiza atrás.`],
  carryAlt: [(name, team) => `${name} conduz para o ${team}.`, (name, team) => `Posse do ${team}, ${name} procura o espaço.`, (name, team) => `${name} levanta a cabeça procurando opção.`, (name, team) => `${name} avança com a bola para o ${team}.`, (name) => `O jogo passa pelos pés de ${name}.`],
};

const de: RadioPack = {
  rejoin: "Das Spielradio ist wieder auf Sendung!",
  opening: "Willkommen an alle! Heute erwartet uns ein packendes Spiel!",
  kickoff: (team) => `${team} stoßen an!`,
  foul: (team) => (team ? `Foul. Freistoß für ${team}.` : "Foul gepfiffen."),
  yellow: (player) => (player ? `Gelbe Karte für ${player}!` : "Gelbe Karte!"),
  red: (player) => (player ? `Rote Karte für ${player}!` : "Rote Karte!"),
  penalty: (team) => (team ? `Elfmeter für ${team}!` : "Elfmeter!"),
  offside: "Abseits!",
  corner: (team) => `Ecke für ${team}.`,
  goalkick: "Abstoß. Der Torwart eröffnet neu.",
  throwin: (team) => `Einwurf für ${team}.`,
  pass: (player, target) => `${player} findet ${target}.`,
  shot: (player) => (player ? `Der Schuss von ${player}!` : "Der Schuss!"),
  miss: "Knapp vorbei!",
  save: "Was für eine Parade vom Torwart!",
  halftime: (score) => (score ? `Halbzeit, ${score[0]} zu ${score[1]}.` : "Halbzeit."),
  extratime: "Wir gehen in die Verlängerung!",
  fulltime: (score) =>
    score
      ? `Schluss! Endstand ${score[0]} zu ${score[1]}. Danke fürs Zuhören beim Spielradio!`
      : "Schluss! Danke fürs Zuhören beim Spielradio!",
  shootout: "Alles wird im Elfmeterschießen entschieden!",
  penTaker: (player) => `${player} läuft an.`,
  penGoal: "Verwandelt!",
  penMiss: "Verschossen!",
  scoreStatus: (score, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? "Weiterhin 0 zu 0." : `${score[0]} zu ${score[1]} in diesem Spiel.`;
    return score[0] > score[1] ? `${homeTeam} führen mit ${score[0]} zu ${score[1]}.` : `${awayTeam} führen mit ${score[1]} zu ${score[0]}.`;
  },
  scoreReminder: (score, minute, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? `Nach ${minute} Minuten steht es weiter 0 zu 0.` : `Nach ${minute} Minuten steht es ${score[0]} zu ${score[1]}.`;
    return score[0] > score[1]
      ? `Nach ${minute} Minuten führt ${homeTeam} mit ${score[0]} zu ${score[1]}.`
      : `Nach ${minute} Minuten führt ${awayTeam} mit ${score[1]} zu ${score[0]}.`;
  },
  loose: "Der Ball ist frei!",
  keeper: (name, team) => `${name} hat den Ball für ${team}.`,
  duel: (name, oppName) => `${name} wird von ${oppName} attackiert.`,
  run: (name, team) => `${name} zieht für ${team} an.`,
  danger: (name) => `${name} nähert sich dem Strafraum.`,
  build: (name, team) => `${team} bauen hinten mit ${name} auf.`,
  carry: (name, team) => `${name} am Ball für ${team}.`,  looseAlt: ["Niemand hat diesen Ball unter Kontrolle!", "Der Ball ist frei im Mittelfeld!"],
  keeperAlt: [(name, team) => `${name} hat ihn sicher und macht das Spiel für ${team} auf.`, (name, team) => `Ganz ruhig: ${team} bauen hinten mit ${name} auf.`],
  duelAlt: [(name, oppName) => `${oppName} klebt an ${name} dran!`, (name, oppName) => `Harter Zweikampf — ${name} schirmt den Ball vor ${oppName} ab.`],
  runAlt: [(name, team) => `${name} zieht das Tempo an für ${team}!`, (name, team) => `Da ist Platz — und ${name} stößt hinein!`],
  dangerAlt: [(name) => `${name} kommt in Schussposition!`, (name) => `Vorsicht, ${name} nähert sich dem Strafraum!`],
  buildAlt: [(name, team) => `${name} leitet den Angriff für ${team} ein.`, (name, team) => `${team} lassen den Ball laufen, ${name} dirigiert hinten.`],
  carryAlt: [(name, team) => `${name} treibt den Ball für ${team} nach vorn.`, (name, team) => `Ballbesitz ${team} — ${name} sucht die Lücke.`, (name, team) => `${name} hebt den Kopf und sucht die Anspielstation.`, (name, team) => `${name} kurbelt das Spiel für ${team} an.`, (name) => `Alles läuft über ${name}.`],
};

const nb: RadioPack = {
  rejoin: "Kampradioen er tilbake på lufta!",
  opening: "Velkommen alle sammen! I dag får vi en spennende kamp!",
  kickoff: (team) => `${team} sparker i gang kampen!`,
  foul: (team) => (team ? `Frispark til ${team}.` : "Frispark dømt."),
  yellow: (player) => (player ? `Gult kort til ${player}!` : "Gult kort!"),
  red: (player) => (player ? `Rødt kort til ${player}!` : "Rødt kort!"),
  penalty: (team) => (team ? `Straffe til ${team}!` : "Straffe!"),
  offside: "Offside!",
  corner: (team) => `Corner til ${team}.`,
  goalkick: "Målspark. Keeperen skal sette i gang.",
  throwin: (team) => `Innkast til ${team}.`,
  pass: (player, target) => `${player} finner ${target}.`,
  shot: (player) => (player ? `Skuddet fra ${player}!` : "Skuddet!"),
  miss: "Like utenfor!",
  save: "For en redning av keeperen!",
  halftime: (score) => (score ? `Pause, ${score[0]}-${score[1]}.` : "Pause."),
  extratime: "Vi går til ekstraomganger!",
  fulltime: (score) =>
    score
      ? `Full tid! Sluttresultat ${score[0]}-${score[1]}. Takk for at du fulgte kampradioen!`
      : "Full tid! Takk for at du fulgte kampradioen!",
  shootout: "Alt skal avgjøres på straffer!",
  penTaker: (player) => `${player} gjør seg klar.`,
  penGoal: "Scorer!",
  penMiss: "Bommer!",
  scoreStatus: (score, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? "Fortsatt 0-0." : `Det står ${score[0]}-${score[1]}.`;
    return score[0] > score[1] ? `${homeTeam} leder ${score[0]}-${score[1]}.` : `${awayTeam} leder ${score[1]}-${score[0]}.`;
  },
  scoreReminder: (score, minute, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? `Etter ${minute} minutter er det fortsatt 0-0.` : `Etter ${minute} minutter står det ${score[0]}-${score[1]}.`;
    return score[0] > score[1]
      ? `Etter ${minute} minutter leder ${homeTeam} ${score[0]}-${score[1]}.`
      : `Etter ${minute} minutter leder ${awayTeam} ${score[1]}-${score[0]}.`;
  },
  loose: "Løs ball!",
  keeper: (name, team) => `${name} har ballen for ${team}.`,
  duel: (name, oppName) => `${name} blir presset av ${oppName}.`,
  run: (name, team) => `${name} setter fart for ${team}.`,
  danger: (name) => `${name} nærmer seg sekstenmeteren.`,
  build: (name, team) => `${team} bygger bakfra med ${name}.`,
  carry: (name, team) => `${name} fører ballen for ${team}.`,  looseAlt: ["Ingen har kontroll på ballen!", "Ballen ligger løs på midtbanen!"],
  keeperAlt: [(name, team) => `${name} plukker den ned og setter i gang ${team}.`, (name, team) => `Rolig nå: ${team} bygger opp bakfra med ${name}.`],
  duelAlt: [(name, oppName) => `${oppName} henger tett på ${name}!`, (name, oppName) => `Tøff duell — ${name} skjermer ballen for ${oppName}.`],
  runAlt: [(name, team) => `${name} setter opp farten for ${team}!`, (name, team) => `Det åpner seg rom, og ${name} går inn i det!`],
  dangerAlt: [(name) => `${name} er i skuddposisjon!`, (name) => `Pass på, ${name} nærmer seg feltet!`],
  buildAlt: [(name, team) => `${name} starter angrepet for ${team}.`, (name, team) => `${team} lar ballen gå, ${name} styrer bakfra.`],
  carryAlt: [(name, team) => `${name} fører ballen fremover for ${team}.`, (name, team) => `Ballbesittelse ${team} — ${name} leter etter åpningen.`, (name, team) => `${name} løfter blikket og ser etter en medspiller.`],
};

const it: RadioPack = {
  rejoin: "La radio della partita è tornata in onda!",
  opening: "Benvenuti a tutti! Oggi assisteremo a una partita emozionante!",
  kickoff: (team) => `${team} battono il calcio d'inizio!`,
  foul: (team) => (team ? `Fallo. Punizione per ${team}.` : "Fallo fischiato."),
  yellow: (player) => (player ? `Cartellino giallo per ${player}!` : "Cartellino giallo!"),
  red: (player) => (player ? `Cartellino rosso per ${player}!` : "Cartellino rosso!"),
  penalty: (team) => (team ? `Rigore per ${team}!` : "Rigore!"),
  offside: "Fuorigioco!",
  corner: (team) => `Calcio d'angolo per ${team}.`,
  goalkick: "Rinvio dal fondo. Riparte il portiere.",
  throwin: (team) => `Rimessa laterale per ${team}.`,
  pass: (player, target) => `${player} trova ${target}.`,
  shot: (player) => (player ? `Il tiro di ${player}!` : "Il tiro!"),
  miss: "Fuori di poco!",
  save: "Che parata del portiere!",
  halftime: (score) => (score ? `Intervallo, ${score[0]}-${score[1]}.` : "Intervallo."),
  extratime: "Si va ai supplementari!",
  fulltime: (score) =>
    score
      ? `Finita! Risultato finale ${score[0]}-${score[1]}. Grazie per aver seguito la radio della partita!`
      : "Finita! Grazie per aver seguito la radio della partita!",
  shootout: "Si decide tutto ai rigori!",
  penTaker: (player) => `${player} va sul dischetto.`,
  penGoal: "Gol!",
  penMiss: "Sbaglia!",
  scoreStatus: (score, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? "Sempre zero a zero." : `È ${score[0]} a ${score[1]}.`;
    return score[0] > score[1] ? `${homeTeam} avanti ${score[0]} a ${score[1]}.` : `${awayTeam} avanti ${score[1]} a ${score[0]}.`;
  },
  scoreReminder: (score, minute, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? `Dopo ${minute} minuti è ancora zero a zero.` : `Dopo ${minute} minuti è ${score[0]} a ${score[1]}.`;
    return score[0] > score[1]
      ? `Dopo ${minute} minuti ${homeTeam} sono avanti ${score[0]} a ${score[1]}.`
      : `Dopo ${minute} minuti ${awayTeam} sono avanti ${score[1]} a ${score[0]}.`;
  },
  loose: "Palla vagante!",
  keeper: (name, team) => `${name} ha il pallone per ${team}.`,
  duel: (name, oppName) => `${name} è pressato da ${oppName}.`,
  run: (name, team) => `${name} accelera per ${team}.`,
  danger: (name) => `${name} si avvicina all'area.`,
  build: (name, team) => `${team} costruiscono da dietro con ${name}.`,
  carry: (name, team) => `${name} porta palla per ${team}.`,  looseAlt: ["Nessuno controlla questo pallone!", "Palla vagante a centrocampo!"],
  keeperAlt: [(name, team) => `${name} la blocca e rilancia per ${team}.`, (name, team) => `Con calma, ${team} ripartono da dietro con ${name}.`],
  duelAlt: [(name, oppName) => `${oppName} addosso a ${name}!`, (name, oppName) => `Duello acceso: ${name} protegge palla da ${oppName}.`],
  runAlt: [(name, team) => `${name} cambia passo per ${team}!`, (name, team) => `Si apre lo spazio e ${name} lo attacca!`],
  dangerAlt: [(name) => `${name} entra nella zona calda!`, (name) => `Attenzione, ${name} si avvicina all'area!`],
  buildAlt: [(name, team) => `${name} avvia la manovra per ${team}.`, (name, team) => `${team} fanno girare palla, ${name} dietro a dirigere.`],
  carryAlt: [(name, team) => `${name} porta palla per ${team}.`, (name, team) => `Possesso ${team}, ${name} cerca il varco.`, (name, team) => `${name} alza la testa e cerca l'appoggio.`, (name, team) => `${name} fa avanzare il gioco per ${team}.`, (name) => `Il gioco passa dai piedi di ${name}.`],
};

const ga: RadioPack = {
  rejoin: "Tá raidió an chluiche ar ais ar an aer!",
  opening: "Fáilte romhaibh go léir! Tá cluiche iontach romhainn inniu!",
  kickoff: (team) => `Tosaíonn ${team} an cluiche!`,
  foul: (team) => (team ? `Bréan. Cic saor do ${team}.` : "Bréan tugtha."),
  yellow: (player) => (player ? `Cárta buí do ${player}!` : "Cárta buí!"),
  red: (player) => (player ? `Cárta dearg do ${player}!` : "Cárta dearg!"),
  penalty: (team) => (team ? `Pionós do ${team}!` : "Pionós!"),
  offside: "Tá an bhratach suas, taobh amuigh!",
  corner: (team) => `Coirnéal do ${team}.`,
  goalkick: "Cic cúil. Tosóidh an cúl báire arís.",
  throwin: (team) => `Caith isteach do ${team}.`,
  pass: (player, target) => `${player} chuig ${target}.`,
  shot: (player) => (player ? `An lámhaigh ó ${player}!` : "An lámhaigh!"),
  miss: "Díreach leataobh!",
  save: "Cad é an tarrtháil ón gcúl báire!",
  halftime: (score) => (score ? `Leath-am, ${score[0]}-${score[1]}.` : "Leath-am."),
  extratime: "Táimid ag dul go ham breise!",
  fulltime: (score) =>
    score
      ? `Sin é an cluiche! Scór deiridh ${score[0]}-${score[1]}. Go raibh maith agat as éisteacht le raidió an chluiche!`
      : "Sin é an cluiche! Go raibh maith agat as éisteacht le raidió an chluiche!",
  shootout: "Beidh gach rud socraithe ar phionóis!",
  penTaker: (player) => `${player} ag teacht chun tosaigh.`,
  penGoal: "Scóráilte!",
  penMiss: "Caillte!",
  scoreStatus: (score, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? "Tá sé fós nialas a nialas." : `Tá sé ${score[0]}-${score[1]}.`;
    return score[0] > score[1] ? `${homeTeam} chun tosaigh, ${score[0]}-${score[1]}.` : `${awayTeam} chun tosaigh, ${score[1]}-${score[0]}.`;
  },
  scoreReminder: (score, minute, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? `Tar éis ${minute} nóiméad, tá sé fós nialas a nialas.` : `Tar éis ${minute} nóiméad, tá sé ${score[0]}-${score[1]}.`;
    return score[0] > score[1]
      ? `Tar éis ${minute} nóiméad, tá ${homeTeam} chun tosaigh ${score[0]}-${score[1]}.`
      : `Tar éis ${minute} nóiméad, tá ${awayTeam} chun tosaigh ${score[1]}-${score[0]}.`;
  },
  loose: "Tá an liathróid scaoilte!",
  keeper: (name, team) => `Tá an liathróid ag ${name} do ${team}.`,
  duel: (name, oppName) => `Tá ${oppName} ag brú ar ${name}.`,
  run: (name, team) => `Tá ${name} ag luasghéarú do ${team}.`,
  danger: (name) => `Tá ${name} ag druidim leis an gceantar pionóis.`,
  build: (name, team) => `Tá ${team} ag tógáil ón gcúl le ${name}.`,
  carry: (name, team) => `Tá ${name} ar an liathróid do ${team}.`,  looseAlt: ["Níl smacht ag aon duine ar an liathróid!", "Tá an liathróid scaoilte i lár na páirce!"],
  keeperAlt: [(name, team) => `Beireann ${name} uirthi agus tosaíonn ${team} arís.`, (name, team) => `Go réidh: tógann ${team} ón gcúl le ${name}.`],
  duelAlt: [(name, oppName) => `Tá ${oppName} sáite i ${name}!`, (name, oppName) => `Coimhlint chrua — cosnaíonn ${name} an liathróid ar ${oppName}.`],
  runAlt: [(name, team) => `Cuireann ${name} dlús leis do ${team}!`, (name, team) => `Osclaíonn spás agus isteach le ${name}!`],
  dangerAlt: [(name) => `Tá ${name} i raon scórála anois!`, (name) => `Aire — tá ${name} ag druidim leis an gceantar!`],
  buildAlt: [(name, team) => `Tosaíonn ${name} an t-ionsaí do ${team}.`, (name, team) => `Imríonn ${team} go foighneach, ${name} ag stiúradh ón gcúl.`],
  carryAlt: [(name, team) => `Coinníonn ${name} ag gluaiseacht í do ${team}.`, (name, team) => `Seilbh ag ${team} — ${name} ag lorg bearna.`, (name, team) => `Ardaíonn ${name} a cheann ag lorg rogha.`],
};

const nl: RadioPack = {
  rejoin: "De wedstrijdradio is weer in de lucht!",
  opening: "Welkom allemaal! Vandaag krijgen we een spannende wedstrijd!",
  kickoff: (team) => `${team} trappen af!`,
  foul: (team) => (team ? `Overtreding. Vrije trap voor ${team}.` : "Overtreding gefloten."),
  yellow: (player) => (player ? `Gele kaart voor ${player}!` : "Gele kaart!"),
  red: (player) => (player ? `Rode kaart voor ${player}!` : "Rode kaart!"),
  penalty: (team) => (team ? `Penalty voor ${team}!` : "Penalty!"),
  offside: "Buitenspel!",
  corner: (team) => `Corner voor ${team}.`,
  goalkick: "Doelschop. De keeper gaat hervatten.",
  throwin: (team) => `Inworp voor ${team}.`,
  pass: (player, target) => `${player} vindt ${target}.`,
  shot: (player) => (player ? `Het schot van ${player}!` : "Het schot!"),
  miss: "Net naast!",
  save: "Wat een redding van de keeper!",
  halftime: (score) => (score ? `Rust, ${score[0]}-${score[1]}.` : "Rust."),
  extratime: "We gaan naar verlenging!",
  fulltime: (score) =>
    score
      ? `Afgelopen! Eindstand ${score[0]}-${score[1]}. Bedankt voor het luisteren naar de wedstrijdradio!`
      : "Afgelopen! Bedankt voor het luisteren naar de wedstrijdradio!",
  shootout: "Alles wordt beslist met strafschoppen!",
  penTaker: (player) => `${player} gaat achter de bal staan.`,
  penGoal: "Raak!",
  penMiss: "Gemist!",
  scoreStatus: (score, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? "Nog altijd 0-0." : `Het staat ${score[0]}-${score[1]}.`;
    return score[0] > score[1] ? `${homeTeam} leiden met ${score[0]}-${score[1]}.` : `${awayTeam} leiden met ${score[1]}-${score[0]}.`;
  },
  scoreReminder: (score, minute, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? `Na ${minute} minuten staat het nog altijd 0-0.` : `Na ${minute} minuten staat het ${score[0]}-${score[1]}.`;
    return score[0] > score[1]
      ? `Na ${minute} minuten leiden ${homeTeam} met ${score[0]}-${score[1]}.`
      : `Na ${minute} minuten leiden ${awayTeam} met ${score[1]}-${score[0]}.`;
  },
  loose: "Losse bal!",
  keeper: (name, team) => `${name} heeft de bal voor ${team}.`,
  duel: (name, oppName) => `${name} staat onder druk van ${oppName}.`,
  run: (name, team) => `${name} versnelt voor ${team}.`,
  danger: (name) => `${name} komt dicht bij het strafschopgebied.`,
  build: (name, team) => `${team} bouwen van achteruit op met ${name}.`,
  carry: (name, team) => `${name} aan de bal voor ${team}.`,  looseAlt: ["Niemand heeft deze bal onder controle!", "De bal ligt vrij op het middenveld!"],
  keeperAlt: [(name, team) => `${name} pakt hem en zet ${team} weer op gang.`, (name, team) => `Rustig aan: ${team} bouwen achterin op met ${name}.`],
  duelAlt: [(name, oppName) => `${oppName} zit kort op ${name}!`, (name, oppName) => `Stevig duel — ${name} schermt de bal af voor ${oppName}.`],
  runAlt: [(name, team) => `${name} versnelt voor ${team}!`, (name, team) => `Er valt ruimte en ${name} duikt erin!`],
  dangerAlt: [(name) => `${name} komt in schotpositie!`, (name) => `Opgelet, ${name} nadert het strafschopgebied!`],
  buildAlt: [(name, team) => `${name} zet de aanval op voor ${team}.`, (name, team) => `${team} laten de bal rondgaan, ${name} verdeelt achterin.`],
  carryAlt: [(name, team) => `${name} stuwt de bal vooruit voor ${team}.`, (name, team) => `Balbezit ${team} — ${name} zoekt de opening.`, (name, team) => `${name} kijkt op en zoekt een aanspeelpunt.`],
};

const hr: RadioPack = {
  rejoin: "Radio prijenos utakmice opet je u eteru!",
  opening: "Dobro došli svima! Danas nas čeka sjajna utakmica!",
  kickoff: (team) => `${team} izvode početni udarac!`,
  foul: (team) => (team ? `Prekršaj. Slobodan udarac za ${team}.` : "Dosuđen je prekršaj."),
  yellow: (player) => (player ? `Žuti karton za ${player}!` : "Žuti karton!"),
  red: (player) => (player ? `Crveni karton za ${player}!` : "Crveni karton!"),
  penalty: (team) => (team ? `Kazneni udarac za ${team}!` : "Kazneni udarac!"),
  offside: "Zaleđe!",
  corner: (team) => `Korner za ${team}.`,
  goalkick: "Gol-aut. Vratar će krenuti ispočetka.",
  throwin: (team) => `Aut za ${team}.`,
  pass: (player, target) => `${player} pronalazi ${target}.`,
  shot: (player) => (player ? `Udarac ${player}!` : "Udarac!"),
  miss: "Pored gola!",
  save: "Kakva obrana vratara!",
  halftime: (score) => (score ? `Poluvrijeme, ${score[0]}-${score[1]}.` : "Poluvrijeme."),
  extratime: "Idemo u produžetke!",
  fulltime: (score) =>
    score
      ? `Kraj utakmice! Konačan rezultat je ${score[0]}-${score[1]}. Hvala što ste slušali radio prijenos!`
      : "Kraj utakmice! Hvala što ste slušali radio prijenos!",
  shootout: "Sve će odlučiti jedanaesterci!",
  penTaker: (player) => `${player} prilazi lopti.`,
  penGoal: "Gol!",
  penMiss: "Promašaj!",
  scoreStatus: (score, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? "I dalje je 0-0." : `Rezultat je ${score[0]}-${score[1]}.`;
    return score[0] > score[1] ? `${homeTeam} vode ${score[0]}-${score[1]}.` : `${awayTeam} vode ${score[1]}-${score[0]}.`;
  },
  scoreReminder: (score, minute, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? `Nakon ${minute} minuta i dalje je 0-0.` : `Nakon ${minute} minuta rezultat je ${score[0]}-${score[1]}.`;
    return score[0] > score[1]
      ? `Nakon ${minute} minuta ${homeTeam} vode ${score[0]}-${score[1]}.`
      : `Nakon ${minute} minuta ${awayTeam} vode ${score[1]}-${score[0]}.`;
  },
  loose: "Ničija lopta!",
  keeper: (name, team) => `${name} ima loptu za ${team}.`,
  duel: (name, oppName) => `${name} je pod pritiskom igrača ${oppName}.`,
  run: (name, team) => `${name} ubrzava za ${team}.`,
  danger: (name) => `${name} prilazi kaznenom prostoru.`,
  build: (name, team) => `${team} grade napad odostraga s igračem ${name}.`,
  carry: (name, team) => `${name} vodi loptu za ${team}.`,  looseAlt: ["Nitko ne kontrolira ovu loptu!", "Lopta je slobodna na sredini terena!"],
  keeperAlt: [(name, team) => `${name} je hvata i pokreće ${team}.`, (name, team) => `Mirno: ${team} grade otraga preko ${name}.`],
  duelAlt: [(name, oppName) => `${oppName} se zalijepio za ${name}!`, (name, oppName) => `Žestok duel — ${name} štiti loptu od ${oppName}.`],
  runAlt: [(name, team) => `${name} ubrzava za ${team}!`, (name, team) => `Otvorio se prostor i ${name} ulazi u njega!`],
  dangerAlt: [(name) => `${name} ulazi u zonu šuta!`, (name) => `Oprez, ${name} se približava šesnaestercu!`],
  buildAlt: [(name, team) => `${name} pokreće akciju za ${team}.`, (name, team) => `${team} strpljivo dodaju, ${name} diriguje otraga.`],
  carryAlt: [(name, team) => `${name} nosi loptu za ${team}.`, (name, team) => `Posjed ${team} — ${name} traži prolaz.`, (name, team) => `${name} podiže glavu i traži rješenje.`],
};

const pl: RadioPack = {
  rejoin: "Radio meczowe wraca na antenę!",
  opening: "Witamy wszystkich! Przed nami pasjonujący mecz!",
  kickoff: (team) => `${team} rozpoczynają spotkanie!`,
  foul: (team) => (team ? `Faul. Rzut wolny dla ${team}.` : "Odgwizdano faul."),
  yellow: (player) => (player ? `Żółta kartka dla ${player}!` : "Żółta kartka!"),
  red: (player) => (player ? `Czerwona kartka dla ${player}!` : "Czerwona kartka!"),
  penalty: (team) => (team ? `Rzut karny dla ${team}!` : "Rzut karny!"),
  offside: "Spalony!",
  corner: (team) => `Rzut rożny dla ${team}.`,
  goalkick: "Od bramki. Bramkarz wznowi grę.",
  throwin: (team) => `Aut dla ${team}.`,
  pass: (player, target) => `${player} zagrywa do ${target}.`,
  shot: (player) => (player ? `Strzał ${player}!` : "Strzał!"),
  miss: "Minimalnie obok!",
  save: "Co za obrona bramkarza!",
  halftime: (score) => (score ? `Przerwa, ${score[0]}-${score[1]}.` : "Przerwa."),
  extratime: "Czeka nas dogrywka!",
  fulltime: (score) =>
    score
      ? `Koniec meczu! Wynik końcowy ${score[0]}-${score[1]}. Dziękujemy za słuchanie radia meczowego!`
      : "Koniec meczu! Dziękujemy za słuchanie radia meczowego!",
  shootout: "O wszystkim zdecydują rzuty karne!",
  penTaker: (player) => `${player} podchodzi do piłki.`,
  penGoal: "Gol!",
  penMiss: "Pudło!",
  scoreStatus: (score, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? "Nadal 0-0." : `Wynik ${score[0]}-${score[1]}.`;
    return score[0] > score[1] ? `${homeTeam} prowadzą ${score[0]}-${score[1]}.` : `${awayTeam} prowadzą ${score[1]}-${score[0]}.`;
  },
  scoreReminder: (score, minute, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? `Po ${minute} minutach nadal 0-0.` : `Po ${minute} minutach jest ${score[0]}-${score[1]}.`;
    return score[0] > score[1]
      ? `Po ${minute} minutach ${homeTeam} prowadzą ${score[0]}-${score[1]}.`
      : `Po ${minute} minutach ${awayTeam} prowadzą ${score[1]}-${score[0]}.`;
  },
  loose: "Bezpańska piłka!",
  keeper: (name, team) => `${name} ma piłkę dla ${team}.`,
  duel: (name, oppName) => `${name} jest naciskany przez ${oppName}.`,
  run: (name, team) => `${name} przyspiesza dla ${team}.`,
  danger: (name) => `${name} zbliża się do pola karnego.`,
  build: (name, team) => `${team} rozgrywają od tyłu z ${name}.`,
  carry: (name, team) => `${name} prowadzi piłkę dla ${team}.`,  looseAlt: ["Nikt nie kontroluje tej piłki!", "Piłka luźna w środku pola!"],
  keeperAlt: [(name, team) => `${name} łapie ją i uruchamia ${team}.`, (name, team) => `Spokojnie: ${team} budują od tyłu przez ${name}.`],
  duelAlt: [(name, oppName) => `${oppName} siedzi na plecach ${name}!`, (name, oppName) => `Twardy pojedynek — ${name} osłania piłkę przed ${oppName}.`],
  runAlt: [(name, team) => `${name} przyspiesza dla ${team}!`, (name, team) => `Otwiera się przestrzeń i ${name} w nią wchodzi!`],
  dangerAlt: [(name) => `${name} wchodzi w strefę strzału!`, (name) => `Uwaga, ${name} zbliża się do pola karnego!`],
  buildAlt: [(name, team) => `${name} rozpoczyna akcję ${team}.`, (name, team) => `${team} cierpliwie wymieniają podania, ${name} dyryguje z tyłu.`],
  carryAlt: [(name, team) => `${name} prowadzi piłkę dla ${team}.`, (name, team) => `Posiadanie ${team} — ${name} szuka luki.`, (name, team) => `${name} podnosi głowę i szuka opcji.`],
};

const tr: RadioPack = {
  rejoin: "Mac radyosu yeniden yayında!",
  opening: "Herkese hoş geldiniz! Bugün heyecan dolu bir maç bizi bekliyor!",
  kickoff: (team) => `${team} maça başlıyor!`,
  foul: (team) => (team ? `Faul. Serbest vuruş ${team} için.` : "Faul kararı."),
  yellow: (player) => (player ? `${player} için sarı kart!` : "Sarı kart!"),
  red: (player) => (player ? `${player} için kırmızı kart!` : "Kırmızı kart!"),
  penalty: (team) => (team ? `${team} için penaltı!` : "Penaltı!"),
  offside: "Ofsayt!",
  corner: (team) => `${team} için korner.`,
  goalkick: "Aut atışı. Kaleci oyunu başlatacak.",
  throwin: (team) => `${team} için taç atışı.`,
  pass: (player, target) => `${player}, ${target} ile buluşuyor.`,
  shot: (player) => (player ? `${player} vurdu!` : "Şut geldi!"),
  miss: "Az farkla dışarıda!",
  save: "Kaleciden müthiş kurtarış!",
  halftime: (score) => (score ? `İlk yarı bitti, skor ${score[0]}-${score[1]}.` : "İlk yarı bitti."),
  extratime: "Uzatmalara gidiyoruz!",
  fulltime: (score) =>
    score
      ? `Mac bitti! Sonuç ${score[0]}-${score[1]}. Mac radyosunu dinlediğiniz için teşekkürler!`
      : "Mac bitti! Mac radyosunu dinlediğiniz için teşekkürler!",
  shootout: "Her şey penaltılarda belli olacak!",
  penTaker: (player) => `${player} topun başına geçiyor.`,
  penGoal: "Gol!",
  penMiss: "Kaçırdı!",
  scoreStatus: (score, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? "Hâlâ 0-0." : `Skor ${score[0]}-${score[1]}.`;
    return score[0] > score[1] ? `${homeTeam} ${score[0]}-${score[1]} önde.` : `${awayTeam} ${score[1]}-${score[0]} önde.`;
  },
  scoreReminder: (score, minute, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? `${minute} dakika sonunda hâlâ 0-0.` : `${minute} dakika sonunda skor ${score[0]}-${score[1]}.`;
    return score[0] > score[1]
      ? `${minute} dakika sonunda ${homeTeam} ${score[0]}-${score[1]} önde.`
      : `${minute} dakika sonunda ${awayTeam} ${score[1]}-${score[0]} önde.`;
  },
  loose: "Boşta top!",
  keeper: (name, team) => `${name} topu ${team} adına kontrol ediyor.`,
  duel: (name, oppName) => `${name}, ${oppName} baskısı altında.`,
  run: (name, team) => `${name}, ${team} adına hızlanıyor.`,
  danger: (name) => `${name} ceza alanına yaklaşıyor.`,
  build: (name, team) => `${team} arkadan ${name} ile çıkıyor.`,
  carry: (name, team) => `${name} topu ${team} adına taşıyor.`,  looseAlt: ["Bu topa kimse hakim değil!", "Top orta sahada boşta!"],
  keeperAlt: [(name, team) => `${name} topu alıyor ve ${team} için oyunu başlatıyor.`, (name, team) => `Sakin: ${team} geriden ${name} ile kuruyor.`],
  duelAlt: [(name, oppName) => `${oppName}, ${name} üzerinde baskı kuruyor!`, (name, oppName) => `Sert mücadele — ${name} topu ${oppName} karşısında koruyor.`],
  runAlt: [(name, team) => `${name}, ${team} için hızlanıyor!`, (name, team) => `Boşluk açıldı ve ${name} oraya dalıyor!`],
  dangerAlt: [(name) => `${name} şut mesafesine giriyor!`, (name) => `Dikkat, ${name} ceza sahasına yaklaşıyor!`],
  buildAlt: [(name, team) => `${name}, ${team} adına atağı başlatıyor.`, (name, team) => `${team} sabırla paslaşıyor, ${name} geriden yönetiyor.`],
  carryAlt: [(name, team) => `${name}, ${team} için topu taşıyor.`, (name, team) => `Top ${team} takımında — ${name} boşluk arıyor.`, (name, team) => `${name} başını kaldırıp seçenek arıyor.`],
};

const ru: RadioPack = {
  rejoin: "Радио матча снова в эфире!",
  opening: "Добро пожаловать! Сегодня нас ждет захватывающий матч!",
  kickoff: (team) => `${team} начинают матч!`,
  foul: (team) => (team ? `Фол. Штрафной в пользу ${team}.` : "Зафиксирован фол."),
  yellow: (player) => (player ? `Желтая карточка для ${player}!` : "Желтая карточка!"),
  red: (player) => (player ? `Красная карточка для ${player}!` : "Красная карточка!"),
  penalty: (team) => (team ? `Пенальти в пользу ${team}!` : "Пенальти!"),
  offside: "Офсайд!",
  corner: (team) => `Угловой для ${team}.`,
  goalkick: "Удар от ворот. Вратарь введет мяч в игру.",
  throwin: (team) => `Аут в пользу ${team}.`,
  pass: (player, target) => `${player} находит ${target}.`,
  shot: (player) => (player ? `Удар ${player}!` : "Удар!"),
  miss: "Рядом со штангой!",
  save: "Какой сейв вратаря!",
  halftime: (score) => (score ? `Перерыв, ${score[0]}-${score[1]}.` : "Перерыв."),
  extratime: "Нас ждет дополнительное время!",
  fulltime: (score) =>
    score
      ? `Матч окончен! Итоговый счет ${score[0]}-${score[1]}. Спасибо, что были с радио матча!`
      : "Матч окончен! Спасибо, что были с радио матча!",
  shootout: "Все решится в серии пенальти!",
  penTaker: (player) => `${player} подходит к мячу.`,
  penGoal: "Гол!",
  penMiss: "Не забил!",
  scoreStatus: (score, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? "По-прежнему 0-0." : `Счет ${score[0]}-${score[1]}.`;
    return score[0] > score[1] ? `${homeTeam} ведут ${score[0]}-${score[1]}.` : `${awayTeam} ведут ${score[1]}-${score[0]}.`;
  },
  scoreReminder: (score, minute, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? `После ${minute} минут по-прежнему 0-0.` : `После ${minute} минут счет ${score[0]}-${score[1]}.`;
    return score[0] > score[1]
      ? `После ${minute} минут ${homeTeam} ведут ${score[0]}-${score[1]}.`
      : `После ${minute} минут ${awayTeam} ведут ${score[1]}-${score[0]}.`;
  },
  loose: "Мяч ничей!",
  keeper: (name, team) => `${name} контролирует мяч у ${team}.`,
  duel: (name, oppName) => `${oppName} прессингует ${name}.`,
  run: (name, team) => `${name} ускоряется за ${team}.`,
  danger: (name) => `${name} приближается к штрафной.`,
  build: (name, team) => `${team} начинают атаку через ${name}.`,
  carry: (name, team) => `${name} ведет мяч за ${team}.`,  looseAlt: ["Никто не владеет этим мячом!", "Мяч свободен в центре поля!"],
  keeperAlt: [(name, team) => `${name} забирает мяч и начинает атаку ${team}.`, (name, team) => `Спокойно: ${team} строят игру сзади через ${name}.`],
  duelAlt: [(name, oppName) => `${oppName} вплотную к ${name}!`, (name, oppName) => `Жёсткая борьба — ${name} укрывает мяч от ${oppName}.`],
  runAlt: [(name, team) => `${name} ускоряется за ${team}!`, (name, team) => `Открылось пространство, и ${name} врывается в него!`],
  dangerAlt: [(name) => `${name} выходит на ударную позицию!`, (name) => `Осторожно, ${name} приближается к штрафной!`],
  buildAlt: [(name, team) => `${name} начинает атаку ${team}.`, (name, team) => `${team} терпеливо катают мяч, ${name} дирижирует сзади.`],
  carryAlt: [(name, team) => `${name} ведёт мяч для ${team}.`, (name, team) => `Владение у ${team} — ${name} ищет свободную зону.`, (name, team) => `${name} поднимает голову и ищет продолжение.`],
};

const uk: RadioPack = {
  rejoin: "Радіо матчу знову в ефірі!",
  opening: "Вітаємо всіх! Сьогодні на нас чекає захопливий матч!",
  kickoff: (team) => `${team} розпочинають гру!`,
  foul: (team) => (team ? `Фол. Штрафний для ${team}.` : "Зафіксовано фол."),
  yellow: (player) => (player ? `Жовта картка для ${player}!` : "Жовта картка!"),
  red: (player) => (player ? `Червона картка для ${player}!` : "Червона картка!"),
  penalty: (team) => (team ? `Пенальті для ${team}!` : "Пенальті!"),
  offside: "Офсайд!",
  corner: (team) => `Кутовий для ${team}.`,
  goalkick: "Удар від воріт. Воротар введе м'яч у гру.",
  throwin: (team) => `Аут для ${team}.`,
  pass: (player, target) => `${player} знаходить ${target}.`,
  shot: (player) => (player ? `Удар ${player}!` : "Удар!"),
  miss: "Поруч зі стійкою!",
  save: "Який сейв воротаря!",
  halftime: (score) => (score ? `Перерва, ${score[0]}-${score[1]}.` : "Перерва."),
  extratime: "Попереду додатковий час!",
  fulltime: (score) =>
    score
      ? `Матч завершено! Підсумковий рахунок ${score[0]}-${score[1]}. Дякуємо, що слухали радіо матчу!`
      : "Матч завершено! Дякуємо, що слухали радіо матчу!",
  shootout: "Усе вирішиться в серії пенальті!",
  penTaker: (player) => `${player} підходить до позначки.`,
  penGoal: "Гол!",
  penMiss: "Не влучив!",
  scoreStatus: (score, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? "Досі 0-0." : `Рахунок ${score[0]}-${score[1]}.`;
    return score[0] > score[1] ? `${homeTeam} ведуть ${score[0]}-${score[1]}.` : `${awayTeam} ведуть ${score[1]}-${score[0]}.`;
  },
  scoreReminder: (score, minute, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? `Після ${minute} хвилин досі 0-0.` : `Після ${minute} хвилин рахунок ${score[0]}-${score[1]}.`;
    return score[0] > score[1]
      ? `Після ${minute} хвилин ${homeTeam} ведуть ${score[0]}-${score[1]}.`
      : `Після ${minute} хвилин ${awayTeam} ведуть ${score[1]}-${score[0]}.`;
  },
  loose: "Нічийний м'яч!",
  keeper: (name, team) => `${name} контролює м'яч за ${team}.`,
  duel: (name, oppName) => `${oppName} пресингує ${name}.`,
  run: (name, team) => `${name} прискорюється за ${team}.`,
  danger: (name) => `${name} наближається до штрафного майданчика.`,
  build: (name, team) => `${team} починають атаку через ${name}.`,
  carry: (name, team) => `${name} веде м'яч за ${team}.`,  looseAlt: ["Ніхто не володіє цим м'ячем!", "М'яч вільний у центрі поля!"],
  keeperAlt: [(name, team) => `${name} забирає м'яч і розпочинає атаку ${team}.`, (name, team) => `Спокійно: ${team} будують гру ззаду через ${name}.`],
  duelAlt: [(name, oppName) => `${oppName} впритул до ${name}!`, (name, oppName) => `Жорстка боротьба — ${name} захищає м'яч від ${oppName}.`],
  runAlt: [(name, team) => `${name} прискорюється за ${team}!`, (name, team) => `Відкрився простір, і ${name} вривається туди!`],
  dangerAlt: [(name) => `${name} виходить на ударну позицію!`, (name) => `Обережно, ${name} наближається до штрафного!`],
  buildAlt: [(name, team) => `${name} розпочинає атаку ${team}.`, (name, team) => `${team} терпляче котять м'яч, ${name} диригує ззаду.`],
  carryAlt: [(name, team) => `${name} веде м'яч для ${team}.`, (name, team) => `Володіння у ${team} — ${name} шукає вільну зону.`, (name, team) => `${name} підводить голову і шукає варіант.`],
};

const ar: RadioPack = {
  rejoin: "راديو المباراة عاد إلى البث!",
  opening: "أهلا بكم جميعا! نحن على موعد مع مباراة مثيرة اليوم!",
  kickoff: (team) => `${team} يبدأون المباراة!`,
  foul: (team) => (team ? `خطأ. ركلة حرة لصالح ${team}.` : "تم احتساب خطأ."),
  yellow: (player) => (player ? `بطاقة صفراء لـ ${player}!` : "بطاقة صفراء!"),
  red: (player) => (player ? `بطاقة حمراء لـ ${player}!` : "بطاقة حمراء!"),
  penalty: (team) => (team ? `ركلة جزاء لـ ${team}!` : "ركلة جزاء!"),
  offside: "تسلل!",
  corner: (team) => `ركنية لصالح ${team}.`,
  goalkick: "ركلة مرمى. الحارس سيستأنف اللعب.",
  throwin: (team) => `رمية تماس لصالح ${team}.`,
  pass: (player, target) => `${player} يجد ${target}.`,
  shot: (player) => (player ? `تسديدة من ${player}!` : "تسديدة!"),
  miss: "مرت بجوار القائم!",
  save: "يا لها من تصدٍ من الحارس!",
  halftime: (score) => (score ? `نهاية الشوط الأول، ${score[0]}-${score[1]}.` : "نهاية الشوط الأول."),
  extratime: "سنذهب إلى الوقت الإضافي!",
  fulltime: (score) =>
    score
      ? `انتهت المباراة! النتيجة النهائية ${score[0]}-${score[1]}. شكرا لمتابعتكم راديو المباراة!`
      : "انتهت المباراة! شكرا لمتابعتكم راديو المباراة!",
  shootout: "كل شيء سيتحدد بركلات الترجيح!",
  penTaker: (player) => `${player} يتقدم للتسديد.`,
  penGoal: "هدف!",
  penMiss: "أهدرها!",
  scoreStatus: (score, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? "النتيجة ما زالت صفر صفر." : `النتيجة ${score[0]}-${score[1]}.`;
    return score[0] > score[1] ? `${homeTeam} يتقدم ${score[0]}-${score[1]}.` : `${awayTeam} يتقدم ${score[1]}-${score[0]}.`;
  },
  scoreReminder: (score, minute, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? `بعد ${minute} دقيقة ما زالت النتيجة صفر صفر.` : `بعد ${minute} دقيقة النتيجة ${score[0]}-${score[1]}.`;
    return score[0] > score[1]
      ? `بعد ${minute} دقيقة يتقدم ${homeTeam} ${score[0]}-${score[1]}.`
      : `بعد ${minute} دقيقة يتقدم ${awayTeam} ${score[1]}-${score[0]}.`;
  },
  loose: "الكرة حرة!",
  keeper: (name, team) => `${name} يسيطر على الكرة لصالح ${team}.`,
  duel: (name, oppName) => `${name} يتعرض للضغط من ${oppName}.`,
  run: (name, team) => `${name} ينطلق لصالح ${team}.`,
  danger: (name) => `${name} يقترب من منطقة الجزاء.`,
  build: (name, team) => `${team} يبنون اللعب من الخلف عبر ${name}.`,
  carry: (name, team) => `${name} يحمل الكرة لصالح ${team}.`,  looseAlt: ["لا أحد يسيطر على هذه الكرة!", "الكرة سائبة في وسط الملعب!"],
  keeperAlt: [(name, team) => `${name} يلتقطها ويبدأ الهجمة لصالح ${team}.`, (name, team) => `بهدوء: ${team} يبنون من الخلف عبر ${name}.`],
  duelAlt: [(name, oppName) => `${oppName} يلاحق ${name} عن قرب!`, (name, oppName) => `صراع قوي — ${name} يحمي الكرة من ${oppName}.`],
  runAlt: [(name, team) => `${name} يزيد السرعة لصالح ${team}!`, (name, team) => `المساحة مفتوحة و${name} ينطلق فيها!`],
  dangerAlt: [(name) => `${name} في مدى التسديد الآن!`, (name) => `انتبهوا، ${name} يقترب من منطقة الجزاء!`],
  buildAlt: [(name, team) => `${name} يبدأ البناء لصالح ${team}.`, (name, team) => `${team} يمررون بصبر، و${name} يدير من الخلف.`],
  carryAlt: [(name, team) => `${name} يتقدم بالكرة لصالح ${team}.`, (name, team) => `استحواذ لـ${team} — ${name} يبحث عن ثغرة.`, (name, team) => `${name} يرفع رأسه باحثاً عن خيار.`],
};

const hi: RadioPack = {
  rejoin: "मैच रेडियो फिर से ऑन एयर है!",
  opening: "सभी का स्वागत है! आज हम एक रोमांचक मैच देखने वाले हैं!",
  kickoff: (team) => `${team} मैच की शुरुआत कर रहे हैं!`,
  foul: (team) => (team ? `फाउल। ${team} के लिए फ्री किक।` : "फाउल दिया गया है।"),
  yellow: (player) => (player ? `${player} को पीला कार्ड!` : "पीला कार्ड!"),
  red: (player) => (player ? `${player} को लाल कार्ड!` : "लाल कार्ड!"),
  penalty: (team) => (team ? `${team} के लिए पेनल्टी!` : "पेनल्टी!"),
  offside: "ऑफसाइड!",
  corner: (team) => `${team} के लिए कॉर्नर।`,
  goalkick: "गोल किक। गोलकीपर खेल फिर शुरू करेगा।",
  throwin: (team) => `${team} के लिए थ्रो-इन।`,
  pass: (player, target) => `${player}, ${target} को पास देते हैं।`,
  shot: (player) => (player ? `${player} का शॉट!` : "शॉट!"),
  miss: "बस बाहर!",
  save: "गोलकीपर की शानदार बचत!",
  halftime: (score) => (score ? `हाफ टाइम, स्कोर ${score[0]}-${score[1]}.` : "हाफ टाइम।"),
  extratime: "हम अतिरिक्त समय में जा रहे हैं!",
  fulltime: (score) =>
    score
      ? `मैच खत्म! अंतिम स्कोर ${score[0]}-${score[1]}. मैच रेडियो सुनने के लिए धन्यवाद!`
      : "मैच खत्म! मैच रेडियो सुनने के लिए धन्यवाद!",
  shootout: "सब कुछ पेनल्टी शूटआउट से तय होगा!",
  penTaker: (player) => `${player} शॉट लेने आ रहे हैं।`,
  penGoal: "गोल!",
  penMiss: "चूक गए!",
  scoreStatus: (score, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? "स्कोर अभी भी 0-0 है।" : `स्कोर ${score[0]}-${score[1]} है।`;
    return score[0] > score[1] ? `${homeTeam} ${score[0]}-${score[1]} से आगे हैं।` : `${awayTeam} ${score[1]}-${score[0]} से आगे हैं।`;
  },
  scoreReminder: (score, minute, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? `${minute} मिनट बाद भी स्कोर 0-0 है।` : `${minute} मिनट बाद स्कोर ${score[0]}-${score[1]} है।`;
    return score[0] > score[1]
      ? `${minute} मिनट बाद ${homeTeam} ${score[0]}-${score[1]} से आगे हैं।`
      : `${minute} मिनट बाद ${awayTeam} ${score[1]}-${score[0]} से आगे हैं।`;
  },
  loose: "गेंद खुली है!",
  keeper: (name, team) => `${name} के पास ${team} के लिए गेंद है।`,
  duel: (name, oppName) => `${oppName}, ${name} पर दबाव बना रहे हैं।`,
  run: (name, team) => `${name}, ${team} के लिए तेजी से आगे बढ़ रहे हैं।`,
  danger: (name) => `${name} बॉक्स के करीब पहुंच रहे हैं।`,
  build: (name, team) => `${team}, ${name} के साथ पीछे से खेल बना रहे हैं।`,
  carry: (name, team) => `${name}, ${team} के लिए गेंद लेकर चल रहे हैं।`,  looseAlt: ["इस गेंद पर किसी का नियंत्रण नहीं!", "मिडफील्ड में गेंद खाली पड़ी है!"],
  keeperAlt: [(name, team) => `${name} गेंद पकड़कर ${team} का खेल शुरू करते हैं।`, (name, team) => `आराम से: ${team} पीछे से ${name} के साथ खेल बनाते हैं।`],
  duelAlt: [(name, oppName) => `${oppName} ने ${name} पर कड़ा दबाव बनाया!`, (name, oppName) => `कड़ा मुकाबला — ${name} गेंद को ${oppName} से बचा रहे हैं।`],
  runAlt: [(name, team) => `${name} ${team} के लिए रफ्तार बढ़ाते हैं!`, (name, team) => `जगह खुली और ${name} उसमें घुस गए!`],
  dangerAlt: [(name) => `${name} अब शूटिंग रेंज में हैं!`, (name) => `सावधान, ${name} बॉक्स के पास पहुंच रहे हैं!`],
  buildAlt: [(name, team) => `${name} ${team} के लिए हमला शुरू करते हैं।`, (name, team) => `${team} धैर्य से पास खेलते हैं, ${name} पीछे से संभालते हैं।`],
  carryAlt: [(name, team) => `${name} ${team} के लिए गेंद आगे बढ़ाते हैं।`, (name, team) => `गेंद ${team} के पास — ${name} रास्ता खोज रहे हैं।`, (name, team) => `${name} सिर उठाकर विकल्प देखते हैं।`],
};

const id: RadioPack = {
  rejoin: "Radio pertandingan kembali mengudara!",
  opening: "Selamat datang semuanya! Hari ini kita akan menyaksikan laga yang seru!",
  kickoff: (team) => `${team} memulai pertandingan!`,
  foul: (team) => (team ? `Pelanggaran. Tendangan bebas untuk ${team}.` : "Pelanggaran diberikan."),
  yellow: (player) => (player ? `Kartu kuning untuk ${player}!` : "Kartu kuning!"),
  red: (player) => (player ? `Kartu merah untuk ${player}!` : "Kartu merah!"),
  penalty: (team) => (team ? `Penalti untuk ${team}!` : "Penalti!"),
  offside: "Offside!",
  corner: (team) => `Tendangan sudut untuk ${team}.`,
  goalkick: "Tendangan gawang. Kiper akan memulai lagi.",
  throwin: (team) => `Lemparan ke dalam untuk ${team}.`,
  pass: (player, target) => `${player} menemukan ${target}.`,
  shot: (player) => (player ? `Tembakan dari ${player}!` : "Tembakan!"),
  miss: "Tipis di luar!",
  save: "Penyelamatan hebat dari kiper!",
  halftime: (score) => (score ? `Babak pertama usai, ${score[0]}-${score[1]}.` : "Babak pertama usai."),
  extratime: "Kita masuk ke perpanjangan waktu!",
  fulltime: (score) =>
    score
      ? `Pertandingan selesai! Skor akhir ${score[0]}-${score[1]}. Terima kasih telah mengikuti radio pertandingan!`
      : "Pertandingan selesai! Terima kasih telah mengikuti radio pertandingan!",
  shootout: "Semuanya akan ditentukan lewat adu penalti!",
  penTaker: (player) => `${player} bersiap menendang.`,
  penGoal: "Gol!",
  penMiss: "Gagal!",
  scoreStatus: (score, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? "Masih 0-0." : `Skor ${score[0]}-${score[1]}.`;
    return score[0] > score[1] ? `${homeTeam} unggul ${score[0]}-${score[1]}.` : `${awayTeam} unggul ${score[1]}-${score[0]}.`;
  },
  scoreReminder: (score, minute, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? `Setelah ${minute} menit, skor masih 0-0.` : `Setelah ${minute} menit, skor ${score[0]}-${score[1]}.`;
    return score[0] > score[1]
      ? `Setelah ${minute} menit, ${homeTeam} unggul ${score[0]}-${score[1]}.`
      : `Setelah ${minute} menit, ${awayTeam} unggul ${score[1]}-${score[0]}.`;
  },
  loose: "Bola lepas!",
  keeper: (name, team) => `${name} menguasai bola untuk ${team}.`,
  duel: (name, oppName) => `${name} ditekan oleh ${oppName}.`,
  run: (name, team) => `${name} melaju untuk ${team}.`,
  danger: (name) => `${name} mendekati kotak penalti.`,
  build: (name, team) => `${team} membangun serangan dari belakang bersama ${name}.`,
  carry: (name, team) => `${name} membawa bola untuk ${team}.`,  looseAlt: ["Tidak ada yang menguasai bola ini!", "Bola liar di tengah lapangan!"],
  keeperAlt: [(name, team) => `${name} menangkapnya dan memulai serangan ${team}.`, (name, team) => `Tenang: ${team} membangun dari belakang lewat ${name}.`],
  duelAlt: [(name, oppName) => `${oppName} menempel ketat pada ${name}!`, (name, oppName) => `Duel sengit — ${name} melindungi bola dari ${oppName}.`],
  runAlt: [(name, team) => `${name} menambah kecepatan untuk ${team}!`, (name, team) => `Ruang terbuka dan ${name} menyerbunya!`],
  dangerAlt: [(name) => `${name} sudah dalam jangkauan tembak!`, (name) => `Hati-hati, ${name} mendekati kotak penalti!`],
  buildAlt: [(name, team) => `${name} memulai serangan untuk ${team}.`, (name, team) => `${team} mengoper dengan sabar, ${name} mengatur dari belakang.`],
  carryAlt: [(name, team) => `${name} membawa bola untuk ${team}.`, (name, team) => `Penguasaan bola ${team} — ${name} mencari celah.`, (name, team) => `${name} mengangkat kepala mencari opsi.`],
};

const vi: RadioPack = {
  rejoin: "Radio trận đấu đã trở lại!",
  opening: "Chào mừng tất cả mọi người! Hôm nay chúng ta sẽ có một trận đấu hấp dẫn!",
  kickoff: (team) => `${team} giao bóng!`,
  foul: (team) => (team ? `Phạm lỗi. Đá phạt cho ${team}.` : "Đã có lỗi."),
  yellow: (player) => (player ? `Thẻ vàng cho ${player}!` : "Thẻ vàng!"),
  red: (player) => (player ? `Thẻ đỏ cho ${player}!` : "Thẻ đỏ!"),
  penalty: (team) => (team ? `Phạt đền cho ${team}!` : "Phạt đền!"),
  offside: "Việt vị!",
  corner: (team) => `Phạt góc cho ${team}.`,
  goalkick: "Phát bóng lên. Thủ môn sẽ bắt đầu lại.",
  throwin: (team) => `Ném biên cho ${team}.`,
  pass: (player, target) => `${player} tìm thấy ${target}.`,
  shot: (player) => (player ? `Cú sút của ${player}!` : "Cú sút!"),
  miss: "Chệch khung thành trong gang tấc!",
  save: "Pha cứu thua tuyệt vời của thủ môn!",
  halftime: (score) => (score ? `Hết hiệp một, ${score[0]}-${score[1]}.` : "Hết hiệp một."),
  extratime: "Chúng ta sẽ bước vào hiệp phụ!",
  fulltime: (score) =>
    score
      ? `Trận đấu kết thúc! Tỷ số cuối cùng là ${score[0]}-${score[1]}. Cảm ơn bạn đã nghe radio trận đấu!`
      : "Trận đấu kết thúc! Cảm ơn bạn đã nghe radio trận đấu!",
  shootout: "Mọi thứ sẽ được quyết định bằng loạt luân lưu!",
  penTaker: (player) => `${player} bước lên chấm đá phạt đền.`,
  penGoal: "Vào rồi!",
  penMiss: "Hỏng ăn!",
  scoreStatus: (score, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? "Tỷ số vẫn là 0-0." : `Tỷ số là ${score[0]}-${score[1]}.`;
    return score[0] > score[1] ? `${homeTeam} dẫn ${score[0]}-${score[1]}.` : `${awayTeam} dẫn ${score[1]}-${score[0]}.`;
  },
  scoreReminder: (score, minute, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? `Sau ${minute} phút, tỷ số vẫn là 0-0.` : `Sau ${minute} phút, tỷ số là ${score[0]}-${score[1]}.`;
    return score[0] > score[1]
      ? `Sau ${minute} phút, ${homeTeam} dẫn ${score[0]}-${score[1]}.`
      : `Sau ${minute} phút, ${awayTeam} dẫn ${score[1]}-${score[0]}.`;
  },
  loose: "Bóng đang bỏ trống!",
  keeper: (name, team) => `${name} đang giữ bóng cho ${team}.`,
  duel: (name, oppName) => `${name} đang bị ${oppName} gây áp lực.`,
  run: (name, team) => `${name} đang tăng tốc cho ${team}.`,
  danger: (name) => `${name} đang tiến sát vòng cấm.`,
  build: (name, team) => `${team} triển khai từ tuyến dưới với ${name}.`,
  carry: (name, team) => `${name} đang cầm bóng cho ${team}.`,  looseAlt: ["Không ai kiểm soát quả bóng này!", "Bóng tự do ở giữa sân!"],
  keeperAlt: [(name, team) => `${name} bắt gọn và phát động cho ${team}.`, (name, team) => `Bình tĩnh: ${team} triển khai từ tuyến dưới qua ${name}.`],
  duelAlt: [(name, oppName) => `${oppName} áp sát ${name}!`, (name, oppName) => `Tranh chấp quyết liệt — ${name} che bóng trước ${oppName}.`],
  runAlt: [(name, team) => `${name} tăng tốc cho ${team}!`, (name, team) => `Khoảng trống mở ra và ${name} lao vào!`],
  dangerAlt: [(name) => `${name} đã vào tầm dứt điểm!`, (name) => `Cẩn thận, ${name} đang áp sát vòng cấm!`],
  buildAlt: [(name, team) => `${name} khởi xướng đợt tấn công cho ${team}.`, (name, team) => `${team} chuyền bóng kiên nhẫn, ${name} điều phối phía sau.`],
  carryAlt: [(name, team) => `${name} dẫn bóng cho ${team}.`, (name, team) => `${team} cầm bóng — ${name} tìm khe hở.`, (name, team) => `${name} ngẩng đầu tìm phương án.`],
};

const th: RadioPack = {
  rejoin: "วิทยุการแข่งขันกลับมาออกอากาศแล้ว!",
  opening: "ยินดีต้อนรับทุกคน! วันนี้เรากำลังจะได้ชมเกมที่น่าตื่นเต้น!",
  kickoff: (team) => `${team} เริ่มเขี่ยลูกแล้ว!`,
  foul: (team) => (team ? `ฟาวล์ ฟรีคิกให้ ${team}.` : "มีการเป่าฟาวล์."),
  yellow: (player) => (player ? `ใบเหลืองสำหรับ ${player}!` : "ใบเหลือง!"),
  red: (player) => (player ? `ใบแดงสำหรับ ${player}!` : "ใบแดง!"),
  penalty: (team) => (team ? `จุดโทษสำหรับ ${team}!` : "จุดโทษ!"),
  offside: "ล้ำหน้า!",
  corner: (team) => `เตะมุมให้ ${team}.`,
  goalkick: "โกลคิก ผู้รักษาประตูจะเริ่มเล่นใหม่.",
  throwin: (team) => `ทุ่มให้ ${team}.`,
  pass: (player, target) => `${player} จ่ายให้ ${target}.`,
  shot: (player) => (player ? `ยิงของ ${player}!` : "ยิง!"),
  miss: "หลุดกรอบไปนิดเดียว!",
  save: "ผู้รักษาประตูเซฟได้ยอดเยี่ยม!",
  halftime: (score) => (score ? `จบครึ่งแรก ${score[0]}-${score[1]}.` : "จบครึ่งแรก."),
  extratime: "เรากำลังจะเข้าสู่ช่วงต่อเวลา!",
  fulltime: (score) =>
    score
      ? `จบการแข่งขัน! สกอร์สุดท้าย ${score[0]}-${score[1]}. ขอบคุณที่ติดตามวิทยุการแข่งขัน!`
      : "จบการแข่งขัน! ขอบคุณที่ติดตามวิทยุการแข่งขัน!",
  shootout: "ทุกอย่างจะตัดสินกันด้วยการดวลจุดโทษ!",
  penTaker: (player) => `${player} เดินเข้ามารับหน้าที่ยิง.`,
  penGoal: "เข้าไปแล้ว!",
  penMiss: "พลาด!",
  scoreStatus: (score, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? "ยังคง 0-0." : `สกอร์อยู่ที่ ${score[0]}-${score[1]}.`;
    return score[0] > score[1] ? `${homeTeam} นำอยู่ ${score[0]}-${score[1]}.` : `${awayTeam} นำอยู่ ${score[1]}-${score[0]}.`;
  },
  scoreReminder: (score, minute, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? `ผ่านไป ${minute} นาที สกอร์ยังคง 0-0.` : `ผ่านไป ${minute} นาที สกอร์อยู่ที่ ${score[0]}-${score[1]}.`;
    return score[0] > score[1]
      ? `ผ่านไป ${minute} นาที ${homeTeam} นำอยู่ ${score[0]}-${score[1]}.`
      : `ผ่านไป ${minute} นาที ${awayTeam} นำอยู่ ${score[1]}-${score[0]}.`;
  },
  loose: "บอลยังไม่มีใครครอง!",
  keeper: (name, team) => `${name} ครองบอลให้ ${team}.`,
  duel: (name, oppName) => `${name} กำลังโดน ${oppName} กดดัน.`,
  run: (name, team) => `${name} เร่งสปีดให้ ${team}.`,
  danger: (name) => `${name} กำลังเข้าใกล้เขตโทษ.`,
  build: (name, team) => `${team} ต่อเกมจากแนวรับผ่าน ${name}.`,
  carry: (name, team) => `${name} พาบอลขึ้นให้ ${team}.`,  looseAlt: ["ไม่มีใครครองบอลลูกนี้!", "บอลหลุดกลางสนาม!"],
  keeperAlt: [(name, team) => `${name} เก็บบอลและเริ่มเกมให้ ${team}`, (name, team) => `ใจเย็นๆ ${team} ตั้งเกมจากแดนหลังผ่าน ${name}`],
  duelAlt: [(name, oppName) => `${oppName} ประกบ ${name} แน่น!`, (name, oppName) => `ดวลกันดุ — ${name} บังบอลจาก ${oppName}`],
  runAlt: [(name, team) => `${name} เร่งความเร็วให้ ${team}!`, (name, team) => `มีช่องว่างและ ${name} พุ่งเข้าไป!`],
  dangerAlt: [(name) => `${name} เข้าระยะยิงแล้ว!`, (name) => `ระวัง ${name} ใกล้เขตโทษแล้ว!`],
  buildAlt: [(name, team) => `${name} เริ่มบุกให้ ${team}`, (name, team) => `${team} ต่อบอลใจเย็น ${name} คุมเกมแดนหลัง`],
  carryAlt: [(name, team) => `${name} พาบอลให้ ${team}`, (name, team) => `${team} ครองบอล ${name} หาช่อง`, (name, team) => `${name} เงยหน้ามองหาตัวเลือก`],
};

const ja: RadioPack = {
  rejoin: "試合ラジオが放送に戻りました!",
  opening: "みなさんようこそ! 今日は熱い試合になりそうです!",
  kickoff: (team) => `${team} がキックオフです!`,
  foul: (team) => (team ? `ファウルです。${team} のフリーキックです。` : "ファウルがありました。"),
  yellow: (player) => (player ? `${player} にイエローカード!` : "イエローカード!"),
  red: (player) => (player ? `${player} にレッドカード!` : "レッドカード!"),
  penalty: (team) => (team ? `${team} にPKです!` : "PKです!"),
  offside: "オフサイドです!",
  corner: (team) => `${team} のコーナーキックです。`,
  goalkick: "ゴールキック。キーパーが再開します。",
  throwin: (team) => `${team} のスローインです。`,
  pass: (player, target) => `${player} から ${target} へ。`,
  shot: (player) => (player ? `${player} のシュート!` : "シュート!"),
  miss: "わずかに外れました!",
  save: "キーパーの素晴らしいセーブです!",
  halftime: (score) => (score ? `ハーフタイム、${score[0]}-${score[1]}です。` : "ハーフタイムです。"),
  extratime: "延長戦に入ります!",
  fulltime: (score) =>
    score
      ? `試合終了! 最終スコアは ${score[0]}-${score[1]}。試合ラジオをお聞きいただきありがとうございました!`
      : "試合終了! 試合ラジオをお聞きいただきありがとうございました!",
  shootout: "勝負はPK戦にもつれ込みます!",
  penTaker: (player) => `${player} がボールの前に立ちます。`,
  penGoal: "決めた!",
  penMiss: "外した!",
  scoreStatus: (score, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? "スコアはまだ 0対0 です。" : `スコアは ${score[0]}-${score[1]} です。`;
    return score[0] > score[1] ? `${homeTeam} が ${score[0]}-${score[1]} でリードしています。` : `${awayTeam} が ${score[1]}-${score[0]} でリードしています。`;
  },
  scoreReminder: (score, minute, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? `${minute} 分経過してもまだ 0対0 です。` : `${minute} 分経過してスコアは ${score[0]}-${score[1]} です。`;
    return score[0] > score[1]
      ? `${minute} 分経過して ${homeTeam} が ${score[0]}-${score[1]} でリードしています。`
      : `${minute} 分経過して ${awayTeam} が ${score[1]}-${score[0]} でリードしています。`;
  },
  loose: "ルーズボールです!",
  keeper: (name, team) => `${name} が ${team} のためにボールを確保しました。`,
  duel: (name, oppName) => `${name} に ${oppName} がプレッシャーをかけています。`,
  run: (name, team) => `${name} が ${team} のために加速します。`,
  danger: (name) => `${name} がペナルティエリアに近づきます。`,
  build: (name, team) => `${team} は ${name} を使って後方から組み立てます。`,
  carry: (name, team) => `${name} が ${team} のためにボールを運びます。`,  looseAlt: ["誰もこのボールを支配していません!", "中盤でボールがこぼれています!"],
  keeperAlt: [(name, team) => `${name}がキャッチして${team}の攻撃を始めます。`, (name, team) => `落ち着いて、${team}は${name}から後ろで組み立てます。`],
  duelAlt: [(name, oppName) => `${oppName}が${name}に激しく寄せます!`, (name, oppName) => `激しい競り合い、${name}が${oppName}からボールを守ります。`],
  runAlt: [(name, team) => `${name}が${team}のために加速します!`, (name, team) => `スペースが空き、${name}が走り込みます!`],
  dangerAlt: [(name) => `${name}がシュートレンジに入りました!`, (name) => `注意、${name}がペナルティエリアに近づきます!`],
  buildAlt: [(name, team) => `${name}が${team}の攻撃を組み立てます。`, (name, team) => `${team}はじっくりパスを回し、${name}が後ろで指揮します。`],
  carryAlt: [(name, team) => `${name}が${team}のためにボールを運びます。`, (name, team) => `${team}がポゼッション、${name}が隙を探します。`, (name, team) => `${name}が顔を上げてパスコースを探します。`],
};

const ko: RadioPack = {
  rejoin: "경기 라디오가 다시 방송됩니다!",
  opening: "여러분 환영합니다! 오늘은 정말 흥미로운 경기가 기다리고 있습니다!",
  kickoff: (team) => `${team} 이 킥오프합니다!`,
  foul: (team) => (team ? `파울입니다. ${team} 의 프리킥입니다.` : "파울이 선언됐습니다."),
  yellow: (player) => (player ? `${player} 에게 옐로카드!` : "옐로카드!"),
  red: (player) => (player ? `${player} 에게 레드카드!` : "레드카드!"),
  penalty: (team) => (team ? `${team} 의 페널티킥입니다!` : "페널티킥입니다!"),
  offside: "오프사이드입니다!",
  corner: (team) => `${team} 의 코너킥입니다.`,
  goalkick: "골킥입니다. 골키퍼가 다시 시작합니다.",
  throwin: (team) => `${team} 의 스로인입니다.`,
  pass: (player, target) => `${player}, ${target}에게 연결합니다.`,
  shot: (player) => (player ? `${player} 의 슛!` : "슛입니다!"),
  miss: "아슬아슬하게 빗나갑니다!",
  save: "골키퍼의 대단한 선방입니다!",
  halftime: (score) => (score ? `전반 종료, ${score[0]}-${score[1]}입니다.` : "전반 종료입니다."),
  extratime: "연장전으로 갑니다!",
  fulltime: (score) =>
    score
      ? `경기 종료! 최종 스코어는 ${score[0]}-${score[1]}입니다. 경기 라디오를 들어주셔서 감사합니다!`
      : "경기 종료! 경기 라디오를 들어주셔서 감사합니다!",
  shootout: "승부는 승부차기로 이어집니다!",
  penTaker: (player) => `${player} 가 키커로 나섭니다.`,
  penGoal: "골입니다!",
  penMiss: "실축입니다!",
  scoreStatus: (score, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? "아직 0대0입니다." : `스코어는 ${score[0]}-${score[1]}입니다.`;
    return score[0] > score[1] ? `${homeTeam} 이 ${score[0]}-${score[1]}로 앞서고 있습니다.` : `${awayTeam} 이 ${score[1]}-${score[0]}로 앞서고 있습니다.`;
  },
  scoreReminder: (score, minute, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? `${minute}분이 지났지만 아직 0대0입니다.` : `${minute}분이 지나 현재 스코어는 ${score[0]}-${score[1]}입니다.`;
    return score[0] > score[1]
      ? `${minute}분이 지나 ${homeTeam} 이 ${score[0]}-${score[1]}로 앞서고 있습니다.`
      : `${minute}분이 지나 ${awayTeam} 이 ${score[1]}-${score[0]}로 앞서고 있습니다.`;
  },
  loose: "루즈볼입니다!",
  keeper: (name, team) => `${name} 이 ${team} 을 위해 공을 잡았습니다.`,
  duel: (name, oppName) => `${name} 이 ${oppName} 의 압박을 받고 있습니다.`,
  run: (name, team) => `${name} 이 ${team} 을 위해 속도를 올립니다.`,
  danger: (name) => `${name} 이 페널티 지역에 가까워집니다.`,
  build: (name, team) => `${team} 이 ${name} 과 함께 후방에서 전개합니다.`,
  carry: (name, team) => `${name} 이 ${team} 을 위해 공을 몰고 갑니다.`,  looseAlt: ["아무도 이 공을 소유하지 못했습니다!", "미드필드에서 공이 흘렀습니다!"],
  keeperAlt: [(name, team) => `${name} 선수가 공을 잡고 ${team}의 공격을 시작합니다.`, (name, team) => `침착하게, ${team}은 ${name}부터 후방 빌드업입니다.`],
  duelAlt: [(name, oppName) => `${oppName} 선수가 ${name} 선수를 강하게 압박합니다!`, (name, oppName) => `치열한 몸싸움 — ${name} 선수가 ${oppName} 선수로부터 공을 지킵니다.`],
  runAlt: [(name, team) => `${name} 선수가 ${team}을 위해 속도를 올립니다!`, (name, team) => `공간이 열리고 ${name} 선수가 파고듭니다!`],
  dangerAlt: [(name) => `${name} 선수가 슈팅 범위에 들어왔습니다!`, (name) => `조심하세요, ${name} 선수가 페널티 지역에 접근합니다!`],
  buildAlt: [(name, team) => `${name} 선수가 ${team}의 공격을 시작합니다.`, (name, team) => `${team}이 참을성 있게 패스를 돌리고, ${name} 선수가 후방에서 조율합니다.`],
  carryAlt: [(name, team) => `${name} 선수가 ${team}을 위해 공을 몰고 갑니다.`, (name, team) => `${team}의 점유 — ${name} 선수가 틈을 찾습니다.`, (name, team) => `${name} 선수가 고개를 들어 패스길을 찾습니다.`],
};

const zhCN: RadioPack = {
  rejoin: "比赛广播重新回到空中!",
  opening: "欢迎各位! 今天我们将看到一场精彩的比赛!",
  kickoff: (team) => `${team} 开球了!`,
  foul: (team) => (team ? `犯规。${team} 获得任意球。` : "裁判吹罚犯规。"),
  yellow: (player) => (player ? `${player} 吃到黄牌!` : "黄牌!"),
  red: (player) => (player ? `${player} 吃到红牌!` : "红牌!"),
  penalty: (team) => (team ? `${team} 获得点球!` : "点球!"),
  offside: "越位了!",
  corner: (team) => `${team} 获得角球。`,
  goalkick: "球门球。门将将重新开球。",
  throwin: (team) => `${team} 获得界外球。`,
  pass: (player, target) => `${player} 找到 ${target}。`,
  shot: (player) => (player ? `${player} 的射门!` : "射门!"),
  miss: "稍稍偏出!",
  save: "门将的精彩扑救!",
  halftime: (score) => (score ? `半场结束，比分 ${score[0]}-${score[1]}。` : "半场结束。"),
  extratime: "比赛将进入加时赛!",
  fulltime: (score) =>
    score
      ? `比赛结束! 最终比分 ${score[0]}-${score[1]}。感谢收听比赛广播!`
      : "比赛结束! 感谢收听比赛广播!",
  shootout: "一切都将通过点球大战决定!",
  penTaker: (player) => `${player} 走向点球点。`,
  penGoal: "球进了!",
  penMiss: "罚丢了!",
  scoreStatus: (score, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? "比分仍然是 0比0。" : `当前比分 ${score[0]}-${score[1]}。`;
    return score[0] > score[1] ? `${homeTeam} 以 ${score[0]}-${score[1]} 领先。` : `${awayTeam} 以 ${score[1]}-${score[0]} 领先。`;
  },
  scoreReminder: (score, minute, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? `${minute} 分钟过后，比分仍然是 0比0。` : `${minute} 分钟过后，当前比分 ${score[0]}-${score[1]}。`;
    return score[0] > score[1]
      ? `${minute} 分钟过后，${homeTeam} 以 ${score[0]}-${score[1]} 领先。`
      : `${minute} 分钟过后，${awayTeam} 以 ${score[1]}-${score[0]} 领先。`;
  },
  loose: "球权还没定!",
  keeper: (name, team) => `${name} 为 ${team} 控住了球。`,
  duel: (name, oppName) => `${name} 正受到 ${oppName} 的逼抢。`,
  run: (name, team) => `${name} 正为 ${team} 加速推进。`,
  danger: (name) => `${name} 正在接近禁区。`,
  build: (name, team) => `${team} 通过 ${name} 从后场组织进攻。`,
  carry: (name, team) => `${name} 为 ${team} 带球推进。`,  looseAlt: ["没有人控制住这个球!", "中场出现无主球!"],
  keeperAlt: [(name, team) => `${name}将球拿稳，为${team}发起进攻。`, (name, team) => `稳一稳，${team}由${name}从后场组织。`],
  duelAlt: [(name, oppName) => `${oppName}紧紧贴住${name}!`, (name, oppName) => `激烈对抗——${name}护球摆脱${oppName}。`],
  runAlt: [(name, team) => `${name}为${team}提速了!`, (name, team) => `空当出现，${name}果断插上!`],
  dangerAlt: [(name) => `${name}进入射程了!`, (name) => `注意，${name}逼近禁区!`],
  buildAlt: [(name, team) => `${name}为${team}发起进攻组织。`, (name, team) => `${team}耐心倒脚，${name}在后场调度。`],
  carryAlt: [(name, team) => `${name}为${team}带球推进。`, (name, team) => `${team}控球——${name}在寻找空当。`, (name, team) => `${name}抬头观察，寻找出球点。`],
};

const zhTW: RadioPack = {
  rejoin: "比賽廣播重新回到空中!",
  opening: "歡迎各位! 今天我們將看到一場精彩的比賽!",
  kickoff: (team) => `${team} 開球了!`,
  foul: (team) => (team ? `犯規。${team} 獲得自由球。` : "裁判吹罰犯規。"),
  yellow: (player) => (player ? `${player} 吃到黃牌!` : "黃牌!"),
  red: (player) => (player ? `${player} 吃到紅牌!` : "紅牌!"),
  penalty: (team) => (team ? `${team} 獲得點球!` : "點球!"),
  offside: "越位了!",
  corner: (team) => `${team} 獲得角球。`,
  goalkick: "球門球。門將將重新開球。",
  throwin: (team) => `${team} 獲得界外球。`,
  pass: (player, target) => `${player} 找到 ${target}。`,
  shot: (player) => (player ? `${player} 的射門!` : "射門!"),
  miss: "差一點偏出!",
  save: "門將的精彩撲救!",
  halftime: (score) => (score ? `半場結束，比數 ${score[0]}-${score[1]}。` : "半場結束。"),
  extratime: "比賽將進入延長賽!",
  fulltime: (score) =>
    score
      ? `比賽結束! 最終比數 ${score[0]}-${score[1]}。感謝收聽比賽廣播!`
      : "比賽結束! 感謝收聽比賽廣播!",
  shootout: "一切都將由點球大戰決定!",
  penTaker: (player) => `${player} 走向點球點。`,
  penGoal: "進球了!",
  penMiss: "踢丟了!",
  scoreStatus: (score, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? "比數仍然是 0比0。" : `目前比數 ${score[0]}-${score[1]}。`;
    return score[0] > score[1] ? `${homeTeam} 以 ${score[0]}-${score[1]} 領先。` : `${awayTeam} 以 ${score[1]}-${score[0]} 領先。`;
  },
  scoreReminder: (score, minute, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? `${minute} 分鐘過後，比數仍然是 0比0。` : `${minute} 分鐘過後，目前比數 ${score[0]}-${score[1]}。`;
    return score[0] > score[1]
      ? `${minute} 分鐘過後，${homeTeam} 以 ${score[0]}-${score[1]} 領先。`
      : `${minute} 分鐘過後，${awayTeam} 以 ${score[1]}-${score[0]} 領先。`;
  },
  loose: "球權還沒確定!",
  keeper: (name, team) => `${name} 為 ${team} 控住了球。`,
  duel: (name, oppName) => `${name} 正受到 ${oppName} 的壓迫。`,
  run: (name, team) => `${name} 正為 ${team} 加速推進。`,
  danger: (name) => `${name} 正在接近禁區。`,
  build: (name, team) => `${team} 透過 ${name} 從後場組織進攻。`,
  carry: (name, team) => `${name} 為 ${team} 帶球推進。`,  looseAlt: ["沒有人控制住這顆球!", "中場出現無主球!"],
  keeperAlt: [(name, team) => `${name}將球拿穩，為${team}發起進攻。`, (name, team) => `穩一穩，${team}由${name}從後場組織。`],
  duelAlt: [(name, oppName) => `${oppName}緊緊貼住${name}!`, (name, oppName) => `激烈對抗——${name}護球擺脫${oppName}。`],
  runAlt: [(name, team) => `${name}為${team}提速了!`, (name, team) => `空檔出現，${name}果斷插上!`],
  dangerAlt: [(name) => `${name}進入射程了!`, (name) => `注意，${name}逼近禁區!`],
  buildAlt: [(name, team) => `${name}為${team}發起進攻組織。`, (name, team) => `${team}耐心傳導，${name}在後場調度。`],
  carryAlt: [(name, team) => `${name}為${team}帶球推進。`, (name, team) => `${team}控球——${name}在尋找空檔。`, (name, team) => `${name}抬頭觀察，尋找出球點。`],
};


const ro: RadioPack = {
  rejoin: "Radioul meciului e din nou in emisie!",
  opening: "Bun venit tuturor! Urmeaza un meci pe cinste!",
  kickoff: (team) => `${team} pun mingea in joc!`,
  foul: (team) => (team ? `Fault. Lovitura libera pentru ${team}.` : "Fault fluierat."),
  yellow: (player) => (player ? `Cartonas galben pentru ${player}!` : "Cartonas galben!"),
  red: (player) => (player ? `Cartonas rosu pentru ${player}!` : "Cartonas rosu!"),
  penalty: (team) => (team ? `Penalty pentru ${team}!` : "Penalty!"),
  offside: "Ofsaid semnalizat!",
  corner: (team) => `Corner pentru ${team}.`,
  goalkick: "Lovitura de poarta. Portarul repune mingea.",
  throwin: (team) => `Aut pentru ${team}.`,
  pass: (player, target) => `${player} il gaseste pe ${target}.`,
  shot: (player) => (player ? `Sutul lui ${player}!` : "Ce sut!"),
  miss: "Putin pe langa!",
  save: "Ce interventie a portarului!",
  halftime: (score) => (score ? `Pauza, ${score[0]}-${score[1]}.` : "Pauza."),
  extratime: "Mergem in prelungiri!",
  fulltime: (score) =>
    score
      ? `Final de meci! Scor final, ${score[0]}-${score[1]}. Multumim ca ati ascultat radioul meciului!`
      : "Final de meci! Multumim ca ati ascultat radioul meciului!",
  shootout: "Se decide la penalty-uri!",
  penTaker: (player) => `${player} se pregateste sa execute.`,
  penGoal: "Inscrie!",
  penMiss: "Rateaza!",
  scoreStatus: (score, homeTeam, awayTeam) => {
    if (score[0] === score[1]) return score[0] === 0 ? "Inca 0-0." : `Este ${score[0]}-${score[1]} in acest meci.`;
    return score[0] > score[1] ? `${homeTeam} conduce cu ${score[0]}-${score[1]}.` : `${awayTeam} conduce cu ${score[1]}-${score[0]}.`;
  },
  scoreReminder: (score, minute, homeTeam, awayTeam) => {
    if (score[0] === score[1]) {
      return score[0] === 0 ? `Dupa ${minute} minute, tot 0-0.` : `Dupa ${minute} minute, este ${score[0]}-${score[1]}.`;
    }
    return score[0] > score[1]
      ? `Dupa ${minute} minute, ${homeTeam} conduce cu ${score[0]}-${score[1]}.`
      : `Dupa ${minute} minute, ${awayTeam} conduce cu ${score[1]}-${score[0]}.`;
  },
  loose: "Minge libera!",
  keeper: (name, team) => `${name} o are in siguranta pentru ${team}.`,
  duel: (name, oppName) => `${name} este presat de ${oppName}.`,
  run: (name, team) => `${name} accelereaza pentru ${team}.`,
  danger: (name) => `${name} se apropie de careu.`,
  build: (name, team) => `${team} construiesc din spate prin ${name}.`,
  carry: (name, team) => `${name} are mingea pentru ${team}.`,  looseAlt: ["Nimeni nu controleaza mingea!", "Minge libera la mijlocul terenului!"],
  keeperAlt: [(name, team) => `${name} o prinde si repune pentru ${team}.`, (name, team) => `Cu calm, ${team} construiesc din spate prin ${name}.`],
  duelAlt: [(name, oppName) => `${oppName} il preseaza strans pe ${name}!`, (name, oppName) => `Duel tare — ${name} protejeaza mingea de ${oppName}.`],
  runAlt: [(name, team) => `${name} accelereaza pentru ${team}!`, (name, team) => `S-a deschis spatiul si ${name} ataca!`],
  dangerAlt: [(name) => `${name} intra in zona de sut!`, (name) => `Atentie, ${name} se apropie de careu!`],
  buildAlt: [(name, team) => `${name} porneste actiunea pentru ${team}.`, (name, team) => `${team} paseaza cu rabdare, ${name} dirijeaza din spate.`],
  carryAlt: [(name, team) => `${name} duce mingea pentru ${team}.`, (name, team) => `Posesie ${team}, ${name} cauta culoarul.`, (name, team) => `${name} ridica privirea si cauta o solutie.`],
};

const RADIO_PACKS: Record<AppLanguage, RadioPack> = {
  fr,
  en,
  es,
  pt,
  de,
  nb,
  it,
  ga,
  nl,
  hr,
  pl,
  tr,
  ru,
  uk,
  ar,
  ro,
  hi,
  id,
  vi,
  th,
  ja,
  ko,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
};

export function getRadioPack(language: AppLanguage): RadioPack {
  return RADIO_PACKS[language] ?? RADIO_PACKS.en;
}
