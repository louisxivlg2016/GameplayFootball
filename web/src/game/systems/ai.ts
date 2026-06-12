import type { Entity, World } from "koota";
import {
  BallRef,
  BallState,
  HomePos,
  IsBall,
  IsPlayer,
  PlayerInfo,
  Position,
  Role,
  Selected,
  Team,
  Velocity,
} from "../traits";
import { PITCH, SPEEDS, attackSign } from "../levels";
import { pass, shoot } from "./kicks";

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

/** Accelerate toward a point; speed scales with distance like gamedefines.hpp:54. */
function seek(
  e: Entity,
  tx: number,
  tz: number,
  dt: number,
  maxSpeed: number = SPEEDS.sprint,
): void {
  const p = e.get(Position)!;
  const v = e.get(Velocity)!;
  const dx = tx - p.x;
  const dz = tz - p.z;
  const d = Math.hypot(dx, dz);
  const speed = d < 0.4 ? 0 : Math.min(d * 2.6, maxSpeed);
  const k = Math.min(1, dt * 6);
  const wx = d > 0 ? (dx / d) * speed : 0;
  const wz = d > 0 ? (dz / d) * speed : 0;
  v.x += (wx - v.x) * k;
  v.z += (wz - v.z) * k;
}

export function aiSystem(world: World, dt: number): void {
  const ball = world.queryFirst(IsBall);
  if (!ball) return;
  const bs = ball.get(BallState)!;
  const rb = ball.get(BallRef)!.value;
  if (!rb) return;
  const bp = rb.translation();
  const bv = rb.linvel();

  const players = world.query(IsPlayer);

  // one designated chaser per team: nearest outfielder (never the human's player)
  const chaser: Array<Entity | null> = [null, null];
  const chaserD = [Infinity, Infinity];
  for (const e of players) {
    if (e.has(Selected) || e.get(PlayerInfo)!.role === Role.GK) continue;
    const t = e.get(Team)!.id;
    const p = e.get(Position)!;
    const d = Math.hypot(p.x - bp.x, p.z - bp.z);
    if (d < chaserD[t]!) {
      chaserD[t] = d;
      chaser[t] = e;
    }
  }

  for (const e of players) {
    if (e.has(Selected)) continue; // human steers this one
    const teamId = e.get(Team)!.id;
    const info = e.get(PlayerInfo)!;
    const s = attackSign(teamId);

    if (info.role === Role.GK) {
      keeper(e, s, bs.owner, bp, dt);
      continue;
    }

    if (bs.owner === e) {
      possessor(world, e, s, dt, players);
      continue;
    }

    const opponentHasBall = bs.owner !== null && bs.owner.get(Team)!.id !== teamId;
    if (chaser[teamId] === e && (bs.owner === null || opponentHasBall)) {
      // intercept slightly ahead of the rolling ball
      seek(e, bp.x + bv.x * 0.25, bp.z + bv.z * 0.25, dt);
      continue;
    }

    // hold formation, shifted with the ball like the original's strategy anchors
    const a = e.get(HomePos)!;
    const tx = clamp(a.x + clamp(bp.x * 0.42, -16, 16), -52, 52);
    const tz = clamp(a.z + (bp.z - a.z) * 0.18, -34, 34);
    seek(e, tx, tz, dt, SPEEDS.walk * 1.25);
  }
}

function keeper(
  e: Entity,
  s: number,
  owner: Entity | null,
  bp: { x: number; y: number; z: number },
  dt: number,
): void {
  const goalX = -s * PITCH.halfLength;
  const distGoal = Math.hypot(bp.x - goalX, bp.z);
  if (owner === null && distGoal < 10) {
    seek(e, bp.x, bp.z, dt); // rush the loose ball in the box
    return;
  }
  const tz = clamp(bp.z * 0.35, -3.1, 3.1);
  seek(e, goalX + s * 1.2, tz, dt);
}

function possessor(
  world: World,
  e: Entity,
  s: number,
  dt: number,
  players: readonly Entity[],
): void {
  const p = e.get(Position)!;
  const goalX = s * PITCH.halfLength;
  seek(e, goalX, p.z * 0.5, dt, SPEEDS.sprint * 0.85);

  const info = e.get(PlayerInfo)!;
  const aiTimer = info.aiTimer - dt;
  if (aiTimer > 0) {
    e.set(PlayerInfo, { aiTimer });
    return;
  }
  e.set(PlayerInfo, { aiTimer: 0.3 });

  const teamId = e.get(Team)!.id;
  let nearestOpp = Infinity;
  for (const o of players) {
    if (o.get(Team)!.id === teamId) continue;
    const op = o.get(Position)!;
    nearestOpp = Math.min(nearestOpp, Math.hypot(op.x - p.x, op.z - p.z));
  }

  const distGoal = Math.hypot(goalX - p.x, p.z);
  if (distGoal < 22 && Math.abs(p.z) < 18) {
    shoot(world, e, (Math.random() - 0.5) * 5);
  } else if (nearestOpp < 2.8) {
    const d = Math.hypot(goalX - p.x, -p.z) || 1;
    pass(world, e, (goalX - p.x) / d, -p.z * 0.3 / d, distGoal > 35);
  }
}
