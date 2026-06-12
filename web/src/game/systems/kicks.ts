import type { Entity, World } from "koota";
import {
  BallRef,
  BallState,
  IsBall,
  IsPlayer,
  Match,
  Position,
  Team,
  Velocity,
} from "../traits";
import { PITCH, attackSign } from "../levels";

export function releaseBall(
  world: World,
  kicker: Entity,
  vel: { x: number; y: number; z: number },
): void {
  const ball = world.queryFirst(IsBall);
  if (!ball) return;
  const rb = ball.get(BallRef)!.value;
  if (!rb) return;
  rb.setLinvel(vel, true);
  const bs = ball.get(BallState)!;
  bs.owner = null;
  bs.lastKicker = kicker;
  bs.kickCooldown = 0.45;
  world.queryFirst(Match)?.set(Match, {
    lastTouchTeam: kicker.get(Team)!.id,
  });
}

export function shoot(world: World, kicker: Entity, aimZ: number): void {
  const ball = world.queryFirst(IsBall);
  const rb = ball?.get(BallRef)!.value;
  if (!ball || !rb) return;
  const bp = rb.translation();
  const goalX = attackSign(kicker.get(Team)!.id) * PITCH.halfLength;
  const tz = Math.max(
    -PITCH.goalHalfWidth + 0.4,
    Math.min(PITCH.goalHalfWidth - 0.4, aimZ),
  );
  const dx = goalX - bp.x;
  const dz = tz - bp.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.5) return;
  const speed = 26;
  const lift = Math.min(6.5, 2.2 + dist * 0.09);
  releaseBall(world, kicker, {
    x: (dx / dist) * speed,
    y: lift,
    z: (dz / dist) * speed,
  });
}

/** Most aligned teammate in the kick direction, lightly penalized by distance. */
export function bestPassTarget(
  world: World,
  kicker: Entity,
  dirX: number,
  dirZ: number,
): Entity | null {
  const teamId = kicker.get(Team)!.id;
  const kp = kicker.get(Position)!;
  let best: Entity | null = null;
  let bestScore = -Infinity;
  let nearest: Entity | null = null;
  let nearestD = Infinity;
  for (const e of world.query(IsPlayer)) {
    if (e === kicker || e.get(Team)!.id !== teamId) continue;
    const p = e.get(Position)!;
    const dx = p.x - kp.x;
    const dz = p.z - kp.z;
    const d = Math.hypot(dx, dz);
    if (d < 2) continue;
    if (d < nearestD) {
      nearestD = d;
      nearest = e;
    }
    if (d > 45) continue;
    const align = (dx * dirX + dz * dirZ) / d;
    const score = align * 2 - d * 0.025;
    if (align > 0.05 && score > bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best ?? nearest;
}

export function pass(
  world: World,
  kicker: Entity,
  dirX: number,
  dirZ: number,
  lofted: boolean,
): void {
  const ball = world.queryFirst(IsBall);
  const rb = ball?.get(BallRef)!.value;
  if (!ball || !rb) return;
  const bp = rb.translation();

  const target = bestPassTarget(world, kicker, dirX, dirZ);
  let tx: number;
  let tz: number;
  let dist: number;
  if (target) {
    const p = target.get(Position)!;
    const v = target.get(Velocity)!;
    dist = Math.hypot(p.x - bp.x, p.z - bp.z);
    const flight = dist / 16;
    tx = p.x + v.x * flight * 0.7; // lead the runner
    tz = p.z + v.z * flight * 0.7;
  } else {
    tx = bp.x + dirX * 12;
    tz = bp.z + dirZ * 12;
    dist = 12;
  }
  const dx = tx - bp.x;
  const dz = tz - bp.z;
  const d = Math.hypot(dx, dz) || 1;
  const speed = lofted
    ? Math.min(21, Math.max(9, dist * 1.15))
    : Math.min(23, Math.max(10, dist * 1.5));
  const lift = lofted ? Math.min(8.5, Math.max(4, dist * 0.3)) : 0.4;
  releaseBall(world, kicker, {
    x: (dx / d) * speed,
    y: lift,
    z: (dz / d) * speed,
  });
}
