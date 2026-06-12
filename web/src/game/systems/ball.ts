import type { World } from "koota";
import {
  BallRef,
  BallState,
  Heading,
  IsBall,
  Position,
  Stats,
  Velocity,
} from "../traits";
import { PITCH } from "../levels";
import { refState } from "./referee";

/**
 * Free-ball aerodynamics ported from ball.cpp: quadratic air drag (0.015·v²),
 * rolling friction (0.04·v² + 1.6 linear), net absorption (0.95 per 10ms).
 * Bounces and woodwork are Rapier's job (restitution 0.62 on the collider).
 */
export function ballSystem(world: World, dt: number): void {
  const ball = world.queryFirst(IsBall);
  if (!ball) return;
  const bs = ball.get(BallState)!;
  const rb = ball.get(BallRef)!.value;
  if (!rb) return;
  const bp = rb.translation();
  const v = rb.linvel();

  // touch-based dribbling: the carrier plays the ball ahead in discrete touches
  // and chases it — the ball is genuinely loose (and winnable) between touches
  if (bs.owner && (!refState.ceremony || refState.ceremony.ready)) {
    const p = bs.owner.get(Position)!;
    const ov = bs.owner.get(Velocity)!;
    const speed = Math.hypot(ov.x, ov.z);
    const ballSpeed = Math.hypot(v.x, v.z);
    const d = Math.hypot(bp.x - p.x, bp.z - p.z);
    bs.touchTimer -= dt;
    // a touch fires when the carrier has caught up to the slowing ball, not on
    // a fixed clock — otherwise a player starting to run outruns their own ball
    const caughtUp = speed > 1 && ballSpeed < speed * 0.75;
    if (d < 1.0 && bp.y < 0.5 && (bs.touchTimer <= 0 || caughtUp)) {
      const stats = bs.owner.get(Stats)!;
      if (speed >= 1) {
        // GetBallControlVector (humanoid_utils.cpp): aim the ball at a planned
        // re-touch point — playerPos + movement·delay + front-of-foot offset,
        // where delay = (v/sprint)²·0.6 + 0.25s — with just enough pace that
        // rolling friction kills it there as the carrier arrives.
        const delay = Math.pow(speed / 8, 2) * 0.6 + 0.25;
        const err =
          (1 - stats.ballcontrol) * 0.12 * (Math.random() - 0.5) * 2;
        const cos = Math.cos(err);
        const sin = Math.sin(err);
        const mx = (ov.x * cos - ov.z * sin) / speed;
        const mz = (ov.x * sin + ov.z * cos) / speed;
        const plannedX = p.x + mx * (speed * delay + 0.35);
        const plannedZ = p.z + mz * (speed * delay + 0.35);
        const toX = plannedX - bp.x;
        const toZ = plannedZ - bp.z;
        const dist = Math.hypot(toX, toZ) || 0.001;
        const timeToGo = delay + 0.08;
        const divisor = timeToGo * (0.38 + 0.02 * stats.ballcontrol) * 1.1;
        const power = Math.pow(dist / divisor, 0.7);
        rb.setLinvel(
          { x: (toX / dist) * power, y: Math.min(v.y, 0.2), z: (toZ / dist) * power },
          true,
        );
        bs.touchTimer = Math.max(0.25, delay * 0.85);
      } else {
        // standing: trap the ball dead at the feet, stay ready for the next touch
        rb.setLinvel({ x: v.x * 0.3, y: v.y, z: v.z * 0.3 }, true);
        bs.touchTimer = 0.15;
      }
      // the drag section below works on this frame's pre-touch velocity and
      // would cancel the touch we just applied — skip it for this frame
      return;
    }
  }

  let { x: vx, y: vy, z: vz } = v;
  const speed = Math.hypot(vx, vy, vz);
  if (speed > 0.01) {
    const f = Math.max(0, 1 - 0.015 * speed * dt); // drag·v² → dv = 0.015·v²·dt
    vx *= f;
    vy *= f;
    vz *= f;
  }
  if (bp.y < PITCH.ballRadius + 0.03) {
    const hs = Math.hypot(vx, vz);
    if (hs > 0.01) {
      const next = Math.max(0, hs - (0.04 * hs * hs + 1.6) * dt);
      vx *= next / hs;
      vz *= next / hs;
    }
  }
  // inside the goal: the net soaks up momentum
  const ax = Math.abs(bp.x);
  if (
    ax > PITCH.halfLength &&
    ax < PITCH.halfLength + PITCH.goalDepth + 0.6 &&
    Math.abs(bp.z) < PITCH.goalHalfWidth + 0.6 &&
    bp.y < PITCH.goalHeight + 0.4
  ) {
    const f = Math.pow(0.95, dt * 100);
    vx *= f;
    vy *= f;
    vz *= f;
  }
  rb.setLinvel({ x: vx, y: vy, z: vz }, true);
}
