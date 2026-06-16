import type { Entity, World } from "koota";
import {
  BallRef,
  BallState,
  IsBall,
  IsPlayer,
  Match,
  Name,
  PlayerInfo,
  Position,
  Role,
  Stats,
  Team,
  Velocity,
} from "../traits";
import { PITCH, SPEEDS, attackSign } from "../levels";
import { kickSound } from "../audio";
import { radio } from "../radio";
import { refereeOnKick } from "./referee";
import { AI_TEAM, difficulty } from "../difficulty";

/** AI_GetMindSet by role: defenders 0, mids 0.5, attackers 1 (AIfunctions.cpp). */
export const MINDSET = [0, 0, 0.5, 1] as const;

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

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
  bs.passTarget = null; // generic kicks don't home; executePass re-arms it
  bs.passProtected = false;
  bs.lastKicker = kicker;
  bs.kickCooldown = 0.45;
  bs.recaptureBlocks = [{ player: kicker, t: 0.45 }];
  world.queryFirst(Match)?.set(Match, {
    lastTouchTeam: kicker.get(Team)!.id,
  });
  kickSound(Math.hypot(vel.x, vel.y, vel.z) / 20);
  refereeOnKick(world, kicker); // offside snapshot + set-piece completion
}

/**
 * Interception odds along a pass line, from elizacontroller.cpp:1037-1077:
 * for each opponent projected onto the line at parameter u, the ball arrives at
 * 0.7 + dist·u·0.03 s (high passes +2.5s past halfway); danger accumulates when
 * the opponent can beat it. odds = 1 - clamp(danger).
 */
export function passingOdds(
  world: World,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  teamId: number,
  high: boolean,
): number {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.5) return 0;
  const ux = dx / dist;
  const uz = dz / dist;
  let danger = high ? 0.4 : 0;
  for (const opp of world.query(IsPlayer)) {
    if (opp.get(Team)!.id === teamId) continue;
    const p = opp.get(Position)!;
    const u = clamp(((p.x - fromX) * ux + (p.z - fromZ) * uz) / dist, 0, 1);
    const ix = fromX + ux * u * dist;
    const iz = fromZ + uz * u * dist;
    const ballT = 0.7 + dist * u * 0.03 + (high && u > 0.5 ? 2.5 : 0);
    const oppT = Math.hypot(p.x - ix, p.z - iz) / SPEEDS.sprint;
    danger += Math.max(0, Math.min(ballT - oppT + 0.5, 1.5)) * (u > 0.03 ? 1 : 0);
  }
  return 1 - clamp(danger, 0, 1);
}

/**
 * Tactical self/mate rating, elizacontroller.cpp:846-920:
 * (0.4·forwardSpace + 0.3·space + 2·forward) / 2.7
 */
export function tacticalRating(
  world: World,
  x: number,
  z: number,
  teamId: number,
): number {
  const goalX = attackSign(teamId) * PITCH.halfLength;
  const forwardSpace = 1 - clamp(Math.hypot(goalX - x, z) / 80, 0, 1);
  let nearestOpp = 30;
  for (const opp of world.query(IsPlayer)) {
    if (opp.get(Team)!.id === teamId) continue;
    const p = opp.get(Position)!;
    nearestOpp = Math.min(nearestOpp, Math.hypot(p.x - x, p.z - z));
  }
  const space = clamp(nearestOpp / 10, 0, 1);
  const forward = (x * attackSign(teamId) + PITCH.halfLength) / (PITCH.halfLength * 2);
  return (0.4 * forwardSpace + 0.3 * space + 2 * forward) / 2.7;
}

export interface PassChoice {
  mate: Entity;
  /** kick target used to start the pass; homing finishes on the receiver's feet */
  tx: number;
  tz: number;
  high: boolean;
  odds: number;
  total: number;
  protected?: boolean;
}

/**
 * Two-stage pass selection (elizacontroller.cpp:809-977): candidates must beat
 * the kicker's own tactical rating by a role threshold; score combines the
 * tactical gain (weighted by role mindset) with interception odds; targets are
 * led by their movement (through balls).
 */
export function evaluateBestPass(
  world: World,
  kicker: Entity,
  dirX = 0,
  dirZ = 0,
  possessionSeconds = 0,
): PassChoice | null {
  const teamId = kicker.get(Team)!.id;
  const kp = kicker.get(Position)!;
  const mindset = MINDSET[kicker.get(PlayerInfo)!.role]!;
  const selfRating = tacticalRating(world, kp.x, kp.z, teamId);
  const threshold = 0.06 * (1 - mindset);
  const w = 1 + mindset * mindset * 10;
  const longPossession = Math.pow(clamp(possessionSeconds / 5, 0, 1), 2);
  const hasDir = dirX !== 0 || dirZ !== 0;

  let best: PassChoice | null = null;
  for (const mate of world.query(IsPlayer)) {
    if (mate === kicker || mate.get(Team)!.id !== teamId) continue;
    const mp = mate.get(Position)!;
    const mv = mate.get(Velocity)!;
    const d = Math.hypot(mp.x - kp.x, mp.z - kp.z);
    if (d < 3 || d > 55) continue;
    // through-ball lead, elizacontroller: estimatedTime = 0.7 + dist·0.03, max 0.5s of movement
    const lead = clamp(0.7 + d * 0.03, 0, 1.2);
    const tx = mp.x + mv.x * Math.min(lead, 0.5) * 2;
    const tz = mp.z + mv.z * Math.min(lead, 0.5) * 2;

    const mateRating = tacticalRating(world, tx, tz, teamId);
    if (mateRating < selfRating + threshold) continue;

    const oddsShort = d < 38 ? passingOdds(world, kp.x, kp.z, tx, tz, teamId, false) : 0;
    const oddsHigh = d > 14 ? passingOdds(world, kp.x, kp.z, tx, tz, teamId, true) : 0;
    const high = oddsHigh > oddsShort;
    const odds = Math.max(oddsShort, oddsHigh);

    const align = hasDir ? ((tx - kp.x) * dirX + (tz - kp.z) * dirZ) / (d || 1) : 0;
    const total =
      ((mateRating - selfRating) * w + odds) / (w + 1) + (hasDir ? align * 0.4 : 0);
    if (!best || total > best.total) {
      best = { mate, tx, tz, high, odds, total };
    }
  }
  if (!best) return null;
  // execution thresholds soften the longer possession drags on
  const passThreshold = 0.1 - longPossession * 0.05;
  const passMinimum = 0.2 * (1 - mindset) - longPossession * 0.1;
  if (!hasDir && (best.total < passThreshold || best.odds < passMinimum)) return null;
  return best;
}

export function executePass(world: World, kicker: Entity, choice: PassChoice): void {
  const ball = world.queryFirst(IsBall);
  const rb = ball?.get(BallRef)!.value;
  if (!ball || !rb) return;
  const bp = rb.translation();
  // Human passes should go to the selected teammate's feet. Keep technical
  // scatter only for the AI, scaled by difficulty.
  const err =
    kicker.get(Team)!.id === AI_TEAM
      ? (1 - kicker.get(Stats)!.shortpass) *
        0.015 *
        difficulty().aiErr *
        (Math.random() - 0.5) *
        2
      : 0;
  const cos = Math.cos(err);
  const sin = Math.sin(err);
  const rawX = choice.tx - bp.x;
  const rawZ = choice.tz - bp.z;
  const dx = rawX * cos - rawZ * sin;
  const dz = rawX * sin + rawZ * cos;
  const d = Math.hypot(dx, dz) || 1;
  const speed = choice.high
    ? Math.min(21, Math.max(9, d * 1.15))
    : Math.min(23, Math.max(10, d * 1.5));
  const lift = choice.high ? Math.min(8.5, Math.max(4, d * 0.3)) : 0.4;
  releaseBall(world, kicker, { x: (dx / d) * speed, y: lift, z: (dz / d) * speed });
  // arm the pass assist: the ball bends onto this receiver while in flight
  const bsAfter = ball.get(BallState)!;
  bsAfter.passTarget = choice.mate;
  bsAfter.passHomingT = 4;
  bsAfter.passProtected = choice.protected ?? false;
  radio("pass", {
    player: kicker.get(Name)?.spoken ?? "",
    target: choice.mate.get(Name)?.spoken ?? "",
  });
}

/**
 * Directional pass for the human player. The receiver is whoever you are
 * POINTING at — best stick alignment wins, tactics never override the input
 * (the old tactical filter could pick a different mate than the one aimed
 * at, or exclude him entirely, which read as "passes miss").
 */
export function pass(
  world: World,
  kicker: Entity,
  dirX: number,
  dirZ: number,
  lofted: boolean,
): void {
  const teamId = kicker.get(Team)!.id;
  const kp = kicker.get(Position)!;
  let mate: Entity | null = null;
  let fallbackMate: Entity | null = null;
  let bestScore = -Infinity;
  let fallbackScore = -Infinity;
  for (const e of world.query(IsPlayer)) {
    if (e === kicker || e.get(Team)!.id !== teamId) continue;
    const p = e.get(Position)!;
    const dx = p.x - kp.x;
    const dz = p.z - kp.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.5 || d > 62) continue; // 62m reaches a back-pass to the keeper
    const align = (dx * dirX + dz * dirZ) / (d || 1);
    // alignment dominates; among similar angles prefer the closer man
    const score = align * 2 - d * 0.015;
    if (score > fallbackScore) {
      fallbackScore = score;
      fallbackMate = e;
    }
    if (align < 0.35) continue; // ~70° half-cone around the input
    if (score > bestScore) {
      bestScore = score;
      mate = e;
    }
  }
  mate ??= fallbackMate;
  if (mate) {
    const mp = mate.get(Position)!;
    executePass(world, kicker, {
      mate,
      tx: mp.x,
      tz: mp.z,
      high: lofted,
      odds: 1,
      total: 1,
      protected: true,
    });
    return;
  }
  // nobody anywhere near the cone: plain directional punt
  releaseBall(world, kicker, {
    x: dirX * (lofted ? 16 : 15),
    y: lofted ? 6 : 0.4,
    z: dirZ * (lofted ? 16 : 15),
  });
}

/**
 * Shot, elizacontroller.cpp:945-972: try three goal-mouth aim points, shoot at
 * the best; direction blends goal-centering with the input/momentum side factor.
 */
export function shotOdds(
  world: World,
  kicker: Entity,
): { aimZ: number; odds: number; idealFactor: number } {
  const teamId = kicker.get(Team)!.id;
  const kp = kicker.get(Position)!;
  const goalX = attackSign(teamId) * PITCH.halfLength;
  const distGoal = Math.hypot(goalX - kp.x, kp.z);
  const idealFactor = 1 - clamp(Math.abs(distGoal - 7) / 16, 0, 1);
  let bestOdds = 0;
  let bestAim = 0;
  for (const aimZ of [-3.3, 0, 3.3]) {
    const odds = passingOdds(world, kp.x, kp.z, goalX, aimZ, teamId, false);
    if (odds > bestOdds) {
      bestOdds = odds;
      bestAim = aimZ;
    }
  }
  return { aimZ: bestAim, odds: bestOdds, idealFactor };
}

export function shoot(world: World, kicker: Entity, aimZ: number): void {
  const ball = world.queryFirst(IsBall);
  const rb = ball?.get(BallRef)!.value;
  if (!ball || !rb) return;
  const bp = rb.translation();
  const goalX = attackSign(kicker.get(Team)!.id) * PITCH.halfLength;
  // technical_shot scatter: poor shooters spray wide and high
  const shotDiffErr = kicker.get(Team)!.id === AI_TEAM ? difficulty().aiErr : 1;
  const scatter =
    (1 - kicker.get(Stats)!.shot) * 2.2 * shotDiffErr * (Math.random() - 0.5) * 2;
  const tz = clamp(aimZ + scatter, -PITCH.goalHalfWidth - 0.6, PITCH.goalHalfWidth + 0.6);
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
  if (dist < 32) radio("shot", { player: kicker.get(Name)?.spoken ?? "" });
}

/** Panic clear for low-mindset players near goal (elizacontroller.cpp:924-939). */
export function panicClear(world: World, kicker: Entity): void {
  const teamId = kicker.get(Team)!.id;
  const kp = kicker.get(Position)!;
  const s = attackSign(teamId);
  const dirZ = kp.z >= 0 ? 0.5 : -0.5;
  const len = Math.hypot(s, dirZ);
  releaseBall(world, kicker, {
    x: (s / len) * 17,
    y: 7,
    z: (dirZ / len) * 17 + (Math.random() - 0.5) * 4,
  });
}

export { Role };
