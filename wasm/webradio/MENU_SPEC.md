# GAMEPLAY FOOTBALL — Main Menu (home tab) static reproduction spec

Goal: rebuild the **MAIN** menu screen (sidebar + title + 4 player photos + 3 mode
cards + players selector, over a green pitch background) as static, self-contained
HTML+CSS so it can be shown as an overlay in the WASM build.

Source of truth:
- JSX: `/home/louisxiv/GameplayFootball/web/src/components/Hud.tsx`
- CSS: the big `<style>` block in `/home/louisxiv/GameplayFootball/web/index.html`

The menu is only rendered when the zustand store `mode === "menu"` **and** the local
state `menuTab === "home"` (default). Relevant JSX: `Hud.tsx:697` (`mode === "menu"`
wrapper) → `Hud.tsx:742` (`menuTab === "home"` block).

Language note: the UI text is i18n-driven. Default language falls back to **French**
(`detectLanguage()` in `src/i18n.tsx:1960`, returns `"fr"` when nothing else matches).
Below I give the rendered **French** strings (what the app ships by default) and, in
`{...}` comments, the translation key so you can swap languages. English equivalents are
in `src/i18n.tsx` (`en` table at line ~22).

---

## 1. DOM STRUCTURE (JSX → static HTML)

Outer chain is `.hud` → `.menu` → (two decorative side gradients) → `.menu-shell` →
`.menu-layout` (grid: `86px | 1fr`) → `.menu-sidebar` + `.menu-content`.

The `.menu-top-tools` block (SON / RADIO STADE / LANGUE, top-right) is the piece you
said you already have — it is the first child of `.menu-shell`, **before**
`.menu-layout`. I include a stub for correct positioning; drop in your own.

Static HTML (French default text):

```html
<div class="hud">
  <!-- menu music <audio> is here but hidden; not visual -->

  <div class="menu">
    <!-- two decorative edge gradients; both have opacity:0 by default (invisible) -->
    <div class="menu-side menu-side-red"></div>
    <div class="menu-side menu-side-blue"></div>

    <div class="menu-shell">
      <!-- ==== TOP-RIGHT TOOLS: SON / RADIO STADE / LANGUE (you already have these) ==== -->
      <div class="menu-top-tools">
        <!-- SoundToggleButton / RadioToggleButton / LanguagePicker render here -->
      </div>

      <!-- optional first-run language modal (.menu-language-modal-backdrop) — usually absent -->

      <div class="menu-layout">
        <!-- ==== LEFT SIDEBAR: MAIN / CLUB / NATIONAL / DEFI ==== -->
        <aside class="menu-sidebar">
          <button class="menu-sidebar-button active">      <!-- MAIN is active/highlighted -->
            <span class="menu-sidebar-icon">⌂</span><b>MAIN</b>
          </button>
          <button class="menu-sidebar-button">
            <span class="menu-sidebar-icon">◎</span><b>CLUB</b>
          </button>
          <button class="menu-sidebar-button">
            <span class="menu-sidebar-icon">◔</span><b>NATIONAL</b>
          </button>
          <button class="menu-sidebar-button">
            <span class="menu-sidebar-icon">◌</span><b>DEFI</b>
          </button>
        </aside>

        <!-- ==== RIGHT CONTENT ==== -->
        <div class="menu-content">

          <!-- 4 player photos (Haaland / Mbappé / Ronaldo / Messi).
               NOTE: both classes present. .menu-hero-legends turns this into an
               absolutely-positioned overlapping "hero" band (height 430px), and the
               <b> name labels are hidden (.legend-card b { display:none }). -->
          <div class="legend-strip menu-hero-legends" aria-hidden="true">
            <div class="legend-card">
              <img class="legend-photo" src="{HAALAND_URL}" alt=""><b>Haaland</b>
            </div>
            <div class="legend-card">
              <img class="legend-photo" src="{MBAPPE_URL}" alt=""><b>Mbappé</b>
            </div>
            <div class="legend-card">
              <img class="legend-photo" src="{RONALDO_URL}" alt=""><b>Ronaldo</b>
            </div>
            <div class="legend-card">
              <img class="legend-photo" src="{MESSI_URL}" alt=""><b>Messi</b>
            </div>
          </div>

          <!-- BIG TITLE: GAMEPLAY (white) FOOTBALL (yellow) -->
          <div class="menu-title-row">
            <h1>GAMEPLAY <span>FOOTBALL</span></h1>
          </div>

          <!-- 3 MODE CARDS. Each is an image-mode button: the visible card art is the
               PNG; the caption/note text is overlaid bottom-left over the image.
               Card art (what you see): MATCH AMICAL (green), ENTRAINEMENT (blue),
               COUPE DU MONDE (gold/red) — baked into the PNGs.
               The overlaid caption text is the i18n title (Jouer / Entrainement /
               Coupe du monde). tone class (yellow/green/blue) is inert here because
               .image-mode-button forces transparent bg. -->
          <div class="menu-main-actions">
            <button class="menu-mode-button mode-yellow image-mode-button">
              <img src="{PLAY_BTN_PNG}" alt="Jouer">
              <span class="image-mode-caption">Jouer</span>            <!-- t("play") -->
              <em class="image-mode-note">Lance un vrai match direct</em> <!-- t("playNote") -->
            </button>
            <button class="menu-mode-button mode-green image-mode-button">
              <img src="{TRAINING_BTN_PNG}" alt="Entrainement">
              <span class="image-mode-caption">Entrainement</span>      <!-- t("training") -->
              <em class="image-mode-note">Penalty, corner, coup franc, hors-jeu, tacle, dribble</em> <!-- t("trainingNote") -->
            </button>
            <button class="menu-mode-button mode-blue image-mode-button">
              <img src="{WORLDCUP_BTN_PNG}" alt="Coupe du monde">
              <span class="image-mode-caption">Coupe du monde</span>    <!-- t("worldCup") -->
              <em class="image-mode-note">Calendrier, groupes et finale</em> <!-- t("worldCupNote") -->
            </button>
          </div>

          <!-- BOTTOM BAR: JOUEURS  1 JOUEUR  2 JOUEURS (PlayersToggle component) -->
          <div class="home-settings-strip home-settings-strip-solo">
            <button class="menu-option tile-blue">
              <span class="menu-key">J</span>
              <span class="menu-option-label">Joueurs</span>            <!-- t("players") -->
              <span class="menu-choice-line">
                <!-- active side gets .active-choice + colour class; other side .muted-choice -->
                <span class="active-choice yellow-choice">1 JOUEUR</span> <!-- t("onePlayer"); players===1 -->
                <span class="muted-choice">2 JOUEURS</span>              <!-- t("twoPlayers") -->
              </span>
              <!-- when players===2 an extra note appears (hidden in this strip via CSS):
                   <span class="menu-option-note">versus local : J1 dirige les ROUGES, J2 dirige les BLEUS</span> -->
            </button>
          </div>

          <!-- keyboard help block (hidden under 820px tall). players===1 variant: -->
          <div class="controls">
            WASD / Fleches pour bouger   Shift pour sprinter<br>
            Espace tir   X passe   C lobee   V tete   E tacle glisse<br>
            Gardien : tu le controles sur les tirs et penalties - Espace ou E plonge du cote du joystick<br>
            R radio   Esc pause
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

JSX line references:
- `.menu` / `.menu-side*`: `Hud.tsx:698-700`
- `.menu-shell`: `Hud.tsx:701`
- `.menu-top-tools` (SON/RADIO/LANGUE): `Hud.tsx:702-717`
- `.menu-layout`: `Hud.tsx:725`
- `.menu-sidebar` + buttons (data from `MENU_SIDEBAR_ITEMS`, `Hud.tsx:165-170`): `Hud.tsx:726-740`
- `.menu-content` home block: `Hud.tsx:742-805`
- legend strip (data from `MENU_LEGENDS`, `Hud.tsx:140-161`): `Hud.tsx:744-751`
- title: `Hud.tsx:752-756`
- 3 mode cards (`MenuModeButton`, component at `Hud.tsx:1137-1169`): `Hud.tsx:757-782`
- players strip (`PlayersToggle`, component at `Hud.tsx:1348-1369`): `Hud.tsx:783-785`
- controls: `Hud.tsx:786-804`

Sidebar item glyphs (icons are plain Unicode text, not image files):
`MAIN = ⌂` (U+2302 house), `CLUB = ◎` (U+25CE), `NATIONAL = ◔` (U+25D4),
`DEFI = ◌` (U+25CC).

---

## 2. CSS (verbatim from `web/index.html` `<style>`)

Everything below is copied exactly. Only rules that affect the **home** screen are
included (I dropped lineup/matchup/national/club/training/worldcup-panel/scoreboard
rules that never show on the home tab). Global reset + `.hud` first.

```css
/* ---- global ---- */
html,
body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #060d06;
  font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  user-select: none;
}
#root {
  width: 100%;
  height: 100%;
}
.hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
  color: #fff;
}

/* ---- menu shell & background ---- */
.menu {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #06120b;
  overflow: hidden;
}
.menu::before {
  content: "";
  position: absolute;
  inset: 12px;
  border: 2px solid rgba(255, 255, 255, 0.08);
  pointer-events: none;
}
.menu-side {
  position: absolute;
  top: 0;
  bottom: 0;
  width: min(16vw, 190px);
  opacity: 0;
}
.menu-side-red {
  left: 0;
  background: linear-gradient(90deg, rgba(216, 52, 44, 0.72), rgba(216, 52, 44, 0));
}
.menu-side-blue {
  right: 0;
  background: linear-gradient(270deg, rgba(36, 89, 214, 0.72), rgba(36, 89, 214, 0));
}
.menu-shell {
  width: min(1380px, calc(100vw - 32px));
  max-height: calc(100vh - 24px);
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 28px 44px 28px;
  background:
    linear-gradient(180deg, rgba(5, 22, 15, 0.18), rgba(5, 22, 15, 0.62)),
    url("https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1600&q=80") center 48% / cover;
  border: 2px solid rgba(255, 255, 255, 0.14);
  border-radius: 6px;
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.45);
  box-sizing: border-box;
  position: relative;
  overflow: auto;
}
.menu-shell::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(2, 8, 7, 0.34)),
    radial-gradient(circle at 50% 24%, rgba(255, 233, 74, 0.18), transparent 28%);
  pointer-events: none;
}
.menu-shell > * {
  position: relative;
  z-index: 1;
}
/* the home tab specifically: full-height shell, tighter left padding */
.menu-shell:has(.menu-hero-legends) {
  min-height: calc(100vh - 32px);
  overflow: hidden;
  padding-left: 12px;
}

/* ---- layout: sidebar | content ---- */
.menu-layout {
  width: 100%;
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr);
  gap: 12px;
}
.menu-sidebar {
  min-height: 100%;
  display: grid;
  align-content: start;
  gap: 0;
  background: linear-gradient(180deg, rgba(4, 18, 10, 0.94), rgba(2, 10, 8, 0.96));
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04), 0 18px 26px rgba(0, 0, 0, 0.35);
}
.menu-sidebar-button {
  pointer-events: auto;
  cursor: pointer;
  min-height: 92px;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 7px;
  color: #fff;
  background: transparent;
  border: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-family: inherit;
  font-size: 12px;
  font-weight: 900;
  text-align: center;
}
.menu-sidebar-button.active {
  background: linear-gradient(180deg, #ff1c67, #d71753);   /* pink/red highlight */
}
.menu-sidebar-icon {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  font-size: 22px;
  line-height: 1;
}
.menu-sidebar-button.active .menu-sidebar-icon {
  background: rgba(255, 255, 255, 0.18);
}
.menu-sidebar-button b {
  font-size: 10px;
  letter-spacing: 0.9px;
  text-transform: uppercase;
}
.menu-content {
  position: relative;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: hidden;
}

/* ---- title ---- */
.menu-title-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: 18px;
  width: 100%;
}
.menu h1 {
  font-size: clamp(32px, 5vw, 58px);
  font-weight: 900;
  color: #fff;
  letter-spacing: 2px;
  margin: 0;
  text-align: center;
  text-shadow: 0 4px 24px rgba(0, 0, 0, 0.9);
}
.menu h1 span {
  color: #ffe94a;            /* FOOTBALL = yellow */
}

/* ---- player photos (base legend-strip, then hero override) ---- */
.legend-strip {
  width: min(720px, 100%);
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: end;
  gap: 14px;
}
.legend-card {
  min-height: 118px;
  display: grid;
  grid-template-rows: 1fr auto;
  place-items: center;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  overflow: visible;
}
.legend-photo {
  width: 100%;
  height: 104px;
  object-fit: cover;
  object-position: center 18%;
  border-radius: 0;
  background: transparent;
  filter: drop-shadow(0 13px 12px rgba(0, 0, 0, 0.45));
}
.legend-card b {
  display: none;             /* the player names are NOT shown */
}
.menu-hero-legends {
  position: absolute;
  inset: 92px 80px auto 80px;
  z-index: 0;
  width: auto;
  height: 430px;
  display: grid;
  grid-template-columns: 0.98fr 1.18fr 1.1fr 1fr;
  gap: clamp(14px, 2.1vw, 34px);
  align-items: end;
  opacity: 0.98;
  pointer-events: none;
}
.menu-hero-legends .legend-card {
  min-height: 430px;
  overflow: hidden;
  border-radius: 44% 44% 18px 18px / 24% 24% 18px 18px;
  -webkit-mask-image:
    linear-gradient(90deg, transparent 0, #000 10%, #000 90%, transparent 100%),
    linear-gradient(180deg, #000 0, #000 82%, transparent 100%);
  -webkit-mask-composite: source-in;
  mask-image:
    linear-gradient(90deg, transparent 0, #000 10%, #000 90%, transparent 100%),
    linear-gradient(180deg, #000 0, #000 82%, transparent 100%);
  mask-composite: intersect;
}
.menu-hero-legends .legend-photo {
  height: 430px;
  object-fit: cover;
  object-position: center 6%;
  filter: saturate(1.1) contrast(1.06) drop-shadow(0 24px 18px rgba(0, 0, 0, 0.42));
}
.menu-hero-legends .legend-card:nth-child(1) {
  transform: translateX(16px) translateY(10px) scale(1.04);
  z-index: 1;
}
.menu-hero-legends .legend-card:nth-child(2) {
  transform: translateX(-2px) translateY(-18px) scale(1.12);
  z-index: 3;
}
.menu-hero-legends .legend-card:nth-child(3) {
  transform: translateX(2px) translateY(0) scale(1.08);
  z-index: 2;
}
.menu-hero-legends .legend-card:nth-child(4) {
  transform: translateX(-16px) translateY(8px) scale(1.04);
  z-index: 1;
}

/* ---- 3 mode cards ---- */
.menu-main-actions {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
/* home layout: the actions row is pushed to the bottom and down by 200px so it
   sits below the tall hero-legend band. Both rules exist verbatim: */
.menu-hero-legends + .menu-title-row + .menu-main-actions {
  z-index: 2;
}
.menu-hero-legends + .menu-title-row + .menu-main-actions {
  margin-top: auto;
  margin-bottom: 0;
  transform: translateY(200px);
}
.menu-mode-button {
  pointer-events: auto;
  cursor: pointer;
  min-height: 148px;
  padding: 17px;
  position: relative;
  display: grid;
  align-content: space-between;
  gap: 10px;
  text-align: left;
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
  border: 3px solid rgba(255, 255, 255, 0.18);
  border-radius: 6px;
  box-shadow: inset 0 -8px 0 rgba(0, 0, 0, 0.18), 0 16px 28px rgba(0, 0, 0, 0.34);
  font-family: inherit;
  overflow: hidden;
}
.image-mode-button {
  padding: 0;
  place-items: center;
  background: transparent;
  border: 0 !important;
  box-shadow: none !important;
}
.image-mode-button.mode-yellow,
.image-mode-button.mode-green,
.image-mode-button.mode-blue {
  background: transparent;
  border-color: transparent;
}
.image-mode-button img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  filter: drop-shadow(0 16px 20px rgba(0, 0, 0, 0.34));
}
.image-mode-caption,
.image-mode-note {
  position: absolute;
  left: 18px;
  right: 18px;
  width: auto !important;
  max-width: none !important;
  padding: 0 !important;
  background: none !important;
  border-radius: 0 !important;
  text-align: left;
  color: #fff !important;
  text-shadow: 0 3px 12px rgba(0, 0, 0, 0.7);
  pointer-events: none;
}
.image-mode-caption {
  bottom: 20px;
  font-size: clamp(20px, 2vw, 28px) !important;
  font-weight: 900 !important;
  line-height: 0.95;
}
.image-mode-note {
  bottom: 4px;
  font-size: 12px !important;
  font-style: normal;
  font-weight: 800 !important;
  opacity: 0.92;
}
/* 3rd card (Coupe du monde) image shrinks to 74% and centres */
.menu-main-actions .image-mode-button:nth-child(3) img {
  width: 74%;
  height: 74%;
  justify-self: center;
  align-self: center;
}
/* text-mode fallbacks (only used if a card has NO image — not the case on home) */
.menu-mode-button span {
  width: max-content;
  max-width: 100%;
  padding: 5px 8px;
  color: #07100b;
  background: #fff;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.8px;
}
.menu-mode-button b {
  color: #fff;
  font-size: clamp(21px, 2.15vw, 28px);
  font-weight: 900;
  line-height: 0.95;
  text-shadow: 0 3px 12px rgba(0, 0, 0, 0.55);
  overflow-wrap: anywhere;
}
.menu-mode-button em {
  color: rgba(255, 255, 255, 0.82);
  font-size: 13px;
  font-style: normal;
  font-weight: 800;
  line-height: 1.25;
}
.mode-yellow {
  background: linear-gradient(160deg, #f3c52a, #a86d10);
  border-color: #fff1a4;
}
.mode-green {
  background: linear-gradient(160deg, #1e9b50, #0d4f2b);
  border-color: #91f58a;
}
.mode-blue {
  background: linear-gradient(160deg, #2f65ef, #142c80);
  border-color: #8fd7ff;
}
.menu-mode-button:active {
  transform: translateY(3px);
}

/* ---- players selector strip ---- */
.home-settings-strip {
  margin-top: auto;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  z-index: 3;
}
.home-settings-strip-solo {
  grid-template-columns: 1fr;
}
.home-settings-strip .menu-option {
  min-height: 64px;
  background: rgba(5, 18, 12, 0.72);
  backdrop-filter: blur(4px);
}
.home-settings-strip .menu-option-note {
  display: none;
}
.menu-option {
  pointer-events: auto;
  cursor: pointer;
  min-height: 76px;
  display: grid;
  grid-template-columns: 38px 1fr;
  align-items: center;
  gap: 8px 12px;
  padding: 12px;
  text-align: left;
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
  border: 2px solid rgba(255, 255, 255, 0.16);
  border-left-width: 8px;
  border-radius: 4px;
  font-family: inherit;
  font-size: 15px;
  font-weight: 800;
}
.menu-option:hover {
  background: rgba(255, 255, 255, 0.13);
}
.tile-blue {
  border-left-color: #4ad2ff;
}
.menu-key {
  grid-row: span 2;
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #111b16;
  border: 2px solid rgba(255, 255, 255, 0.26);
  border-radius: 4px;
  color: #fff;
  font-weight: 900;
}
.menu-option-label {
  color: #b7c9ba;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.menu-choice-line {
  grid-column: 2;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
}
.active-choice {
  color: #fff;
  margin-right: 8px;
}
.yellow-choice {
  color: #ffe94a;
}
.blue-choice {
  color: #4ad2ff;
}
.muted-choice {
  color: #8fa094;
  opacity: 0.72;
  margin-right: 8px;
}
.menu-option-note {
  grid-column: 2;
  font-size: 12px;
  line-height: 1.3;
  color: #a9b9ad;
}

/* ---- keyboard help ---- */
.menu .controls {
  width: 100%;
  color: #b5c7b8;
  font-size: 14px;
  line-height: 1.8;
  text-align: center;
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  padding: 12px;
  box-sizing: border-box;
}
.menu .controls b {
  color: #fff;
  background: rgba(255, 255, 255, 0.14);
  border-radius: 4px;
  padding: 1px 7px;
  font-weight: 600;
}
```

### Top-tools container (you already have the buttons — layout rule only)

```css
.menu-top-tools {
  position: static;
  z-index: 6;
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
  align-items: flex-start;
}
```

### Responsive overrides (media queries) that touch the home screen

```css
@media (max-width: 720px) {
  .menu-shell { padding: 18px; gap: 10px; }
  .menu-layout { grid-template-columns: 1fr; }
  .menu-sidebar {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    align-content: stretch;
    min-height: auto;
  }
  .menu-sidebar-button { min-height: 72px; }
  .menu-title-row { grid-template-columns: 1fr; gap: 8px; }
  .menu-main-actions,
  .home-settings-strip { grid-template-columns: 1fr; }
  .menu-mode-button { min-height: 118px; }
  .menu .controls { font-size: 12px; line-height: 1.65; }
}
@media (max-height: 820px) {
  .menu-shell { padding: 16px 26px; gap: 8px; }
  .menu h1 { font-size: 46px; line-height: 0.92; }
  .legend-card { min-height: 92px; }
  .legend-photo { height: 80px; }
  .legend-card b { font-size: 11px; }
  .menu-mode-button { min-height: 116px; padding: 12px; }
  .menu-option { min-height: 62px; padding: 10px; }
  .menu .controls { display: none; }   /* keyboard help hidden on short screens */
}
```

Inline styles in Hud.tsx for the home screen: **none** relevant. (Inline styles exist
only for scoreboard/shootout/radar/skip-button/national-card CSS vars — none on the
home menu. `MENU_SIDEBAR_ITEMS`/`MENU_LEGENDS` provide text/URLs, not styles.)

---

## 3. ASSET FILES

Web root: `/home/louisxiv/GameplayFootball/web`

### Mode-card images (local PNGs, imported at top of Hud.tsx)

| import name (Hud.tsx line) | import path | resolved file |
|---|---|---|
| `playButtonUrl` (`Hud.tsx:27`) | `../assets/play-button.png` | `/home/louisxiv/GameplayFootball/web/src/assets/play-button.png` |
| `trainingButtonUrl` (`Hud.tsx:28`) | `../assets/training-button.png` | `/home/louisxiv/GameplayFootball/web/src/assets/training-button.png` |
| `worldCupButtonUrl` (`Hud.tsx:29`) | `../assets/worldcup-button.png` | `/home/louisxiv/GameplayFootball/web/src/assets/worldcup-button.png` |

These three PNGs ARE the visible card art (the green MATCH AMICAL, blue ENTRAINEMENT,
gold/red COUPE DU MONDE — the text is baked into the images). Copy these three files
and serve them; that alone reproduces the cards.

(Other `training-*.png` imports at `Hud.tsx:30-34` are for the training sub-tab only —
not on the home screen.)

### Sidebar icons

No image files — they are Unicode glyphs in `MENU_SIDEBAR_ITEMS` (`Hud.tsx:165-170`):
`⌂ ◎ ◔ ◌`.

### Background pitch image (REMOTE, not a local asset)

Set in `.menu-shell` CSS (`index.html` ~line 239):
```
https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1600&q=80
```
Positioned `center 48% / cover`, under two dark gradient overlays. It is fetched from
Unsplash at runtime — for an offline/self-contained overlay you must download it and
re-host it (or embed as a data URI). The solid fallback while it loads is `#06120b`
(the `.menu` background).

### Logo / favicon (NOT on the menu screen)

`src/assets/menu-logo.png` — used only as the page `<link rel="icon">`
(`index.html:7-8`). Not rendered inside the menu.

### The 4 player photos (Haaland / Mbappé / Ronaldo / Messi)

On the home screen these are **hardcoded Wikimedia thumbnail URLs** in the
`MENU_LEGENDS` array (`Hud.tsx:140-161`) and rendered directly as
`<img class="legend-photo" src={legend.image}>` (`Hud.tsx:747`). They are **not**
live-fetched here — the URLs are fixed:

```
Haaland : https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Erling_Haaland_Morocco_v_Norway_7_June_2026-51.jpg/500px-Erling_Haaland_Morocco_v_Norway_7_June_2026-51.jpg
Mbappé  : https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Kylian_Mbappe_France_v_Senegal_16_June_2026-391_%28cropped%29.jpg/500px-Kylian_Mbappe_France_v_Senegal_16_June_2026-391_%28cropped%29.jpg
Ronaldo : https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Cristiano_Ronaldo_2275_%28cropped%29.jpg/500px-Cristiano_Ronaldo_2275_%28cropped%29.jpg
Messi   : https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Lionel_Messi_NE_Revolution_Inter_Miami_7.9.25-178_%28cropped_2%29.jpg/500px-Lionel_Messi_NE_Revolution_Inter_Miami_7.9.25-178_%28cropped_2%29.jpg
```
For a self-contained overlay: download these 4 JPGs, re-host locally, and drop them
into the `{HAALAND_URL}` … `{MESSI_URL}` slots.

**Live-fetch pattern (used elsewhere, FYI):** the `PlayerHead` component
(`Hud.tsx:292-326`) — used on the lineup/matchup screens, *not* on the home legends —
fetches from the Wikipedia REST API:
```
https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json
  &pithumbsize=120&origin=*&titles=<Name>|<Name> footballer
```
and uses `data.query.pages[*].thumbnail.source`. Not needed to reproduce the home
screen, but that is the "fetched from Wikipedia" mechanism.

---

## 4. FONTS

No web fonts, no `@font-face`, no font files. The app uses a **system font stack** set
once on `html, body` (`index.html:18`):

```css
font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
```

Every element inherits it via `font-family: inherit`. To match the look on Linux/other
platforms where "Segoe UI" is absent, ship/reference a close substitute (e.g. bundle
Segoe UI, or accept the Helvetica/Arial fallback). All weights used are just
`font-weight: 800 / 900 / 1000` of that same family. No italics (the `<em>`/`<i>`
elements are explicitly `font-style: normal`).

---

## 5. MODE-CARD CLICK HANDLERS (intent)

The three home cards are `MenuModeButton`s at `Hud.tsx:757-782`. On the home screen the
cards do **not** start a match directly — each one just switches `menuTab` to a
sub-screen:

| Card (art)            | Handler (`Hud.tsx`) | Intent |
|---|---|---|
| **MATCH AMICAL** (`play-button.png`)   | `onClick={() => setMenuTab("matchup")}` (`Hud.tsx:764`)   | Opens the team-setup screen (`menuTab === "matchup"`, `Hud.tsx:809`): pick both sides + captains, then → lineup, then start. |
| **ENTRAINEMENT** (`training-button.png`) | `onClick={() => setMenuTab("training")}` (`Hud.tsx:772`) | Opens the training-exercise picker (`menuTab === "training"`, `Hud.tsx:938`): tiles call `startMatch(option.id)` for penalty/corner/free-kick/etc. |
| **COUPE DU MONDE** (`worldcup-button.png`) | `onClick={() => setMenuTab("worldcup")}` (`Hud.tsx:780`) | Opens the World Cup 2026 fixtures list (`menuTab === "worldcup"`, `Hud.tsx:1075`): each fixture row calls `startMatch(0)`. |

The actual "start a match" is `startMatch(practiceId)` at `Hud.tsx:476-483`
(`setLineupNames` → `setPractice` → `newMatch` → `radio("opening")`). It is invoked from
the sub-screens, not the home cards. When you wire these differently, the natural
mappings are: MATCH AMICAL → start a normal match; ENTRAINEMENT → start a practice
drill; COUPE DU MONDE → start a tournament match.

Sidebar handlers (`Hud.tsx:731-734`): each button sets `menuTab` to
`home` / `club` / `national` / `challenge`. On this build CLUB→`ClubsMenu`,
NATIONAL→national card grid, DEFI(`challenge`)→`EmptyMenu title="Defi"` (a placeholder).

Players selector (`PlayersToggle`, `Hud.tsx:1348-1369`): `onClick={() =>
act().togglePlayers()}` toggles between 1 and 2 local players (swaps which choice gets
`.active-choice` and shows the versus note when 2).

---

## Minimum to reproduce pixel-for-pixel

1. Copy the 3 card PNGs from `web/src/assets/` (`play-button.png`,
   `training-button.png`, `worldcup-button.png`) and serve them.
2. Download the Unsplash pitch image + the 4 Wikimedia player JPGs and re-host locally
   (CSP/offline).
3. Paste the section-2 CSS and the section-1 HTML; substitute the 8 URLs.
4. No fonts to ship (system stack); "Segoe UI" fallback is acceptable.
