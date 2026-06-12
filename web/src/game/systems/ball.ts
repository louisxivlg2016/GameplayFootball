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
    const d = Math.hypot(bp.x - p.x, bp.z - p.z);
    bs.touchTimer -= dt;
    if (d < 0.8 && bp.y < 0.5 && bs.touchTimer <= 0) {
      const stats = bs.owner.get(Stats)!;
      const ang = bs.owner.get(Heading)!.angle;
      // touch error from technical_ballcontrol, worse at speed
      const err = ((1 - stats.ballcontrol) * 0.22 + speed * 0.012) * (Math.random() - 0.5) * 2;
      const dir = ang + err;
      const push = Math.max(speed, 0.001) < 1 ? 0 : Math.min(speed, 8) * 1.12 + 1.1;
      if (push > 0) {
        rb.setLinvel({ x: Math.sin(dir) * push, y: v.y, z: Math.cos(dir) * push }, true);
      } else {
        rb.setLinvel({ x: v.x * 0.4, y: v.y, z: v.z * 0.4 }, true); // shield it
      }
      // touch cadence shortens as the dribble slows (~the original's per-step touches)
      bs.touchTimer = Math.min(0.7, Math.max(0.28, 2.0 / Math.max(speed, 2)));
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
