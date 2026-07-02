/** Any playable side: the five hand-built nationals, or a curated
 *  `club-…` id for clubs that have a real-player squad. */
export type NationalTeamId = string;

export const NATIONAL_IDS = ["france", "england", "argentina", "portugal", "norway"] as const;

import { LEAGUES, type League } from "./clubs";
import { REAL_CLUB_SQUADS } from "./clubSquads";

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
// Club teams: only clubs with curated real-player squads are registered as
// playable sides, so the club menu never falls back to invented footballers.
// ---------------------------------------------------------------------------

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

export function hasRealClubSquad(name: string): boolean {
  return Boolean(REAL_CLUB_SQUADS[name]?.length);
}

const LEAGUE_BY_TEAM_ID = new Map<string, League>();
const PLAYABLE_CLUB_IDS_BY_LEAGUE = new Map<string, NationalTeamId[]>();
const TEAM_BADGE_URL_CACHE = new Map<NationalTeamId, string | null>();
const TEAM_BADGE_PENDING = new Map<NationalTeamId, Promise<string | null>>();

const TEAM_WIKIPEDIA_PAGE_BY_ID: Partial<Record<NationalTeamId, string>> = {
  france: "France_national_football_team",
  england: "England_national_football_team",
  argentina: "Argentina_national_football_team",
  portugal: "Portugal_national_football_team",
  norway: "Norway_national_football_team",
  [clubTeamId("Paris Saint-Germain")]: "Paris_Saint-Germain_FC",
  [clubTeamId("Olympique de Marseille")]: "Olympique_de_Marseille",
  [clubTeamId("Olympique Lyonnais")]: "Olympique_Lyonnais",
  [clubTeamId("AS Monaco")]: "AS_Monaco_FC",
  [clubTeamId("LOSC Lille")]: "Lille_OSC",
  [clubTeamId("OGC Nice")]: "OGC_Nice",
  [clubTeamId("RC Lens")]: "RC_Lens",
  [clubTeamId("Stade Rennais")]: "Stade_Rennais_FC",
  [clubTeamId("RC Strasbourg")]: "RC_Strasbourg_Alsace",
  [clubTeamId("Toulouse FC")]: "Toulouse_FC",
  [clubTeamId("FC Nantes")]: "FC_Nantes",
  [clubTeamId("Stade Brestois")]: "Stade_Brestois_29",
  [clubTeamId("Arsenal")]: "Arsenal_F.C.",
  [clubTeamId("Liverpool")]: "Liverpool_F.C.",
  [clubTeamId("Manchester City")]: "Manchester_City_F.C.",
  [clubTeamId("Manchester United")]: "Manchester_United_F.C.",
  [clubTeamId("Chelsea")]: "Chelsea_F.C.",
  [clubTeamId("Tottenham Hotspur")]: "Tottenham_Hotspur_F.C.",
  [clubTeamId("Real Madrid")]: "Real_Madrid_CF",
  [clubTeamId("FC Barcelone")]: "FC_Barcelona",
  [clubTeamId("Atlético Madrid")]: "Atlético_Madrid",
  [clubTeamId("Inter Milan")]: "Inter_Milan",
  [clubTeamId("AC Milan")]: "AC_Milan",
  [clubTeamId("Juventus")]: "Juventus_FC",
  [clubTeamId("Napoli")]: "SSC_Napoli",
  [clubTeamId("Bayern Munich")]: "FC_Bayern_Munich",
  [clubTeamId("Borussia Dortmund")]: "Borussia_Dortmund",
  [clubTeamId("Bayer Leverkusen")]: "Bayer_04_Leverkusen",
  [clubTeamId("Galatasaray")]: "Galatasaray_S.K._(football)",
  [clubTeamId("Al-Nassr")]: "Al-Nassr_FC",
  [clubTeamId("Inter Miami")]: "Inter_Miami_CF",
};

interface WikipediaSummaryResponse {
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
}

interface WikipediaSearchResponse {
  query?: {
    search?: Array<{ title?: string }>;
  };
}

async function fetchWikipediaBadgeForPage(pageTitle: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`,
    );
    if (!response.ok) return null;
    const data = (await response.json()) as WikipediaSummaryResponse;
    return data.thumbnail?.source ?? data.originalimage?.source ?? null;
  } catch {
    return null;
  }
}

async function searchWikipediaPageTitle(teamId: NationalTeamId): Promise<string | null> {
  const team = NATIONAL_TEAMS[teamId];
  if (!team) return null;
  const query = isClubTeamId(teamId)
    ? `${team.label} football club`
    : `${team.label} national football team`;
  try {
    const response = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`,
    );
    if (!response.ok) return null;
    const data = (await response.json()) as WikipediaSearchResponse;
    return data.query?.search?.[0]?.title?.replace(/ /g, "_") ?? null;
  } catch {
    return null;
  }
}

export function getCachedTeamBadgeUrl(teamId: NationalTeamId): string | null | undefined {
  return TEAM_BADGE_URL_CACHE.get(teamId);
}

export async function loadTeamBadgeUrl(teamId: NationalTeamId): Promise<string | null> {
  if (TEAM_BADGE_URL_CACHE.has(teamId)) return TEAM_BADGE_URL_CACHE.get(teamId) ?? null;
  const pending = TEAM_BADGE_PENDING.get(teamId);
  if (pending) return pending;
  const load = (async () => {
    const directPage = TEAM_WIKIPEDIA_PAGE_BY_ID[teamId];
    let badgeUrl = directPage ? await fetchWikipediaBadgeForPage(directPage) : null;
    if (!badgeUrl) {
      const searchTitle = await searchWikipediaPageTitle(teamId);
      if (searchTitle) badgeUrl = await fetchWikipediaBadgeForPage(searchTitle);
    }
    TEAM_BADGE_URL_CACHE.set(teamId, badgeUrl);
    TEAM_BADGE_PENDING.delete(teamId);
    return badgeUrl;
  })();
  TEAM_BADGE_PENDING.set(teamId, load);
  return load;
}

function buildClubTeam(league: League, clubIndex: number): NationalTeam | null {
  const club = league.clubs[clubIndex]!;
  const players = REAL_CLUB_SQUADS[club.name];
  if (!players?.length) return null;
  return buildTeam({
    id: clubTeamId(club.name),
    label: club.name,
    radioLabel: club.name,
    color: club.color,
    shorts: club.color2,
    players,
  });
}

for (const league of LEAGUES) {
  const teamIds: NationalTeamId[] = [];
  for (let i = 0; i < league.clubs.length; i++) {
    const team = buildClubTeam(league, i);
    if (!team) continue;
    (NATIONAL_TEAMS as Record<string, NationalTeam>)[team.id] = team;
    LEAGUE_BY_TEAM_ID.set(team.id, league);
    teamIds.push(team.id);
  }
  if (teamIds.length) PLAYABLE_CLUB_IDS_BY_LEAGUE.set(league.id, teamIds);
}

/** Kind of side an id is: hand-built national or curated club. */
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
    ? (PLAYABLE_CLUB_IDS_BY_LEAGUE.get(league.id) ?? [])
    : [...NATIONAL_IDS];
  if (!order.length) return current;
  const start = order.indexOf(current);
  for (let step = 1; step <= order.length; step++) {
    const candidate = order[(start + step) % order.length]!;
    if (candidate !== avoid) return candidate;
  }
  return current;
}
