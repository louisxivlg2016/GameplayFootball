# GAMEPLAY FOOTBALL — CLUB screen (`club` tab) static reproduction spec

Goal: rebuild the **CLUB** menu screen (country/league tabs across the top + a grid of
club cards, each showing the club's real Wikipedia crest, name, city and JOUER/VS
buttons) as static, self-contained HTML+CSS + a small runtime logo fetch, so it can be
overlaid in the WASM build.

Source of truth:
- JSX: `/home/louisxiv/GameplayFootball/web/src/components/Hud.tsx`
  - `ClubsMenu` component: **`Hud.tsx:1412`–`1492`**
  - `TeamBadge` component: **`Hud.tsx:328`–`356`**
- Club catalog data: `/home/louisxiv/GameplayFootball/web/src/game/clubs.ts` (`LEAGUES`, `Hud.tsx` imports it via `teams.ts`)
- Real-squad gate + Wikipedia logo resolution: `/home/louisxiv/GameplayFootball/web/src/game/teams.ts`
  - `TEAM_WIKIPEDIA_PAGE_BY_ID` map: **`teams.ts:448`–`485`**
  - `fetchWikipediaBadgeForPage`: **`teams.ts:498`–`509`**
  - `searchWikipediaPageTitle`: **`teams.ts:511`–`527`**
  - `loadTeamBadgeUrl`: **`teams.ts:533`–`550`**
  - `clubTeamId` / `clubSlug`: **`teams.ts:425`–`437`**
  - `hasRealClubSquad`: **`teams.ts:439`–`441`**
- Which clubs are playable: `/home/louisxiv/GameplayFootball/web/src/game/clubSquads.ts` (`REAL_CLUB_SQUADS`)
- CSS: the big `<style>` block in `/home/louisxiv/GameplayFootball/web/index.html`
  (club classes at **lines 1379–1517**, panel/head at **1269–1301**, wrappers/responsive noted below)

The CLUB screen renders only when the store `mode === "menu"` **and** local state
`menuTab === "club"`. It is rendered as `<ClubsMenu onPlay={...} />` inside `.menu-content`.

Default UI language is **French**; all visible strings on this screen are hard-coded
French literals in the JSX (NOT i18n) — see the header `Clubs · effectifs réels`, the
`JOUER ⚽` / `JOUER` / `VS` / `✓ MOI` / `✓ ADV` button labels. Reproduce verbatim.

---

## 1. THE `LEAGUES` DATA (playable clubs only)

### 1a. How the screen filters clubs

`ClubsMenu` (`Hud.tsx:1413-1420`) does:

```ts
const playableLeagues = LEAGUES
  .map((entry) => ({ ...entry, clubs: entry.clubs.filter((club) => hasRealClubSquad(club.name)) }))
  .filter((entry) => entry.clubs.length > 0);
```

`hasRealClubSquad(name)` = `Boolean(REAL_CLUB_SQUADS[name]?.length)` (`teams.ts:439`). So a
club card is shown **iff its exact `club.name` string is a key in `REAL_CLUB_SQUADS`** and
that squad array is non-empty. Every league keeps only its real-squad clubs, in the
league's original catalog order, and empty leagues are dropped.

### 1b. IMPORTANT — the actual playable set is 31 clubs, not ~25

Cross-referencing `REAL_CLUB_SQUADS` (31 keys, `clubSquads.ts`) against `LEAGUES`, **all 31
squad keys exist in the catalog and are shown**. The task's "~25" list was missing 6 clubs
that DO have real squads and DO appear: **Arsenal, Liverpool, Chelsea** (England),
**Juventus, Napoli** (Italy), **Galatasaray** (Autres pays). Confirmed full set below,
grouped by their real league tab (in tab order, clubs in catalog order):

| # | Tab (league.id) | Club (`club.name`) | code | city |
|---|---|---|---|---|
| **France 🇫🇷 — id `fr`** (12) | | | | |
| 1 | fr | Paris Saint-Germain | PSG | Paris |
| 2 | fr | Olympique de Marseille | OM | Marseille |
| 3 | fr | Olympique Lyonnais | OL | Lyon |
| 4 | fr | AS Monaco | ASM | Monaco |
| 5 | fr | LOSC Lille | LOSC | Lille |
| 6 | fr | OGC Nice | OGCN | Nice |
| 7 | fr | RC Lens | RCL | Lens |
| 8 | fr | Stade Rennais | SRFC | Rennes |
| 9 | fr | RC Strasbourg | RCSA | Strasbourg |
| 10 | fr | Toulouse FC | TFC | Toulouse |
| 11 | fr | FC Nantes | FCN | Nantes |
| 12 | fr | Stade Brestois | SB29 | Brest |
| **Angleterre 🏴 — id `en`** (6) | | | | |
| 13 | en | Arsenal | ARS | Londres |
| 14 | en | Liverpool | LIV | Liverpool |
| 15 | en | Manchester City | MCI | Manchester |
| 16 | en | Manchester United | MUN | Manchester |
| 17 | en | Chelsea | CHE | Londres |
| 18 | en | Tottenham Hotspur | TOT | Londres |
| **Espagne 🇪🇸 — id `es`** (3) | | | | |
| 19 | es | Real Madrid | RMA | Madrid |
| 20 | es | FC Barcelone | BAR | Barcelone |
| 21 | es | Atlético Madrid | ATM | Madrid |
| **Italie 🇮🇹 — id `it`** (4) | | | | |
| 22 | it | Inter Milan | INT | Milan |
| 23 | it | AC Milan | MIL | Milan |
| 24 | it | Juventus | JUV | Turin |
| 25 | it | Napoli | NAP | Naples |
| **Allemagne 🇩🇪 — id `de`** (3) | | | | |
| 26 | de | Bayern Munich | FCB | Munich |
| 27 | de | Borussia Dortmund | BVB | Dortmund |
| 28 | de | Bayer Leverkusen | B04 | Leverkusen |
| **Autres pays 🌍 — id `eu`** (3) | | | | |
| 29 | eu | Galatasaray | GAL | Istanbul 🇹🇷 |
| 30 | eu | Al-Nassr | NAS | Riyad 🇸🇦 |
| 31 | eu | Inter Miami | MIA | Miami 🇺🇸 |

Note the `eu` ("Autres pays") league appends a country flag emoji **inside the `city`
string** (e.g. `"Istanbul 🇹🇷"`) — those are literal text in the data, render as-is.

### 1c. Ready-to-paste array literal (playable clubs only, with real-squad flag)

This is the `LEAGUES` data pruned to exactly what the CLUB screen renders. Every field
used by a card is present: `name`, `code`, `city`, `color` (`--club-color`), `color2`
(`--club-color2`). `wiki` is the Wikipedia page title used for the logo (see §2). `id` per
club is `clubTeamId(name)` — i.e. `"club-" + slug(name)` (see §2a); precomputed here.

```ts
// Each league tab: { id, country, flag, name, clubs: [...] }
// Only clubs with a real squad (REAL_CLUB_SQUADS) are included — every one below IS playable.
const PLAYABLE_LEAGUES = [
  {
    id: "fr", country: "France", flag: "🇫🇷", name: "Ligue 1",
    clubs: [
      { name: "Paris Saint-Germain",    code: "PSG",  city: "Paris",      color: "#004170", color2: "#da291c", id: "club-paris-saint-germain",    wiki: "Paris_Saint-Germain_FC" },
      { name: "Olympique de Marseille", code: "OM",   city: "Marseille",  color: "#2faee0", color2: "#ffffff", id: "club-olympique-de-marseille", wiki: "Olympique_de_Marseille" },
      { name: "Olympique Lyonnais",     code: "OL",   city: "Lyon",       color: "#da001a", color2: "#153d8a", id: "club-olympique-lyonnais",     wiki: "Olympique_Lyonnais" },
      { name: "AS Monaco",              code: "ASM",  city: "Monaco",     color: "#e51b22", color2: "#ffffff", id: "club-as-monaco",              wiki: "AS_Monaco_FC" },
      { name: "LOSC Lille",             code: "LOSC", city: "Lille",      color: "#e01e13", color2: "#20214e", id: "club-losc-lille",             wiki: "Lille_OSC" },
      { name: "OGC Nice",               code: "OGCN", city: "Nice",       color: "#d00027", color2: "#000000", id: "club-ogc-nice",               wiki: "OGC_Nice" },
      { name: "RC Lens",                code: "RCL",  city: "Lens",       color: "#fff200", color2: "#ec1c24", id: "club-rc-lens",                wiki: "RC_Lens" },
      { name: "Stade Rennais",          code: "SRFC", city: "Rennes",     color: "#e13327", color2: "#000000", id: "club-stade-rennais",          wiki: "Stade_Rennais_FC" },
      { name: "RC Strasbourg",          code: "RCSA", city: "Strasbourg", color: "#009fe3", color2: "#ffffff", id: "club-rc-strasbourg",          wiki: "RC_Strasbourg_Alsace" },
      { name: "Toulouse FC",            code: "TFC",  city: "Toulouse",   color: "#6a2c91", color2: "#ffffff", id: "club-toulouse-fc",            wiki: "Toulouse_FC" },
      { name: "FC Nantes",              code: "FCN",  city: "Nantes",     color: "#fcd405", color2: "#008d3f", id: "club-fc-nantes",              wiki: "FC_Nantes" },
      { name: "Stade Brestois",         code: "SB29", city: "Brest",      color: "#e30613", color2: "#ffffff", id: "club-stade-brestois",         wiki: "Stade_Brestois_29" },
    ],
  },
  {
    id: "en", country: "Angleterre", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", name: "Premier League",
    clubs: [
      { name: "Arsenal",            code: "ARS", city: "Londres",    color: "#ef0107", color2: "#ffffff", id: "club-arsenal",            wiki: "Arsenal_F.C." },
      { name: "Liverpool",          code: "LIV", city: "Liverpool",  color: "#c8102e", color2: "#ffffff", id: "club-liverpool",          wiki: "Liverpool_F.C." },
      { name: "Manchester City",    code: "MCI", city: "Manchester", color: "#6cabdd", color2: "#ffffff", id: "club-manchester-city",    wiki: "Manchester_City_F.C." },
      { name: "Manchester United",  code: "MUN", city: "Manchester", color: "#da291c", color2: "#000000", id: "club-manchester-united",  wiki: "Manchester_United_F.C." },
      { name: "Chelsea",            code: "CHE", city: "Londres",    color: "#034694", color2: "#ffffff", id: "club-chelsea",            wiki: "Chelsea_F.C." },
      { name: "Tottenham Hotspur",  code: "TOT", city: "Londres",    color: "#ffffff", color2: "#132257", id: "club-tottenham-hotspur",  wiki: "Tottenham_Hotspur_F.C." },
    ],
  },
  {
    id: "es", country: "Espagne", flag: "🇪🇸", name: "La Liga",
    clubs: [
      { name: "Real Madrid",     code: "RMA", city: "Madrid",    color: "#ffffff", color2: "#febe10", id: "club-real-madrid",     wiki: "Real_Madrid_CF" },
      { name: "FC Barcelone",    code: "BAR", city: "Barcelone", color: "#a50044", color2: "#004d98", id: "club-fc-barcelone",    wiki: "FC_Barcelona" },
      { name: "Atlético Madrid", code: "ATM", city: "Madrid",    color: "#cb3524", color2: "#ffffff", id: "club-atletico-madrid", wiki: "Atlético_Madrid" },
    ],
  },
  {
    id: "it", country: "Italie", flag: "🇮🇹", name: "Serie A",
    clubs: [
      { name: "Inter Milan", code: "INT", city: "Milan",  color: "#0068a8", color2: "#000000", id: "club-inter-milan", wiki: "Inter_Milan" },
      { name: "AC Milan",    code: "MIL", city: "Milan",  color: "#fb090b", color2: "#000000", id: "club-ac-milan",    wiki: "AC_Milan" },
      { name: "Juventus",    code: "JUV", city: "Turin",  color: "#ffffff", color2: "#000000", id: "club-juventus",    wiki: "Juventus_FC" },
      { name: "Napoli",      code: "NAP", city: "Naples", color: "#12a0d7", color2: "#ffffff", id: "club-napoli",      wiki: "SSC_Napoli" },
    ],
  },
  {
    id: "de", country: "Allemagne", flag: "🇩🇪", name: "Bundesliga",
    clubs: [
      { name: "Bayern Munich",     code: "FCB", city: "Munich",     color: "#dc052d", color2: "#ffffff", id: "club-bayern-munich",     wiki: "FC_Bayern_Munich" },
      { name: "Borussia Dortmund", code: "BVB", city: "Dortmund",   color: "#fde100", color2: "#000000", id: "club-borussia-dortmund", wiki: "Borussia_Dortmund" },
      { name: "Bayer Leverkusen",  code: "B04", city: "Leverkusen", color: "#e32221", color2: "#000000", id: "club-bayer-leverkusen",  wiki: "Bayer_04_Leverkusen" },
    ],
  },
  {
    id: "eu", country: "Autres pays", flag: "🌍", name: "Grands clubs d'Europe",
    clubs: [
      { name: "Galatasaray", code: "GAL", city: "Istanbul 🇹🇷", color: "#a90432", color2: "#fdb912", id: "club-galatasaray", wiki: "Galatasaray_S.K._(football)" },
      { name: "Al-Nassr",    code: "NAS", city: "Riyad 🇸🇦",    color: "#ffe500", color2: "#00205b", id: "club-al-nassr",    wiki: "Al-Nassr_FC" },
      { name: "Inter Miami", code: "MIA", city: "Miami 🇺🇸",    color: "#f7b5cd", color2: "#000000", id: "club-inter-miami", wiki: "Inter_Miami_CF" },
    ],
  },
];
```

> The full unfiltered `LEAGUES` catalog (110+ clubs incl. non-playable ones like Newcastle,
> Real Sociedad, AS Roma, RB Leipzig, Benfica, …) lives in `clubs.ts:29-192`. You do **not**
> need them for this screen — non-playable clubs are filtered out before render. The 31
> above are the complete rendered set.

---

## 2. LOGO / CREST FETCH MECHANISM (Wikipedia)

Each card's crest comes from `<TeamBadge teamId={clubTeamId(club.name)} … fallback={club.code}/>`
(`Hud.tsx:1461-1466`). `TeamBadge` (`Hud.tsx:328-356`) calls `loadTeamBadgeUrl(teamId)` and,
while the URL is unknown/null, shows the `fallback` — i.e. the club's `code` text (PSG, OM…).
Once a URL resolves it renders `<img class="club-crest-img" src={url} loading="lazy" />`.

### 2a. The team id

`teamId = clubTeamId(club.name)` where (`teams.ts:425-437`):

```ts
function clubSlug(name) {
  return name.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")  // strip accents
    .replace(/[^a-z0-9]+/g, "-")                        // non-alnum → hyphen
    .replace(/(^-|-$)/g, "");                           // trim hyphens
}
const clubTeamId = (name) => `club-${clubSlug(name)}`;
// e.g. "Atlético Madrid" -> "club-atletico-madrid"; "AS Monaco" -> "club-as-monaco"
```

The precomputed `id` for every playable club is in the array in §1c.

### 2b. Direct page-title map (this is what actually resolves all 31 logos)

`teams.ts:448-485` defines `TEAM_WIKIPEDIA_PAGE_BY_ID`, keyed by `clubTeamId(name)`.
**Every one of the 31 playable clubs has a direct entry**, so in practice the search
fallback (§2d) never fires for them. Verbatim mapping (club name → page title), plus the 5
national teams for completeness:

```
// national teams
france     -> France_national_football_team
england    -> England_national_football_team
argentina  -> Argentina_national_football_team
portugal   -> Portugal_national_football_team
norway     -> Norway_national_football_team
// clubs (key shown as the club name passed to clubTeamId)
Paris Saint-Germain     -> Paris_Saint-Germain_FC
Olympique de Marseille  -> Olympique_de_Marseille
Olympique Lyonnais      -> Olympique_Lyonnais
AS Monaco               -> AS_Monaco_FC
LOSC Lille              -> Lille_OSC
OGC Nice                -> OGC_Nice
RC Lens                 -> RC_Lens
Stade Rennais           -> Stade_Rennais_FC
RC Strasbourg           -> RC_Strasbourg_Alsace
Toulouse FC             -> Toulouse_FC
FC Nantes               -> FC_Nantes
Stade Brestois          -> Stade_Brestois_29
Arsenal                 -> Arsenal_F.C.
Liverpool               -> Liverpool_F.C.
Manchester City         -> Manchester_City_F.C.
Manchester United       -> Manchester_United_F.C.
Chelsea                 -> Chelsea_F.C.
Tottenham Hotspur       -> Tottenham_Hotspur_F.C.
Real Madrid             -> Real_Madrid_CF
FC Barcelone            -> FC_Barcelona
Atlético Madrid         -> Atlético_Madrid
Inter Milan             -> Inter_Milan
AC Milan                -> AC_Milan
Juventus                -> Juventus_FC
Napoli                  -> SSC_Napoli
Bayern Munich           -> FC_Bayern_Munich
Borussia Dortmund       -> Borussia_Dortmund
Bayer Leverkusen        -> Bayer_04_Leverkusen
Galatasaray             -> Galatasaray_S.K._(football)
Al-Nassr                -> Al-Nassr_FC
Inter Miami             -> Inter_Miami_CF
```

(The map in source also contains a few non-playable clubs — `RB Leipzig`? no. It does list
`Juventus`, `Napoli`, `Galatasaray` which ARE playable. There are no extra keys beyond the
national teams + the 31 clubs above.)

### 2c. The summary API call (the primary fetch — use this per club)

`fetchWikipediaBadgeForPage(pageTitle)` (`teams.ts:498-509`):

```
GET https://en.wikipedia.org/api/rest_v1/page/summary/<encodeURIComponent(pageTitle)>
```

- If `!response.ok` → return `null`.
- Parse JSON, return the first of: **`data.thumbnail.source`**, else **`data.originalimage.source`**, else `null`.

So the badge URL used on the card is the REST summary endpoint's `thumbnail.source`
(a raster PNG at Wikipedia's default thumb size, e.g.
`https://upload.wikimedia.org/wikipedia/…/NNNpx-…png`), falling back to `originalimage.source`.

Concrete example the app makes for PSG:
```
https://en.wikipedia.org/api/rest_v1/page/summary/Paris_Saint-Germain_FC
```
→ JSON `.thumbnail.source` = the PSG crest thumbnail URL → set as `<img src>`.

**To replicate per club:** for each club take its `wiki` title from §1c, `encodeURIComponent`
it, fetch the summary URL, read `thumbnail.source ?? originalimage.source`. No API key, no
`origin=*` needed on the REST endpoint (it sends permissive CORS). Cache the result per id
(the app caches in `TEAM_BADGE_URL_CACHE`, `teams.ts:445`).

### 2d. Search fallback (rarely used for these 31, but replicate for parity)

If the direct page yields no image (`badgeUrl` still null), `loadTeamBadgeUrl`
(`teams.ts:533-550`) calls `searchWikipediaPageTitle(teamId)` (`teams.ts:511-527`):

```
query = isClubTeamId(teamId) ? `${team.label} football club`
                             : `${team.label} national football team`
// for a club, team.label === club.name (e.g. "Napoli football club")
GET https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=<encodeURIComponent(query)>&format=json&origin=*
```
Take `data.query.search[0].title`, replace spaces with `_`, then run §2c on that title.

Full resolution order in `loadTeamBadgeUrl`:
1. cache hit → return it;
2. `directPage = TEAM_WIKIPEDIA_PAGE_BY_ID[teamId]`; if present → summary fetch (§2c);
3. if still null → search (§2d) → summary fetch on the found title;
4. cache the result (may be `null`) and return.

### 2e. Minimal standalone JS to fetch all 31 logos (drop-in for the WASM overlay)

```js
async function fetchClubLogo(club) {          // club = one entry from PLAYABLE_LEAGUES[].clubs
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(club.wiki)}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const d = await r.json();
    return d.thumbnail?.source ?? d.originalimage?.source ?? null;
  } catch { return null; }
}
// Then, per card: const src = await fetchClubLogo(club);
//   src ? crestEl.innerHTML = `<img class="club-crest-img" src="${src}" alt="Blason ${club.name}" loading="lazy">`
//       : crestEl.innerHTML = `<span>${club.code}</span>`;   // fallback = club.code
```

---

## 3. DOM STRUCTURE (JSX → static HTML)

`ClubsMenu` renders (`Hud.tsx:1426-1491`). Outer chain in the app is
`.hud` → `.menu` → `.menu-shell` → `.menu-layout` → `.menu-content` → **`.menu-panel.club-panel`**.
For the overlay you mainly need the `.menu-panel.club-panel` subtree; the `.menu-shell`
wrapper supplies the pitch background + framing (see §4h).

Header `<b>` shows the currently selected team vs opponent (store-driven:
`getNationalTeam(nationalTeam).label vs getNationalTeam(opponentTeam).label`); default is
`France vs Angleterre`. Static reproduction can hard-code it or omit.

Per card: `--club-color`/`--club-color2` are set as inline CSS custom properties from
`club.color`/`club.color2`. `mine`/`rival` classes come from whether this club's id equals
the selected/opponent team id (adds `.club-card-mine` / `.club-card-rival`, and `.on` on the
respective action button with label `✓ MOI` / `✓ ADV`).

```html
<div class="menu-panel club-panel">
  <div class="menu-panel-head">
    <span>Clubs · effectifs réels</span>
    <b>France vs Angleterre</b>   <!-- selected vs opponent; store-driven -->
  </div>

  <!-- league/country tabs; the JOUER button is the LAST child of this row -->
  <div class="club-league-tabs">
    <button class="club-league-tab active"><span>🇫🇷</span><b>France</b></button>
    <button class="club-league-tab"><span>🏴󠁧󠁢󠁥󠁮󠁧󠁿</span><b>Angleterre</b></button>
    <button class="club-league-tab"><span>🇪🇸</span><b>Espagne</b></button>
    <button class="club-league-tab"><span>🇮🇹</span><b>Italie</b></button>
    <button class="club-league-tab"><span>🇩🇪</span><b>Allemagne</b></button>
    <button class="club-league-tab"><span>🌍</span><b>Autres pays</b></button>
    <button class="club-play-now">JOUER ⚽</button>
  </div>

  <!-- one card PER playable club in the active league -->
  <div class="club-grid">

    <!-- normal card -->
    <div class="club-card" style="--club-color:#004170;--club-color2:#da291c">
      <span class="club-crest">
        <!-- resolved: --> <img class="club-crest-img" src="…wikipedia crest…" alt="Blason Paris Saint-Germain" loading="lazy">
        <!-- fallback (until/if logo fails): <span>PSG</span> -->
      </span>
      <b>Paris Saint-Germain</b>
      <small>Paris</small>
      <span class="club-actions">
        <button title="Jouer avec ce club">JOUER</button>
        <button title="Affronter ce club">VS</button>
      </span>
    </div>

    <!-- "mine" state (this club is the player's team) -->
    <div class="club-card club-card-mine" style="--club-color:#2faee0;--club-color2:#ffffff">
      <span class="club-crest"><span>OM</span></span>
      <b>Olympique de Marseille</b>
      <small>Marseille</small>
      <span class="club-actions">
        <button class="on" title="Jouer avec ce club">✓ MOI</button>
        <button title="Affronter ce club">VS</button>
      </span>
    </div>

    <!-- "rival" state (this club is the opponent) -->
    <div class="club-card club-card-rival" style="--club-color:#da001a;--club-color2:#153d8a">
      <span class="club-crest"><span>OL</span></span>
      <b>Olympique Lyonnais</b>
      <small>Lyon</small>
      <span class="club-actions">
        <button title="Jouer avec ce club">JOUER</button>
        <button class="on" title="Affronter ce club">✓ ADV</button>
      </span>
    </div>

    <!-- …one .club-card per club in the active league… -->
  </div>
</div>
```

Button label logic (JSX `Hud.tsx:1470-1484`):
- First button: `mine ? "✓ MOI" : "JOUER"`, gets `class="on"` when `mine`. `title="Jouer avec ce club"`.
- Second button: `rival ? "✓ ADV" : "VS"`, gets `class="on"` when `rival`. `title="Affronter ce club"`.

The crest content: `TeamBadge` shows `<span>{club.code}</span>` (wrapped in `.club-crest`)
until the Wikipedia image resolves, then swaps to `<img class="club-crest-img">`.

---

## 4. CSS (verbatim from `web/index.html` `<style>`)

All the following are copied verbatim. Line references in comments.

### 4a. Panel + head (shared menu chrome) — lines 1269–1301

```css
.menu-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.menu-panel-head {
  min-height: 54px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 14px;
  background: rgba(0, 0, 0, 0.28);
  border: 2px solid rgba(255, 255, 255, 0.14);
  border-radius: 4px;
  box-sizing: border-box;
}
.menu-panel-head span {
  color: #ffe94a;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 1px;
}
.menu-panel-head b {
  color: #fff;
  font-size: 15px;
  text-align: right;
}
```

### 4b. Club panel — line 1379

```css
.club-panel {
  flex: 1;
  min-height: 0;
}
```

### 4c. League tabs (+ flag span + active) — lines 1383–1412

```css
.club-league-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.club-league-tab {
  pointer-events: auto;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 38px;
  padding: 0 13px;
  color: #dfe9e2;
  background: rgba(5, 18, 12, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.5px;
}
.club-league-tab span {
  font-size: 16px;
}
.club-league-tab.active {
  color: #08120c;
  background: #ffe94a;
  border-color: #fff3a6;
}
```

### 4d. Grid — lines 1413–1421

```css
.club-grid {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 10px;
  padding-right: 4px;
}
```

### 4e. Card + crest + name/city + mine/rival — lines 1422–1472

```css
.club-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px 10px;
  background: rgba(5, 18, 12, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-top: 3px solid var(--club-color);
  border-radius: 10px;
  text-align: center;
}
.club-crest {
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.98), rgba(224, 232, 238, 0.88));
  box-shadow: inset 0 0 0 3px rgba(0, 0, 0, 0.25), 0 6px 12px rgba(0, 0, 0, 0.35);
}
.club-crest-img {
  width: 42px;
  height: 42px;
  object-fit: contain;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.28));
}
.club-crest span {
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.5px;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85);
}
.club-card b {
  font-size: 12.5px;
  font-weight: 800;
  line-height: 1.15;
}
.club-card small {
  font-size: 10.5px;
  color: #9fb8a6;
  font-weight: 700;
}
.club-card-mine {
  border-color: #ffe94a;
  box-shadow: 0 0 0 1px #ffe94a inset;
}
.club-card-rival {
  border-color: #ff5a4e;
  box-shadow: 0 0 0 1px #ff5a4e inset;
}
```

> Note the crest FALLBACK text color: `.club-crest span` is white (`#fff`) on a
> near-white radial-gradient disc — the `text-shadow` is what keeps the club-`code`
> initials legible before/if the logo loads. The `--club-color2` custom property is set on
> every card but is **not consumed by any club CSS rule** in the shipped stylesheet (only
> `--club-color` is used, for the card's `border-top`). Keep setting both for fidelity, but
> only `--club-color` visibly matters.

### 4f. Action buttons (+ on states) — lines 1474–1501

```css
.club-actions {
  display: flex;
  gap: 6px;
  margin-top: 2px;
}
.club-actions button {
  pointer-events: auto;
  cursor: pointer;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-family: inherit;
  font-size: 10.5px;
  font-weight: 900;
  letter-spacing: 0.5px;
}
.club-actions button:first-child.on {
  background: #ffe94a;
  border-color: #fff3a6;
  color: #08120c;
}
.club-actions button:last-child.on {
  background: #d8342c;
  border-color: #ff8a80;
}
```

### 4g. JOUER "play now" pill — lines 1502–1517

```css
.club-play-now {
  pointer-events: auto;
  cursor: pointer;
  margin-left: auto;      /* pushes the pill to the far right of .club-league-tabs */
  min-height: 38px;
  padding: 0 18px;
  border-radius: 999px;
  border: 2px solid #ff9db2;
  background: #ff2e63;
  color: #fff;
  font-family: inherit;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.6px;
  box-shadow: 0 5px 0 #a01038, 0 10px 18px rgba(0, 0, 0, 0.35);
}
```

### 4h. Wrapper / background context (so the panel sits on the pitch) — lines 11–20, 196–246

Body font + colors, and the `.menu` / `.menu-shell` framing the panel lives inside. Include
if you want the exact backdrop; otherwise place `.menu-panel.club-panel` on your own bg.

```css
html, body {
  margin: 0; padding: 0; width: 100%; height: 100%;
  overflow: hidden;
  background: #060d06;
  font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;   /* the ONLY font — no @font-face/webfont */
  user-select: none;
}
.menu {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  background: #06120b; overflow: hidden;
}
.menu-shell {
  width: min(1380px, calc(100vw - 32px));
  max-height: calc(100vh - 24px);
  pointer-events: auto;
  display: flex; flex-direction: column; align-items: center;
  gap: 14px;
  padding: 28px 44px 28px;
  background:
    linear-gradient(180deg, rgba(5, 22, 15, 0.18), rgba(5, 22, 15, 0.62)),
    url("https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1600&q=80") center 48% / cover;
  border: 2px solid rgba(255, 255, 255, 0.14);
  border-radius: 6px;
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.45);
  box-sizing: border-box; position: relative; overflow: auto;
}
```

(The `.menu-shell` background is a remote Unsplash pitch photo. For a strict self-contained
overlay with no external requests, swap it for a local image or a green gradient.)

### 4i. Responsive overrides — `@media (max-width: 720px)` (block starts line 2210)

There are **no club-specific** responsive rules. The grid is already fluid via
`repeat(auto-fill, minmax(148px, 1fr))`. The only relevant override in the ≤720px block is
to the shared panel head (lines 2277–2317):

```css
@media (max-width: 720px) {
  .menu-panel-head { grid-template-columns: 1fr; }     /* line 2277-2280 (no-op here: head is flex, not grid) */
  .menu-panel-head {                                    /* line 2311 */
    align-items: flex-start;
    flex-direction: column;
  }
  .menu-panel-head b { text-align: left; }             /* line 2315 */
}
```

There is also `@media (max-height: 820px)` (line 2332) affecting `.menu-shell` sizing only —
not club-specific.

---

## 5. FONTS / ASSETS SPECIFIC TO THIS SCREEN

- **Fonts:** none special. The whole app uses the system stack
  `"Segoe UI", "Helvetica Neue", Arial, sans-serif` (index.html line 18); every club element
  uses `font-family: inherit`. No `@font-face`, no webfont.
- **Flag emojis** (tabs + inside some `eu` city strings): plain Unicode text
  (`🇫🇷`, `🏴󠁧󠁢󠁥󠁮󠁧󠁿`, `🇪🇸`, `🇮🇹`, `🇩🇪`, `🌍`, `🇹🇷`, `🇸🇦`, `🇺🇸`). Rendered by the
  system emoji font — no image assets.
- **Club crests:** fetched at runtime from Wikipedia (§2). No bundled crest images. Until a
  crest resolves (and if it fails), the fallback is the club `code` text on the white disc.
- **`JOUER ⚽` / decorative `⚽` / `⟲`** are emoji/text glyphs, no assets.
- **Background:** the only image is the remote Unsplash pitch photo on `.menu-shell`
  (§4h) — not part of the panel itself; replace with a local asset for full offline/CSP
  self-containment.

---

## 6. SUMMARY — key facts for the rebuild

1. **31 playable clubs** (not ~25), across 6 tabs: France 12, Angleterre 6, Espagne 3,
   Italie 4, Allemagne 3, Autres pays 3. A club shows iff `club.name ∈ REAL_CLUB_SQUADS`.
   Full pruned data with colors + ids + wiki titles is the paste-ready array in §1c.
2. **Logo resolution:** per club, `GET https://en.wikipedia.org/api/rest_v1/page/summary/<wikiTitle>`,
   use `thumbnail.source ?? originalimage.source`. The `wikiTitle` comes from the verbatim
   `TEAM_WIKIPEDIA_PAGE_BY_ID` map (§2b) — all 31 clubs have a hard-coded title, so the
   search fallback effectively never runs. Fallback if the fetch/field is empty: render the
   club's `code` initials (§2e).
3. **DOM:** `.menu-panel.club-panel` → `.menu-panel-head` + `.club-league-tabs`
   (tabs with `.active`, then `.club-play-now` pushed right) + `.club-grid` of `.club-card`
   (each with inline `--club-color`/`--club-color2`, `.club-crest` disc holding
   `.club-crest-img` or fallback `<span>code</span>`, name `<b>`, city `<small>`,
   `.club-actions` two buttons). `.club-card-mine`/`.club-card-rival` + button `.on` are the
   selected/opponent states.
4. **CSS** is entirely in §4, verbatim. Only `--club-color` is actually consumed (card
   `border-top`); `--club-color2` is set but unused by shipped CSS.
5. **No special fonts or bundled image assets** on this screen — system font stack, Unicode
   emoji flags, runtime-fetched Wikipedia crests.
