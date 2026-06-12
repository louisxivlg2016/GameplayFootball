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

  // pass assist: a played pass homes onto its receiver like a guided ball,
  // bending in flight toward where he is going — it arrives at his feet
  // instead of where he stood when it was struck. It never boomerangs:
  // once the receiver is behind the ball's path the assist lets go.
  if (bs.passTarget && bs.passHomingT > 0) {
    bs.passHomingT -= dt;
    const mate = bs.passTarget;
    const mp = mate.isAlive() ? mate.get(Position) : undefined;
    const speed2d = Math.hypot(v.x, v.z);
    if (!mp || bs.passHomingT <= 0 || speed2d < 2.5) {
      bs.passTarget = null;
    } else {
      const mv = mate.get(Velocity)!;
      // lead his run when far, but converge on the MAN himself up close so
      // the ball finishes on his boots, not half a meter beside them
      const lead = Math.min(0.22, Math.hypot(mp.x - bp.x, mp.z - bp.z) * 0.025);
      const dx = mp.x + mv.x * lead - bp.x;
      const dz = mp.z + mv.z * lead - bp.z;
      const dist = Math.hypot(dx, dz) || 1;
      const dot = (v.x * dx + v.z * dz) / (speed2d * dist);
      if (dist < 0.4 || dot < 0) {
        bs.passTarget = null;
      } else {
        // strong correction: the pass tracks the man, and a long ball that
        // friction would kill short keeps just enough roll to reach him
        const k = Math.min(1, dt * 7);
        const sp =
          dist > 1.5 && speed2d < 4.5
            ? Math.min(4.5, speed2d + 9 * dt)
            : speed2d;
        const nx = v.x / speed2d + (dx / dist - v.x / speed2d) * k;
        const nz = v.z / speed2d + (dz / dist - v.z / speed2d) * k;
        const nl = Math.hypot(nx, nz) || 1;
        rb.setLinvel({ x: (nx / nl) * sp, y: v.y, z: (nz / nl) * sp }, true);
        v.x = (nx / nl) * sp;
        v.z = (nz / nl) * sp;
      }
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
