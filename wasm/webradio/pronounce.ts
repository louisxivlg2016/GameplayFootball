/**
 * Spoken-name normalisation for the radio commentator.
 *
 * The engine hands us last names in the in-game bitmap font's ALL-CAPS ASCII —
 * no accents, initials glued with dots ("MBAPPE", "DEMBELE", "T.HERNANDEZ",
 * "A.ROBINSON"). Read literally by a neural voice that is WRONG:
 *   - a French voice reads "Mbappe" with a silent final e  -> "mbap"
 *   - "Dembele" collapses to "demb"
 *   - English names get read with the voice's own spelling rules
 *     ("Robinson" the French way instead of the English way).
 *
 * So we respell names for the voice that will actually speak them:
 *   1. ACCENTS  — put the real diacritics back. Correct in EVERY language, so
 *      this runs for all of them (Mbappé, Dembélé, Vinícius, Rüdiger…).
 *   2. FR / ROMANCE / EN respellings — phonetic spellings tuned to the voice's
 *      own reading rules, so a foreign name comes out sounding right.
 *
 * Keys are the raw engine spelling with initials dropped (see nameKey).
 */

/** Real diacritics — helps every language's voice. */
const ACCENTS: Record<string, string> = {
  // France
  MBAPPE: "Mbappé", DEMBELE: "Dembélé", KOUNDE: "Koundé", TCHOUAMENI: "Tchouaméni",
  KONATE: "Konaté", DOUE: "Doué", "ZAIRE.EMERY": "Zaïré Emery", THURAM: "Thuram",
  BARCOLA: "Barcola", OLISE: "Olisé", SALIBA: "Saliba", MAIGNAN: "Maignan",
  GIROUD: "Giroud", GRIEZMANN: "Griezmann", COMAN: "Coman", NKUNKU: "Nkunku",
  // Spain / Portugal / Brazil (nasals, tildes, cedillas)
  LEAO: "Leão", FELIX: "Félix", "RUBEN.DIAS": "Rúben Dias", JOAO: "João",
  GONCALVES: "Gonçalves", VITINHA: "Vitinha", PALHINHA: "Palhinha",
  VINICIUS: "Vinícius", MILITAO: "Militão", "BRUNO.GUIMARAES": "Bruno Guimarães",
  ANDRE: "André", RICHARLISON: "Richarlison", CASEMIRO: "Casemiro",
  MARTINEZ: "Martínez", "DI.MARIA": "Di María", ALVAREZ: "Álvarez",
  RODRIGUEZ: "Rodríguez", GOMEZ: "Gómez", SANCHEZ: "Sánchez", PEREZ: "Pérez",
  FERNANDEZ: "Fernández", GONZALEZ: "González", HERNANDEZ: "Hernández",
  JIMENEZ: "Jiménez", SUAREZ: "Suárez", VAZQUEZ: "Vázquez", DIAZ: "Díaz",
  RAMOS: "Ramos", ASENSIO: "Asensio",
  // Germany / Austria / Switzerland / Turkey
  RUDIGER: "Rüdiger", GUNDOGAN: "Gündogan", SANE: "Sané", FULLKRUG: "Füllkrug",
  GROSS: "Gross", MULLER: "Müller", SCHAFER: "Schäfer", GUNTER: "Günter",
  AKTURKOGLU: "Aktürkoglou", CALHANOGLU: "Tchalhanoglou", GULER: "Güler",
  YILDIZ: "Yildiz", KOKCU: "Kökçu", SOYUNCU: "Soyoundju",
  // Nordics / East
  ODEGAARD: "Ødegaard", HOJLUND: "Højlund", ERIKSEN: "Eriksen",
  SZCZESNY: "Chtchesny", ZIELINSKI: "Zielinski", MODRIC: "Modritch",
  PERISIC: "Perichitch", KOVACIC: "Kovatchitch", GVARDIOL: "Gvardiol",
  VLAHOVIC: "Vlahovitch", MITROVIC: "Mitrovitch", TADIC: "Taditch",
  // Africa / Middle East
  HAKIMI: "Hakimi", ZIYECH: "Ziyech", AMRABAT: "Amrabat", "EN.NESYRI": "En Nesyri",
  KOULIBALY: "Koulibaly", SARR: "Sarr", NDIAYE: "Ndiaye", MENDY: "Mendy",
  OSIMHEN: "Osimhen", IWOBI: "Iwobi", SALAH: "Salah", MANE: "Mané",
};

/** English/Germanic names respelled for a FRENCH voice. */
const RESPELL_FR: Record<string, string> = {
  // England
  PICKFORD: "Pikfeurd", WALKER: "Wôkeur", STONES: "Stônnz", GUEHI: "Gué-i",
  SHAW: "Chô", RICE: "Raïss", BELLINGHAM: "Bèlingam", FODEN: "Fôdeune",
  SAKA: "Saka", KANE: "Kéïne", PALMER: "Pâmeur", RAMSDALE: "Ramzdeïl",
  TRIPPIER: "Tripieur", KONSA: "Konsa", GORDON: "Gordeune", MAINOO: "Mènou",
  WATKINS: "Watkinnz", EZE: "Ézé", HENDERSON: "Hendeurseune",
  MAGUIRE: "Maguaïeur", GREALISH: "Grélich", STERLING: "Steurling",
  // USA / Scotland / Wales / Australia / Canada
  ROBINSON: "Robinnseune", TURNER: "Teurneur", RICHARDS: "Ritcheurdz",
  SCALLY: "Skali", ADAMS: "Adamz", MCKENNIE: "Mac Kèni", MUSAH: "Moussa",
  PULISIC: "Poulissik", WEAH: "Wéa", BALOGUN: "Balogoune", HORVATH: "Horvath",
  CARTER: "Karteur", CHANDLER: "Tchandleur", AARONSON: "Aronnseune",
  REYNA: "Rèïna", DEST: "Dèst",
  GUNN: "Gueune", HICKEY: "Hiki", HANLEY: "Hanli", TIERNEY: "Tirni",
  ROBERTSON: "Robeurtseune", MCTOMINAY: "Mac Tominé", MCGREGOR: "Mac Grégueur",
  GILMOUR: "Guilmour", MCGINN: "Mac Guine", CHRISTIE: "Kristi",
  PORTEOUS: "Portieuss", RALSTON: "Rôlsteune", DYKES: "Daïks",
  WARD: "Wôrd", WILLIAMS: "Ouilliamz", RODON: "Rodeune", MEPHAM: "Mèfam",
  DAVIES: "Dèïviz", ALLEN: "Aleune", RAMSEY: "Ramzi", WILSON: "Ouilsseune",
  JOHNSON: "Djonnseune", MOORE: "Môr", JAMES: "Djèmz", AMPADU: "Ampadou",
  BROOKS: "Brouks", COLWILL: "Colouil",
  RYAN: "Raïane", ATKINSON: "Atkinnseune", SOUTTAR: "Souteur", ROWLES: "Rôlz",
  MOOY: "Moui", IRVINE: "Eurvine", MCGREE: "Mac Gri", LECKIE: "Léki",
  DUKE: "Diouk", GOODWIN: "Goudouine", BACCUS: "Bakeuss", BOYLE: "Boïle",
  "ST.CLAIR": "Sènt Clèr", JOHNSTON: "Djonnsteune", MILLER: "Mileur",
  BUCHANAN: "Biou-kanane", DAVID: "Dèïvid", LARIN: "Larine",
  HOILETT: "Hoïlette", CORNELIUS: "Korniliousse", UGBO: "Ougbo",
  // widely-known others
  HAALAND: "Hôlann", FODE: "Fodé", KOBBIE: "Kobi", TRENT: "Trènte",
  ALEXANDER: "Alexandeur", ARNOLD: "Arnold", SMITH: "Smiss", TAYLOR: "Tèïleur",
  BROWN: "Braoune", WRIGHT: "Raïte", CLARK: "Clark", YOUNG: "Yeung",
  KING: "Kigne", HALL: "Hôl", BAILEY: "Bèïli", MOUNT: "Maounte",
};

/** Light respelling for the other Romance voices (es / pt / it / ro). */
const RESPELL_ROMANCE: Record<string, string> = {
  RICE: "Rais", KANE: "Kein", SHAW: "Sho", STONES: "Stouns", FODEN: "Foden",
  BELLINGHAM: "Belingam", WALKER: "Uoker", PICKFORD: "Pikford",
  ROBINSON: "Robinson", MAINOO: "Meinu", RAMSDALE: "Ramsdeil",
  MCTOMINAY: "Mac Tominei", MCGREGOR: "Mac Gregor", MCKENNIE: "Mac Keni",
  JAMES: "Yeims", DAVID: "Deivid", DUKE: "Diuk", DYKES: "Daiks",
  HAALAND: "Holan", ODEGAARD: "Odegor",
};

/** Non-English names respelled for the ENGLISH voice. */
const RESPELL_EN: Record<string, string> = {
  MBAPPE: "Em-bapp-ay", DEMBELE: "Dom-bay-lay", KOUNDE: "Koon-day",
  TCHOUAMENI: "Choo-ah-may-nee", KONATE: "Ko-na-tay", DOUE: "Doo-ay",
  GIROUD: "Zhee-roo", GRIEZMANN: "Gree-ez-man", MAIGNAN: "Man-yon",
  UPAMECANO: "Oo-pa-me-ka-no", CAMAVINGA: "Ka-ma-ving-ga", OLISE: "O-lee-say",
  SALIBA: "Sa-lee-ba", RABIOT: "Ra-bee-oh", THURAM: "Too-ram",
  VINICIUS: "Vi-nee-see-us", RODRYGO: "Ro-dree-go", RAPHINHA: "Ha-feen-ya",
  MILITAO: "Mi-li-town", MARQUINHOS: "Mar-keen-yos", CASEMIRO: "Ka-ze-mee-ro",
  LEAO: "Lay-own", VITINHA: "Vi-teen-ya", PALHINHA: "Pal-yeen-ya",
  GONCALVES: "Gon-sal-vesh", JOAO: "Zhoo-ow", FELIX: "Fay-leesh",
  YAMAL: "Ya-mal", PEDRI: "Ped-ree", RODRI: "Rod-ree", CUCURELLA: "Koo-koo-rel-ya",
  CARVAJAL: "Kar-va-hal", OYARZABAL: "O-yar-tha-bal", MORATA: "Mo-ra-ta",
  RUDIGER: "Rue-di-ger", GUNDOGAN: "Gun-do-an", MUSIALA: "Moo-see-ah-la",
  WIRTZ: "Veerts", HAVERTZ: "Ha-verts", SANE: "Za-nay", FULLKRUG: "Fool-kroog",
  SZCZESNY: "Sh-ches-nee", LEWANDOWSKI: "Le-van-dof-ski", ZIELINSKI: "Zhe-lin-ski",
  MODRIC: "Mod-rich", PERISIC: "Pe-ri-shich", KOVACIC: "Ko-va-chich",
  GVARDIOL: "Gvar-dee-ol", VLAHOVIC: "Vla-ho-vich", COURTOIS: "Kort-wah",
  ODEGAARD: "Er-de-gore", HOJLUND: "Hoy-loon", HAALAND: "Haw-lann",
  AKTURKOGLU: "Ak-tur-ko-loo", CALHANOGLU: "Chal-ha-no-loo", GULER: "Gue-ler",
  HAKIMI: "Ha-kee-mee", ZIYECH: "Zee-yesh", MANE: "Ma-nay",
  KOULIBALY: "Koo-lee-ba-lee", OSIMHEN: "O-sim-en",
};

/** Engine spelling -> lookup key: drop single-letter initials, keep the rest. */
function nameKey(raw: string): string {
  return raw.split(".").map((t) => t.trim()).filter((t) => t.length > 1).join(".").toUpperCase();
}

/** Fallback: Title-case each part, dots become spaces ("DE.BRUYNE" -> "De Bruyne"). */
function titleCase(raw: string): string {
  const parts = raw.split(".").map((t) => t.trim()).filter((t) => t.length > 1)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
  return parts.length ? parts.join(" ") : raw;
}

const ROMANCE = new Set(["es", "pt", "it", "ro"]);

/**
 * The name as it should be SPOKEN by the voice of `lang`.
 * Falls back to the plain Title-cased name when we have no respelling.
 */
export function spokenName(raw: string, lang: string): string {
  if (!raw) return raw;
  const key = nameKey(raw);
  if (!key) return titleCase(raw);
  if (lang === "en") {
    const en = RESPELL_EN[key];
    if (en) return en;
  } else if (lang === "fr") {
    const fr = RESPELL_FR[key];
    if (fr) return fr;
  } else if (ROMANCE.has(lang)) {
    const ro = RESPELL_ROMANCE[key];
    if (ro) return ro;
  }
  // diacritics are correct in every language — apply them last as the common case
  const acc = ACCENTS[key];
  if (acc) return acc;
  return titleCase(raw);
}
