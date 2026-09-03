/**
 * Transfer-market catalogue: REAL, still-active players only (no retired
 * legends). `id` is the name the engine gets — uppercase, dots for initials,
 * same format as clubsquads.ts, so a signing renders on the shirt correctly.
 *
 * `age` is the player's age in the 2026 season. Prices are a rough market value
 * in ballons d'or: rated on ability first, with a discount for the veterans and
 * a premium on the young stars.
 */
export type Pos = "GK" | "DF" | "MF" | "FW";

export interface Target {
  id: string;      // engine name
  label: string;   // shown in the menu
  pos: Pos;
  nat: string;     // country
  flag: string;
  age: number;
  price: number;
  tier: "Légende" | "Superstar" | "Star" | "Espoir";
}

export const POS_LABEL: Record<Pos, string> = {
  GK: "Gardien", DF: "Défenseur", MF: "Milieu", FW: "Attaquant",
};

export const MARKET: Target[] = [
  // ---- gardiens ----
  { id: "COURTOIS", label: "Thibaut Courtois", pos: "GK", nat: "Belgique", flag: "🇧🇪", age: 34, price: 900, tier: "Star" },
  { id: "ALISSON", label: "Alisson Becker", pos: "GK", nat: "Brésil", flag: "🇧🇷", age: 33, price: 850, tier: "Star" },
  { id: "DONNARUMMA", label: "Gianluigi Donnarumma", pos: "GK", nat: "Italie", flag: "🇮🇹", age: 27, price: 950, tier: "Star" },
  { id: "MAIGNAN", label: "Mike Maignan", pos: "GK", nat: "France", flag: "🇫🇷", age: 31, price: 800, tier: "Star" },
  { id: "EDERSON", label: "Ederson", pos: "GK", nat: "Brésil", flag: "🇧🇷", age: 33, price: 700, tier: "Star" },
  { id: "RAYA", label: "David Raya", pos: "GK", nat: "Espagne", flag: "🇪🇸", age: 30, price: 700, tier: "Star" },

  // ---- défenseurs ----
  { id: "VAN.DIJK", label: "Virgil van Dijk", pos: "DF", nat: "Pays-Bas", flag: "🇳🇱", age: 35, price: 950, tier: "Star" },
  { id: "SALIBA", label: "William Saliba", pos: "DF", nat: "France", flag: "🇫🇷", age: 25, price: 1100, tier: "Star" },
  { id: "R.DIAS", label: "Rúben Dias", pos: "DF", nat: "Portugal", flag: "🇵🇹", age: 29, price: 1000, tier: "Star" },
  { id: "BASTONI", label: "Alessandro Bastoni", pos: "DF", nat: "Italie", flag: "🇮🇹", age: 27, price: 900, tier: "Star" },
  { id: "HAKIMI", label: "Achraf Hakimi", pos: "DF", nat: "Maroc", flag: "🇲🇦", age: 27, price: 1000, tier: "Star" },
  { id: "T.HERNANDEZ", label: "Theo Hernández", pos: "DF", nat: "France", flag: "🇫🇷", age: 28, price: 800, tier: "Star" },
  { id: "GVARDIOL", label: "Joško Gvardiol", pos: "DF", nat: "Croatie", flag: "🇭🇷", age: 24, price: 950, tier: "Star" },
  { id: "MILITAO", label: "Éder Militão", pos: "DF", nat: "Brésil", flag: "🇧🇷", age: 28, price: 800, tier: "Star" },
  { id: "MARQUINHOS", label: "Marquinhos", pos: "DF", nat: "Brésil", flag: "🇧🇷", age: 32, price: 700, tier: "Star" },
  { id: "ARAUJO", label: "Ronald Araújo", pos: "DF", nat: "Uruguay", flag: "🇺🇾", age: 27, price: 850, tier: "Star" },
  { id: "KONATE", label: "Ibrahima Konaté", pos: "DF", nat: "France", flag: "🇫🇷", age: 27, price: 800, tier: "Star" },
  { id: "UPAMECANO", label: "Dayot Upamecano", pos: "DF", nat: "France", flag: "🇫🇷", age: 27, price: 750, tier: "Star" },
  { id: "ALEXANDER.ARNOLD", label: "Trent Alexander-Arnold", pos: "DF", nat: "Angleterre", flag: "🏴", age: 27, price: 1000, tier: "Star" },
  { id: "N.MENDES", label: "Nuno Mendes", pos: "DF", nat: "Portugal", flag: "🇵🇹", age: 24, price: 900, tier: "Star" },
  { id: "CUBARSI", label: "Pau Cubarsí", pos: "DF", nat: "Espagne", flag: "🇪🇸", age: 19, price: 500, tier: "Espoir" },
  { id: "HUIJSEN", label: "Dean Huijsen", pos: "DF", nat: "Espagne", flag: "🇪🇸", age: 21, price: 450, tier: "Espoir" },
  { id: "YORO", label: "Leny Yoro", pos: "DF", nat: "France", flag: "🇫🇷", age: 20, price: 420, tier: "Espoir" },

  // ---- milieux ----
  { id: "RODRI", label: "Rodri", pos: "MF", nat: "Espagne", flag: "🇪🇸", age: 30, price: 1300, tier: "Star" },
  { id: "BELLINGHAM", label: "Jude Bellingham", pos: "MF", nat: "Angleterre", flag: "🏴", age: 23, price: 1800, tier: "Superstar" },
  { id: "PEDRI", label: "Pedri", pos: "MF", nat: "Espagne", flag: "🇪🇸", age: 23, price: 1400, tier: "Superstar" },
  { id: "WIRTZ", label: "Florian Wirtz", pos: "MF", nat: "Allemagne", flag: "🇩🇪", age: 23, price: 1500, tier: "Superstar" },
  { id: "MUSIALA", label: "Jamal Musiala", pos: "MF", nat: "Allemagne", flag: "🇩🇪", age: 23, price: 1500, tier: "Superstar" },
  { id: "DE.BRUYNE", label: "Kevin De Bruyne", pos: "MF", nat: "Belgique", flag: "🇧🇪", age: 35, price: 900, tier: "Star" },
  { id: "VALVERDE", label: "Federico Valverde", pos: "MF", nat: "Uruguay", flag: "🇺🇾", age: 28, price: 1200, tier: "Star" },
  { id: "VITINHA", label: "Vitinha", pos: "MF", nat: "Portugal", flag: "🇵🇹", age: 26, price: 1200, tier: "Star" },
  { id: "TCHOUAMENI", label: "Aurélien Tchouaméni", pos: "MF", nat: "France", flag: "🇫🇷", age: 26, price: 1000, tier: "Star" },
  { id: "CAMAVINGA", label: "Eduardo Camavinga", pos: "MF", nat: "France", flag: "🇫🇷", age: 23, price: 950, tier: "Star" },
  { id: "ODEGAARD", label: "Martin Ødegaard", pos: "MF", nat: "Norvège", flag: "🇳🇴", age: 27, price: 1100, tier: "Star" },
  { id: "RICE", label: "Declan Rice", pos: "MF", nat: "Angleterre", flag: "🏴", age: 27, price: 1200, tier: "Star" },
  { id: "MAC.ALLISTER", label: "Alexis Mac Allister", pos: "MF", nat: "Argentine", flag: "🇦🇷", age: 27, price: 1000, tier: "Star" },
  { id: "SZOBOSZLAI", label: "Dominik Szoboszlai", pos: "MF", nat: "Hongrie", flag: "🇭🇺", age: 25, price: 900, tier: "Star" },
  { id: "BARELLA", label: "Nicolò Barella", pos: "MF", nat: "Italie", flag: "🇮🇹", age: 29, price: 900, tier: "Star" },
  { id: "DE.JONG", label: "Frenkie de Jong", pos: "MF", nat: "Pays-Bas", flag: "🇳🇱", age: 29, price: 850, tier: "Star" },
  { id: "KIMMICH", label: "Joshua Kimmich", pos: "MF", nat: "Allemagne", flag: "🇩🇪", age: 31, price: 850, tier: "Star" },
  { id: "B.FERNANDES", label: "Bruno Fernandes", pos: "MF", nat: "Portugal", flag: "🇵🇹", age: 31, price: 900, tier: "Star" },
  { id: "MODRIC", label: "Luka Modrić", pos: "MF", nat: "Croatie", flag: "🇭🇷", age: 40, price: 600, tier: "Star" },
  { id: "ZAIRE.EMERY", label: "Warren Zaïre-Emery", pos: "MF", nat: "France", flag: "🇫🇷", age: 20, price: 500, tier: "Espoir" },
  { id: "MAINOO", label: "Kobbie Mainoo", pos: "MF", nat: "Angleterre", flag: "🏴", age: 21, price: 450, tier: "Espoir" },
  { id: "CHERKI", label: "Rayan Cherki", pos: "MF", nat: "France", flag: "🇫🇷", age: 23, price: 500, tier: "Espoir" },
  { id: "J.NEVES", label: "João Neves", pos: "MF", nat: "Portugal", flag: "🇵🇹", age: 22, price: 700, tier: "Espoir" },
  { id: "BERNARDO", label: "Bernardo Silva", pos: "MF", nat: "Portugal", flag: "🇵🇹", age: 32, price: 750, tier: "Star" },

  // ---- attaquants ----
  { id: "MBAPPE", label: "Kylian Mbappé", pos: "FW", nat: "France", flag: "🇫🇷", age: 27, price: 2800, tier: "Légende" },
  { id: "MESSI", label: "Lionel Messi", pos: "FW", nat: "Argentine", flag: "🇦🇷", age: 39, price: 2200, tier: "Légende" },
  { id: "C.RONALDO", label: "Cristiano Ronaldo", pos: "FW", nat: "Portugal", flag: "🇵🇹", age: 41, price: 2000, tier: "Légende" },
  { id: "NEYMAR", label: "Neymar Jr", pos: "FW", nat: "Brésil", flag: "🇧🇷", age: 34, price: 1500, tier: "Légende" },
  { id: "HAALAND", label: "Erling Haaland", pos: "FW", nat: "Norvège", flag: "🇳🇴", age: 26, price: 2400, tier: "Superstar" },
  { id: "YAMAL", label: "Lamine Yamal", pos: "FW", nat: "Espagne", flag: "🇪🇸", age: 19, price: 2300, tier: "Superstar" },
  { id: "DOUE", label: "Désiré Doué", pos: "FW", nat: "France", flag: "🇫🇷", age: 21, price: 1800, tier: "Superstar" },
  { id: "VINICIUS", label: "Vinícius Júnior", pos: "FW", nat: "Brésil", flag: "🇧🇷", age: 26, price: 2000, tier: "Superstar" },
  { id: "SALAH", label: "Mohamed Salah", pos: "FW", nat: "Égypte", flag: "🇪🇬", age: 34, price: 1500, tier: "Superstar" },
  { id: "KANE", label: "Harry Kane", pos: "FW", nat: "Angleterre", flag: "🏴", age: 33, price: 1600, tier: "Superstar" },
  { id: "LEWANDOWSKI", label: "Robert Lewandowski", pos: "FW", nat: "Pologne", flag: "🇵🇱", age: 38, price: 1000, tier: "Star" },
  { id: "SON", label: "Son Heung-min", pos: "FW", nat: "Corée du Sud", flag: "🇰🇷", age: 34, price: 900, tier: "Star" },
  { id: "OSIMHEN", label: "Victor Osimhen", pos: "FW", nat: "Nigeria", flag: "🇳🇬", age: 27, price: 1300, tier: "Star" },
  { id: "L.MARTINEZ", label: "Lautaro Martínez", pos: "FW", nat: "Argentine", flag: "🇦🇷", age: 29, price: 1300, tier: "Star" },
  { id: "J.ALVAREZ", label: "Julián Álvarez", pos: "FW", nat: "Argentine", flag: "🇦🇷", age: 26, price: 1400, tier: "Star" },
  { id: "KVARATSKHELIA", label: "Khvicha Kvaratskhelia", pos: "FW", nat: "Géorgie", flag: "🇬🇪", age: 25, price: 1400, tier: "Star" },
  { id: "DEMBELE", label: "Ousmane Dembélé", pos: "FW", nat: "France", flag: "🇫🇷", age: 29, price: 1500, tier: "Star" },
  { id: "RODRYGO", label: "Rodrygo", pos: "FW", nat: "Brésil", flag: "🇧🇷", age: 25, price: 1300, tier: "Star" },
  { id: "LEAO", label: "Rafael Leão", pos: "FW", nat: "Portugal", flag: "🇵🇹", age: 27, price: 1100, tier: "Star" },
  { id: "N.WILLIAMS", label: "Nico Williams", pos: "FW", nat: "Espagne", flag: "🇪🇸", age: 24, price: 1300, tier: "Star" },
  { id: "SAKA", label: "Bukayo Saka", pos: "FW", nat: "Angleterre", flag: "🏴", age: 24, price: 1500, tier: "Star" },
  { id: "GYOKERES", label: "Viktor Gyökeres", pos: "FW", nat: "Suède", flag: "🇸🇪", age: 28, price: 1200, tier: "Star" },
  { id: "SESKO", label: "Benjamin Šeško", pos: "FW", nat: "Slovénie", flag: "🇸🇮", age: 23, price: 1100, tier: "Star" },
  { id: "VLAHOVIC", label: "Dušan Vlahović", pos: "FW", nat: "Serbie", flag: "🇷🇸", age: 26, price: 900, tier: "Star" },
  { id: "KOLO.MUANI", label: "Randal Kolo Muani", pos: "FW", nat: "France", flag: "🇫🇷", age: 27, price: 800, tier: "Star" },
  { id: "DOKU", label: "Jérémy Doku", pos: "FW", nat: "Belgique", flag: "🇧🇪", age: 24, price: 900, tier: "Star" },
  { id: "OLISE", label: "Michael Olise", pos: "FW", nat: "France", flag: "🇫🇷", age: 24, price: 1200, tier: "Star" },
  { id: "BARCOLA", label: "Bradley Barcola", pos: "FW", nat: "France", flag: "🇫🇷", age: 24, price: 800, tier: "Espoir" },
  { id: "ENDRICK", label: "Endrick", pos: "FW", nat: "Brésil", flag: "🇧🇷", age: 20, price: 600, tier: "Espoir" },
  { id: "GITTENS", label: "Jamie Gittens", pos: "FW", nat: "Angleterre", flag: "🏴", age: 22, price: 450, tier: "Espoir" },
  { id: "GARNACHO", label: "Alejandro Garnacho", pos: "FW", nat: "Argentine", flag: "🇦🇷", age: 22, price: 550, tier: "Espoir" },
  { id: "MAYULU", label: "Senny Mayulu", pos: "FW", nat: "France", flag: "🇫🇷", age: 20, price: 380, tier: "Espoir" },
  { id: "BEN.SEGHIR", label: "Eliesse Ben Seghir", pos: "FW", nat: "Maroc", flag: "🇲🇦", age: 21, price: 400, tier: "Espoir" },
];

/** Countries present in the catalogue, alphabetical. */
export function marketCountries(): string[] {
  return [...new Set(MARKET.map((t) => t.nat))].sort((a, b) => a.localeCompare(b, "fr"));
}
