import type { Entity, World } from "koota";
import {
  BallRef,
  BallState,
  IsBall,
  IsPlayer,
  KeeperDive,
  Match,
  PlayerInfo,
  Position,
  Role,
  Stats,
  Team,
} from "../traits";
import { refState, refereeOffside } from "./referee";
import { radio } from "../radio";
import { AI_TEAM, difficulty } from "../difficulty";

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

const CAPTURE_RADIUS = 0.9;
const STEAL_RADIUS = 0.62;
const OWNER_DROP_RADIUS = 1.8;
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
  bs.recaptureBlocks = bs.recaptureBlocks
    .map((block) => ({ player: block.player, t: block.t - dt }))
    .filter((block) => block.t > 0 && block.player.isAlive());
  const bp = rb.translation();
  const v = rb.linvel();
  const ballSpeed = Math.hypot(v.x, v.y, v.z);

  // owner loses the ball if it escapes close control (deflection, tackle bounce)
  if (bs.owner) {
    const op = bs.owner.get(Position);
    if (!op || Math.hypot(op.x - bp.x, op.z - bp.z) > OWNER_DROP_RADIUS) bs.owner = null;
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
    if (bs.recaptureBlocks.some((block) => block.player === e)) continue;
    if (bs.owner && e.get(Team)!.id === ownerTeam) continue; // no stealing from teammates
    const p = e.get(Position)!;
    const d = Math.hypot(p.x - bp.x, p.z - bp.z);
    // reach scales with ball control (technical_ballcontrol bonus, humanoidbase.cpp:2108);
    // a diving keeper covers extra ground with his outstretched arms
    const radius =
      (bs.owner ? STEAL_RADIUS : CAPTURE_RADIUS) *
      (0.85 + 0.3 * e.get(Stats)!.ballcontrol) *
      (e.has(KeeperDive) ? 1.45 : 1);
    if (d < radius && d < bestD) {
      bestD = d;
      best = e;
    }
  }
  if (!best) return;

  // offside: flagged players are whistled the moment they take the ball
  if (refereeOffside(world, best)) return;

  const stats = best.get(Stats)!;
  const isKeeper = best.get(PlayerInfo)!.role === Role.GK;

  // a keeper facing a real strike sometimes gets beaten — but only in
  // proportion to how hard the save actually is. A ball straight into his
  // chest is virtually always held no matter the difficulty; the leak odds
  // grow with shot pace AND the stretch he needs at contact, so misses
  // concentrate on fingertip rockets. Only an opponent's kick can beat him
  // (he never fumbles a teammate's backpass).
  if (
    isKeeper &&
    ballSpeed > TRAP_SPEED &&
    bs.lastKicker &&
    bs.lastKicker.isAlive() &&
    bs.lastKicker.get(Team)!.id !== best.get(Team)!.id
  ) {
    const pace = clamp((ballSpeed - TRAP_SPEED) / 12, 0, 1);
    const reach = CAPTURE_RADIUS * (0.85 + 0.3 * stats.ballcontrol);
    const stretch = Math.min(bestD / reach, 1);
    let hardness = pace * (0.15 + 0.85 * stretch);
    if (best.get(Team)!.id === AI_TEAM) hardness /= difficulty().keeperSave;
    if (Math.random() < clamp(hardness, 0, 0.95)) {
      // beaten: the ball flies past — block him briefly so it isn't re-caught
      bs.recaptureBlocks.push({ player: best, t: 0.4 });
      return;
    }
  }

  bs.owner = best;
  bs.lastKicker = null;
  bs.touchTimer = 0; // first touch happens immediately in the ball system
  match.set(Match, { lastTouchTeam: best.get(Team)!.id });

  // first-touch trap: error grows with incoming speed, shrinks with control
  const err = (1 - stats.ballcontrol) * 0.3 + Math.min(ballSpeed, 16) * 0.02;
  if (isKeeper && ballSpeed > 12) radio("save"); // a real stop, not a pickup
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
