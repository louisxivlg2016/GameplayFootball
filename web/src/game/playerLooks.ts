/**
 * Per-player appearance: skin tone, hair colour and hairstyle, so the real
 * squads actually resemble the real players instead of looking however their
 * shirt-number slot happened to fall.
 *
 * The rig palette is small (4 skins, 5 hair colours, 6 styles), so a look is
 * the CLOSEST match, not a perfect likeness:
 *   skin  0 fair · 1 olive/light-brown · 2 brown · 3 dark
 *   hair  black · brown · darkblonde · blonde · red
 *   style bald · short01 · short02 · medium01 · medium02 · long01
 *
 * Marquee names are hand-mapped below; everyone else gets a STABLE, realistic
 * look derived from a hash of their name (so a given player always looks the
 * same, and the distribution leans the way real football does — mostly short
 * dark hair, the odd blond, rare redhead).
 *
 * Keys in NAMED must already be in normalizeName() form: lowercase, accents
 * stripped, hyphens/punctuation turned to single spaces.
 */

export type SkinTone = 0 | 1 | 2 | 3;
export type HairColor = "black" | "brown" | "darkblonde" | "blonde" | "red";
export type HairStyle =
  | "bald"
  | "short01"
  | "short02"
  | "medium01"
  | "medium02"
  | "long01";

export interface PlayerLook {
  skin: SkinTone;
  style: HairStyle;
  hair: HairColor;
}

/** lowercase, strip accents/punctuation, collapse spaces. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const B = "black" as const,
  R = "brown" as const,
  D = "darkblonde" as const,
  L = "blonde" as const,
  X = "red" as const;

/** hand-mapped likenesses for the players a viewer recognises on sight. */
const NAMED: Record<string, PlayerLook> = {
  // ---- global icons ----
  "kylian mbappe": { skin: 2, style: "short01", hair: B },
  "lionel messi": { skin: 1, style: "medium01", hair: B },
  "cristiano ronaldo": { skin: 1, style: "short01", hair: B },
  "erling haaland": { skin: 0, style: "medium02", hair: L },
  "vinicius junior": { skin: 3, style: "short02", hair: B },
  "jude bellingham": { skin: 1, style: "short01", hair: R },
  "mohamed salah": { skin: 2, style: "medium01", hair: B },
  "kevin de bruyne": { skin: 0, style: "short01", hair: X },
  "robert lewandowski": { skin: 0, style: "short01", hair: R },
  "harry kane": { skin: 0, style: "short01", hair: R },

  // ---- Real Madrid ----
  "rodrygo": { skin: 2, style: "short02", hair: B },
  "federico valverde": { skin: 0, style: "medium01", hair: R },
  "aurelien tchouameni": { skin: 3, style: "short01", hair: B },
  "eduardo camavinga": { skin: 3, style: "short02", hair: B },
  "antonio rudiger": { skin: 3, style: "short01", hair: B },
  "david alaba": { skin: 2, style: "short01", hair: B },
  "thibaut courtois": { skin: 0, style: "short01", hair: R },
  "arda guler": { skin: 0, style: "short01", hair: R },
  "dani carvajal": { skin: 0, style: "short01", hair: R },
  "kylian mbappe lottin": { skin: 2, style: "short01", hair: B },

  // ---- Barcelona ----
  "lamine yamal": { skin: 2, style: "short02", hair: B },
  "pedri": { skin: 0, style: "short01", hair: R },
  "gavi": { skin: 0, style: "short01", hair: R },
  "raphinha": { skin: 2, style: "short02", hair: B },
  "frenkie de jong": { skin: 0, style: "medium01", hair: R },
  "jules kounde": { skin: 3, style: "short02", hair: B },
  "ronald araujo": { skin: 1, style: "short01", hair: R },
  "marc andre ter stegen": { skin: 0, style: "short01", hair: R },
  "ferran torres": { skin: 0, style: "short01", hair: R },
  "pau cubarsi": { skin: 0, style: "short01", hair: R },

  // ---- Man City ----
  "phil foden": { skin: 0, style: "short01", hair: L },
  "rodri": { skin: 0, style: "medium01", hair: R },
  "bernardo silva": { skin: 1, style: "short01", hair: B },
  "jeremy doku": { skin: 3, style: "short02", hair: B },
  "ruben dias": { skin: 1, style: "short01", hair: B },
  "josko gvardiol": { skin: 0, style: "short01", hair: R },
  "savinho": { skin: 2, style: "short02", hair: B },
  "omar marmoush": { skin: 2, style: "short01", hair: B },
  "gianluigi donnarumma": { skin: 0, style: "short01", hair: B },
  "rayan cherki": { skin: 1, style: "short01", hair: B },
  "tijjani reijnders": { skin: 1, style: "short01", hair: B },

  // ---- Arsenal ----
  "bukayo saka": { skin: 3, style: "short01", hair: B },
  "martin odegaard": { skin: 0, style: "medium01", hair: L },
  "declan rice": { skin: 0, style: "short01", hair: R },
  "william saliba": { skin: 3, style: "short01", hair: B },
  "gabriel martinelli": { skin: 1, style: "short01", hair: B },
  "gabriel magalhaes": { skin: 2, style: "short01", hair: B },
  "viktor gyokeres": { skin: 0, style: "short01", hair: R },
  "david raya": { skin: 0, style: "short01", hair: R },
  "martin zubimendi": { skin: 0, style: "short01", hair: R },
  "riccardo calafiori": { skin: 0, style: "medium01", hair: R },
  "leandro trossard": { skin: 0, style: "short01", hair: R },

  // ---- Liverpool ----
  "florian wirtz": { skin: 0, style: "short01", hair: R },
  "alexander isak": { skin: 2, style: "short01", hair: B },
  "virgil van dijk": { skin: 2, style: "short01", hair: B },
  "alexis mac allister": { skin: 0, style: "medium01", hair: R },
  "dominik szoboszlai": { skin: 0, style: "short01", hair: R },
  "ryan gravenberch": { skin: 3, style: "short02", hair: B },
  "cody gakpo": { skin: 2, style: "short01", hair: B },
  "ibrahima konate": { skin: 3, style: "short01", hair: B },
  "alisson becker": { skin: 0, style: "short01", hair: R },
  "hugo ekitike": { skin: 3, style: "short01", hair: B },
  "jeremie frimpong": { skin: 3, style: "short02", hair: B },
  "milos kerkez": { skin: 0, style: "short01", hair: R },

  // ---- Man United ----
  "bruno fernandes": { skin: 0, style: "short01", hair: R },
  "matheus cunha": { skin: 1, style: "medium01", hair: B },
  "bryan mbeumo": { skin: 3, style: "short01", hair: B },
  "casemiro": { skin: 2, style: "short02", hair: B },
  "leny yoro": { skin: 3, style: "short01", hair: B },
  "matthijs de ligt": { skin: 0, style: "short01", hair: R },
  "amad diallo": { skin: 3, style: "short01", hair: B },
  "diogo dalot": { skin: 0, style: "short01", hair: R },

  // ---- Chelsea ----
  "cole palmer": { skin: 0, style: "short01", hair: R },
  "enzo fernandez": { skin: 0, style: "medium01", hair: R },
  "moises caicedo": { skin: 2, style: "short01", hair: B },
  "nicolas jackson": { skin: 3, style: "short02", hair: B },
  "pedro neto": { skin: 0, style: "short01", hair: R },
  "reece james": { skin: 2, style: "short01", hair: B },

  // ---- Tottenham ----
  "son heung min": { skin: 1, style: "short01", hair: B },
  "james maddison": { skin: 0, style: "short01", hair: R },
  "cristian romero": { skin: 0, style: "medium01", hair: R },
  "micky van de ven": { skin: 0, style: "short01", hair: R },

  // ---- Bayern ----
  "jamal musiala": { skin: 2, style: "short02", hair: B },
  "joshua kimmich": { skin: 0, style: "short01", hair: R },
  "michael olise": { skin: 2, style: "short02", hair: B },
  "leroy sane": { skin: 3, style: "short02", hair: L },
  "manuel neuer": { skin: 0, style: "short01", hair: R },
  "dayot upamecano": { skin: 3, style: "short01", hair: B },
  "serge gnabry": { skin: 3, style: "short01", hair: B },
  "kingsley coman": { skin: 3, style: "short01", hair: B },

  // ---- Dortmund / Leverkusen ----
  "serhou guirassy": { skin: 3, style: "short01", hair: B },
  "karim adeyemi": { skin: 3, style: "short01", hair: B },
  "julian brandt": { skin: 0, style: "short01", hair: R },
  "gregor kobel": { skin: 0, style: "short01", hair: R },
  "granit xhaka": { skin: 0, style: "short01", hair: R },
  "patrik schick": { skin: 0, style: "short01", hair: R },

  // ---- Serie A ----
  "lautaro martinez": { skin: 0, style: "short01", hair: B },
  "marcus thuram": { skin: 3, style: "short01", hair: B },
  "nicolo barella": { skin: 0, style: "short01", hair: R },
  "hakan calhanoglu": { skin: 0, style: "short01", hair: B },
  "rafael leao": { skin: 3, style: "short02", hair: B },
  "christian pulisic": { skin: 0, style: "short01", hair: R },
  "theo hernandez": { skin: 0, style: "medium01", hair: R },
  "mike maignan": { skin: 3, style: "short01", hair: B },
  "dusan vlahovic": { skin: 0, style: "short01", hair: R },
  "kenan yildiz": { skin: 0, style: "short01", hair: B },
  "khephren thuram": { skin: 3, style: "short01", hair: B },
  "victor osimhen": { skin: 3, style: "short01", hair: B },
  "scott mctominay": { skin: 0, style: "short01", hair: R },
  "romelu lukaku": { skin: 3, style: "short01", hair: B },

  // ---- PSG ----
  "ousmane dembele": { skin: 3, style: "short02", hair: B },
  "achraf hakimi": { skin: 2, style: "short01", hair: B },
  "khvicha kvaratskhelia": { skin: 0, style: "medium01", hair: R },
  "vitinha": { skin: 1, style: "short01", hair: B },
  "joao neves": { skin: 1, style: "short01", hair: B },
  "marquinhos": { skin: 2, style: "short01", hair: B },
  "nuno mendes": { skin: 3, style: "short02", hair: B },
  "desire doue": { skin: 2, style: "short02", hair: B },
  "bradley barcola": { skin: 3, style: "short02", hair: B },
  "warren zaire emery": { skin: 2, style: "short01", hair: B },
  "goncalo ramos": { skin: 1, style: "short01", hair: B },
  "kang in lee": { skin: 1, style: "short01", hair: B },
  "fabian ruiz": { skin: 0, style: "medium01", hair: R },
  "willian pacho": { skin: 3, style: "short01", hair: B },
  "lucas chevalier": { skin: 0, style: "short01", hair: R },

  // ---- Marseille & other Ligue 1 ----
  "pierre emerick aubameyang": { skin: 3, style: "short01", hair: B },
  "mason greenwood": { skin: 1, style: "short01", hair: B },
  "geronimo rulli": { skin: 0, style: "short01", hair: R },
  "amine gouiri": { skin: 2, style: "short01", hair: B },
  "georges mikautadze": { skin: 0, style: "short01", hair: R },
  "malick fofana": { skin: 3, style: "short01", hair: B },

  // ---- Al-Nassr / Inter Miami / Galatasaray ----
  "sadio mane": { skin: 3, style: "short01", hair: B },
  "sergio ramos": { skin: 0, style: "medium01", hair: R },
  "luis suarez": { skin: 0, style: "short01", hair: R },
  "jordi alba": { skin: 0, style: "short01", hair: R },
  "sergio busquets": { skin: 0, style: "short01", hair: R },
  "mauro icardi": { skin: 0, style: "short01", hair: R },

  // ---- national-team extras ----
  "antoine griezmann": { skin: 0, style: "short01", hair: R },
  "randal kolo muani": { skin: 3, style: "short01", hair: B },
  "luka modric": { skin: 0, style: "medium01", hair: L },
  "toni kroos": { skin: 0, style: "short01", hair: L },
  "neymar": { skin: 2, style: "short02", hair: B },
};

// silence "declared but unused" for the shorthand not yet placed (keeps the
// palette legend complete and lets new entries use any colour freely)
void D;
void X;

/** cheap deterministic string hash (FNV-1a, 32-bit). */
function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** pick from a weighted table using a 0..1 roll. */
function weighted<T>(roll: number, table: Array<[T, number]>): T {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let r = roll * total;
  for (const [item, w] of table) {
    if ((r -= w) < 0) return item;
  }
  return table[table.length - 1]![0];
}

// realistic-ish distributions for players we have no explicit look for
const SKIN_TABLE: Array<[SkinTone, number]> = [
  [0, 34],
  [1, 28],
  [2, 22],
  [3, 24],
];
const STYLE_TABLE: Array<[HairStyle, number]> = [
  ["short01", 34],
  ["short02", 26],
  ["medium01", 15],
  ["medium02", 10],
  ["long01", 6],
  ["bald", 9],
];
const HAIR_TABLE: Array<[HairColor, number]> = [
  ["black", 44],
  ["brown", 34],
  ["darkblonde", 11],
  ["blonde", 8],
  ["red", 3],
];

/**
 * Resolve a player's look. Named stars get their hand-mapped likeness; everyone
 * else gets a stable, individually-varied look seeded off their name (so the
 * same player always looks identical, match after match).
 */
export function lookForName(name: string): PlayerLook {
  const key = normalizeName(name);
  const named = NAMED[key];
  if (named) return named;
  // three independent hash streams so skin/style/colour don't correlate
  const skin = weighted((hash(key) % 1000) / 1000, SKIN_TABLE);
  const style = weighted((hash(key + "|s") % 1000) / 1000, STYLE_TABLE);
  const hair = weighted((hash(key + "|h") % 1000) / 1000, HAIR_TABLE);
  // dark skin almost never pairs with red/blond hair — nudge those to black
  const hairFixed = skin >= 2 && (hair === "red" || hair === "blonde") ? "black" : hair;
  return { skin, style, hair: hairFixed };
}
