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
}

const SPEECH_LOCALE_BY_LANGUAGE: Record<AppLanguage, string> = {
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
  carry: (name, team) => `${name} conduce para ${team}.`,
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
  carry: (name, team) => `${name} conduz a bola para ${team}.`,
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
  carry: (name, team) => `${name} am Ball für ${team}.`,
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
  carry: (name, team) => `${name} fører ballen for ${team}.`,
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
  carry: (name, team) => `${name} porta palla per ${team}.`,
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
  carry: (name, team) => `Tá ${name} ar an liathróid do ${team}.`,
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
  carry: (name, team) => `${name} aan de bal voor ${team}.`,
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
  carry: (name, team) => `${name} vodi loptu za ${team}.`,
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
  carry: (name, team) => `${name} prowadzi piłkę dla ${team}.`,
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
  carry: (name, team) => `${name} topu ${team} adına taşıyor.`,
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
  carry: (name, team) => `${name} ведет мяч за ${team}.`,
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
  carry: (name, team) => `${name} веде м'яч за ${team}.`,
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
  carry: (name, team) => `${name} يحمل الكرة لصالح ${team}.`,
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
  carry: (name, team) => `${name}, ${team} के लिए गेंद लेकर चल रहे हैं।`,
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
  carry: (name, team) => `${name} membawa bola untuk ${team}.`,
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
  carry: (name, team) => `${name} đang cầm bóng cho ${team}.`,
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
  carry: (name, team) => `${name} พาบอลขึ้นให้ ${team}.`,
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
  carry: (name, team) => `${name} が ${team} のためにボールを運びます。`,
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
  carry: (name, team) => `${name} 이 ${team} 을 위해 공을 몰고 갑니다.`,
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
  carry: (name, team) => `${name} 为 ${team} 带球推进。`,
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
  carry: (name, team) => `${name} 為 ${team} 帶球推進。`,
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
