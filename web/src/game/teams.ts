/** Any playable side: the five hand-built nationals, or a generated
 *  `club-…` id for every club of the CLUB-tab catalog. */
export type NationalTeamId = string;

export const NATIONAL_IDS = ["france", "england", "argentina", "portugal", "norway"] as const;

import { LEAGUES, type League } from "./clubs";

export interface NationalTeamPlayer {
  id: number;
  name: string;
  pos: string;
  rating: number;
  photo?: string;
}

export interface NationalTeam {
  id: NationalTeamId;
  label: string;
  radioLabel: string;
  color: string;
  shorts: string;
  squad: NationalTeamPlayer[];
  defaultLineup: number[];
}

export const LINEUP_SLOT_LAYOUT = [
  { x: 50, y: 90 },
  { x: 18, y: 69 },
  { x: 38, y: 72 },
  { x: 62, y: 72 },
  { x: 82, y: 69 },
  { x: 34, y: 49 },
  { x: 66, y: 49 },
  { x: 50, y: 42 },
  { x: 24, y: 18 },
  { x: 50, y: 9 },
  { x: 76, y: 18 },
] as const;

export const NATIONAL_TEAM_ORDER: NationalTeamId[] = [
  "france",
  "england",
  "argentina",
  "portugal",
  "norway",
];

export const DEFAULT_NATIONAL_TEAM: NationalTeamId = "france";

const OPPONENT_BY_TEAM: Record<NationalTeamId, NationalTeamId> = {
  france: "england",
  england: "argentina",
  argentina: "portugal",
  portugal: "france",
  norway: "france",
};

interface TeamSeed {
  id: NationalTeamId;
  label: string;
  radioLabel: string;
  color: string;
  shorts: string;
  players: Array<Omit<NationalTeamPlayer, "id">>;
  defaultLineupNames?: string[];
}

let nextPlayerId = 1;

function buildTeam(seed: TeamSeed): NationalTeam {
  const squad = seed.players.map((player) => ({ ...player, id: nextPlayerId++ }));
  const byName = new Map(squad.map((player) => [player.name, player]));
  const defaultNames = seed.defaultLineupNames ?? squad.slice(0, 11).map((player) => player.name);
  const defaultLineup = defaultNames
    .map((name) => byName.get(name)?.id ?? null)
    .filter((id): id is number => id !== null);
  return {
    id: seed.id,
    label: seed.label,
    radioLabel: seed.radioLabel,
    color: seed.color,
    shorts: seed.shorts,
    squad,
    defaultLineup,
  };
}

const teams = NATIONAL_TEAM_ORDER.map((id) => id);

const FRANCE = buildTeam({
  id: "france",
  label: "France",
  radioLabel: "la France",
  color: "#2459d6",
  shorts: "#f4f7ff",
  players: [
    { name: "Mike Maignan", pos: "GB", rating: 87 },
    { name: "Jules Kounde", pos: "DD", rating: 85 },
    { name: "William Saliba", pos: "DC", rating: 88 },
    { name: "Dayot Upamecano", pos: "DC", rating: 86 },
    { name: "Lucas Digne", pos: "DG", rating: 82 },
    { name: "Aurelien Tchouameni", pos: "MDC", rating: 86 },
    { name: "N'Golo Kante", pos: "MC", rating: 85 },
    { name: "Rayan Cherki", pos: "MOC", rating: 84 },
    { name: "Bradley Barcola", pos: "AG", rating: 84 },
    { name: "Kylian Mbappe", pos: "BU", rating: 92 },
    { name: "Ousmane Dembele", pos: "AD", rating: 88 },
    { name: "Brice Samba", pos: "GB", rating: 81 },
    { name: "Robin Risser", pos: "GB", rating: 74 },
    { name: "Malo Gusto", pos: "DD", rating: 80 },
    { name: "Ibrahima Konate", pos: "DC", rating: 86 },
    { name: "Theo Hernandez", pos: "DG", rating: 86 },
    { name: "Lucas Hernandez", pos: "DG", rating: 84 },
    { name: "Maxence Lacroix", pos: "DC", rating: 80 },
    { name: "Manu Kone", pos: "MC", rating: 82 },
    { name: "Adrien Rabiot", pos: "MC", rating: 83 },
    { name: "Warren Zaire-Emery", pos: "MC", rating: 82 },
    { name: "Maghnes Akliouche", pos: "MOC", rating: 80 },
    { name: "Marcus Thuram", pos: "BU", rating: 84 },
    { name: "Michael Olise", pos: "AD", rating: 84 },
    { name: "Desire Doue", pos: "AG", rating: 82 },
    { name: "Jean-Philippe Mateta", pos: "BU", rating: 81 },
    { name: "Lucas Chevalier", pos: "GB", rating: 80 },
    { name: "Benjamin Pavard", pos: "DC", rating: 82 },
    { name: "Loic Bade", pos: "DC", rating: 80 },
    { name: "Clement Lenglet", pos: "DC", rating: 79 },
    { name: "Jonathan Clauss", pos: "DD", rating: 80 },
    { name: "Pierre Kalulu", pos: "DD", rating: 79 },
    { name: "Eduardo Camavinga", pos: "MC", rating: 84 },
    { name: "Matteo Guendouzi", pos: "MC", rating: 80 },
    { name: "Khephren Thuram", pos: "MC", rating: 81 },
    { name: "Florian Thauvin", pos: "AD", rating: 79 },
    { name: "Kingsley Coman", pos: "AG", rating: 84 },
    { name: "Randal Kolo Muani", pos: "BU", rating: 82 },
    { name: "Christopher Nkunku", pos: "MOC", rating: 83 },
    {
      name: "Hugo Ekitike",
      pos: "BU",
      rating: 81,
      photo:
        "https://backend.liverpoolfc.com/sites/default/files/styles/xs/public/2026-06/hugo-ekitike-2026-27-body-shot_a170f152368cb434d055d6dd13698085.webp?itok=optavXDp",
    },
  ],
  defaultLineupNames: [
    "Mike Maignan",
    "Michael Olise",
    "Desire Doue",
    "Dayot Upamecano",
    "Lucas Digne",
    "Aurelien Tchouameni",
    "Adrien Rabiot",
    "Rayan Cherki",
    "Bradley Barcola",
    "Kylian Mbappe",
    "Ousmane Dembele",
  ],
});

const ENGLAND = buildTeam({
  id: "england",
  label: "Angleterre",
  radioLabel: "l'Angleterre",
  color: "#f2f2f2",
  shorts: "#153a8a",
  players: [
    { name: "Jordan Pickford", pos: "GB", rating: 84 },
    { name: "Trent Alexander-Arnold", pos: "DD", rating: 86 },
    { name: "John Stones", pos: "DC", rating: 85 },
    { name: "Marc Guehi", pos: "DC", rating: 82 },
    { name: "Luke Shaw", pos: "DG", rating: 81 },
    { name: "Declan Rice", pos: "MDC", rating: 88 },
    { name: "Jude Bellingham", pos: "MC", rating: 91 },
    { name: "Cole Palmer", pos: "MOC", rating: 89 },
    { name: "Phil Foden", pos: "AG", rating: 89 },
    { name: "Harry Kane", pos: "BU", rating: 90 },
    { name: "Bukayo Saka", pos: "AD", rating: 89 },
    { name: "Aaron Ramsdale", pos: "GB", rating: 80 },
    { name: "Dean Henderson", pos: "GB", rating: 79 },
    { name: "Kyle Walker", pos: "DD", rating: 82 },
    { name: "Ezri Konsa", pos: "DC", rating: 82 },
    { name: "Levi Colwill", pos: "DC", rating: 81 },
    { name: "Ben Chilwell", pos: "DG", rating: 79 },
    { name: "Kobbie Mainoo", pos: "MC", rating: 82 },
    { name: "Conor Gallagher", pos: "MC", rating: 80 },
    { name: "Curtis Jones", pos: "MC", rating: 80 },
    { name: "Eberechi Eze", pos: "MOC", rating: 83 },
    { name: "Anthony Gordon", pos: "AG", rating: 82 },
    { name: "Jarrod Bowen", pos: "AD", rating: 82 },
    { name: "Ollie Watkins", pos: "BU", rating: 85 },
  ],
});

const ARGENTINA = buildTeam({
  id: "argentina",
  label: "Argentine",
  radioLabel: "l'Argentine",
  color: "#77d4ff",
  shorts: "#f4f7ff",
  players: [
    { name: "Emiliano Martinez", pos: "GB", rating: 88 },
    { name: "Nahuel Molina", pos: "DD", rating: 82 },
    { name: "Cristian Romero", pos: "DC", rating: 87 },
    { name: "Nicolas Otamendi", pos: "DC", rating: 82 },
    { name: "Nicolas Tagliafico", pos: "DG", rating: 81 },
    { name: "Rodrigo De Paul", pos: "MDC", rating: 84 },
    { name: "Enzo Fernandez", pos: "MC", rating: 86 },
    { name: "Alexis Mac Allister", pos: "MOC", rating: 87 },
    { name: "Lionel Messi", pos: "AG", rating: 90 },
    { name: "Julian Alvarez", pos: "BU", rating: 86 },
    { name: "Lautaro Martinez", pos: "AD", rating: 88 },
    { name: "Geronimo Rulli", pos: "GB", rating: 79 },
    { name: "Walter Benitez", pos: "GB", rating: 78 },
    { name: "Gonzalo Montiel", pos: "DD", rating: 78 },
    { name: "German Pezzella", pos: "DC", rating: 78 },
    { name: "Lisandro Martinez", pos: "DC", rating: 84 },
    { name: "Valentin Barco", pos: "DG", rating: 77 },
    { name: "Leandro Paredes", pos: "MC", rating: 81 },
    { name: "Exequiel Palacios", pos: "MC", rating: 80 },
    { name: "Giovani Lo Celso", pos: "MOC", rating: 81 },
    { name: "Nicolas Gonzalez", pos: "AG", rating: 80 },
    { name: "Angel Di Maria", pos: "AD", rating: 82 },
    { name: "Paulo Dybala", pos: "MOC", rating: 84 },
    { name: "Alejandro Garnacho", pos: "AG", rating: 82 },
  ],
});

const PORTUGAL = buildTeam({
  id: "portugal",
  label: "Portugal",
  radioLabel: "le Portugal",
  color: "#b21924",
  shorts: "#197c3d",
  players: [
    { name: "Diogo Costa", pos: "GB", rating: 86 },
    { name: "Joao Cancelo", pos: "DD", rating: 84 },
    { name: "Ruben Dias", pos: "DC", rating: 88 },
    { name: "Goncalo Inacio", pos: "DC", rating: 84 },
    { name: "Nuno Mendes", pos: "DG", rating: 85 },
    { name: "Joao Neves", pos: "MDC", rating: 84 },
    { name: "Vitinha", pos: "MC", rating: 86 },
    { name: "Bruno Fernandes", pos: "MOC", rating: 88 },
    { name: "Rafael Leao", pos: "AG", rating: 86 },
    { name: "Cristiano Ronaldo", pos: "BU", rating: 86 },
    { name: "Bernardo Silva", pos: "AD", rating: 88 },
    { name: "Jose Sa", pos: "GB", rating: 79 },
    { name: "Rui Patricio", pos: "GB", rating: 77 },
    { name: "Diogo Dalot", pos: "DD", rating: 82 },
    { name: "Antonio Silva", pos: "DC", rating: 81 },
    { name: "Danilo Pereira", pos: "DC", rating: 79 },
    { name: "Nuno Tavares", pos: "DG", rating: 77 },
    { name: "Palhinha", pos: "MC", rating: 82 },
    { name: "Ruben Neves", pos: "MC", rating: 82 },
    { name: "Pedro Goncalves", pos: "MOC", rating: 81 },
    { name: "Joao Felix", pos: "AG", rating: 81 },
    { name: "Pedro Neto", pos: "AD", rating: 82 },
    { name: "Goncalo Ramos", pos: "BU", rating: 82 },
    { name: "Francisco Conceicao", pos: "AD", rating: 80 },
  ],
});

const NORWAY = buildTeam({
  id: "norway",
  label: "Norvege",
  radioLabel: "la Norvege",
  color: "#d8342c",
  shorts: "#f4f7ff",
  players: [
    { name: "Orjan Nyland", pos: "GB", rating: 77 },
    { name: "Julian Ryerson", pos: "DD", rating: 80 },
    { name: "Kristoffer Ajer", pos: "DC", rating: 78 },
    { name: "Leo Ostigard", pos: "DC", rating: 78 },
    { name: "David Moller Wolfe", pos: "DG", rating: 76 },
    { name: "Sander Berge", pos: "MDC", rating: 79 },
    { name: "Martin Odegaard", pos: "MC", rating: 89 },
    { name: "Patrick Berg", pos: "MOC", rating: 77 },
    { name: "Antonio Nusa", pos: "AG", rating: 82 },
    { name: "Erling Haaland", pos: "BU", rating: 92 },
    { name: "Alexander Sorloth", pos: "AD", rating: 84 },
    { name: "Mathias Dyngeland", pos: "GB", rating: 73 },
    { name: "Egil Selvik", pos: "GB", rating: 72 },
    { name: "Marcus Pedersen", pos: "DD", rating: 74 },
    { name: "Stian Gregersen", pos: "DC", rating: 74 },
    { name: "Torbjorn Heggem", pos: "DC", rating: 73 },
    { name: "Birger Meling", pos: "DG", rating: 75 },
    { name: "Morten Thorsby", pos: "MC", rating: 76 },
    { name: "Thelo Aasgaard", pos: "MC", rating: 74 },
    { name: "Andreas Schjelderup", pos: "MOC", rating: 78 },
    { name: "Oscar Bobb", pos: "AG", rating: 79 },
    { name: "Jorgen Strand Larsen", pos: "BU", rating: 80 },
    { name: "Kristian Thorstvedt", pos: "MC", rating: 77 },
    { name: "Aron Donnum", pos: "AD", rating: 75 },
  ],
});

export const NATIONAL_TEAMS: Record<NationalTeamId, NationalTeam> = {
  france: FRANCE,
  england: ENGLAND,
  argentina: ARGENTINA,
  portugal: PORTUGAL,
  norway: NORWAY,
};

export const NATIONAL_TEAM_OPTIONS = teams.map((id) => ({
  id,
  label: NATIONAL_TEAMS[id].label,
}));

let configuredSides: [NationalTeamId, NationalTeamId] = [
  DEFAULT_NATIONAL_TEAM,
  OPPONENT_BY_TEAM[DEFAULT_NATIONAL_TEAM],
];

export function getNationalTeam(id: NationalTeamId): NationalTeam {
  return NATIONAL_TEAMS[id];
}

export function getOpponentTeamId(id: NationalTeamId): NationalTeamId {
  const fixed = OPPONENT_BY_TEAM[id];
  if (fixed) return fixed;
  // a club's default rival: the next club of its own league
  return nextMatchTeamId(id, id);
}

export function getPreviewMatchSides(
  selectedTeam: NationalTeamId,
  humanSide: 0 | 1,
): [NationalTeam, NationalTeam] {
  const human = getNationalTeam(selectedTeam);
  const ai = getNationalTeam(getOpponentTeamId(selectedTeam));
  return humanSide === 0 ? [human, ai] : [ai, human];
}

export function getPreviewMatchSidesFor(
  humanTeamId: NationalTeamId,
  opponentTeamId: NationalTeamId,
  humanSide: 0 | 1,
): [NationalTeam, NationalTeam] {
  const human = getNationalTeam(humanTeamId);
  const ai = getNationalTeam(opponentTeamId);
  return humanSide === 0 ? [human, ai] : [ai, human];
}

export function configureMatchSides(
  selectedTeam: NationalTeamId,
  humanSide: 0 | 1,
): [NationalTeam, NationalTeam] {
  const sides = getPreviewMatchSides(selectedTeam, humanSide);
  configuredSides = [sides[0].id, sides[1].id];
  return sides;
}

export function getConfiguredMatchTeam(side: 0 | 1): NationalTeam {
  return getNationalTeam(configuredSides[side]);
}

export function getConfiguredMatchSides(): [NationalTeam, NationalTeam] {
  return [getConfiguredMatchTeam(0), getConfiguredMatchTeam(1)];
}

/** Configure a match with an EXPLICIT opponent (the pre-match setup screen lets
 *  the player pick both sides, not just their own with a fixed rival). */
export function configureMatchSidesFor(
  humanTeamId: NationalTeamId,
  opponentTeamId: NationalTeamId,
  humanSide: 0 | 1,
): [NationalTeam, NationalTeam] {
  const sides = getPreviewMatchSidesFor(humanTeamId, opponentTeamId, humanSide);
  configuredSides = [sides[0].id, sides[1].id];
  return sides;
}

/** Team overall: the rounded average rating of the starting eleven. */
export function getTeamOverall(id: NationalTeamId): number {
  const team = getNationalTeam(id);
  const byId = new Map(team.squad.map((player) => [player.id, player]));
  const starters = team.defaultLineup
    .map((pid) => byId.get(pid)?.rating ?? 0)
    .filter((rating) => rating > 0);
  if (!starters.length) return 0;
  return Math.round(starters.reduce((sum, r) => sum + r, 0) / starters.length);
}

/** Captain: the highest-rated outfield starter (skips the keeper — pos "GB"). */
export function getTeamCaptain(id: NationalTeamId): NationalTeamPlayer {
  const team = getNationalTeam(id);
  const byId = new Map(team.squad.map((player) => [player.id, player]));
  const starters = team.defaultLineup
    .map((pid) => byId.get(pid))
    .filter((p): p is NationalTeamPlayer => !!p);
  const outfield = starters.filter((p) => p.pos !== "GB");
  const pool = outfield.length ? outfield : starters;
  return pool.reduce((best, p) => (p.rating > best.rating ? p : best), pool[0]!);
}

/** Emoji flag per side, for the match-setup screen. */
export const TEAM_FLAG: Record<NationalTeamId, string> = {
  france: "🇫🇷",
  england: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  argentina: "🇦🇷",
  portugal: "🇵🇹",
  norway: "🇳🇴",
};

export function getDefaultLineupIds(teamId: NationalTeamId): number[] {
  return [...getNationalTeam(teamId).defaultLineup];
}

export function getDefaultLineupNames(teamId: NationalTeamId): string[] {
  const team = getNationalTeam(teamId);
  const byId = new Map(team.squad.map((player) => [player.id, player]));
  return team.defaultLineup.map((id) => byId.get(id)?.name ?? "");
}

export function isNationalTeamId(value: string): value is NationalTeamId {
  return value in NATIONAL_TEAMS;
}

// ---------------------------------------------------------------------------
// Club teams: every club of the CLUB-tab catalog is a playable side. Squads
// are generated deterministically — names flavored by the league's country,
// ratings from the club's fame (catalog order) — and registered alongside the
// nationals so the whole match pipeline (lineup, kits, radio) just works.
// ---------------------------------------------------------------------------

const CLUB_POSITIONS = [
  "GB", "DD", "DC", "DC", "DG", "MDC", "MC", "MOC", "AG", "BU", "AD",
  "GB", "DD", "DC", "DG", "MC", "MOC", "BU",
];

const CLUB_FIRST: Record<string, string[]> = {
  fr: ["Lucas", "Hugo", "Théo", "Enzo", "Léo", "Nathan", "Tom", "Mathis", "Noah", "Ethan", "Louis", "Jules", "Adam", "Maël", "Rayan", "Sacha"],
  en: ["Jack", "Harry", "Oliver", "George", "Charlie", "Jacob", "Alfie", "Freddie", "Oscar", "Archie", "Henry", "Theo", "Leo", "Finley", "Mason", "Callum"],
  es: ["Pablo", "Álvaro", "Hugo", "Mario", "Daniel", "Javier", "Adrián", "Diego", "Marcos", "Iker", "Sergio", "Carlos", "Rubén", "Iván", "Raúl", "Mikel"],
  it: ["Marco", "Luca", "Alessandro", "Andrea", "Matteo", "Lorenzo", "Davide", "Simone", "Federico", "Riccardo", "Gabriele", "Antonio", "Giuseppe", "Nicolò", "Tommaso", "Pietro"],
  de: ["Leon", "Finn", "Jonas", "Luis", "Paul", "Felix", "Maximilian", "Elias", "Julian", "Moritz", "Niklas", "Tim", "Jan", "Fabian", "David", "Nico"],
  eu: ["João", "Rúben", "Sven", "Daan", "Callum", "Ewan", "Emre", "Kaan", "Thibaut", "Milan", "Mateo", "Nicolás", "Kaio", "Rafael", "Omar", "Diego"],
};
const CLUB_LAST: Record<string, string[]> = {
  fr: ["Martin", "Bernard", "Dubois", "Moreau", "Laurent", "Garnier", "Rousseau", "Blanc", "Guérin", "Chevalier", "Perrin", "Marchand", "Dupont", "Fontaine", "Lambert", "Renard"],
  en: ["Smith", "Jones", "Taylor", "Brown", "Wilson", "Evans", "Walker", "Wright", "Hughes", "Turner", "Parker", "Collins", "Bennett", "Murphy", "Cooper", "Foster"],
  es: ["García", "López", "Martínez", "Sánchez", "Pérez", "Gómez", "Fernández", "Torres", "Ramírez", "Navarro", "Moreno", "Ortega", "Delgado", "Castro", "Vargas", "Molina"],
  it: ["Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco", "Bruno", "Gallo", "Conti", "De Luca", "Costa", "Rizzo"],
  de: ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Wagner", "Becker", "Hoffmann", "Koch", "Richter", "Klein", "Wolf", "Schröder", "Neumann", "Braun", "Krüger"],
  eu: ["Silva", "Santos", "De Jong", "Van Dijk", "MacLeod", "Yilmaz", "Öztürk", "Peeters", "Kovač", "Fernández", "Costa", "Oliveira", "Souza", "Petrov", "Papas", "Haddad"],
};

/** Deterministic string hash (fnv-ish) for stable generated squads. */
function clubHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clubSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Stable playable-team id for a catalog club. */
export function clubTeamId(name: string): NationalTeamId {
  return `club-${clubSlug(name)}`;
}

const LEAGUE_BY_TEAM_ID = new Map<string, League>();

function buildClubTeam(league: League, clubIndex: number): NationalTeam {
  const club = league.clubs[clubIndex]!;
  const id = clubTeamId(club.name);
  const firsts = CLUB_FIRST[league.id] ?? CLUB_FIRST.eu!;
  const lasts = CLUB_LAST[league.id] ?? CLUB_LAST.eu!;
  // fame: catalog order (PSG/Real/Arsenal first) sets the squad's level
  const prestige = Math.max(74, (league.id === "eu" ? 85 : 88) - clubIndex * 0.7);
  const seed = clubHash(club.name);
  const used = new Set<string>();
  const players = CLUB_POSITIONS.map((pos, i) => {
    let name = "";
    for (let attempt = 0; attempt < 8 && (!name || used.has(name)); attempt++) {
      const h = clubHash(`${seed}:${i}:${attempt}`);
      name = `${firsts[h % firsts.length]} ${lasts[(h >> 8) % lasts.length]}`;
    }
    used.add(name);
    const jitter = ((clubHash(`${seed}r${i}`) % 700) / 100) - 3; // -3..+4
    const bench = i >= 11 ? -2 : 0;
    return {
      name,
      pos,
      rating: Math.round(Math.min(93, Math.max(70, prestige + jitter + bench))),
    };
  });
  return buildTeam({
    id,
    label: club.name,
    radioLabel: club.name,
    color: club.color,
    shorts: club.color2,
    players,
  });
}

for (const league of LEAGUES) {
  for (let i = 0; i < league.clubs.length; i++) {
    const team = buildClubTeam(league, i);
    (NATIONAL_TEAMS as Record<string, NationalTeam>)[team.id] = team;
    LEAGUE_BY_TEAM_ID.set(team.id, league);
  }
}

/** Kind of side an id is: hand-built national or generated club. */
export function isClubTeamId(id: NationalTeamId): boolean {
  return LEAGUE_BY_TEAM_ID.has(id);
}

/** Flag for the matchup screen: national flag, or the club's league flag. */
export function getTeamFlag(id: NationalTeamId): string {
  return TEAM_FLAG[id] ?? LEAGUE_BY_TEAM_ID.get(id)?.flag ?? "⚽";
}

/** Cycle to the next side in the SAME group (nationals, or the club's league),
 *  never landing on `avoid` — the matchup screen's change buttons. */
export function nextMatchTeamId(current: NationalTeamId, avoid: NationalTeamId): NationalTeamId {
  const league = LEAGUE_BY_TEAM_ID.get(current);
  const order: NationalTeamId[] = league
    ? league.clubs.map((club) => clubTeamId(club.name))
    : [...NATIONAL_IDS];
  const start = order.indexOf(current);
  for (let step = 1; step <= order.length; step++) {
    const candidate = order[(start + step) % order.length]!;
    if (candidate !== avoid) return candidate;
  }
  return current;
}
