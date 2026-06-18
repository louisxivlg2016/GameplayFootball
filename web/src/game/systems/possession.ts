import type { Entity, World } from "koota";
import {
  BallRef,
  BallState,
  Heading,
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
import { PITCH } from "../levels";

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

  // Once the ball has crossed the goal plane inside the frame, no keeper
  // possession check should erase the goal before refereeSystem sees it.
  if (
    Math.abs(bp.x) > PITCH.halfLength - PITCH.ballRadius * 0.35 &&
    Math.abs(bp.z) < PITCH.goalHalfWidth &&
    bp.y < PITCH.goalHeight
  ) {
    return;
  }

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
  // penalties, free kicks and corners are deliberate dead-ball strikes you AIM
  // (draw-to-shoot): nobody — not even the taker — may pick the ball up off the
  // spot, or grabbing it would end the ceremony and drop you into open play.
  // It stays put until it is actually struck (which clears the ceremony).
  if (
    ceremony &&
    (ceremony.type === "penalty" ||
      ceremony.type === "freekick" ||
      ceremony.type === "corner")
  )
    return;

  // shoot-out: a kick is ONE shot. Once it's struck (awaiting > 0) the ball is
  // dead — no rebounds, no retakes, nobody may touch it until the next kick.
  if (refState.shootout && refState.shootout.awaiting > 0) return;

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
    if (
      bs.passProtected &&
      bs.passTarget &&
      bs.passTarget.isAlive() &&
      e.get(Team)!.id !== bs.passTarget.get(Team)!.id
    ) {
      continue;
    }
    let d = Math.hypot(p.x - bp.x, p.z - bp.z);
    if (bs.owner && !isKeeper && e.get(Team)!.id !== ownerTeam) {
      const op = bs.owner.get(Position)!;
      const oh = bs.owner.get(Heading)!.angle;
      const od = Math.hypot(p.x - op.x, p.z - op.z) || 1;
      // facing factor: +1 dead in front of the carrier, 0 level (his side),
      // -1 directly behind. Only a side-on or front challenge can win the ball;
      // anything from behind the carrier's shoulders cannot take it (it's in
      // front of him). A keeper smothering is exempt.
      const facing =
        ((p.x - op.x) * Math.sin(oh) + (p.z - op.z) * Math.cos(oh)) / od;
      if (facing < -0.05) continue;
    }
    // a 26 m/s strike covers over a meter per frame: test the keeper against
    // the ball's swept path this frame so shots can't tunnel through him
    if (isKeeper && ballSpeed > TRAP_SPEED) {
      d = Math.min(d, segDist(p.x, p.z, segX, segZ, bp.x, bp.z));
    }
    // fast passes should be caught when the ball path crosses the receiver's
    // feet, not because a wide capture bubble grabbed it beside him.
    if (intended && ballSpeed > TRAP_SPEED) {
      d = Math.min(d, segDist(p.x, p.z, segX, segZ, bp.x, bp.z));
    }
    // reach scales with ball control (technical_ballcontrol bonus, humanoidbase.cpp:2108);
    // a diving keeper covers extra ground with his outstretched arms
    const radius =
      (bs.owner ? STEAL_RADIUS : CAPTURE_RADIUS) *
      (0.85 + 0.3 * e.get(Stats)!.ballcontrol) *
      (isKeeper ? 1.5 : 1) * // a keeper covers more ground, but not the whole goal
      (e.has(KeeperDive) ? 1.7 : 1) * // arms outstretched mid-dive
      (intended ? 0.85 : 1); // the intended receiver traps it at his feet
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
    // a much sharper keeper: only a hard shot he has to fully stretch for can
    // beat him, and even then he often gets a hand to it. Pace ramps slowly,
    // stretch matters less, and the ceiling is far below a sure thing.
    const pace = clamp((ballSpeed - TRAP_SPEED) / 17, 0, 1);
    const reach = CAPTURE_RADIUS * (0.85 + 0.3 * stats.ballcontrol) * 1.6;
    const stretch = Math.min(bestD / reach, 1);
    // a STRONG keeper that is still beaten now and then. Both keepers hold the
    // bulk of what they reach; only a hard, well-placed strike to the corner
    // beats or spills past them. The opponent AI keeper leaks a bit more than
    // the human's so the player can score; difficulty scales the AI one.
    const isAIKeeper = best.get(Team)!.id === AI_TEAM;
    const beatMul = isAIKeeper ? 0.6 / difficulty().keeperSave : 0.2;
    const parryMul = isAIKeeper ? 0.6 : 0.4;
    let hardness = pace * (0.04 + 0.45 * stretch) * beatMul;
    hardness = clamp(hardness, 0, isAIKeeper ? 0.55 : 0.4);
    const roll = Math.random();
    if (roll < hardness) {
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
    // a hard shot he reaches isn't always HELD: often he can only parry it
    // away, spilling a rebound rather than catching cleanly. Tame shots are
    // still gathered; only pace + stretch produce spills.
    const parry = clamp(pace * (0.18 + 0.5 * stretch) * parryMul, 0, 0.55);
    if (roll < hardness + parry) {
      const kp = best.get(Position)!;
      if (!best.has(KeeperDive)) {
        best.add(KeeperDive);
        best.set(KeeperDive, { t: 0, side: Math.sign(bp.z - kp.z) || 1 });
      }
      // shove it clear of the goal: out toward the field, to a flank, with lift
      rb.setLinvel(
        {
          x: -Math.sign(kp.x || 1) * (4 + Math.random() * 5),
          y: 1 + Math.random() * 2,
          z: (bp.z >= 0 ? 1 : -1) * (3 + Math.random() * 5),
        },
        true,
      );
      bs.owner = null; // loose ball — a rebound for whoever follows up
      bs.recaptureBlocks.push({ player: best, t: 0.5 });
      radio("save");
      return;
    }
  }

  bs.owner = best;
  bs.lastKicker = null;
  bs.passTarget = null; // the pass has arrived (or been cut out)
  bs.passProtected = false;
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
