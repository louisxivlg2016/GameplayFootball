import { useEffect, useRef } from "react";
import { TEAMS, useStore } from "../game/store";
import { TouchControls } from "./TouchControls";
import { DragShoot } from "./DragShoot";

const act = () => useStore.getState();

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
  const mm = String(Math.floor(clock / 60)).padStart(2, "0");
  const ss = String(clock % 60).padStart(2, "0");

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
      {mode === "goal" && <div className="banner">GOAL!</div>}
      {banner && mode !== "goal" && (
        <div className="banner" style={{ fontSize: 40, letterSpacing: 3 }}>
          {banner}
        </div>
      )}
      {mode === "pause" && (
        <div className="menu">
          <h1>PAUSE</h1>
          <BigButton label="REPRENDRE" onClick={() => act().setMode("play")} />
          <div className="prompt">ou appuie sur Échap</div>
        </div>
      )}
      {mode === "menu" && (
        <div className="menu">
          <h1>
            GAMEPLAY <span>FOOTBALL</span>
          </h1>
          <BigButton label="▶ JOUER" onClick={() => act().newMatch()} />
          <div className="prompt">ou appuie sur Entrée</div>
          <ModePicker />
          <PlayersToggle />
          {players === 1 && <DifficultyPicker />}
          {practice === 0 && <ImportantToggle />}
          {players === 1 ? (
            <div className="controls">
              <b>WASD / Arrows</b> move&ensp;<b>Shift</b> sprint
              <br />
              <b>Space</b> shoot&ensp;<b>X</b> pass&ensp;<b>C</b> lofted pass&ensp;
              <b>V</b> header&ensp;<b>E</b> slide tackle
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
      onClick={onClick}
      style={{
        pointerEvents: "auto",
        cursor: "pointer",
        margin: "10px 0",
        padding: "14px 38px",
        fontSize: 22,
        fontWeight: 800,
        letterSpacing: 1,
        color: "#0b1a0b",
        background: "#ffe94a",
        border: "none",
        borderRadius: 10,
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
        fontFamily: "inherit",
      }}
    >
      {label}
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

const PRACTICE_NAMES = ["MATCH", "TIRS AU BUT", "COUP FRANC", "CORNER", "PENALTY"];

function ModePicker(): React.ReactNode {
  const practice = useStore((s) => s.practice);
  return (
    <div
      onClick={() => act().cyclePractice()}
      style={{
        textAlign: "center",
        fontSize: 16,
        color: "#e8e8e8",
        pointerEvents: "auto",
        cursor: "pointer",
        padding: "4px 0",
      }}
    >
      <span
        style={{
          background: "rgba(255,255,255,0.12)",
          borderRadius: 4,
          padding: "1px 7px",
          color: "#fff",
          fontWeight: 600,
        }}
      >
        T
      </span>{" "}
      Mode :{" "}
      <b style={{ color: practice === 0 ? "#7ddb5a" : "#ffe94a" }}>
        {PRACTICE_NAMES[practice]}
      </b>{" "}
      <span style={{ opacity: 0.6 }}>▸</span>
    </div>
  );
}

function PlayersToggle(): React.ReactNode {
  const players = useStore((s) => s.players);
  return (
    <div
      onClick={() => act().togglePlayers()}
      style={{
        textAlign: "center",
        fontSize: 16,
        color: "#e8e8e8",
        pointerEvents: "auto",
        cursor: "pointer",
        padding: "4px 0",
      }}
    >
      <span
        style={{
          background: "rgba(255,255,255,0.12)",
          borderRadius: 4,
          padding: "1px 7px",
          color: "#fff",
          fontWeight: 600,
        }}
      >
        J
      </span>{" "}
      Mode :{" "}
      <span
        style={{
          margin: "0 4px",
          fontWeight: players === 1 ? 800 : 400,
          color: players === 1 ? "#ffe94a" : "#9fb89f",
          opacity: players === 1 ? 1 : 0.6,
        }}
      >
        1 JOUEUR
      </span>
      <span
        style={{
          margin: "0 4px",
          fontWeight: players === 2 ? 800 : 400,
          color: players === 2 ? "#4ad2ff" : "#9fb89f",
          opacity: players === 2 ? 1 : 0.6,
        }}
      >
        2 JOUEURS
      </span>
      {players === 2 && (
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          versus local : J1 dirige les ROUGES, J2 dirige les BLEUS
        </div>
      )}
    </div>
  );
}

const DIFFICULTY_NAMES = ["FACILE", "NORMAL", "DIFFICILE"];
const DIFFICULTY_COLORS = ["#7ddb5a", "#ffe94a", "#ff6b4a"];

function DifficultyPicker(): React.ReactNode {
  const difficulty = useStore((s) => s.difficulty);
  return (
    <div
      onClick={() => act().cycleDifficulty()}
      style={{
        textAlign: "center",
        fontSize: 16,
        color: "#e8e8e8",
        pointerEvents: "auto",
        cursor: "pointer",
        padding: "4px 0",
      }}
    >
      <span
        style={{
          background: "rgba(255,255,255,0.12)",
          borderRadius: 4,
          padding: "1px 7px",
          color: "#fff",
          fontWeight: 600,
        }}
      >
        D
      </span>{" "}
      Difficulté :{" "}
      {DIFFICULTY_NAMES.map((name, i) => (
        <span
          key={name}
          style={{
            margin: "0 4px",
            fontWeight: i === difficulty ? 800 : 400,
            color: i === difficulty ? DIFFICULTY_COLORS[i] : "#9fb89f",
            opacity: i === difficulty ? 1 : 0.6,
          }}
        >
          {name}
        </span>
      ))}
    </div>
  );
}

function ImportantToggle(): React.ReactNode {
  const important = useStore((s) => s.important);
  return (
    <div
      onClick={() => act().toggleImportant()}
      style={{
        textAlign: "center",
        color: important ? "#ffe94a" : "#9fb89f",
        fontSize: 16,
        pointerEvents: "auto",
        cursor: "pointer",
        padding: "4px 0",
      }}
    >
      <span
        style={{
          background: "rgba(255,255,255,0.12)",
          borderRadius: 4,
          padding: "1px 7px",
          color: "#fff",
          fontWeight: 600,
        }}
      >
        M
      </span>{" "}
      Match important : {important ? "OUI" : "NON"}
      <div style={{ fontSize: 12, opacity: 0.8 }}>
        deux mi-temps, puis prolongation (deux mi-temps) et tirs au but si le
        score reste égal
      </div>
    </div>
  );
}

const RADAR_W = 220;
const RADAR_H = 148;

function Radar(): React.ReactNode {
  const radar = useStore((s) => s.radar);
  const ref = useRef<HTMLCanvasElement>(null);

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
