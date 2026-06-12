import { useEffect, useRef } from "react";
import { TEAMS, useStore } from "../game/store";

export function Hud(): React.ReactNode {
  const mode = useStore((s) => s.mode);
  const score = useStore((s) => s.score);
  const clock = useStore((s) => s.clock);
  const phaseLabel = useStore((s) => s.phaseLabel);
  const banner = useStore((s) => s.banner);
  const pens = useStore((s) => s.pens);
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
          </div>
          <Radar />
        </>
      )}
      {mode === "goal" && <div className="banner">GOAL!</div>}
      {banner && mode !== "goal" && (
        <div className="banner" style={{ fontSize: 40, letterSpacing: 3 }}>
          {banner}
        </div>
      )}
      {mode === "pause" && (
        <div className="menu">
          <h1>PAUSED</h1>
          <div className="prompt">Press Esc to resume</div>
        </div>
      )}
      {mode === "menu" && (
        <div className="menu">
          <h1>
            GAMEPLAY <span>FOOTBALL</span>
          </h1>
          <div className="prompt">Press Enter to kick off</div>
          <div className="controls">
            <b>WASD / Arrows</b> move&ensp;<b>Shift</b> sprint
            <br />
            <b>Space</b> shoot&ensp;<b>X</b> pass&ensp;<b>C</b> lofted pass&ensp;
            <b>E</b> slide tackle
            <br />
            <b>R</b> radio commentary&ensp;<b>Esc</b> pause
          </div>
        </div>
      )}
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
