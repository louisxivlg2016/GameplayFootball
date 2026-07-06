# LINEUP / FORMATION screen — static-HTML rebuild spec

Goal: rebuild the "Composition / Lineup" screen (green pitch + 11 player cards on
the left, **Remplaçants** substitutes panel on the right) as **self-contained
static HTML+CSS**, no React, to overlay in a different build. This documents the
exact DOM, CSS, data, and assets from the source app.

Source app: `/home/louisxiv/GameplayFootball/web` (React + Zustand).
- JSX: `src/components/Hud.tsx`
- CSS: the big inline `<style>` block in `index.html`
- Slot layout + team model: `src/game/teams.ts`
- Squad data: `src/game/clubSquads.ts`

The screen renders when **`menuTab === "lineup"`** (`Hud.tsx:967`). It is NOT the
in-match HUD and NOT the `matchup`/`cardScene` screen — it's the pre-match
"choose your XI" tab in the menu shell.

---

## 0. Where it lives (render condition + container)

`Hud.tsx:967-1073`:

```jsx
{menuTab === "lineup" && (
  <div className="lineup-panel">
    <div className="lineup-top">
      <div>
        <span>{currentNationalTeam.label}</span>      {/* "Manchester City" */}
        <b>{t("choosePlayers")}</b>                   {/* "Choisis tes joueurs avant le match" */}
      </div>
      <button className="lineup-start" onClick={...}>
        {subFromMatch ? t("resumeMatch") : t("playMatch")}   {/* "Jouer le match" */}
      </button>
    </div>
    <div className="lineup-layout">
      <div className="lineup-pitch" aria-label={t("lineup")}> … 11 player-cards … </div>
      <div className="lineup-bench"> <span>Remplaçants</span> … bench-cards … </div>
    </div>
    {lineupDrag && <div className="lineup-drag-ghost"> … </div>}
  </div>
)}
```

The whole thing sits inside `.menu-shell` (the frosted-glass overlay panel with a
stadium photo background). For a standalone overlay you can drop `.menu-shell` and
just use `.lineup-panel` as the root, but the shell CSS is included below in case
you want the identical framing.

i18n note: the substitutes label key is `substitutes`. French value in
`src/i18n.tsx:138` is literally **`"Remplacants"`** (no cedilla in the source
string); English is `"Substitutes"`. The screenshot shows "Remplaçants" — use
whichever spelling you want; it is just the `t("substitutes")` text node inside
`.lineup-bench > span`.

---

## 1. DOM STRUCTURE (JSX → static HTML)

### 1a. Pitch container

`Hud.tsx:992-1010`:

```jsx
<div className="lineup-pitch" aria-label="Composition">
  {LINEUP_SLOT_LAYOUT.map((slot, index) => {
    const player = lineupPlayerById.get(selectedLineup[index]);
    return (
      <button
        key={`${slot.x}-${slot.y}-${player.id}`}
        data-lineup-slot={index}
        className={`player-card ${lineupFocus === player.id ? "player-card-focused" : ""}${lineupDrag?.targetSlot === index ? " player-card-drop-target" : ""}`}
        style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
        onClick={() => setLineupFocus(player.id)}
      >
        <strong>{player.rating}</strong>   {/* big rating number, top-left  */}
        <span>{player.pos}</span>          {/* position badge, top-right    */}
        <PlayerHead name={player.name} photoUrl={player.photo} />  {/* photo circle */}
        <b>{player.name}</b>               {/* name, bottom                 */}
      </button>
    );
  })}
</div>
```

Each card is a `<button>` — NOT a div. Element order inside is fixed:
`strong` (rating) → `span` (position code) → `i.player-head` (photo) → `b` (name).
The visual "top-right badge" effect is produced purely by CSS grid + a negative
`margin-top` on the `span` (see §2), not by DOM order.

**One player card, as static HTML** (example: Haaland):

```html
<button class="player-card" style="left:50%; top:9%;">
  <strong>92</strong>
  <span>BU</span>
  <i class="player-head"><img src="…haaland.jpg" alt=""></i>
  <b>Erling Haaland</b>
</button>
```

The focused (green-glow) card just adds the class:

```html
<button class="player-card player-card-focused" style="left:50%; top:90%;">
  <strong>84</strong>
  <span>BU</span>
  <i class="player-head"><img src="…marmoush.jpg" alt=""></i>
  <b>Omar Marmoush</b>
</button>
```

### 1b. `PlayerHead` (the circular photo)

`Hud.tsx:292-326`. Renders `<i class="player-head">` containing either an `<img>`
(if a photo URL is known) or the player's initials text. For a static rebuild,
inline the `<img>` (or the initials as a text fallback):

```html
<i class="player-head"><img src="PHOTO_URL" alt=""></i>
<!-- or, no photo: -->
<i class="player-head">EH</i>
```

Initials = first letter of first two space-separated name parts, uppercased
(`playerInitials`, `Hud.tsx:201-209`). "Erling Haaland" → `EH`,
"Bernardo Silva" → `BS`. When showing initials, note `.player-head` sets
`font-size: 0` on the box and `color: transparent`, so raw initials are actually
invisible unless you override — the real app relies on the image loading. (This
is why empty heads look like plain skin-tone circles.) If you want visible
initials in the static build, override `font-size`/`color` on `.player-head`.

### 1c. Formation positioning mechanism  ← IMPORTANT

There is **no CSS grid or flex** placing the cards. Each card is
`position: absolute` inside the `position: relative` `.lineup-pitch`, and gets an
**inline `left`/`top` as a percentage** from a hard-coded slot table, then is
centred on that point with `transform: translate(-50%, -50%)`.

The slot table is `LINEUP_SLOT_LAYOUT` (`src/game/teams.ts:28-40`), 11 entries,
index-aligned with the starting XI array:

```ts
export const LINEUP_SLOT_LAYOUT = [
  { x: 50, y: 90 },   // 0  GK slot          — bottom centre
  { x: 18, y: 69 },   // 1  right/left back
  { x: 38, y: 72 },   // 2  centre back
  { x: 62, y: 72 },   // 3  centre back
  { x: 82, y: 69 },   // 4  left/right back
  { x: 34, y: 49 },   // 5  def-mid
  { x: 66, y: 49 },   // 6  centre mid
  { x: 50, y: 42 },   // 7  attacking mid
  { x: 24, y: 18 },   // 8  left wing
  { x: 50, y: 9  },   // 9  striker           — top centre
  { x: 76, y: 18 },   // 10 right wing
] as const;
```

`x`/`y` are **percent of the pitch box**. `left: 50%` = horizontal centre,
`top: 9%` = near the top edge, `top: 90%` = near the bottom. So the pitch is drawn
**GK at the bottom, strikers at the top** (attacking upward). The card's own
`transform: translate(-50%, -50%)` makes `left`/`top` refer to the card's centre.

Applied exactly as: `style={{ left: `${slot.x}%`, top: `${slot.y}%` }}`
(`Hud.tsx:1000`).

`data-lineup-slot={index}` is only used for the drag-and-drop hit-testing; it has
no visual effect and can be dropped in a static build.

### 1d. Substitutes panel ("Remplaçants") + one bench row

`Hud.tsx:1011-1050`:

```jsx
<div className="lineup-bench">
  <span>Remplaçants</span>
  {currentNationalTeam.squad
    .filter((player) => !selectedLineup.includes(player.id))   // squad minus the XI
    .map((player) => (
      <button key={player.id}
              className={`bench-card ${selectedLineup.includes(player.id) ? "selected" : ""}`}
              onPointerDown={…} onClick={…}>
        <strong>{player.rating}</strong>                       {/* rating (left col) */}
        <PlayerHead name={player.name} photoUrl={player.photo} /> {/* circular photo   */}
        <b>{player.name}</b>                                   {/* name             */}
        <em>{player.pos}</em>                                  {/* position code    */}
      </button>
    ))}
</div>
```

The bench list is the whole squad **filtered to those not in the starting XI**,
in squad (array) order. It scrolls because `.lineup-bench` has `overflow: auto`.
The `.selected` class never actually applies here (a bench card is by definition
not in `selectedLineup`), so you can ignore it for the static render — but it uses
the same green outline as the focused pitch card.

**One bench row, static HTML** (example: Donnarumma):

```html
<button class="bench-card">
  <strong>89</strong>
  <i class="player-head"><img src="…donnarumma.jpg" alt=""></i>
  <b>Gianluigi Donnarumma</b>
  <em>GB</em>
</button>
```

Column layout (rating | photo | name+pos) comes from `grid-template-columns:
44px 40px 1fr` with the rating and photo spanning both rows; name (`b`) and
position (`em`) stack in the third column (see §2).

### 1e. Drag ghost (optional)

`.lineup-drag-ghost` (`Hud.tsx:1052-1072`) is the card that follows the cursor
while dragging a sub onto the pitch. It is `position: fixed` at the pointer. Not
part of the static presentation unless you want to depict a drag in progress — CSS
included below for completeness.

---

## 2. CSS — verbatim from `index.html` `<style>`

All rules below are copied exactly. Line numbers are `index.html`.

### 2a. Layout wrappers

```css
/* index.html:1863 */
.lineup-panel {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
}
/* index.html:1870 */
.lineup-top {
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 14px;
  color: #fff;
  background: rgba(4, 16, 25, 0.72);
  border: 2px solid rgba(255, 255, 255, 0.14);
  border-radius: 6px;
  box-sizing: border-box;
}
/* index.html:1883 */
.lineup-top span {
  display: block;
  color: #ffe94a;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 1px;
}
/* index.html:1890 */
.lineup-top b { font-size: 18px; }
/* index.html:1893 */
.lineup-start {
  pointer-events: auto;
  cursor: pointer;
  min-height: 42px;
  padding: 0 18px;
  color: #07100b;
  background: #ffe94a;
  border: 2px solid #fff4a6;
  border-radius: 6px;
  font-family: inherit;
  font-size: 15px;
  font-weight: 900;
  box-shadow: 0 7px 0 #b58c12, 0 12px 20px rgba(0, 0, 0, 0.38);
}
/* index.html:1907 */
.lineup-layout {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;   /* pitch fills, bench is 320px */
  gap: 14px;
}
```

### 2b. The pitch (background + markings) — index.html:1913-1942

```css
.lineup-pitch {
  position: relative;
  min-height: 0;
  overflow: hidden;
  border: 3px solid rgba(255, 255, 255, 0.28);
  border-radius: 8px;
  background:
    /* halfway line (vertical white stripe at 50%) */
    linear-gradient(90deg, transparent 49.7%, rgba(255,255,255,0.42) 49.7% 50.3%, transparent 50.3%),
    /* centre circle */
    radial-gradient(circle at 50% 50%, transparent 0 13%, rgba(255,255,255,0.45) 13.3% 13.8%, transparent 14%),
    /* mowing stripes (vertical light/dark bands) */
    linear-gradient(90deg, rgba(255,255,255,0.05) 0 10%, transparent 10% 20%, rgba(255,255,255,0.05) 20% 30%, transparent 30% 40%, rgba(255,255,255,0.05) 40% 50%, transparent 50% 60%, rgba(255,255,255,0.05) 60% 70%, transparent 70% 80%, rgba(255,255,255,0.05) 80% 90%, transparent 90%),
    /* green base gradient */
    linear-gradient(180deg, rgba(43, 132, 43, 0.95), rgba(16, 91, 31, 0.95));
  box-shadow: inset 0 0 0 4px rgba(0, 0, 0, 0.16);
}
/* the two penalty boxes, drawn as ::before (top) / ::after (bottom) */
.lineup-pitch::before,
.lineup-pitch::after {
  content: "";
  position: absolute;
  left: 34%;
  width: 32%;
  height: 16%;
  border: 3px solid rgba(255,255,255,0.45);
}
.lineup-pitch::before { top: -3px; border-top: 0; }      /* top penalty box   */
.lineup-pitch::after  { bottom: -3px; border-bottom: 0; }/* bottom penalty box */
```

The pitch is entirely CSS gradients — **no image texture**. Colour: green
`linear-gradient(180deg, rgba(43,132,43,.95), rgba(16,91,31,.95))`, white lines at
various alpha.

### 2c. Player card (pitch) — index.html:1943-1993

```css
.player-card {
  position: absolute;
  pointer-events: auto;
  cursor: pointer;
  width: 84px;
  min-height: 104px;
  transform: translate(-50%, -50%);        /* centres card on its left/top point */
  display: grid;
  grid-template-rows: auto auto 1fr auto;    /* rating / badge / photo / name */
  align-items: center;
  justify-items: center;
  padding: 6px 5px;
  color: #1b1205;
  background: linear-gradient(160deg, #f8b752, #c66d28);  /* gold/amber FUT-style card */
  border: 2px solid rgba(255, 255, 255, 0.48);
  border-radius: 9px;
  font-family: inherit;
  box-shadow: 0 10px 18px rgba(0, 0, 0, 0.4);
}
.player-card strong {           /* the big rating number */
  justify-self: start;          /* pushed to the left  */
  font-size: 18px;
  font-weight: 900;
}
.player-card span {             /* the position badge (green) */
  justify-self: end;            /* pushed to the right */
  margin-top: -21px;            /* pulled up to sit level with the rating (top-right) */
  padding: 2px 4px;
  color: #fff;
  background: rgba(30, 105, 55, 0.92);   /* GREEN badge */
  border-radius: 4px;
  font-size: 10px;
  font-weight: 900;
}
.player-card b {                /* the name */
  align-self: end;
  max-width: 100%;
  color: #fff;
  font-size: 10px;
  text-align: center;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.55);
}
.player-card-focused {          /* SELECTED / green-glow state */
  outline: 3px solid #6eff7c;
  z-index: 5;
}
.player-card-drop-target {      /* drag-hover target (yellow) — not needed for static */
  outline: 4px solid #ffe94a;
  z-index: 8;
  transform: translate(-50%, -50%) scale(1.08);
  box-shadow: 0 0 0 6px rgba(255, 233, 74, 0.18), 0 14px 24px rgba(0, 0, 0, 0.46);
}
```

### 2d. Photo circle (shared by pitch + bench) — index.html:1995-2018

```css
.player-card .player-head,
.bench-card .player-head {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: transparent;
  background: #d9b188;                    /* skin-tone fallback fill */
  border: 2px solid rgba(255, 255, 255, 0.72);
  border-radius: 50%;                      /* circular */
  font-size: 0;
  font-style: normal;
  font-weight: 900;
  overflow: hidden;
  box-shadow: 0 5px 10px rgba(0, 0, 0, 0.3);
}
.player-head img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  object-position: center 18%;             /* frames the face, not the chest */
}
.player-card-off {                         /* greyed-out (used elsewhere), FYI */
  opacity: 0.48;
  filter: grayscale(0.5);
}
```

### 2e. Substitutes panel + rows — index.html:2023-2083

```css
.lineup-bench {
  min-height: 0;
  display: grid;
  align-content: start;
  gap: 9px;
  padding: 12px;
  background: rgba(23, 82, 125, 0.72);     /* blue translucent panel */
  border: 2px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  overflow: auto;                          /* scrolls; default browser scrollbar */
}
.lineup-bench > span {                      /* the "Remplaçants" title */
  color: #fff;
  font-size: 14px;
  font-weight: 900;
  letter-spacing: 1px;
}
.bench-card {
  pointer-events: auto;
  cursor: grab;
  touch-action: none;
  min-height: 68px;
  display: grid;
  grid-template-columns: 44px 40px 1fr;    /* rating | photo | name+pos */
  gap: 2px 9px;
  align-items: center;
  padding: 8px;
  color: #1b1205;
  background: linear-gradient(160deg, #f6a852, #c95b28);  /* amber, like pitch card */
  border: 2px solid rgba(255, 255, 255, 0.42);
  border-radius: 8px;
  font-family: inherit;
  text-align: left;
}
.bench-card:active {
  cursor: grabbing;
  transform: scale(0.98);
}
.bench-card strong {                        /* rating, spans both rows */
  grid-row: span 2;
  color: #fff;
  font-size: 22px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.55);
}
.bench-card .player-head {                  /* photo, spans both rows, slightly bigger */
  grid-row: span 2;
  width: 38px;
  height: 38px;
}
.bench-card b {                             /* name */
  color: #fff;
  font-size: 13px;
}
.bench-card em {                            /* position code */
  color: rgba(255, 255, 255, 0.75);
  font-style: normal;
  font-weight: 900;
}
.bench-card.selected {                      /* same green glow as focused (unused here) */
  outline: 3px solid #6eff7c;
}
```

### 2f. Drag ghost (optional) — index.html:2084-2129

```css
.lineup-drag-ghost {
  position: fixed;
  z-index: 50;
  pointer-events: none;
  width: 128px;
  min-height: 78px;
  transform: translate(-50%, -50%) rotate(-2deg);
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 2px 8px;
  align-items: center;
  padding: 9px;
  color: #fff;
  background: linear-gradient(160deg, #ffc069, #c95b28);
  border: 3px solid #ffe94a;
  border-radius: 9px;
  box-shadow: 0 18px 34px rgba(0, 0, 0, 0.55);
  font-family: inherit;
}
.lineup-drag-ghost strong { grid-row: span 2; color: #1b1205; font-size: 22px; font-weight: 900; }
.lineup-drag-ghost .player-head {
  width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center;
  background: #d9b188; border: 2px solid rgba(255, 255, 255, 0.78); border-radius: 50%; overflow: hidden;
}
.lineup-drag-ghost b { font-size: 12px; line-height: 1.05; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.55); }
.lineup-drag-ghost em { color: rgba(255, 255, 255, 0.82); font-style: normal; font-weight: 900; }
```

### 2g. Responsive overrides (≤ some breakpoint) — index.html:2288-2310

```css
.lineup-layout { grid-template-columns: 1fr; }   /* stack: pitch above bench */
.lineup-pitch  { min-height: 380px; }
.lineup-bench  { max-height: 34vh; }
.player-card   { width: 72px; min-height: 90px; }
.player-card strong { font-size: 15px; }
.player-card span   { margin-top: -18px; font-size: 9px; }
.player-card b      { font-size: 9px; }
```
(These live inside the app's mobile `@media` block. Wrap them in your own
`@media (max-width: …)` if you want the same responsive collapse.)

### 2h. Outer shell + body (only if you want the identical frame)

```css
/* index.html:11 */
body {
  margin: 0; padding: 0; width: 100%; height: 100%;
  overflow: hidden;
  background: #060d06;
  font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;   /* the ONLY font — system stack */
  user-select: none;
}
/* index.html:228 — the frosted stadium-photo panel that wraps the whole menu */
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
/* index.html:1857 — makes the shell full-viewport when a lineup-panel is inside */
.menu-shell:has(.lineup-panel) {
  width: calc(100vw - 32px);
  min-height: calc(100vh - 32px);
  max-height: calc(100vh - 32px);
  align-items: stretch;
}
```

**Scrollbar:** there is **no custom `::-webkit-scrollbar`** anywhere in the app
(`grep` count = 0). The substitutes list uses the platform default scrollbar via
`overflow: auto`. If you want a styled scrollbar in the overlay you must add one
yourself; the original has none.

**Font:** the only typeface is the system stack
`"Segoe UI", "Helvetica Neue", Arial, sans-serif` set on `body`; everything else
inherits (`font-family: inherit`). No web font, no `@font-face`.

---

## 3. PLAYER DATA — Manchester City

### 3a. Source of truth

Squad array: `src/game/clubSquads.ts:133-152`, key `"Manchester City"` in
`REAL_CLUB_SQUADS`. Each entry is `{ name, pos, rating }` (no photo field).

How it becomes the on-screen team:
- `buildClubTeam` (`teams.ts:552-564`) → `buildTeam` (`teams.ts:72-88`) assigns each
  player a sequential numeric `id` (`nextPlayerId++`, global across all teams) and,
  because Man City has **no `defaultLineupNames`**, sets
  `defaultLineup = squad.slice(0, 11)` → **the first 11 array entries are the
  starting XI**, the rest are the bench.
- The team id is `club-manchester-city` (`clubTeamId("Manchester City")`).
- `getNationalTeam("club-manchester-city").squad` is what the screen iterates.

The comment at `clubSquads.ts:1-4` documents the fixed order of the first 11:
**`GB, DD, DC, DC, DG, MDC, MC, MOC, AG, BU, AD`** — and that order lines up 1:1
with `LINEUP_SLOT_LAYOUT` indices 0–10.

### 3b. Full Man City squad (verbatim, `clubSquads.ts:133-152`)

| # (array) | Name | pos | rating |
|----|------|-----|--------|
| 0  | Gianluigi Donnarumma | GB  | 89 |
| 1  | Matheus Nunes        | DD  | 80 |
| 2  | Ruben Dias           | DC  | 87 |
| 3  | Josko Gvardiol       | DC  | 86 |
| 4  | Rayan Ait-Nouri      | DG  | 83 |
| 5  | Rodri                | MDC | 90 |
| 6  | Bernardo Silva       | MC  | 87 |
| 7  | Phil Foden           | MOC | 87 |
| 8  | Jeremy Doku          | AG  | 85 |
| 9  | Erling Haaland       | BU  | 92 |
| 10 | Savinho              | AD  | 82 |
| 11 | James Trafford       | GB  | 80 |
| 12 | John Stones          | DC  | 85 |
| 13 | Nathan Ake           | DC  | 82 |
| 14 | Tijjani Reijnders    | MC  | 85 |
| 15 | Rayan Cherki         | MOC | 84 |
| 16 | Omar Marmoush        | BU  | 84 |
| 17 | Nico Gonzalez        | MC  | 82 |

### 3c. DEFAULT starting XI → pitch coordinates

With the unedited default lineup, slot index → player (via
`LINEUP_SLOT_LAYOUT[index]` and `selectedLineup[index]`):

| slot | left% | top% | player | pos | rating |
|------|------|------|--------|-----|--------|
| 0 | 50 | 90 | Gianluigi Donnarumma | GB  | 89 |
| 1 | 18 | 69 | Matheus Nunes        | DD  | 80 |
| 2 | 38 | 72 | Ruben Dias           | DC  | 87 |
| 3 | 62 | 72 | Josko Gvardiol       | DC  | 86 |
| 4 | 82 | 69 | Rayan Ait-Nouri      | DG  | 83 |
| 5 | 34 | 49 | Rodri                | MDC | 90 |
| 6 | 66 | 49 | Bernardo Silva       | MC  | 87 |
| 7 | 50 | 42 | Phil Foden           | MOC | 87 |
| 8 | 24 | 18 | Jeremy Doku          | AG  | 85 |
| 9 | 50 | 9  | Erling Haaland       | BU  | 92 |
| 10| 76 | 18 | Savinho              | AD  | 82 |

Default bench (squad order, minus the XI): Trafford (GB 80), Stones (DC 85),
Ake (DC 82), Reijnders (MC 85), Cherki (MOC 84), Marmoush (BU 84),
Nico Gonzalez (MC 82).

### 3d. The SCREENSHOT state (user-edited lineup)

The screenshot is **not** the default — it is a lineup the user edited (saved to
`localStorage` under key `mfp:lineup:club-manchester-city`, via
`loadSavedLineup`/`lineupStorageKey`, `Hud.tsx:170-194,427`). In the screenshot,
**slot 0 (the GK slot, bottom-centre) has been replaced by Omar Marmoush (BU 84),
and Donnarumma has dropped to the bench.** That is why there are two `BU` cards
and no visible keeper, and why the bench starts with Donnarumma.

Screenshot starting XI → coordinates (this is what to reproduce pixel-for-pixel):

| slot | left% | top% | player | pos | rating | note |
|------|------|------|--------|-----|--------|------|
| 0 | 50 | 90 | **Omar Marmoush** | BU  | 84 | **FOCUSED — green glow (`player-card-focused`)** |
| 1 | 18 | 69 | Matheus Nunes     | DD  | 80 | |
| 2 | 38 | 72 | Ruben Dias        | DC  | 87 | |
| 3 | 62 | 72 | Josko Gvardiol    | DC  | 86 | |
| 4 | 82 | 69 | Rayan Ait-Nouri   | DG  | 83 | |
| 5 | 34 | 49 | Rodri             | MDC | 90 | |
| 6 | 66 | 49 | Bernardo Silva    | MC  | 87 | |
| 7 | 50 | 42 | Phil Foden        | MOC | 87 | |
| 8 | 24 | 18 | Jeremy Doku       | AG  | 85 | |
| 9 | 50 | 9  | Erling Haaland    | BU  | 92 | |
| 10| 76 | 18 | Savinho           | AD  | 82 | |

Screenshot substitutes panel (squad order, minus the edited XI) — top to bottom:

| Name | rating | pos |
|------|--------|-----|
| Gianluigi Donnarumma | 89 | GB  |
| James Trafford       | 80 | GB  |
| John Stones          | 85 | DC  |
| Nathan Ake           | 82 | DC  |
| Tijjani Reijnders    | 85 | MC  |
| Rayan Cherki         | 84 | MOC |
| Nico Gonzalez        | 82 | MC  | ← 7th, below the fold in the screenshot |

(The task listed 6 subs; the 7th, Nico Gonzalez, is just scrolled off — the panel
scrolls.)

### 3e. Which card is highlighted / where the green glow comes from

- Highlight = the CSS class **`player-card-focused`**, added when
  `lineupFocus === player.id` (`Hud.tsx:999`). `lineupFocus` is set to the last
  clicked player (`onClick={() => setLineupFocus(player.id)}`). In the screenshot
  that is **Omar Marmoush** (slot 0).
- The glow itself is just **`outline: 3px solid #6eff7c; z-index: 5;`**
  (`index.html:1985-1988`). Bright green `#6eff7c`. The bench's equivalent
  `.bench-card.selected` uses the same `outline: 3px solid #6eff7c`.
- For the static rebuild: put `class="player-card player-card-focused"` on the one
  card you want glowing.

---

## 4. PHOTOS — how the circular player images are obtained

There are **no hard-coded photo URLs for Manchester City players.** The
`RealPlayer` records carry only `{ name, pos, rating }`; `player.photo` is
`undefined` for every City player. (The only hard-coded `photo` in the whole
codebase is France's Hugo Ekitike, `teams.ts:138-144` — irrelevant here.)

Photos are fetched at runtime by the **`PlayerHead`** component
(`Hud.tsx:292-326`) from the **Wikipedia `pageimages` API**:

```
GET https://en.wikipedia.org/w/api.php
  ?action=query
  &prop=pageimages
  &format=json
  &pithumbsize=120
  &origin=*
  &titles=<Name>|<Name> footballer
```

It takes the first page that has a `thumbnail.source` and uses that URL as the
`<img src>`; results are memoised in a module-level `wikiPhotoCache` Map. Until it
resolves, the head shows the (invisible, `font-size:0`) initials over the
`#d9b188` skin-tone circle.

**Implication for a static, self-contained overlay:** you must resolve each
player's photo URL yourself and inline it (or download and embed as a `data:`
URI, since a strict CSP overlay may block Wikimedia). To get the same image the
app would show, hit the API above per name and read
`query.pages[*].thumbnail.source` (it returns an `upload.wikimedia.org/...`
`120px-...jpg` URL). Example call for Haaland:

```
https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&pithumbsize=120&origin=*&titles=Erling%20Haaland|Erling%20Haaland%20footballer
```

If you can't fetch, fall back to the initials (override `.player-head`
`font-size`/`color` so they're visible) or your own portrait assets. The circle is
`34px` on the pitch card, `38px` on the bench card, `border-radius:50%`,
`object-fit:cover`, `object-position:center 18%`.

Note: `PlayerHead` also fetches team **badges** via a separate Wikipedia summary
API (`teams.ts:498-527`, page `Manchester_City_F.C.`), but the badge does NOT
appear on the lineup screen — that's for the matchup/national-card screens. No
badge is rendered inside `.lineup-pitch` or `.lineup-bench`.

---

## 5. ASSETS / FONTS specific to this screen

- **Pitch texture:** none — 100% CSS gradients (see §2b). No image file.
- **Font:** none bundled — system stack `"Segoe UI", "Helvetica Neue", Arial,
  sans-serif` on `body`, inherited everywhere. No `@font-face`, no web font.
- **Icons:** none on this screen (no SVG/icon font in the cards or bench).
- **Player photos:** remote, Wikipedia `pageimages` thumbnails (see §4). Host
  `upload.wikimedia.org`.
- **Shell background photo (only if you keep `.menu-shell`):** remote Unsplash
  `https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1600&q=80`
  (`index.html:239`). Not part of the pitch/bench themselves.

Key colours (hex) to hard-code:
- Card body gradient (pitch): `linear-gradient(160deg, #f8b752, #c66d28)` (gold/amber)
- Card body gradient (bench): `linear-gradient(160deg, #f6a852, #c95b28)`
- Position badge: `rgba(30, 105, 55, 0.92)` (green), text `#fff`
- Pitch green: `linear-gradient(180deg, rgba(43,132,43,.95), rgba(16,91,31,.95))`
- Pitch lines: white at 0.42 / 0.45 alpha
- Bench panel: `rgba(23, 82, 125, 0.72)` (steel blue), border white 0.16
- Selected/focused glow: outline `#6eff7c`
- Drop-target glow (drag): outline `#ffe94a`
- Card text: rating/name on cards use `#fff` with dark text-shadow; card base
  colour `#1b1205`; head fill `#d9b188`.

---

## 6. Position-code → colour mapping

**Confirmed: position badges are ALWAYS green, regardless of position.** There is
NO per-position colour map anywhere. Every `.player-card span` and every
`.bench-card em` uses the same styling:
- Pitch badge: `background: rgba(30, 105, 55, 0.92); color: #fff;` (`index.html:1971-1972`)
- Bench pos (`em`): `color: rgba(255, 255, 255, 0.75);` — plain text, no background.

The position codes are French abbreviations, taken verbatim from the `pos` string
on each player (`clubSquads.ts`). Legend:

| code | role |
|------|------|
| GB  | Gardien de but (goalkeeper) |
| DD  | Défenseur droit (right back) |
| DC  | Défenseur central (centre back) |
| DG  | Défenseur gauche (left back) |
| MDC | Milieu défensif central (defensive mid) |
| MC  | Milieu central (centre mid) |
| MOC | Milieu offensif central (attacking mid) |
| AG  | Ailier gauche (left winger) |
| AD  | Ailier droit (right winger) |
| BU  | Buteur (striker) |

The green glow / "selected" highlight (`#6eff7c`) is a separate concept from the
position badge — it is the focused-card outline (§3e), not a per-position colour.

---

## 7. Minimal self-contained rebuild checklist

1. Root: `<div class="lineup-panel">` (optionally inside `<div class="menu-shell">`).
   `.lineup-panel` needs a sized parent; give the overlay `display:grid` height.
2. `.lineup-top`: team name (`<span>Manchester City</span>`), subtitle
   (`<b>Choisis tes joueurs avant le match</b>`), and the yellow
   `<button class="lineup-start">Jouer le match</button>`.
3. `.lineup-layout` (grid `1fr 320px`) → `.lineup-pitch` + `.lineup-bench`.
4. Pitch: 11 `<button class="player-card" style="left:X%;top:Y%">` using the
   §3d coordinates; add `player-card-focused` to the Marmoush card (slot 0).
   Inside each: `<strong>rating</strong><span>POS</span>
   <i class="player-head"><img src="…"></i><b>Name</b>`.
5. Bench: `<span>Remplaçants</span>` then one `<button class="bench-card">` per
   §3d sub, structure `<strong>rating</strong>
   <i class="player-head"><img></i><b>Name</b><em>POS</em>`.
6. Paste the CSS from §2b–§2f (and §2a wrappers, §2h shell if used). No fonts, no
   images to bundle except the player photos (§4) which you should inline as
   `data:` URIs for a CSP-safe overlay.
```
