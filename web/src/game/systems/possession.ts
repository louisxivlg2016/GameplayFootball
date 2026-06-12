import type { Entity, World } from "koota";
import {
  BallRef,
  BallState,
  IsBall,
  IsPlayer,
  Match,
  PlayerInfo,
  Position,
  Role,
  Team,
} from "../traits";

const CAPTURE_RADIUS = 0.9;
const STEAL_RADIUS = 0.62;
/** Above this ball speed only the keeper can trap it (a "catch"). */
const TRAP_SPEED = 14;

export function possessionSystem(world: World, dt: number): void {
  const ball = world.queryFirst(IsBall);
  const match = world.queryFirst(Match);
  if (!ball || !match) return;
  const bs = ball.get(BallState)!;
  const rb = ball.get(BallRef)!.value;
  if (!rb) return;

  bs.kickCooldown = Math.max(0, bs.kickCooldown - dt);
  const bp = rb.translation();
  const v = rb.linvel();
  const ballSpeed = Math.hypot(v.x, v.y, v.z);

  // owner loses the ball if it escapes (deflection, tackle bounce)
  if (bs.owner) {
    const op = bs.owner.get(Position);
    if (!op || Math.hypot(op.x - bp.x, op.z - bp.z) > 1.8) bs.owner = null;
  }

  if (bp.y > 1.3) return; // ball above playable height

  const ownerTeam = bs.owner ? bs.owner.get(Team)!.id : -1;
  const radius = bs.owner ? STEAL_RADIUS : CAPTURE_RADIUS;
  let best: Entity | null = null;
  let bestD = radius;
  for (const e of world.query(IsPlayer)) {
    if (e === bs.owner) continue;
    const isKeeper = e.get(PlayerInfo)!.role === Role.GK;
    if (ballSpeed > TRAP_SPEED && !isKeeper) continue;
    if (bs.kickCooldown > 0 && e === bs.lastKicker) continue;
    if (bs.owner && e.get(Team)!.id === ownerTeam) continue; // no stealing from teammates
    const p = e.get(Position)!;
    const d = Math.hypot(p.x - bp.x, p.z - bp.z);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  if (best) {
    bs.owner = best;
    bs.lastKicker = null;
    match.set(Match, { lastTouchTeam: best.get(Team)!.id });
  }
}
