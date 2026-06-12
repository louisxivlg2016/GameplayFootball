import type { World } from "koota";
import {
  BallRef,
  BallState,
  Heading,
  IsBall,
  IsReferee,
  MeshRef,
  Position,
  Velocity,
} from "../traits";
import { refState } from "./referee";
import { animateRig } from "./movement";

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));
const normAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * The on-pitch official: trails play on the classic diagonal toward the far
 * side, closes in on foul/penalty spots during ceremonies, and never gets
 * underfoot. Ignored by all play logic (not an IsPlayer).
 */
export function officialsSystem(world: World, dt: number): void {
  const referee = world.queryFirst(IsReferee);
  if (!referee) return;
  const ballEnt = world.queryFirst(IsBall);
  const rb = ballEnt?.get(BallRef)?.value;
  const bp = rb ? rb.translation() : { x: 0, y: 0, z: 0 };

  const p = referee.get(Position)!;
  const v = referee.get(Velocity)!;

  // run with the play: lead the patrol point along the carrier's velocity so
  // the ref tracks the same direction as the man on the ball instead of
  // reacting to where the ball was (free balls lead on ball velocity)
  const carrier = ballEnt?.get(BallState)?.owner ?? null;
  let leadX = 0;
  let leadZ = 0;
  if (carrier) {
    const cv = carrier.get(Velocity)!;
    leadX = cv.x;
    leadZ = cv.z;
  } else if (rb) {
    const bv = rb.linvel();
    leadX = bv.x;
    leadZ = bv.z;
  }
  const leadM = Math.hypot(leadX, leadZ);
  if (leadM > 8) {
    leadX *= 8 / leadM;
    leadZ *= 8 / leadM;
  }

  // diagonal patrol: behind play, biased to the far touchline
  let tx = (bp.x + leadX * 1.1) * 0.82;
  let tz = (bp.z + leadZ * 1.1) * 0.5 - 8;
  const c = refState.ceremony;
  if (c) {
    // attend the restart — close for fouls and penalties, discreet otherwise
    const standoff = c.type === "freekick" || c.type === "penalty" ? 4 : 9;
    tx = c.x - Math.sign(c.x || 1) * standoff * 0.6;
    tz = c.z - Math.sign(c.z || 1) * standoff;
  }
  // stay out from underfoot of live play
  const dxb = tx - bp.x;
  const dzb = tz - bp.z;
  const dTargetBall = Math.hypot(dxb, dzb);
  if (dTargetBall < 6 && dTargetBall > 0.01) {
    tx = bp.x + (dxb / dTargetBall) * 6;
    tz = bp.z + (dzb / dTargetBall) * 6;
  }
  tx = clamp(tx, -52, 52);
  tz = clamp(tz, -34, 34);

  // seek with the original's distance-to-velocity rule, capped below sprint
  const dx = tx - p.x;
  const dz = tz - p.z;
  const d = Math.hypot(dx, dz);
  const speedWanted = d < 0.6 ? 0 : Math.min(d * 2.6, 7);
  const k = Math.min(1, dt * 6);
  v.x += ((d > 0 ? (dx / d) * speedWanted : 0) - v.x) * k;
  v.z += ((d > 0 ? (dz / d) * speedWanted : 0) - v.z) * k;

  p.x = clamp(p.x + v.x * dt, -58, 58);
  p.z = clamp(p.z + v.z * dt, -39, 39);

  const speed = Math.hypot(v.x, v.z);
  let heading = referee.get(Heading)!.angle;
  let angleDiff = 0;
  if (speed > 0.6) {
    const desired = Math.atan2(v.x, v.z);
    const diff = normAngle(desired - heading);
    const maxTurn = (10 + speed * 0.5) * dt;
    heading = normAngle(heading + clamp(diff, -maxTurn, maxTurn));
    referee.set(Heading, { angle: heading });
    angleDiff = normAngle(desired - heading);
  }

  const h = referee.get(MeshRef)!;
  if (h.value) {
    h.value.position.set(p.x, 0, p.z);
    h.value.rotation.y = heading;
  }
  animateRig(h, speed, angleDiff, dt);
}
