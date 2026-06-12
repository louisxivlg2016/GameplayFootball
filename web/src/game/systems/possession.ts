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

/** 2D distance from point (px,pz) to segment (ax,az)-(bx,bz). */
function segDist(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const t = len2 > 0 ? clamp(((px - ax) * dx + (pz - az) * dz) / len2, 0, 1) : 0;
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

const CAPTURE_RADIUS = 0.9;
const STEAL_RADIUS = 0.62;
let prevBX = 0;
let prevBZ = 0;
let prevSeen = false;
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

  // exact swept segment for fast-ball checks: last frame's true position
  // (v·dt under-sweeps whenever the render frame outlasts the clamped dt,
  // and a 20+ m/s ball then tunnels straight through the keeper)
  const jump = Math.hypot(bp.x - prevBX, bp.z - prevBZ);
  const segOK = prevSeen && jump < 3.5; // a teleport (set piece) breaks the chain
  const segX = segOK ? prevBX : bp.x - v.x * dt;
  const segZ = segOK ? prevBZ : bp.z - v.z * dt;
  prevBX = bp.x;
  prevBZ = bp.z;
  prevSeen = true;

  // owner loses the ball if it escapes close control (deflection, tackle bounce)
  if (bs.owner) {
    const op = bs.owner.get(Position);
    if (!op || Math.hypot(op.x - bp.x, op.z - bp.z) > OWNER_DROP_RADIUS) bs.owner = null;
  }

  if (bp.y > 2.35) return; // above even a keeper's raised arms

  // during a restart ceremony only the taker may take the ball
  const ceremony = refState.ceremony;

  const ownerTeam = bs.owner ? bs.owner.get(Team)!.id : -1;
  let best: Entity | null = null;
  let bestD = Infinity;
  for (const e of world.query(IsPlayer)) {
    if (e === bs.owner) continue;
    if (ceremony && e !== ceremony.taker) continue;
    const isKeeper = e.get(PlayerInfo)!.role === Role.GK;
    // the INTENDED receiver of a pass traps it at any pace — a firm pass
    // used to fly straight through him (only keepers could touch >14 m/s)
    const intended = bs.passTarget === e;
    if (ballSpeed > TRAP_SPEED && !isKeeper && !intended) continue;
    if (bp.y > 1.3 && !isKeeper) continue; // only a keeper plays chest-high balls
    if (bs.kickCooldown > 0 && e === bs.lastKicker) continue;
    if (bs.recaptureBlocks.some((block) => block.player === e)) continue;
    if (bs.owner && e.get(Team)!.id === ownerTeam) continue; // no stealing from teammates
    const p = e.get(Position)!;
    let d = Math.hypot(p.x - bp.x, p.z - bp.z);
    // a 26 m/s strike covers over a meter per frame: test the keeper against
    // the ball's swept path this frame so shots can't tunnel through him
    if (isKeeper && ballSpeed > TRAP_SPEED) {
      d = Math.min(d, segDist(p.x, p.z, segX, segZ, bp.x, bp.z));
    }
    // reach scales with ball control (technical_ballcontrol bonus, humanoidbase.cpp:2108);
    // a diving keeper covers extra ground with his outstretched arms
    const radius =
      (bs.owner ? STEAL_RADIUS : CAPTURE_RADIUS) *
      (0.85 + 0.3 * e.get(Stats)!.ballcontrol) *
      (e.has(KeeperDive) ? 1.45 : 1) *
      (intended ? 1.35 : 1); // the man the pass is for reaches for it
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
    let hardness = pace * (0.08 + 0.72 * stretch);
    if (best.get(Team)!.id === AI_TEAM) hardness /= difficulty().keeperSave;
    if (Math.random() < clamp(hardness, 0, 0.88)) {
      // beaten: the ball flies past — but he still hurls himself at it
      // (a despairing reflex dive) instead of watching it go by
      if (!best.has(KeeperDive)) {
        const kp = best.get(Position)!;
        best.add(KeeperDive);
        best.set(KeeperDive, { t: 0, side: Math.sign(bp.z - kp.z) || 1 });
      }
      bs.recaptureBlocks.push({ player: best, t: 0.4 });
      return;
    }
  }

  bs.owner = best;
  bs.lastKicker = null;
  bs.passTarget = null; // the pass has arrived (or been cut out)
  bs.touchTimer = 0; // first touch happens immediately in the ball system
  match.set(Match, { lastTouchTeam: best.get(Team)!.id });

  // a set piece is in play from the taker's first touch: dribbling off the
  // spot ends the ceremony and wakes the defence (penalties stay kick-only)
  const cer = refState.ceremony;
  if (cer && cer.ready && best === cer.taker && cer.type !== "penalty") {
    refState.ceremony = null;
  }

  // first-touch trap: error grows with incoming speed, shrinks with control
  const err = (1 - stats.ballcontrol) * 0.2 + Math.min(ballSpeed, 16) * 0.015;
  if (isKeeper && ballSpeed > 12) radio("save"); // a real stop, not a pickup
  const damp = isKeeper ? 0 : Math.min(0.25 + err * 0.3, 0.5);
  rb.setLinvel(
    {
      x: v.x * damp + (Math.random() - 0.5) * err * 2.5,
      y: Math.min(v.y, 0.5),
      z: v.z * damp + (Math.random() - 0.5) * err * 2.5,
    },
    true,
  );
}
