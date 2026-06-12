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
  Stats,
  Team,
} from "../traits";
import { refState, refereeOffside } from "./referee";

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

  // owner loses the ball if it escapes (heavy touch, deflection, tackle)
  if (bs.owner) {
    const op = bs.owner.get(Position);
    if (!op || Math.hypot(op.x - bp.x, op.z - bp.z) > 1.9) bs.owner = null;
  }

  if (bp.y > 1.3) return; // ball above playable height

  // during a restart ceremony only the taker may take the ball
  const ceremony = refState.ceremony;

  const ownerTeam = bs.owner ? bs.owner.get(Team)!.id : -1;
  let best: Entity | null = null;
  let bestD = Infinity;
  for (const e of world.query(IsPlayer)) {
    if (e === bs.owner) continue;
    if (ceremony && e !== ceremony.taker) continue;
    const isKeeper = e.get(PlayerInfo)!.role === Role.GK;
    if (ballSpeed > TRAP_SPEED && !isKeeper) continue;
    if (bs.kickCooldown > 0 && e === bs.lastKicker) continue;
    if (bs.owner && e.get(Team)!.id === ownerTeam) continue; // no stealing from teammates
    const p = e.get(Position)!;
    const d = Math.hypot(p.x - bp.x, p.z - bp.z);
    // reach scales with ball control (technical_ballcontrol bonus, humanoidbase.cpp:2108)
    const radius =
      (bs.owner ? STEAL_RADIUS : CAPTURE_RADIUS) *
      (0.85 + 0.3 * e.get(Stats)!.ballcontrol);
    if (d < radius && d < bestD) {
      bestD = d;
      best = e;
    }
  }
  if (!best) return;

  // offside: flagged players are whistled the moment they take the ball
  if (refereeOffside(world, best)) return;

  bs.owner = best;
  bs.lastKicker = null;
  bs.touchTimer = 0; // first touch happens immediately in the ball system
  match.set(Match, { lastTouchTeam: best.get(Team)!.id });

  // first-touch trap: error grows with incoming speed, shrinks with control
  const stats = best.get(Stats)!;
  const err = (1 - stats.ballcontrol) * 0.3 + Math.min(ballSpeed, 16) * 0.02;
  const isKeeper = best.get(PlayerInfo)!.role === Role.GK;
  const damp = isKeeper ? 0 : Math.min(0.25 + err * 0.3, 0.5);
  rb.setLinvel(
    {
      x: v.x * damp + (Math.random() - 0.5) * err * 4,
      y: Math.min(v.y, 0.5),
      z: v.z * damp + (Math.random() - 0.5) * err * 4,
    },
    true,
  );
}
