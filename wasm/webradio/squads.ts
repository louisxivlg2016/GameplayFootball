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
  France: ["MAIGNAN", "KOUNDE", "SALIBA", "UPAMECANO", "T.HERNANDEZ", "TCHOUAMENI", "RABIOT", "DIGNE", "DEMBELE", "MBAPPE", "OLISE", "AREOLA", "KONATE", "L.HERNANDEZ", "CAMAVINGA", "ZAIRE.EMERY", "M.THURAM", "BARCOLA"],
  Allemagne: ["NEUER", "KIMMICH", "RUDIGER", "TAH", "RAUM", "ANDRICH", "GUNDOGAN", "MUSIALA", "WIRTZ", "SANE", "HAVERTZ", "TER.STEGEN", "SCHLOTTERBECK", "ANTON", "GROSS", "GORETZKA", "FULLKRUG", "ADEYEMI"],
  Espagne: ["SIMON", "CARVAJAL", "LE.NORMAND", "LAPORTE", "CUCURELLA", "RODRI", "PEDRI", "OLMO", "YAMAL", "MORATA", "N.WILLIAMS", "R.SANCHEZ", "VIVIAN", "G.MARTIN", "F.LOPEZ", "MERINO", "F.TORRES", "OYARZABAL"],
  Italie: ["DONNARUMMA", "DI.LORENZO", "BASTONI", "CALAFIORI", "DIMARCO", "BARELLA", "JORGINHO", "TONALI", "CHIESA", "RETEGUI", "SCAMACCA", "VICARIO", "DARMIAN", "MANCINI", "UDOGIE", "FRATTESI", "RASPADORI", "ORSOLINI"],
  Angleterre: ["PICKFORD", "WALKER", "STONES", "GUEHI", "SHAW", "RICE", "BELLINGHAM", "FODEN", "SAKA", "KANE", "PALMER", "RAMSDALE", "TRIPPIER", "KONSA", "GORDON", "MAINOO", "WATKINS", "EZE"],
  Portugal: ["D.COSTA", "CANCELO", "R.DIAS", "PEPE", "N.MENDES", "PALHINHA", "B.FERNANDES", "B.SILVA", "LEAO", "RONALDO", "J.FELIX", "J.SA", "DALOT", "A.SILVA", "R.NEVES", "VITINHA", "J.NEVES", "G.RAMOS"],
  "Pays-Bas": ["VERBRUGGEN", "DUMFRIES", "DE.LIGT", "VAN.DIJK", "AKE", "SCHOUTEN", "REIJNDERS", "GAKPO", "X.SIMONS", "DEPAY", "MALEN", "FLEKKEN", "GEERTRUIDA", "TIMBER", "F.DE.JONG", "VEERMAN", "WEGHORST", "BROBBEY"],
  Belgique: ["CASTEELS", "CASTAGNE", "FAES", "VERTONGHEN", "THEATE", "ONANA", "TIELEMANS", "DE.BRUYNE", "LUKEBAKIO", "LUKAKU", "DOKU", "SELS", "DEBAST", "MEUNIER", "VANAKEN", "MANGALA", "OPENDA", "TROSSARD"],
  Croatie: ["LIVAKOVIC", "STANISIC", "SUTALO", "GVARDIOL", "SOSA", "BROZOVIC", "MODRIC", "KOVACIC", "PASALIC", "KRAMARIC", "BUDIMIR", "KOTARSKI", "JURANOVIC", "ERLIC", "PONGRACIC", "MAJER", "BARISIC", "PETKOVIC"],
  Suisse: ["SOMMER", "WIDMER", "AKANJI", "SCHAR", "RODRIGUEZ", "FREULER", "XHAKA", "RIEDER", "NDOYE", "EMBOLO", "VARGAS", "KOBEL", "ELVEDI", "COMERT", "ZAKARIA", "SHAQIRI", "AMDOUNI", "OKAFOR"],
  Bresil: ["ALISSON", "DANILO", "MARQUINHOS", "G.MAGALHAES", "WENDELL", "B.GUIMARAES", "PAQUETA", "RAPHINHA", "RODRYGO", "VINICIUS", "MARTINELLI", "BENTO", "MILITAO", "BREMER", "A.SANDRO", "A.PEREIRA", "ENDRICK", "SAVINHO"],
  "Brésil": ["ALISSON", "DANILO", "MARQUINHOS", "G.MAGALHAES", "WENDELL", "B.GUIMARAES", "PAQUETA", "RAPHINHA", "RODRYGO", "VINICIUS", "MARTINELLI", "BENTO", "MILITAO", "BREMER", "A.SANDRO", "A.PEREIRA", "ENDRICK", "SAVINHO"],
  Argentine: ["E.MARTINEZ", "MOLINA", "ROMERO", "OTAMENDI", "TAGLIAFICO", "DE.PAUL", "MAC.ALLISTER", "E.FERNANDEZ", "MESSI", "J.ALVAREZ", "DI.MARIA", "RULLI", "MONTIEL", "LIS.MARTINEZ", "PAREDES", "E.PALACIOS", "GARNACHO", "LAUTARO"],
  Uruguay: ["ROCHET", "NANDEZ", "J.GIMENEZ", "ARAUJO", "OLIVERA", "VALVERDE", "UGARTE", "BENTANCUR", "PELLISTRI", "NUNEZ", "L.SUAREZ", "SOSA", "VARELA", "CACERES", "ARRASCAETA", "CANOBBIO", "M.ARAUJO", "CAVANI"],
  Colombie: ["VARGAS", "MUNOZ", "S.MURILLO", "D.SANCHEZ", "MOJICA", "R.RIOS", "LERMA", "J.RODRIGUEZ", "L.DIAZ", "CORDOBA", "J.ARIAS", "MONTERO", "C.CUESTA", "LUCUMI", "CUADRADO", "C.SANCHEZ", "BORRE", "S.CORDOBA"],
  "États-Unis": ["M.TURNER", "DEST", "C.RICHARDS", "A.ROBINSON", "SCALLY", "T.ADAMS", "MCKENNIE", "MUSAH", "PULISIC", "WEAH", "BALOGUN", "HORVATH", "C.CARTER", "CHANDLER", "AARONSON", "DE.LA.TORRE", "REYNA", "FERREIRA"],
  Maroc: ["BOUNOU", "HAKIMI", "SAISS", "AGUERD", "MAZRAOUI", "AMRABAT", "OUNAHI", "ZIYECH", "EZZALZOULI", "EN.NESYRI", "BOUFAL", "MUNIR", "ATTIAT.ALLAH", "BENOUN", "HARIT", "EL.KHANNOUS", "RAHIMI", "IGAMANE"],
  "Sénégal": ["E.MENDY", "KOULIBALY", "SABALY", "A.DIALLO", "JAKOBS", "I.GUEYE", "P.GUEYE", "I.SARR", "DIATTA", "S.MANE", "N.JACKSON", "A.GOMIS", "N.SECK", "L.CAMARA", "PM.SARR", "DIENG", "B.DIA", "NIANG"],
  "Norvège": ["NYLAND", "RYERSON", "AJER", "OSTIGARD", "WOLFE", "BERGE", "ODEGAARD", "THORSBY", "NUSA", "HAALAND", "SORLOTH", "HANCHE.OLSEN", "AURSNES", "BOBB"],
  "Danemark": ["SCHMEICHEL", "ANDERSEN", "KJAER", "CHRISTENSEN", "MAEHLE", "HOJBJERG", "ERIKSEN", "HJULMAND", "DAMSGAARD", "HOJLUND", "WIND", "VESTERGAARD", "DREYER", "ESKESEN"],
  "Pologne": ["SZCZESNY", "CASH", "KIWIOR", "BEDNAREK", "BERESZYNSKI", "ZIELINSKI", "SLISZ", "MODER", "ZALEWSKI", "LEWANDOWSKI", "SWIDERSKI", "SKORUPSKI", "FRANKOWSKI", "PIOTROWSKI"],
  "Turquie": ["GUNOK", "CELIK", "AKAYDIN", "DEMIRAL", "KADIOGLU", "CALHANOGLU", "KOKCU", "YILDIZ", "GULER", "YILMAZ", "AKTURKOGLU", "BARDAKCI", "OZCAN", "KAHVECI"],
  "Autriche": ["PENTZ", "POSCH", "LIENHART", "DANSO", "MWENE", "SEIWALD", "LAIMER", "SABITZER", "BAUMGARTNER", "ARNAUTOVIC", "GREGORITSCH", "WOBER", "GRILLITSCH", "SCHMID"],
  "Serbie": ["RAJKOVIC", "PAVLOVIC", "MILENKOVIC", "VELJKOVIC", "MLADENOVIC", "GUDELJ", "LUKIC", "S.MILINKOVIC", "TADIC", "MITROVIC", "VLAHOVIC", "KOSTIC", "MAKSIMOVIC", "JOVIC"],
  "Ukraine": ["LUNIN", "KONOPLYA", "ZABARNYI", "MATVIYENKO", "MYKOLENKO", "STEPANENKO", "SUDAKOV", "ZINCHENKO", "MUDRYK", "DOVBYK", "YARMOLENKO", "TSYGANKOV", "MALINOVSKYI", "YAREMCHUK"],
  "Suède": ["OLSEN", "KRAFTH", "LINDELOF", "HIEN", "AUGUSTINSSON", "EKDAL", "S.LARSSON", "FORSBERG", "KULUSEVSKI", "ISAK", "GYOKERES", "SVANBERG", "ELANGA", "BERGVALL"],
  "Écosse": ["GUNN", "HICKEY", "HANLEY", "TIERNEY", "ROBERTSON", "MCTOMINAY", "MCGREGOR", "GILMOUR", "MCGINN", "ADAMS", "CHRISTIE", "PORTEOUS", "RALSTON", "DYKES"],
  "Pays de Galles": ["WARD", "N.WILLIAMS", "RODON", "MEPHAM", "B.DAVIES", "ALLEN", "RAMSEY", "H.WILSON", "B.JOHNSON", "MOORE", "D.JAMES", "AMPADU", "BROOKS", "COLWILL"],
  "Chili": ["BRAVO", "ISLA", "MEDEL", "MAROTO", "SUAZO", "PULGAR", "ARANGUIZ", "VIDAL", "A.SANCHEZ", "BRERETON", "E.VARGAS", "CORTES", "OSORIO", "PALACIOS"],
  "Équateur": ["GALINDEZ", "PRECIADO", "TORRES", "HINCAPIE", "ESTUPINAN", "CAICEDO", "FRANCO", "PLATA", "PAEZ", "E.VALENCIA", "K.RODRIGUEZ", "PACHO", "MENA", "SARMIENTO"],
  "Pérou": ["GALLESE", "ADVINCULA", "ZAMBRANO", "CALLENS", "TRAUCO", "TAPIA", "YOTUN", "CUEVA", "A.CARRILLO", "GUERRERO", "FLORES", "ARAUJO", "PENA", "LAPADULA"],
  "Paraguay": ["G.SILVA", "ESPINOLA", "GOMEZ", "ALDERETE", "ALONSO", "CUBAS", "VILLASANTI", "M.ALMIRON", "ENCISO", "SANABRIA", "SOSA", "BALBUENA", "BAREIRO", "ROJAS"],
  "Nigéria": ["NWABALI", "AINA", "EKONG", "BASSEY", "SANUSI", "ONYEKA", "IWOBI", "NDIDI", "CHUKWUEZE", "OSIMHEN", "LOOKMAN", "ONYEDIKA", "M.SIMON", "DENNIS"],
  "Égypte": ["EL.SHENAWY", "HAMDY", "HEGAZI", "ABDELMONEM", "FATHY", "ELNENY", "ZIZO", "TREZEGUET", "MARMOUSH", "M.SALAH", "MOHSEN", "KABEL", "AFSHA", "SOBHI"],
  "Cameroun": ["ONANA", "FAI", "CASTELLETTO", "WOOH", "TOLO", "ANGUISSA", "HONGLA", "MBEUMO", "TOKO.EKAMBI", "ABOUBAKAR", "CHOUPO.MOTING", "NGAMALEU", "KUNDE", "NKOUDOU"],
  "Ghana": ["ATI.ZIGI", "LAMPTEY", "DJIKU", "AMARTEY", "MENSAH", "PARTEY", "KUDUS", "A.SAMED", "J.AYEW", "SEMENYO", "SULEMANA", "ODOI", "FATAWU", "ASHIMERU"],
  "Côte d'Ivoire": ["FOFANA", "SINGO", "N.DIOMANDE", "BAILLY", "KONAN", "SERI", "KESSIE", "S.FOFANA", "PEPE", "HALLER", "GRADEL", "BOLY", "ADINGRA", "KOSSOUNOU"],
  "Algérie": ["MBOLHI", "ATAL", "BENSEBAINI", "MANDI", "AIT.NOURI", "BENNACER", "ZERROUKI", "BELAILI", "MAHREZ", "SLIMANI", "BOUNEDJAH", "TOUGAI", "AMOURA", "BRAHIMI"],
  "Tunisie": ["DAHMEN", "DRAGER", "TALBI", "BRONN", "MAALOUL", "SKHIRI", "LAIDOUNI", "MSAKNI", "ABDI", "JEBALI", "KHAZRI", "MERIAH", "SASSI", "SLITI"],
  "Mali": ["A.DIARRA", "L.KOUYATE", "SACKO", "N.KOUYATE", "TRAORE", "HAIDARA", "BISSOUMA", "SAMASSEKOU", "DOUCOURE", "N.DOUMBIA", "DJENEPO", "SINAYOKO", "DIABATE", "KONATE"],
  "Mexique": ["OCHOA", "J.SANCHEZ", "MONTES", "C.VASQUEZ", "GALLARDO", "E.ALVAREZ", "L.CHAVEZ", "H.LOZANO", "PINEDA", "R.JIMENEZ", "A.VEGA", "ARAUJO", "ROMO", "GIMENEZ"],
  "Canada": ["ST.CLAIR", "JOHNSTON", "VITORIA", "M.MILLER", "A.DAVIES", "EUSTAQUIO", "KONE", "BUCHANAN", "J.DAVID", "LARIN", "HOILETT", "CORNELIUS", "OSORIO", "UGBO"],
  "Costa Rica": ["K.NAVAS", "GAMBOA", "DUARTE", "WASTON", "OVIEDO", "TEJEDA", "BORGES", "AGUILERA", "J.CAMPBELL", "CONTRERAS", "M.VARGAS", "CALVO", "ZAMORA", "VENEGAS"],
  "Japon": ["SUZUKI", "SUGAWARA", "ITAKURA", "TOMIYASU", "NAKAYAMA", "W.ENDO", "MORITA", "T.KUBO", "MITOMA", "UEDA", "DOAN", "TANIGUCHI", "A.TANAKA", "KAMADA"],
  "Corée du Sud": ["KIM.SEUNGGYU", "KIM.MOONHWAN", "KIM.MINJAE", "KIM.YOUNGGWON", "KIM.JINSU", "HWANG.INBEOM", "LEE.JAESUNG", "SON", "LEE.KANGIN", "CHO.GUESUNG", "HWANG.HEECHAN", "KWON.KYUNGWON", "HWANG.UIJO", "OH.HYEONGYU"],
  "Australie": ["RYAN", "ATKINSON", "SOUTTAR", "ROWLES", "BEHICH", "MOOY", "IRVINE", "MCGREE", "LECKIE", "DUKE", "GOODWIN", "DEGENEK", "BACCUS", "BOYLE"],
  "Arabie Saoudite": ["AL.OWAIS", "AL.GHANNAM", "AL.BULAYHI", "AL.AMRI", "AL.SHAHRANI", "KANNO", "AL.FARAJ", "AL.DAWSARI", "AL.SHEHRI", "AL.BURAIKAN", "AL.NAJEI", "HAWSAWI", "OTAYF", "ASIRI"],
  "Iran": ["BEIRANVAND", "MOHARRAMI", "HOSSEINI", "POURALIGANJI", "HAJSAFI", "EZATOLAHI", "NOUROLLAHI", "JAHANBAKHSH", "GHODOOS", "AZMOUN", "TAREMI", "KHALILZADEH", "GHOLIZADEH", "ANSARIFARD"],
  "Qatar": ["BARSHAM", "MIGUEL", "KHOUKHI", "T.HASSAN", "PEDRO", "HATEM", "AL.HAYDOS", "MADIBO", "AKRAM.AFIF", "ALMOEZ.ALI", "BOUDIAF", "WAAD", "AL.RAWI", "MUNTARI"],
};

// Kit colour where the flag accent colour isn't the real shirt colour.
const KIT_COLOR: Record<string, string> = {
  Allemagne: "#e9e9e9", // white home shirt
  Bresil: "#f7d417", "Brésil": "#f7d417", // canary yellow
  Angleterre: "#f2f2f2", // white
};

// the real kit colour for a nation name (falls back to the flag colour)
export function kitColor(name: string, fallback: string): string {
  return KIT_COLOR[name] ?? fallback;
}

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

// Per-player skin tone (1..4 = skin01 lightest .. skin04 darkest), shirt-ordered
// to match SQUADS. Only listed nations get real tones; others keep the DB skin.
// (skinsFor() reads this for a nation name.)
export const SKINS: Record<string, number[]> = {
  // shirt-ordered, aligned with SQUADS. Approximate real-life tones; tweak freely.
  France:      [4, 4, 4, 4, 1, 4, 1, 1, 4, 4, 4, 4, 4, 1, 4, 4, 4, 4],
  Allemagne:   [1, 1, 4, 4, 1, 1, 2, 3, 1, 4, 1, 1, 1, 1, 1, 1, 1, 4],
  Espagne:     [1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 4, 1, 1, 1, 1, 1, 1, 1],
  Italie:      [1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 4, 3, 1, 1],
  Angleterre:  [1, 4, 1, 4, 1, 1, 1, 1, 4, 1, 1, 1, 1, 4, 1, 3, 4, 4],
  Portugal:    [1, 2, 1, 4, 4, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  "Pays-Bas":  [1, 4, 1, 4, 4, 1, 3, 4, 1, 4, 4, 1, 4, 4, 1, 1, 1, 4],
  Belgique:    [1, 1, 4, 1, 1, 4, 1, 1, 4, 4, 4, 1, 1, 1, 1, 4, 4, 1],
  Croatie:     [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  Suisse:      [1, 1, 4, 1, 2, 1, 1, 1, 4, 4, 3, 1, 1, 2, 4, 1, 2, 4],
  Bresil:      [1, 4, 3, 4, 4, 3, 2, 3, 4, 4, 2, 3, 4, 4, 4, 2, 3, 3],
  "Brésil":    [1, 4, 3, 4, 4, 3, 2, 3, 4, 4, 2, 3, 4, 4, 4, 2, 3, 3],
  Argentine:   [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  Uruguay:     [1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 3, 4, 1, 1, 1, 1],
  Colombie:    [2, 3, 4, 4, 3, 3, 3, 1, 4, 4, 3, 3, 2, 4, 4, 3, 2, 4],
  "États-Unis":[1, 3, 4, 4, 1, 4, 4, 4, 1, 4, 4, 1, 3, 1, 1, 2, 1, 2],
  Maroc:       [2, 3, 2, 3, 2, 2, 2, 2, 2, 3, 3, 2, 3, 2, 2, 3, 3, 3],
  "Sénégal":   [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  "Norvège":       [1, 1, 1, 1, 1, 1, 1, 1, 4, 1, 1, 1, 1, 4],
  "Danemark":      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  "Pologne":       [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  "Turquie":       [1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  "Autriche":      [1, 1, 1, 4, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1],
  "Serbie":        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  "Ukraine":       [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  "Suède":         [1, 1, 1, 4, 1, 1, 1, 1, 1, 4, 4, 1, 4, 1],
  "Écosse":        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  "Pays de Galles":[1, 4, 1, 1, 1, 1, 1, 1, 1, 4, 1, 4, 1, 1],
  "Chili":         [1, 1, 2, 1, 2, 1, 1, 1, 1, 2, 2, 1, 1, 1],
  "Équateur":      [1, 4, 3, 4, 4, 4, 3, 4, 3, 4, 1, 4, 4, 3],
  "Pérou":         [2, 2, 3, 1, 3, 3, 2, 3, 3, 3, 2, 2, 2, 1],
  "Paraguay":      [1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 3, 2],
  "Nigéria":       [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  "Égypte":        [2, 2, 3, 3, 2, 2, 2, 3, 2, 2, 3, 2, 2, 2],
  "Cameroun":      [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  "Ghana":         [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  "Côte d'Ivoire": [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  "Algérie":       [2, 3, 3, 3, 3, 2, 2, 3, 3, 2, 2, 2, 3, 2],
  "Tunisie":       [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 2, 2, 3],
  "Mali":          [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  "Mexique":       [2, 2, 2, 2, 3, 3, 2, 2, 2, 1, 2, 3, 2, 2],
  "Canada":        [1, 4, 2, 1, 4, 3, 4, 3, 4, 4, 3, 2, 3, 4],
  "Costa Rica":    [2, 2, 3, 1, 2, 2, 2, 2, 1, 3, 3, 2, 3, 2],
  "Japon":         [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  "Corée du Sud":  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  "Australie":     [1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 2, 3, 1],
  "Arabie Saoudite":[3, 2, 3, 2, 2, 3, 2, 4, 3, 2, 3, 3, 2, 3],
  "Iran":          [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  "Qatar":         [2, 2, 3, 2, 2, 3, 3, 4, 4, 4, 3, 2, 3, 4],
};
export function skinsFor(nation: string): number[] | undefined { return SKINS[nation]; }

// DEFI: apply an EXPLICIT squad (era-accurate names) + colour per side, so a
// 2006 challenge fields the 2006 XI, not the current one. `skins` (optional) is
// the per-player skin tone list, shirt-ordered like `names`.
export function applyMatchSquads(
  home: { color: string; names: string[]; skins?: number[]; strength?: number },
  away: { color: string; names: string[]; skins?: number[]; strength?: number },
): void {
  const m = mod();
  if (!m) return;
  m._gpf_clear_team_overrides?.(); // resets per-team strength back to 1.0
  const one = (team: number, color: string, names: string[], skins?: number[], strength?: number): void => {
    const [r, g, b] = hexToRgb(color);
    m._gpf_set_team_color?.(team, r, g, b);
    if (names.length && m.ccall) m.ccall("gpf_set_team_names", null, ["number", "string"], [team, names.join("|")]);
    if (skins && skins.length && m.ccall) m.ccall("gpf_set_team_skins", null, ["number", "string"], [team, skins.join("|")]);
    // realistic-strength mode: OVR-derived multiplier (undefined -> 1.0, no effect)
    if (strength != null && strength !== 1 && m.ccall)
      m.ccall("gpf_set_team_strength", null, ["number", "number"], [team, strength]);
  };
  one(0, home.color, home.names, home.skins, home.strength);
  one(1, away.color, away.names, away.skins, away.strength);
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
