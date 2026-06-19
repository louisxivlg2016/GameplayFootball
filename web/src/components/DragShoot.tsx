import { useEffect, useRef, useState } from "react";
import type { Entity } from "koota";
import * as THREE from "three";
import { world } from "../game/world";
import {
  BallRef,
  IsBall,
  IsPlayer,
  KeeperDive,
  PlayerInfo,
  Position,
  Role,
  Team,
  Velocity,
} from "../game/traits";
import { refState } from "../game/systems/referee";
import { humanSlotFor, PITCH, attackSign } from "../game/levels";
import { strikeToward } from "../game/systems/kicks";

/**
 * Draw-to-shoot: at a human penalty, free kick or corner you scribble a white
 * line with the mouse or finger — like a pencil, it follows your exact stroke,
 * curves and all. On release the END of the stroke is raycast onto the goal
 * plane (a shot) or the pitch (a cross) and the ball is struck there, with power
 * from how far the stroke reaches from the ball.
 */
type Pt = { x: number; y: number };

function activeSetPiece(): typeof refState.ceremony {
  const c = refState.ceremony;
  if (!c || !c.ready) return null;
  if (c.type !== "penalty" && c.type !== "freekick" && c.type !== "corner")
    return null;
  if (humanSlotFor(c.team) === null) return null;
  if (!c.taker || !c.taker.isAlive()) return null;
  return c;
}

/** True whenever the human is on a draw-to-shoot set piece (preparing or ready),
 *  so the HUD can clear the radar out of the way of the ball and aim line. */
export function humanSetPieceActive(): boolean {
  const c = refState.ceremony;
  if (!c) return false;
  if (c.type !== "penalty" && c.type !== "freekick" && c.type !== "corner")
    return false;
  return humanSlotFor(c.team) !== null;
}

function ballScreen(): { x: number; y: number } | null {
  const cam = (globalThis as { __gpfCam?: THREE.Camera }).__gpfCam;
  const rb = world.queryFirst(IsBall)?.get(BallRef)?.value;
  if (!cam || !rb) return null;
  const bp = rb.translation();
  const v = new THREE.Vector3(bp.x, bp.y, bp.z).project(cam);
  return {
    x: (v.x * 0.5 + 0.5) * window.innerWidth,
    y: (-v.y * 0.5 + 0.5) * window.innerHeight,
  };
}

export function DragShoot(): React.ReactNode {
  const [active, setActive] = useState(false);
  const [path, setPath] = useState<Pt[] | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    let raf = 0;
    const tick = (): void => {
      setActive(!!activeSetPiece());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!active) return null;

  const start = (e: React.PointerEvent): void => {
    if (!activeSetPiece()) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = true;
    // anchor the stroke at the ball, then follow the finger from there
    const bs = ballScreen() ?? { x: e.clientX, y: e.clientY };
    setPath([bs, { x: e.clientX, y: e.clientY }]);
  };
  const move = (e: React.PointerEvent): void => {
    if (!dragging.current) return;
    const x = e.clientX;
    const y = e.clientY;
    setPath((p) => {
      if (!p) return p;
      const last = p[p.length - 1]!;
      // skip near-duplicate points so the stroke stays light but smooth
      if (Math.hypot(x - last.x, y - last.y) < 4) return p;
      return [...p, { x, y }];
    });
  };
  const cancel = (): void => {
    dragging.current = false;
    setPath(null);
  };
  const end = (e: React.PointerEvent): void => {
    if (!dragging.current) return;
    dragging.current = false;
    setPath(null);
    const c = activeSetPiece();
    const cam = (globalThis as { __gpfCam?: THREE.Camera }).__gpfCam;
    if (!c || !c.taker || !cam) return;

    const ndc = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, cam);
    const hit = new THREE.Vector3();
    const goalX = attackSign(c.team) * PITCH.halfLength;
    let target: THREE.Vector3 | null = null;

    if (c.type === "corner") {
      const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      if (ray.ray.intersectPlane(ground, hit)) target = hit.clone();
    } else {
      // aim at the goal plane; if the drag misses it, fall back to the ground
      const goalPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -goalX);
      if (ray.ray.intersectPlane(goalPlane, hit) && Math.sign(hit.x) === Math.sign(goalX)) {
        target = hit.clone();
      } else {
        const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        if (ray.ray.intersectPlane(ground, hit)) target = hit.clone();
      }
    }
    if (!target) return;

    const bs = ballScreen();
    const len = bs ? Math.hypot(e.clientX - bs.x, e.clientY - bs.y) : 250;
    const power = Math.max(0.3, Math.min(1, len / (window.innerHeight * 0.5)));

    const corner = c.type === "corner";
    const tx = corner ? target.x : goalX;
    const ty = corner ? 0 : Math.max(0, Math.min(target.y, PITCH.goalHeight + 0.3));
    const tz = corner
      ? target.z
      : Math.max(
          -PITCH.goalHalfWidth - 0.6,
          Math.min(PITCH.goalHalfWidth + 0.6, target.z),
        );
    strikeToward(world, c.taker, tx, ty, tz, power, corner);
  };

  return (
    <div
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={cancel}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "auto",
        zIndex: 6,
        touchAction: "none",
        cursor: "crosshair",
      }}
    >
      {!path && (
        <div
          style={{
            position: "absolute",
            top: "16%",
            left: 0,
            right: 0,
            textAlign: "center",
            color: "#fff",
            fontWeight: 800,
            fontSize: 22,
            letterSpacing: 1,
            textShadow: "0 2px 8px #000",
            pointerEvents: "none",
          }}
        >
          ✏️ Trace un trait pour tirer
        </div>
      )}
      {path && path.length > 1 && (
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        >
          {/* freehand pencil stroke: the exact path the finger drew, bold white
              with a soft dark halo so it reads on the pitch */}
          <polyline
            points={path.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="rgba(0,0,0,0.5)"
            strokeWidth={11}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points={path.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="#fff"
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={path[0]!.x} cy={path[0]!.y} r={7} fill="#ffe94a" />
          <circle
            cx={path[path.length - 1]!.x}
            cy={path[path.length - 1]!.y}
            r={12}
            fill="#fff"
            stroke="#000"
            strokeWidth={2}
          />
        </svg>
      )}
    </div>
  );
}

/** The human's keeper, when an OPPONENT is taking a penalty OR free kick at him. */
function defendingKeeper(): Entity | null {
  const c = refState.ceremony;
  if (!c || (c.type !== "penalty" && c.type !== "freekick")) return null;
  if (humanSlotFor(c.team) !== null) return null; // the human is the taker, not defending
  const defTeam = 1 - c.team;
  if (humanSlotFor(defTeam) === null) return null; // human doesn't control the defenders
  for (const e of world.query(IsPlayer)) {
    if (
      e.isAlive() &&
      e.get(Team)!.id === defTeam &&
      e.get(PlayerInfo)!.role === Role.GK
    )
      return e;
  }
  return null;
}

function screenOf(e: Entity): { x: number; y: number } | null {
  const cam = (globalThis as { __gpfCam?: THREE.Camera }).__gpfCam;
  if (!cam || !e.isAlive()) return null;
  const p = e.get(Position)!;
  const v = new THREE.Vector3(p.x, 1.2, p.z).project(cam);
  if (v.z > 1) return null; // behind the camera
  return {
    x: (v.x * 0.5 + 0.5) * window.innerWidth,
    y: (-v.y * 0.5 + 0.5) * window.innerHeight,
  };
}

/** Fling the human keeper to a side. dir -1 = screen-left, +1 = screen-right.
 *  The camera sits behind the taker looking at the keeper's goal, so screen-right
 *  is world +z when that goal is at +x but world -z when it's at -x — without
 *  this the arrows are mirrored whenever you defend the other end. */
function diveKeeper(dir: number): void {
  const gk = defendingKeeper();
  if (!gk || gk.has(KeeperDive)) return;
  const ownGoalX = -attackSign(gk.get(Team)!.id) * PITCH.halfLength;
  const worldDir = dir * Math.sign(ownGoalX || 1);
  gk.add(KeeperDive);
  gk.set(KeeperDive, { t: 0, side: worldDir });
  const v = gk.get(Velocity)!;
  v.z = worldDir * 8;
  v.x = 0;
}

/**
 * When the AI takes a penalty against you, control of the save is a guess: a
 * big arrow sits either side of your keeper. Press one and he flings himself
 * that way — pick the right side and you keep it out.
 */
export function KeeperArrows(): React.ReactNode {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    let raf = 0;
    const tick = (): void => {
      const gk = defendingKeeper();
      setPos(gk ? screenOf(gk) : null);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  if (!pos) return null;

  const btn = (dir: -1 | 1): React.ReactNode => (
    <div
      onPointerDown={(e) => {
        e.preventDefault();
        diveKeeper(dir);
      }}
      style={{
        position: "absolute",
        left: pos.x + dir * 120 - 36,
        top: pos.y - 36,
        width: 72,
        height: 72,
        borderRadius: "50%",
        background: "rgba(255,233,74,0.85)",
        border: "3px solid #000",
        color: "#000",
        fontSize: 40,
        fontWeight: 900,
        lineHeight: "66px",
        textAlign: "center",
        pointerEvents: "auto",
        touchAction: "none",
        userSelect: "none",
        boxShadow: "0 2px 10px rgba(0,0,0,0.6)",
      }}
    >
      {dir < 0 ? "←" : "→"}
    </div>
  );

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 6 }}>
      <div
        style={{
          position: "absolute",
          top: "16%",
          left: 0,
          right: 0,
          textAlign: "center",
          color: "#fff",
          fontWeight: 800,
          fontSize: 22,
          textShadow: "0 2px 8px #000",
        }}
      >
        🧤 Choisis un côté pour plonger
      </div>
      {btn(-1)}
      {btn(1)}
    </div>
  );
}
