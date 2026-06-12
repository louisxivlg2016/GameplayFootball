import type { World } from "koota";
import {
  BallRef,
  BallState,
  Heading,
  IsBall,
  Position,
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

  // continuous carry (the phase-1 model): keep the ball just in front of the
  // owner's feet every frame. Contests still happen via the steal radius and
  // slide-tackle pokes, which clear the owner before this branch runs.
  if (bs.owner && (!refState.ceremony || refState.ceremony.ready)) {
    const p = bs.owner.get(Position)!;
    const ang = bs.owner.get(Heading)!.angle;
    const ov = bs.owner.get(Velocity)!;
    const speed = Math.hypot(ov.x, ov.z);
    const tx = p.x + Math.sin(ang) * 0.55;
    const tz = p.z + Math.cos(ang) * 0.55;
    const maxCarry = speed + 5;
    let cx = (tx - bp.x) * 9;
    let cz = (tz - bp.z) * 9;
    const cm = Math.hypot(cx, cz);
    if (cm > maxCarry) {
      cx *= maxCarry / cm;
      cz *= maxCarry / cm;
    }
    rb.setLinvel({ x: cx, y: bp.y > 0.25 ? v.y : Math.min(v.y, 0), z: cz }, true);
    return; // never let the free-ball drag below overwrite the carry
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
