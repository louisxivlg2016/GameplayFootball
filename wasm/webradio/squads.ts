/**
 * Real squads + team colours pushed into the native engine before a match
 * builds. The C++ side (gpf_set_team_color / gpf_set_team_names in gametask.cpp,
 * applied in Team::InitPlayers) recolours the kit to the nation's colour and
 * swaps the DB player names for the real ones on the floating name captions.
 *
 * Names are shirt-ordered, goalkeeper first, ASCII-uppercase (the in-game
 * bitmap font has no accents). Nations without an entry keep the DB names.
 */
interface NativeModule {
  _gpf_set_team_color?: (team: number, r: number, g: number, b: number) => void;
  _gpf_clear_team_overrides?: () => void;
  ccall?: (name: string, ret: string | null, types: string[], args: unknown[]) => unknown;
}
const mod = (): NativeModule | undefined =>
  (window as unknown as { Module?: NativeModule }).Module;

// GK, then 10 outfield (roughly by shirt). Recognisable current-era names.
export const SQUADS: Record<string, string[]> = {
  France: ["MAIGNAN", "KOUNDE", "SALIBA", "UPAMECANO", "T.HERNANDEZ", "TCHOUAMENI", "RABIOT", "GRIEZMANN", "DEMBELE", "MBAPPE", "KOLOMUANI"],
  Allemagne: ["NEUER", "KIMMICH", "RUDIGER", "TAH", "RAUM", "ANDRICH", "GUNDOGAN", "MUSIALA", "WIRTZ", "SANE", "HAVERTZ"],
  Espagne: ["SIMON", "CARVAJAL", "LE.NORMAND", "LAPORTE", "CUCURELLA", "RODRI", "PEDRI", "OLMO", "YAMAL", "MORATA", "N.WILLIAMS"],
  Italie: ["DONNARUMMA", "DI.LORENZO", "BASTONI", "CALAFIORI", "DIMARCO", "BARELLA", "JORGINHO", "TONALI", "CHIESA", "RETEGUI", "SCAMACCA"],
  Angleterre: ["PICKFORD", "WALKER", "STONES", "GUEHI", "SHAW", "RICE", "BELLINGHAM", "FODEN", "SAKA", "KANE", "PALMER"],
  Portugal: ["D.COSTA", "CANCELO", "R.DIAS", "PEPE", "N.MENDES", "PALHINHA", "B.FERNANDES", "B.SILVA", "LEAO", "RONALDO", "J.FELIX"],
  "Pays-Bas": ["VERBRUGGEN", "DUMFRIES", "DE.LIGT", "VAN.DIJK", "AKE", "SCHOUTEN", "REIJNDERS", "GAKPO", "X.SIMONS", "DEPAY", "MALEN"],
  Belgique: ["CASTEELS", "CASTAGNE", "FAES", "VERTONGHEN", "THEATE", "ONANA", "TIELEMANS", "DE.BRUYNE", "LUKEBAKIO", "LUKAKU", "DOKU"],
  Croatie: ["LIVAKOVIC", "STANISIC", "SUTALO", "GVARDIOL", "SOSA", "BROZOVIC", "MODRIC", "KOVACIC", "PASALIC", "KRAMARIC", "BUDIMIR"],
  Suisse: ["SOMMER", "WIDMER", "AKANJI", "SCHAR", "RODRIGUEZ", "FREULER", "XHAKA", "RIEDER", "NDOYE", "EMBOLO", "VARGAS"],
  Bresil: ["ALISSON", "DANILO", "MARQUINHOS", "G.MAGALHAES", "WENDELL", "B.GUIMARAES", "PAQUETA", "RAPHINHA", "RODRYGO", "VINICIUS", "MARTINELLI"],
  "Brésil": ["ALISSON", "DANILO", "MARQUINHOS", "G.MAGALHAES", "WENDELL", "B.GUIMARAES", "PAQUETA", "RAPHINHA", "RODRYGO", "VINICIUS", "MARTINELLI"],
  Argentine: ["E.MARTINEZ", "MOLINA", "ROMERO", "OTAMENDI", "TAGLIAFICO", "DE.PAUL", "MAC.ALLISTER", "E.FERNANDEZ", "MESSI", "J.ALVAREZ", "DI.MARIA"],
  Uruguay: ["ROCHET", "NANDEZ", "J.GIMENEZ", "ARAUJO", "OLIVERA", "VALVERDE", "UGARTE", "BENTANCUR", "PELLISTRI", "NUNEZ", "L.SUAREZ"],
  Colombie: ["VARGAS", "MUNOZ", "S.MURILLO", "D.SANCHEZ", "MOJICA", "R.RIOS", "LERMA", "J.RODRIGUEZ", "L.DIAZ", "CORDOBA", "J.ARIAS"],
  "États-Unis": ["M.TURNER", "DEST", "C.RICHARDS", "A.ROBINSON", "SCALLY", "T.ADAMS", "MCKENNIE", "MUSAH", "PULISIC", "WEAH", "BALOGUN"],
  Maroc: ["BOUNOU", "HAKIMI", "SAISS", "AGUERD", "MAZRAOUI", "AMRABAT", "OUNAHI", "ZIYECH", "EZZALZOULI", "EN.NESYRI", "BOUFAL"],
  "Sénégal": ["E.MENDY", "KOULIBALY", "SABALY", "A.DIALLO", "JAKOBS", "I.GUEYE", "P.GUEYE", "I.SARR", "DIATTA", "S.MANE", "N.JACKSON"],
};

// Kit colour where the flag accent colour isn't the real shirt colour.
const KIT_COLOR: Record<string, string> = {
  Allemagne: "#e9e9e9", // white home shirt
  Bresil: "#f7d417", "Brésil": "#f7d417", // canary yellow
  Angleterre: "#f2f2f2", // white
};

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function setOne(team: number, name: string, flagColor: string): void {
  const m = mod();
  if (!m) return;
  const [r, g, b] = hexToRgb(KIT_COLOR[name] ?? flagColor);
  m._gpf_set_team_color?.(team, r, g, b);
  const squad = SQUADS[name];
  if (squad && m.ccall) m.ccall("gpf_set_team_names", null, ["number", "string"], [team, squad.join("|")]);
}

// Home = team 0, away = team 1. Call right before starting a national match.
export function applyNationOverrides(
  home: { name: string; color: string },
  away: { name: string; color: string },
): void {
  const m = mod();
  m?._gpf_clear_team_overrides?.();
  setOne(0, home.name, home.color);
  setOne(1, away.name, away.color);
}

// Clubs: recolour kits to the club colour, but keep DB names (no real rosters).
export function applyClubColors(homeColor: string, awayColor: string): void {
  const m = mod();
  if (!m) return;
  m._gpf_clear_team_overrides?.();
  const [hr, hg, hb] = hexToRgb(homeColor);
  const [ar, ag, ab] = hexToRgb(awayColor);
  m._gpf_set_team_color?.(0, hr, hg, hb);
  m._gpf_set_team_color?.(1, ar, ag, ab);
}
