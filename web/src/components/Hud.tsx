import { useEffect, useRef, useState } from "react";
import { TEAMS, useStore } from "../game/store";
import { TouchControls } from "./TouchControls";
import { DragShoot, KeeperArrows, humanSetPieceActive } from "./DragShoot";
import { world } from "../game/world";
import { skipCinematic } from "../game/systems/cinematic";

const act = () => useStore.getState();

type MenuTab = "home" | "training" | "worldcup";

const TRAINING_OPTIONS = [
  { id: 1, title: "TIRS AU BUT", note: "Duel gardien, serie de tirs" },
  { id: 2, title: "COUP FRANC", note: "Mur, ballon arrete, tir direct" },
  { id: 3, title: "CORNER", note: "Centre depuis le drapeau" },
  { id: 4, title: "PENALTY", note: "Face au gardien, plongeon" },
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
  { name: "Haaland", shirt: "#6ec7ff", hair: "#f2c96b", skin: "#f0b789" },
  { name: "Mbappé", shirt: "#153b8f", hair: "#191919", skin: "#8d5839" },
  { name: "Ronaldo", shirt: "#cf1f2a", hair: "#191919", skin: "#c68a62" },
  { name: "Messi", shirt: "#77c8ff", hair: "#6b3d20", skin: "#d0a075" },
];

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
  const mm = String(Math.floor(clock / 60)).padStart(2, "0");
  const ss = String(clock % 60).padStart(2, "0");

  useEffect(() => {
    if (mode !== "menu") setMenuTab("home");
  }, [mode]);

  const startMatch = (practiceId = 0): void => {
    act().setPractice(practiceId);
    act().newMatch();
  };

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
            <div className="prompt">ou appuie sur Échap</div>
          </div>
        </div>
      )}
      {mode === "menu" && (
        <div className="menu">
          <div className="menu-side menu-side-red" />
          <div className="menu-side menu-side-blue" />
          <div className="menu-shell">
            <div className="menu-field-art" aria-hidden="true">
              <div className="field-line field-midline" />
              <div className="field-circle" />
              <div className="field-box left-box" />
              <div className="field-box right-box" />
              <div className="field-run run-red" />
              <div className="field-run run-blue" />
              <div className="field-player art-red-player" />
              <div className="field-player art-blue-player" />
              <div className="field-ball" />
            </div>
            <div className="menu-title-row">
              <div className="menu-team-mark red-mark">RED</div>
              <h1>
                GAMEPLAY <span>FOOTBALL</span>
              </h1>
              <div className="menu-team-mark blue-mark">BLU</div>
            </div>
            <div className="legend-strip" aria-hidden="true">
              {MENU_LEGENDS.map((legend) => (
                <div className="legend-card" key={legend.name}>
                  <div
                    className="legend-bust"
                    style={{
                      "--shirt": legend.shirt,
                      "--hair": legend.hair,
                      "--skin": legend.skin,
                    } as React.CSSProperties}
                  >
                    <span className="legend-head" />
                    <span className="legend-body" />
                    <span className="legend-arm legend-arm-left" />
                    <span className="legend-arm legend-arm-right" />
                  </div>
                  <b>{legend.name}</b>
                </div>
              ))}
            </div>
            {menuTab !== "home" && (
              <button className="menu-back" onClick={() => setMenuTab("home")}>
                RETOUR
              </button>
            )}
            <div className="menu-premium-strip">
              <span>TACTIQUES RAPIDES</span>
              <span>RADIO STADE</span>
              <span>REPLAY & CARTONS</span>
            </div>
            {menuTab === "home" && (
              <>
                <div className="menu-main-actions">
                  <MenuModeButton
                    tone="yellow"
                    kicker="MATCH"
                    title="JOUER"
                    note="Lance un vrai match direct"
                    onClick={() => startMatch(0)}
                  />
                  <MenuModeButton
                    tone="green"
                    kicker="EXERCICES"
                    title="ENTRAINEMENT"
                    note="Penalty, corner, coup franc, tirs au but"
                    onClick={() => setMenuTab("training")}
                  />
                  <MenuModeButton
                    tone="blue"
                    kicker="19 JUILLET"
                    title="COUPE DU MONDE"
                    note="Calendrier, groupes et finale"
                    onClick={() => setMenuTab("worldcup")}
                  />
                </div>
                <div className="menu-grid">
                  <PlayersToggle />
                  {players === 1 && <TeamChoice />}
                  {players === 1 && <DifficultyPicker />}
                  {practice === 0 && <ImportantToggle />}
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
                      className="training-card"
                      onClick={() => startMatch(option.id)}
                    >
                      <span>{option.title}</span>
                      <b>{option.note}</b>
                    </button>
                  ))}
                </div>
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
            {players === 1 ? (
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
  onClick,
}: {
  tone: "yellow" | "green" | "blue";
  kicker: string;
  title: string;
  note: string;
  onClick: () => void;
}): React.ReactNode {
  return (
    <button className={`menu-mode-button mode-${tone}`} onClick={onClick}>
      <span>{kicker}</span>
      <b>{title}</b>
      <em>{note}</em>
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
