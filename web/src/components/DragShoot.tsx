import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { world } from "../game/world";
import { BallRef, IsBall } from "../game/traits";
import { refState } from "../game/systems/referee";
import { humanSlotFor, PITCH, attackSign } from "../game/levels";
import { strikeToward } from "../game/systems/kicks";

/**
 * Draw-to-shoot: at a human penalty, free kick or corner you trace a white line
 * with the mouse or finger toward where you want the ball to go. On release the
 * line is raycast onto the goal plane (a shot) or the pitch (a cross) and the
 * ball is struck there, with power from the line's length.
 */
type Line = { x1: number; y1: number; x2: number; y2: number };

function activeSetPiece(): typeof refState.ceremony {
  const c = refState.ceremony;
  if (!c || !c.ready) return null;
  if (c.type !== "penalty" && c.type !== "freekick" && c.type !== "corner")
    return null;
  if (humanSlotFor(c.team) === null) return null;
  if (!c.taker || !c.taker.isAlive()) return null;
  return c;
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
  const [line, setLine] = useState<Line | null>(null);
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
    const bs = ballScreen() ?? { x: e.clientX, y: e.clientY };
    setLine({ x1: bs.x, y1: bs.y, x2: e.clientX, y2: e.clientY });
  };
  const move = (e: React.PointerEvent): void => {
    if (!dragging.current) return;
    setLine((l) => (l ? { ...l, x2: e.clientX, y2: e.clientY } : null));
  };
  const cancel = (): void => {
    dragging.current = false;
    setLine(null);
  };
  const end = (e: React.PointerEvent): void => {
    if (!dragging.current) return;
    dragging.current = false;
    setLine(null);
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
      {!line && (
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
          ✏️ Trace une ligne vers le but pour tirer
        </div>
      )}
      {line && (
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        >
          {/* a bold solid white line with a soft halo so it reads on the pitch */}
          <line
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="rgba(0,0,0,0.5)"
            strokeWidth={11}
            strokeLinecap="round"
          />
          <line
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="#fff"
            strokeWidth={6}
            strokeLinecap="round"
          />
          <circle cx={line.x1} cy={line.y1} r={7} fill="#ffe94a" />
          <circle cx={line.x2} cy={line.y2} r={12} fill="#fff" stroke="#000" strokeWidth={2} />
        </svg>
      )}
    </div>
  );
}
