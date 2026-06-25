import { useEffect, useRef, useState } from "react";
import { TEAMS, useStore } from "../game/store";
import { TouchControls } from "./TouchControls";
import { DragShoot, KeeperArrows, humanSetPieceActive } from "./DragShoot";
import { world } from "../game/world";
import { skipCinematic } from "../game/systems/cinematic";
import playButtonUrl from "../assets/play-button.png";
import trainingButtonUrl from "../assets/training-button.png";
import worldCupButtonUrl from "../assets/worldcup-button.png";
import trainingCornerUrl from "../assets/training-corner.png";
import trainingFreeKickUrl from "../assets/training-free-kick.png";
import trainingPenaltyUrl from "../assets/training-penalty.png";

const act = () => useStore.getState();

type MenuTab = "home" | "training" | "worldcup" | "lineup";
type LineupDrag = {
  playerId: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetSlot: number | null;
  moved: boolean;
};

const TRAINING_OPTIONS = [
  { id: 2, title: "COUP FRANC", note: "Mur, ballon arrete, tir direct", image: trainingFreeKickUrl },
  { id: 3, title: "CORNER", note: "Centre depuis le drapeau", image: trainingCornerUrl },
  { id: 4, title: "PENALTY", note: "Face au gardien, plongeon", image: trainingPenaltyUrl },
  { id: 5, title: "HORS-JEU", note: "Apprendre le timing des passes" },
];

const WORLD_CUP_FIXTURES = [
  { date: "24 juin", time: "Jour 14", group: "Groupe A", home: "Czechia", away: "Mexico", venue: "Mexico City" },
  { date: "24 juin", time: "Jour 14", group: "Groupe A", home: "South Africa", away: "Korea Republic", venue: "Monterrey" },
  { date: "24 juin", time: "Jour 14", group: "Groupe B", home: "Switzerland", away: "Canada", venue: "Vancouver" },
  { date: "24 juin", time: "Jour 14", group: "Groupe C", home: "Scotland", away: "Brazil", venue: "Miami" },
  { date: "25 juin", time: "Jour 15", group: "Groupes D/E/F", home: "Ecuador", away: "Germany", venue: "New York/New Jersey" },
  { date: "25 juin", time: "Jour 15", group: "Groupes D/E/F", home: "Turkiye", away: "USA", venue: "Los Angeles" },
  { date: "26 juin", time: "Jour 16", group: "Groupes G/H/I", home: "Norway", away: "France", venue: "Boston" },
  { date: "26 juin", time: "Jour 16", group: "Groupes G/H/I", home: "Uruguay", away: "Spain", venue: "Guadalajara" },
  { date: "27 juin", time: "Jour 17", group: "Groupes J/K/L", home: "Colombia", away: "Portugal", venue: "Miami" },
  { date: "27 juin", time: "Jour 17", group: "Groupes J/K/L", home: "Panama", away: "England", venue: "New York/New Jersey" },
  { date: "28 juin - 3 juillet", time: "Elimination", group: "32es", home: "Qualifie", away: "Qualifie", venue: "Tableau final" },
  { date: "4 - 7 juillet", time: "Elimination", group: "8es", home: "Qualifie", away: "Qualifie", venue: "Tableau final" },
  { date: "9 - 11 juillet", time: "Elimination", group: "Quarts", home: "Qualifie", away: "Qualifie", venue: "Tableau final" },
  { date: "14 - 15 juillet", time: "Elimination", group: "Demi-finales", home: "Qualifie", away: "Qualifie", venue: "Tableau final" },
  { date: "18 juillet", time: "Finale 3e place", group: "Match 103", home: "Perdant demi", away: "Perdant demi", venue: "Miami" },
  { date: "19 juillet", time: "Finale", group: "Match 104", home: "Finaliste", away: "Finaliste", venue: "New York/New Jersey" },
];

const MENU_LEGENDS = [
  {
    name: "Haaland",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Erling_Haaland_Morocco_v_Norway_7_June_2026-51.jpg/500px-Erling_Haaland_Morocco_v_Norway_7_June_2026-51.jpg",
  },
  {
    name: "Mbappé",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Kylian_Mbappe_France_v_Senegal_16_June_2026-391_%28cropped%29.jpg/500px-Kylian_Mbappe_France_v_Senegal_16_June_2026-391_%28cropped%29.jpg",
  },
  {
    name: "Ronaldo",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Cristiano_Ronaldo_2275_%28cropped%29.jpg/500px-Cristiano_Ronaldo_2275_%28cropped%29.jpg",
  },
  {
    name: "Messi",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Lionel_Messi_NE_Revolution_Inter_Miami_7.9.25-178_%28cropped_2%29.jpg/500px-Lionel_Messi_NE_Revolution_Inter_Miami_7.9.25-178_%28cropped_2%29.jpg",
  },
];

const LINEUP_PLAYERS = [
  { id: 1, name: "Mike Maignan", pos: "GB", rating: 87, x: 50, y: 90 },
  { id: 2, name: "Jules Koundé", pos: "DD", rating: 85, x: 18, y: 69 },
  { id: 3, name: "William Saliba", pos: "DC", rating: 88, x: 38, y: 72 },
  { id: 4, name: "Dayot Upamecano", pos: "DC", rating: 86, x: 62, y: 72 },
  { id: 5, name: "Lucas Digne", pos: "DG", rating: 82, x: 82, y: 69 },
  { id: 6, name: "Aurélien Tchouaméni", pos: "MDC", rating: 86, x: 34, y: 49 },
  { id: 7, name: "N'Golo Kanté", pos: "MC", rating: 85, x: 66, y: 49 },
  { id: 8, name: "Rayan Cherki", pos: "MOC", rating: 84, x: 50, y: 42 },
  { id: 9, name: "Bradley Barcola", pos: "AG", rating: 84, x: 24, y: 18 },
  { id: 10, name: "Kylian Mbappé", pos: "BU", rating: 92, x: 50, y: 9 },
  { id: 11, name: "Ousmane Dembélé", pos: "AD", rating: 88, x: 76, y: 18 },
  { id: 12, name: "Brice Samba", pos: "GB", rating: 81 },
  { id: 13, name: "Robin Risser", pos: "GB", rating: 74 },
  { id: 14, name: "Malo Gusto", pos: "DD", rating: 80 },
  { id: 15, name: "Ibrahima Konaté", pos: "DC", rating: 86 },
  { id: 16, name: "Théo Hernandez", pos: "DG", rating: 86 },
  { id: 17, name: "Lucas Hernandez", pos: "DG", rating: 84 },
  { id: 18, name: "Maxence Lacroix", pos: "DC", rating: 80 },
  { id: 19, name: "Manu Koné", pos: "MC", rating: 82 },
  { id: 20, name: "Adrien Rabiot", pos: "MC", rating: 83 },
  { id: 21, name: "Warren Zaïre-Emery", pos: "MC", rating: 82 },
  { id: 22, name: "Maghnes Akliouche", pos: "MOC", rating: 80 },
  { id: 23, name: "Marcus Thuram", pos: "BU", rating: 84 },
  { id: 24, name: "Michael Olise", pos: "AD", rating: 84 },
  { id: 25, name: "Désiré Doué", pos: "AG", rating: 82 },
  { id: 26, name: "Jean-Philippe Mateta", pos: "BU", rating: 81 },
  { id: 27, name: "Lucas Chevalier", pos: "GB", rating: 80 },
  { id: 28, name: "Benjamin Pavard", pos: "DC", rating: 82 },
  { id: 29, name: "Loïc Badé", pos: "DC", rating: 80 },
  { id: 30, name: "Clément Lenglet", pos: "DC", rating: 79 },
  { id: 31, name: "Jonathan Clauss", pos: "DD", rating: 80 },
  { id: 32, name: "Pierre Kalulu", pos: "DD", rating: 79 },
  { id: 33, name: "Eduardo Camavinga", pos: "MC", rating: 84 },
  { id: 34, name: "Mattéo Guendouzi", pos: "MC", rating: 80 },
  { id: 35, name: "Khéphren Thuram", pos: "MC", rating: 81 },
  { id: 36, name: "Florian Thauvin", pos: "AD", rating: 79 },
  { id: 37, name: "Kingsley Coman", pos: "AG", rating: 84 },
  { id: 38, name: "Randal Kolo Muani", pos: "BU", rating: 82 },
  { id: 39, name: "Christopher Nkunku", pos: "MOC", rating: 83 },
  {
    id: 40,
    name: "Hugo Ekitiké",
    pos: "BU",
    rating: 81,
    photo:
      "https://backend.liverpoolfc.com/sites/default/files/styles/xs/public/2026-06/hugo-ekitike-2026-27-body-shot_a170f152368cb434d055d6dd13698085.webp?itok=optavXDp",
  },
];

const LINEUP_SLOTS = LINEUP_PLAYERS.slice(0, 11).map((player) => ({
  defaultId: player.id,
  x: player.x!,
  y: player.y!,
}));
const LINEUP_PLAYER_BY_ID = new Map(LINEUP_PLAYERS.map((player) => [player.id, player]));
const DEFAULT_LINEUP = [
  "Mike Maignan",
  "Michael Olise",
  "Désiré Doué",
  "Dayot Upamecano",
  "Lucas Digne",
  "Aurélien Tchouaméni",
  "Adrien Rabiot",
  "Rayan Cherki",
  "Bradley Barcola",
  "Kylian Mbappé",
  "Ousmane Dembélé",
].map((name) => LINEUP_PLAYERS.find((player) => player.name === name)!.id);
const LINEUP_STORAGE_KEY = "gpf-lineup-v1";

function loadSavedLineup(): number[] {
  if (typeof window === "undefined") return DEFAULT_LINEUP;
  try {
    const raw = window.localStorage.getItem(LINEUP_STORAGE_KEY);
    if (!raw) return DEFAULT_LINEUP;
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved) || saved.length !== DEFAULT_LINEUP.length) return DEFAULT_LINEUP;
    const ids = saved.map((value) => Number(value));
    const unique = new Set(ids);
    const validIds = ids.every((id) => LINEUP_PLAYER_BY_ID.has(id));
    return validIds && unique.size === ids.length ? ids : DEFAULT_LINEUP;
  } catch {
    return DEFAULT_LINEUP;
  }
}

function playerInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

const wikiPhotoCache = new Map<string, string>();

function PlayerHead({ name, photoUrl = "" }: { name: string; photoUrl?: string }): React.ReactNode {
  const [photo, setPhoto] = useState(photoUrl || wikiPhotoCache.get(name) || "");

  useEffect(() => {
    if (photo || photoUrl) return;
    const controller = new AbortController();
    const url = new URL("https://en.wikipedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("prop", "pageimages");
    url.searchParams.set("format", "json");
    url.searchParams.set("pithumbsize", "120");
    url.searchParams.set("origin", "*");
    url.searchParams.set("titles", `${name}|${name} footballer`);

    fetch(url.toString(), { signal: controller.signal })
      .then((response) => response.json())
      .then((data: { query?: { pages?: Record<string, { thumbnail?: { source?: string } }> } }) => {
        const pages = data.query?.pages ?? {};
        const image = Object.values(pages).find((page) => page.thumbnail?.source)?.thumbnail?.source;
        if (image) {
          wikiPhotoCache.set(name, image);
          setPhoto(image);
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [name, photo, photoUrl]);

  return (
    <i className="player-head">
      {photo ? <img src={photo} alt="" /> : playerInitials(name)}
    </i>
  );
}

export function Hud(): React.ReactNode {
  const mode = useStore((s) => s.mode);
  const score = useStore((s) => s.score);
  const clock = useStore((s) => s.clock);
  const phaseLabel = useStore((s) => s.phaseLabel);
  const banner = useStore((s) => s.banner);
  const pens = useStore((s) => s.pens);
  const selectedName = useStore((s) => s.selectedName);
  const selectedName2 = useStore((s) => s.selectedName2);
  const players = useStore((s) => s.players);
  const practice = useStore((s) => s.practice);
  const [menuTab, setMenuTab] = useState<MenuTab>("home");
  const [selectedLineup, setSelectedLineup] = useState<number[]>(() => loadSavedLineup());
  const [lineupFocus, setLineupFocus] = useState<number>(() => loadSavedLineup()[0] ?? DEFAULT_LINEUP[0]!);
  const [lineupDrag, setLineupDrag] = useState<LineupDrag | null>(null);
  const [matchSubOpen, setMatchSubOpen] = useState(false);
  const suppressBenchClick = useRef(false);
  const mm = String(Math.floor(clock / 60)).padStart(2, "0");
  const ss = String(clock % 60).padStart(2, "0");

  useEffect(() => {
    if (mode !== "menu") setMenuTab("home");
  }, [mode]);

  useEffect(() => {
    if (mode !== "play") setMatchSubOpen(false);
  }, [mode]);

  useEffect(() => {
    window.localStorage.setItem(LINEUP_STORAGE_KEY, JSON.stringify(selectedLineup));
  }, [selectedLineup]);

  const lineupPlayerNames = (): string[] =>
    selectedLineup.map((id) => LINEUP_PLAYER_BY_ID.get(id)?.name ?? "");

  const startMatch = (practiceId = 0): void => {
    act().setLineupNames(lineupPlayerNames());
    act().setPractice(practiceId);
    act().newMatch();
  };

  const replaceLineupSlot = (slotIndex: number, playerId: number): void => {
    if (selectedLineup.includes(playerId)) return;
    setSelectedLineup((current) => current.map((id, index) => (index === slotIndex ? playerId : id)));
    setLineupFocus(playerId);
  };

  const lineupSlotAt = (x: number, y: number): number | null => {
    const slotElement = document
      .elementsFromPoint(x, y)
      .find(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && element.dataset.lineupSlot !== undefined,
      );
    if (!slotElement) return null;
    const slot = Number(slotElement.dataset.lineupSlot);
    return Number.isFinite(slot) ? slot : null;
  };

  useEffect(() => {
    if (!lineupDrag) return;

    const onPointerMove = (event: PointerEvent): void => {
      event.preventDefault();
      const distance = Math.hypot(event.clientX - lineupDrag.startX, event.clientY - lineupDrag.startY);
      setLineupDrag((current) =>
        current
          ? {
              ...current,
              x: event.clientX,
              y: event.clientY,
              targetSlot: lineupSlotAt(event.clientX, event.clientY),
              moved: current.moved || distance > 5,
            }
          : current,
      );
    };

    const finishDrag = (event: PointerEvent): void => {
      event.preventDefault();
      const targetSlot = lineupSlotAt(event.clientX, event.clientY);
      if (targetSlot !== null) replaceLineupSlot(targetSlot, lineupDrag.playerId);
      suppressBenchClick.current = lineupDrag.moved || targetSlot !== null;
      setLineupDrag(null);
      window.setTimeout(() => {
        suppressBenchClick.current = false;
      }, 0);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", finishDrag, { passive: false });
    window.addEventListener("pointercancel", finishDrag, { passive: false });

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [lineupDrag]);

  return (
    <div className="hud">
      {mode !== "menu" && (
        <>
          <div className="scoreboard">
            <span className="clock">
              {mm}:{ss} {phaseLabel}
            </span>
            <span className="team">
              <span className="swatch" style={{ background: TEAMS[0].color }} />
              {TEAMS[0].name}
            </span>
            <span className="score">
              {score[0]} - {score[1]}
            </span>
            <span className="team">
              <span className="swatch" style={{ background: TEAMS[1].color }} />
              {TEAMS[1].name}
            </span>
            {pens && (
              <span className="score">
                p {pens[0]} - {pens[1]}
              </span>
            )}
            {selectedName && (
              <span className="team" style={{ color: "#ffe94a" }}>
                ▶ {selectedName}
              </span>
            )}
            {players === 2 && selectedName2 && (
              <span className="team" style={{ color: "#4ad2ff" }}>
                ▶ {selectedName2}
              </span>
            )}
          </div>
          <ShootoutBoard />
          <Radar />
        </>
      )}
      {mode !== "menu" && <DragShoot />}
      {mode !== "menu" && <KeeperArrows />}
      {mode === "play" && players === 1 && <TouchControls />}
      {mode === "play" && players === 1 && (
        <div className={`match-sub-prompt${matchSubOpen ? " open" : ""}`}>
          <button className="match-sub-main" onClick={() => setMatchSubOpen((open) => !open)}>
            CHANGER JOUEUR ?
          </button>
          {matchSubOpen && (
            <div className="match-sub-card">
              <span>Joueur actuel</span>
              <b>{selectedName || "Aucun"}</b>
              <button onClick={() => setMatchSubOpen(false)}>GARDER</button>
              <button
                onClick={() => {
                  setMenuTab("lineup");
                  act().setMode("menu");
                }}
              >
                COMPOSITION
              </button>
            </div>
          )}
        </div>
      )}
      {mode === "play" && (
        <button
          onClick={() => act().setMode("pause")}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            pointerEvents: "auto",
            cursor: "pointer",
            width: 44,
            height: 44,
            borderRadius: 8,
            border: "2px solid rgba(255,255,255,0.3)",
            background: "rgba(8,12,24,0.6)",
            color: "#fff",
            fontSize: 16,
            fontWeight: 800,
          }}
          aria-label="Pause"
        >
          ❚❚
        </button>
      )}
      {(mode === "goal" ||
        mode === "replay" ||
        mode === "cardScene" ||
        mode === "offside") && (
        <button
          onClick={() => skipCinematic(world)}
          style={{
            position: "absolute",
            bottom: 24,
            right: 24,
            pointerEvents: "auto",
            cursor: "pointer",
            padding: "10px 20px",
            borderRadius: 8,
            border: "2px solid rgba(255,255,255,0.35)",
            background: "rgba(8,12,24,0.6)",
            color: "#fff",
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: 1,
          }}
          aria-label="Passer le replay"
        >
          PASSER ⏭
        </button>
      )}
      {mode === "goal" && <div className="banner">GOAL!</div>}
      {banner && mode !== "goal" && (
        <div className="banner" style={{ fontSize: 40, letterSpacing: 3 }}>
          {banner}
        </div>
      )}
      {mode === "pause" && (
        <div className="menu">
          <div className="menu-side menu-side-red" />
          <div className="menu-side menu-side-blue" />
          <div className="menu-shell pause-shell">
            <h1>PAUSE</h1>
            <BigButton label="REPRENDRE" onClick={() => act().setMode("play")} />
            <button
              className="menu-big-button"
              style={{
                background: "#d8342c",
                borderColor: "#ff8a80",
                color: "#fff",
                boxShadow: "0 8px 0 #7a130e, 0 16px 26px rgba(0,0,0,0.5)",
              }}
              onClick={() => act().setMode("menu")}
            >
              QUITTER ▸ MENU
            </button>
            <div className="prompt">ou appuie sur Échap</div>
          </div>
        </div>
      )}
      {mode === "menu" && (
        <div className="menu">
          <div className="menu-side menu-side-red" />
          <div className="menu-side menu-side-blue" />
          <div className="menu-shell">
            {menuTab === "home" && (
              <div className="legend-strip menu-hero-legends" aria-hidden="true">
                {MENU_LEGENDS.map((legend) => (
                  <div className="legend-card" key={legend.name}>
                    <img className="legend-photo" src={legend.image} alt="" />
                    <b>{legend.name}</b>
                  </div>
                ))}
              </div>
            )}
            <div className="menu-title-row">
              <h1>
                GAMEPLAY <span>FOOTBALL</span>
              </h1>
            </div>
            {menuTab !== "home" && (
              <button className="menu-back" onClick={() => setMenuTab("home")}>
                RETOUR
              </button>
            )}
            {menuTab === "worldcup" && (
              <div className="menu-premium-strip">
                <span>TACTIQUES RAPIDES</span>
                <span>RADIO STADE</span>
                <span>REPLAY & CARTONS</span>
              </div>
            )}
            {menuTab === "home" && (
              <>
                <div className="menu-main-actions">
                  <MenuModeButton
                    tone="yellow"
                    kicker="MATCH"
                    title="JOUER"
                    note="Lance un vrai match direct"
                    image={playButtonUrl}
                    onClick={() => setMenuTab("lineup")}
                  />
                  <MenuModeButton
                    tone="green"
                    kicker="EXERCICES"
                    title="ENTRAINEMENT"
                    note="Penalty, corner, coup franc, tirs au but"
                    image={trainingButtonUrl}
                    onClick={() => setMenuTab("training")}
                  />
                  <MenuModeButton
                    tone="blue"
                    kicker="19 JUILLET"
                    title="COUPE DU MONDE"
                    note="Calendrier, groupes et finale"
                    image={worldCupButtonUrl}
                    onClick={() => setMenuTab("worldcup")}
                  />
                </div>
                <div className="home-player-toggle">
                  <PlayersToggle />
                </div>
              </>
            )}
            {menuTab === "training" && (
              <div className="menu-panel">
                <div className="menu-panel-head">
                  <span>ENTRAINEMENT</span>
                  <b>Choisis ton exercice</b>
                </div>
                <div className="training-grid">
                  {TRAINING_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      className={`training-card${option.image ? " training-image-card" : ""}`}
                      onClick={() => startMatch(option.id)}
                    >
                      {option.image ? (
                        <>
                          <img src={option.image} alt="" />
                          <span className="training-image-label">{option.title}</span>
                        </>
                      ) : (
                        <>
                          <span>{option.title}</span>
                          <b>{option.note}</b>
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {menuTab === "lineup" && (
              <div className="lineup-panel">
                <div className="lineup-top">
                  <div>
                    <span>COMPOSITION</span>
                    <b>Choisis tes joueurs avant le match</b>
                  </div>
                  <button className="lineup-start" onClick={() => startMatch(0)}>
                    JOUER LE MATCH
                  </button>
                </div>
                <div className="lineup-layout">
                  <div className="lineup-pitch" aria-label="Formation">
                    {LINEUP_SLOTS.map((slot, index) => {
                      const player = LINEUP_PLAYER_BY_ID.get(selectedLineup[index]!)!;
                      return (
                        <button
                          key={`${slot.defaultId}-${player.id}`}
                          data-lineup-slot={index}
                          className={`player-card ${lineupFocus === player.id ? "player-card-focused" : ""}${lineupDrag?.targetSlot === index ? " player-card-drop-target" : ""}`}
                          style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                          onClick={() => setLineupFocus(player.id)}
                        >
                          <strong>{player.rating}</strong>
                          <span>{player.pos}</span>
                          <PlayerHead name={player.name} photoUrl={player.photo} />
                          <b>{player.name}</b>
                        </button>
                      );
                    })}
                  </div>
                  <div className="lineup-bench">
                    <span>REMPLACANTS</span>
                    {LINEUP_PLAYERS.filter((player) => !selectedLineup.includes(player.id)).map((player) => (
                      <button
                        key={player.id}
                        className={`bench-card ${selectedLineup.includes(player.id) ? "selected" : ""}`}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          setLineupDrag({
                            playerId: player.id,
                            x: event.clientX,
                            y: event.clientY,
                            startX: event.clientX,
                            startY: event.clientY,
                            targetSlot: null,
                            moved: false,
                          });
                        }}
                        onClick={(event) => {
                          if (suppressBenchClick.current) {
                            event.preventDefault();
                            return;
                          }
                          setSelectedLineup((current) => {
                            if (current.includes(player.id)) return current;
                            const next = current.map((id) => (id === lineupFocus ? player.id : id));
                            return next.includes(player.id) ? next : current;
                          });
                          setLineupFocus(player.id);
                        }}
                      >
                        <strong>{player.rating}</strong>
                        <PlayerHead name={player.name} photoUrl={player.photo} />
                        <b>{player.name}</b>
                        <em>{player.pos}</em>
                      </button>
                    ))}
                  </div>
                </div>
                {lineupDrag && (
                  <div
                    className="lineup-drag-ghost"
                    style={{
                      left: lineupDrag.x,
                      top: lineupDrag.y,
                    }}
                  >
                    {(() => {
                      const player = LINEUP_PLAYER_BY_ID.get(lineupDrag.playerId)!;
                      return (
                        <>
                          <strong>{player.rating}</strong>
                          <PlayerHead name={player.name} photoUrl={player.photo} />
                          <b>{player.name}</b>
                          <em>{player.pos}</em>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
            {menuTab === "worldcup" && (
              <div className="menu-panel worldcup-panel">
                <div className="menu-panel-head">
                  <span>COUPE DU MONDE 2026</span>
                  <b>Du 11 juin au 19 juillet, jouable quand tu veux</b>
                </div>
                <div className="worldcup-list">
                  {WORLD_CUP_FIXTURES.map((fixture) => (
                    <button
                      key={`${fixture.date}-${fixture.group}-${fixture.home}-${fixture.away}`}
                      className="fixture-row"
                      onClick={() => startMatch(0)}
                    >
                      <span className="fixture-date">{fixture.date}</span>
                      <span className="fixture-main">
                        <b>{fixture.home}</b>
                        <em>vs</em>
                        <b>{fixture.away}</b>
                      </span>
                      <span className="fixture-meta">
                        {fixture.group} · {fixture.time} · {fixture.venue}
                      </span>
                      <span className="fixture-play">JOUER</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {menuTab === "home" && (
              players === 1 ? (
                <div className="controls">
                  <b>WASD / Arrows</b> move&ensp;<b>Shift</b> sprint
                  <br />
                  <b>Space</b> shoot&ensp;<b>X</b> pass&ensp;<b>C</b> lofted pass&ensp;
                  <b>V</b> header&ensp;<b>E</b> slide tackle
                  <br />
                  <b>Gardien</b> : tu le prends sur un tir/penalty —{" "}
                  <b>Espace/E</b> plonge du côté du joystick
                  <br />
                  <b>R</b> radio commentary&ensp;<b>Esc</b> pause
                </div>
              ) : (
                <div className="controls">
                  <span style={{ color: TEAMS[0].color, fontWeight: 700 }}>J1 (RED)</span>
                  &ensp;<b>WASD</b> move&ensp;<b>Shift g.</b> sprint&ensp;
                  <b>Espace</b> tir&ensp;<b>X</b> passe&ensp;<b>C</b> lobée&ensp;
                  <b>E</b> tacle
                  <br />
                  <span style={{ color: "#4ad2ff", fontWeight: 700 }}>J2 (BLU)</span>
                  &ensp;<b>Flèches</b> move&ensp;<b>Shift d.</b> sprint&ensp;
                  <b>K</b> tir&ensp;<b>L</b> passe&ensp;<b>M</b> lobée&ensp;
                  <b>I</b> tacle
                  <br />
                  <b>R</b> radio&ensp;<b>Esc</b> pause
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** A large tappable menu button (works with touch and mouse). */
function BigButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}): React.ReactNode {
  return (
    <button
      className="menu-big-button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function MenuModeButton({
  tone,
  kicker,
  title,
  note,
  image,
  onClick,
}: {
  tone: "yellow" | "green" | "blue";
  kicker: string;
  title: string;
  note: string;
  image?: string;
  onClick: () => void;
}): React.ReactNode {
  return (
    <button className={`menu-mode-button mode-${tone}${image ? " image-mode-button" : ""}`} onClick={onClick}>
      {image ? (
        <img src={image} alt={title} />
      ) : (
        <>
          <span>{kicker}</span>
          <b>{title}</b>
          <em>{note}</em>
        </>
      )}
    </button>
  );
}

/** The classic shoot-out tracker: a row of ticks/crosses per team. */
function ShootoutBoard(): React.ReactNode {
  const detail = useStore((s) => s.pensDetail);
  if (!detail) return null;
  const rounds = Math.max(5, detail[0].length, detail[1].length);
  return (
    <div
      style={{
        position: "absolute",
        top: 70,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(8, 12, 24, 0.85)",
        borderRadius: 8,
        padding: "10px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 7,
        boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
      }}
    >
      {([0, 1] as const).map((t) => (
        <div key={t} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span
            style={{
              width: 11,
              height: 11,
              background: TEAMS[t].color,
              borderRadius: 2,
              marginRight: 4,
            }}
          />
          {Array.from({ length: rounds }, (_, i) => {
            const o = detail[t][i];
            return (
              <span
                key={i}
                style={{
                  width: 17,
                  height: 17,
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#fff",
                  background:
                    o === "g" ? "#2eb84a" : o === "m" ? "#d8342c" : "transparent",
                  border: o ? "none" : "2px solid rgba(255,255,255,0.35)",
                }}
              >
                {o === "g" ? "✓" : o === "m" ? "✕" : ""}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function PlayersToggle(): React.ReactNode {
  const players = useStore((s) => s.players);
  return (
    <button
      className="menu-option tile-blue"
      onClick={() => act().togglePlayers()}
    >
      <span className="menu-key">J</span>
      <span className="menu-option-label">Joueurs</span>
      <span className="menu-choice-line">
        <span className={players === 1 ? "active-choice yellow-choice" : "muted-choice"}>1 JOUEUR</span>
        <span className={players === 2 ? "active-choice blue-choice" : "muted-choice"}>2 JOUEURS</span>
      </span>
      {players === 2 && (
        <span className="menu-option-note">
          versus local : J1 dirige les ROUGES, J2 dirige les BLEUS
        </span>
      )}
    </button>
  );
}

function TeamChoice(): React.ReactNode {
  const humanTeam = useStore((s) => s.humanTeam);
  return (
    <button
      className={`menu-option ${humanTeam === 0 ? "tile-red" : "tile-blue"}`}
      onClick={() => act().toggleHumanTeam()}
    >
      <span className="menu-key">E</span>
      <span className="menu-option-label">Equipe</span>
      <span className="menu-choice-line">
        <span className={humanTeam === 0 ? "active-choice red-choice" : "muted-choice"}>RED</span>
        <span className={humanTeam === 1 ? "active-choice blue-choice" : "muted-choice"}>BLU</span>
      </span>
      <span className="menu-option-note">
        tu joues {TEAMS[humanTeam].name}, l'autre equipe est l'IA
      </span>
    </button>
  );
}

const DIFFICULTY_NAMES = ["FACILE", "NORMAL", "DIFFICILE"];
const DIFFICULTY_COLORS = ["#7ddb5a", "#ffe94a", "#ff6b4a"];

function DifficultyPicker(): React.ReactNode {
  const difficulty = useStore((s) => s.difficulty);
  return (
    <button
      className="menu-option tile-yellow"
      onClick={() => act().cycleDifficulty()}
    >
      <span className="menu-key">D</span>
      <span className="menu-option-label">Difficulté</span>
      <span className="menu-choice-line">
        {DIFFICULTY_NAMES.map((name, i) => (
          <span
            key={name}
            className={i === difficulty ? "active-choice" : "muted-choice"}
            style={{ color: i === difficulty ? DIFFICULTY_COLORS[i] : undefined }}
          >
            {name}
          </span>
        ))}
      </span>
    </button>
  );
}

function ImportantToggle(): React.ReactNode {
  const important = useStore((s) => s.important);
  return (
    <button
      className="menu-option tile-red"
      onClick={() => act().toggleImportant()}
    >
      <span className="menu-key">M</span>
      <span className="menu-option-label">Match important</span>
      <b className={important ? "active-choice yellow-choice" : "muted-choice"}>
        {important ? "OUI" : "NON"}
      </b>
      <span className="menu-option-note">
        deux mi-temps, puis prolongation (deux mi-temps) et tirs au but si le
        score reste égal
      </span>
    </button>
  );
}

const RADAR_W = 220;
const RADAR_H = 148;

function Radar(): React.ReactNode {
  const radar = useStore((s) => s.radar);
  const ref = useRef<HTMLCanvasElement>(null);
  // hide the radar while aiming a set piece — it sits right over the ball
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let raf = 0;
    const tick = (): void => {
      setHidden(humanSetPieceActive());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, RADAR_W, RADAR_H);
    ctx.fillStyle = "rgba(10, 40, 14, 0.75)";
    ctx.fillRect(0, 0, RADAR_W, RADAR_H);
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(4, 4, RADAR_W - 8, RADAR_H - 8);
    ctx.beginPath();
    ctx.moveTo(RADAR_W / 2, 4);
    ctx.lineTo(RADAR_W / 2, RADAR_H - 4);
    ctx.stroke();

    for (let i = 0; i + 2 < radar.length; i += 3) {
      const x = (radar[i]! * 0.92 * 0.5 + 0.5) * RADAR_W;
      const y = (radar[i + 1]! * 0.92 * 0.5 + 0.5) * RADAR_H;
      const code = radar[i + 2]!;
      ctx.beginPath();
      if (code === 4) {
        ctx.fillStyle = "#ffffff";
        ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      } else {
        ctx.fillStyle = TEAMS[(code % 2) as 0 | 1].color;
        ctx.arc(x, y, 3.4, 0, Math.PI * 2);
      }
      ctx.fill();
      if (code === 2 || code === 3) {
        ctx.strokeStyle = "#ffe94a";
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    }
  }, [radar]);

  if (hidden) return null;
  return (
    <canvas
      ref={ref}
      width={RADAR_W}
      height={RADAR_H}
      style={{
        position: "absolute",
        bottom: 18,
        left: "50%",
        transform: "translateX(-50%)",
        opacity: 0.9,
        borderRadius: 6,
      }}
    />
  );
}
