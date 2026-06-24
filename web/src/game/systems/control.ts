import type { Entity, World } from "koota";
import { consumePress, isSprintingFor, moveDirFor, padFor } from "../input";
import {
  BallRef,
  BallState,
  Heading,
  IsBall,
  IsPlayer,
  Jump,
  KeeperDive,
  Match,
  PlayerInfo,
  Position,
  Role,
  Selected,
  Selected2,
  Stats,
  Team,
  Velocity,
} from "../traits";
import { PITCH, SPEEDS, attackSign, setSelected } from "../levels";
import { useStore } from "../store";
import { header, pass, shoot } from "./kicks";
import { refState } from "./referee";

// per-slot auto-switch hysteresis (the Match trait keeps slot 0's for the
// original single-player flow; slot 1 only exists in two-player mode)
const switchState = { gen: -1, cd: [0, 0] as [number, number] };

export function controlSystem(world: World, dt: number): void {
  const { players, gen, humanTeam } = useStore.getState();
  if (gen !== switchState.gen) {
    switchState.gen = gen;
    switchState.cd = [0.5, 0.5];
  }
  controlSlot(world, dt, 0, players, players === 1 ? humanTeam : 0);
  if (players === 2) controlSlot(world, dt, 1, players);
}

function controlSlot(
  world: World,
  dt: number,
  slot: number,
  players: number,
  teamOverride?: number,
): void {
  const ball = world.queryFirst(IsBall);
  const match = world.queryFirst(Match);
  if (!ball || !match) return;
  const bs = ball.get(BallState)!;
  const rb = ball.get(BallRef)!.value;
  const bp = rb ? rb.translation() : { x: 0, y: 0, z: 0 };
  const bv = rb ? rb.linvel() : { x: 0, y: 0, z: 0 };

  const team = teamOverride ?? slot; // solo can choose side; versus keeps RED=P1 and BLU=P2
  const SelTrait = slot === 1 ? Selected2 : Selected;
  const pad = padFor(slot, players);

  let switchCooldown = Math.max(0, switchState.cd[slot]! - dt);
  let sel = world.queryFirst(SelTrait) ?? null;

  // grab the gloves: when a shot is bearing down on your own goal, or the
  // opponent is taking a penalty against you, control snaps to YOUR keeper so
  // you choose where to dive (the AI no longer saves everything for you).
  const ownGoalX = -attackSign(team) * PITCH.halfLength;
  const tCross = bv.x !== 0 ? (ownGoalX - bp.x) / bv.x : -1;
  const zAtGoal = bp.z + bv.z * tCross;
  const incomingShot =
    !bs.owner &&
    Math.hypot(bv.x, bv.z) > 9 && // a real strike, not a slow roll / pass-back
    tCross > 0 &&
    tCross < 1.4 &&
    Math.abs(zAtGoal) < 6.5;
  const cer = refState.ceremony;
  // a penalty OR a free kick the OPPONENT is taking against you → you defend in
  // goal, ready to dive
  const defendingSetPiece =
    (cer?.type === "penalty" || cer?.type === "freekick") && cer.team !== team;

  // Mirrors team.cpp:360-394 — control snaps to the teammate in possession,
  // otherwise to the closest outfield teammate to the ball (with hysteresis).
  const humanOwner =
    bs.owner && bs.owner.get(Team)!.id === team ? bs.owner : null;
  if (incomingShot || defendingSetPiece) {
    let gk: Entity | null = null;
    for (const e of world.query(IsPlayer)) {
      if (e.get(Team)!.id === team && e.get(PlayerInfo)!.role === Role.GK) {
        gk = e;
        break;
      }
    }
    if (gk) {
      if (gk !== sel) setSelected(world, gk, slot);
      sel = gk;
      switchCooldown = 0.3;
    }
  } else if (humanOwner && humanOwner !== sel) {
    setSelected(world, humanOwner, slot);
    sel = humanOwner;
    switchCooldown = 0.4;
  } else if (!humanOwner && switchCooldown <= 0) {
    let best: Entity | null = null;
    let bestD = Infinity;
    for (const e of world.query(IsPlayer)) {
      if (e.get(Team)!.id !== team || e.get(PlayerInfo)!.role === Role.GK)
        continue;
      const p = e.get(Position)!;
      const d = Math.hypot(p.x - bp.x, p.z - bp.z);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    const sp = sel?.get(Position);
    const selD = sp ? Math.hypot(sp.x - bp.x, sp.z - bp.z) : Infinity;
    if (best && best !== sel && bestD < selD - 1.2) {
      setSelected(world, best, slot);
      sel = best;
      switchCooldown = 0.5;
    }
  }
  switchState.cd[slot] = switchCooldown;
  if (slot === 0) match.set(Match, { switchCooldown });
  if (!sel) return;

  const dir = moveDirFor(pad);
  const moving = dir.x !== 0 || dir.z !== 0;
  const hasBall = bs.owner === sel;
  const sp = sel.get(Position)!;
  const dBall = Math.hypot(sp.x - bp.x, sp.z - bp.z);
  // physical_velocity + stamina multipliers (playerbase.cpp:136-139)
  const stats = sel.get(Stats)!;
  const statMul = (0.9 + 0.1 * stats.velocity) * (0.75 + 0.25 * stats.energy);
  // the controlled man gets a hair of extra pace over an equal-stat AI —
  // the AI must never win a flat footrace against the human
  const top =
    (isSprintingFor(pad) ? SPEEDS.sprint : SPEEDS.walk) *
    (hasBall ? 0.82 : 1) *
    statMul *
    1.04;
  const vel = sel.get(Velocity)!;
  const k = Math.min(1, dt * 8);
  const ceremony = refState.ceremony;
  // a penalty is a strike from the spot: the taker is rooted (no dribbling it
  // forward), direction only aims the corner. Same for either team.
  const penaltyTaker = ceremony?.type === "penalty" && ceremony.taker === sel;
  // a corner / free-kick taker is rooted too — you stand over the dead ball and
  // AIM the kick (draw-to-shoot), you don't walk it around.
  const rootedTaker =
    (ceremony?.type === "corner" || ceremony?.type === "freekick") &&
    ceremony.taker === sel;
  const isKeeper = sel.get(PlayerInfo)!.role === Role.GK;
  if (penaltyTaker || rootedTaker) {
    vel.x = 0;
    vel.z = 0;
  } else if (isKeeper && sel.has(KeeperDive)) {
    // mid-dive: he is committed — don't fight the launch, let him fly full stretch
  } else {
    vel.x += (dir.x * top - vel.x) * k;
    vel.z += (dir.z * top - vel.z) * k;
    // input is authoritative for the human's facing: at high fps a reversal sits
    // multiple frames in the low-speed band where velocity-derived heading stalls
    if (moving) sel.set(Heading, { angle: Math.atan2(dir.x, dir.z) });
    // going up for a cross in the attacking half (corner/high ball): never
    // back-pedal toward your own goal — attack the ball forwards
    if (bp.y > 1.3 && dBall < 10 && !hasBall) {
      const s = attackSign(sel.get(Team)!.id);
      if (sp.x * s > 8 && vel.x * s < 0) vel.x = 0;
    }
  }

  // human keeper: a long full-stretch dive (shoot or tackle button) flings him
  // the way the stick points, fast enough to reach the corners — your save
  if (
    isKeeper &&
    !hasBall &&
    !sel.has(KeeperDive) &&
    moving &&
    (consumePress(pad.shoot) || consumePress(pad.tackle))
  ) {
    sel.add(KeeperDive);
    sel.set(KeeperDive, { t: 0, side: Math.sign(dir.z) || Math.sign(dir.x) || 1 });
    vel.z = dir.z * 3.2;
    vel.x = dir.x * 2.4;
    return;
  }

  // during a restart only the taker may play the ball, and only after the whistle
  if (ceremony && (!ceremony.ready || ceremony.taker !== sel)) return;

  const h = sel.get(Heading)!.angle;
  const fx = moving ? dir.x : Math.sin(h);
  const fz = moving ? dir.z : Math.cos(h);

  // an airborne ball (cross, bounce, clearance) is played with the HEAD/volley,
  // which the feet can't reach. Head with V (TÊTE button) or the shoot button;
  // pass/lob become a headed flick. You LEAP for it — a proper jumping header,
  // so a corner can be attacked in the air and headed at goal.
  const headable =
    bp.y >= 0.8 && bp.y < 4.2 && bs.owner === null && dBall < 3.2 && bs.kickCooldown <= 0 && !penaltyTaker;
  if (headable) {
    let headed = false;
    if (consumePress(pad.head) || consumePress(pad.shoot)) {
      header(world, sel, dir.x, dir.z, true); // headed at goal
      headed = true;
    } else if (consumePress(pad.pass) || consumePress(pad.lob)) {
      header(world, sel, fx, fz, false); // headed flick / clearance
      headed = true;
    }
    if (headed) {
      // jump up to meet the ball (the leap pose lives in movementSystem)
      if (!sel.has(Jump)) sel.add(Jump);
      sel.set(Jump, { t: 0 });
    }
    return;
  }

  // kicks need the ball physically in striking range
  const kickable =
    (hasBall || bs.owner === null) && dBall < 1.5 && bp.y < 1 && bs.kickCooldown <= 0;

  if (kickable) {
    if (consumePress(pad.shoot)) {
      // vertical input steers toward a corner, like the original's aim bias
      // (aimZ is world-z in the goal mouth, the same axis for either goal)
      shoot(world, sel, dir.z * PITCH.goalHalfWidth * 0.85 + (Math.random() - 0.5));
    } else if (!penaltyTaker && consumePress(pad.pass)) {
      pass(world, sel, fx, fz, false);
    } else if (!penaltyTaker && consumePress(pad.lob)) {
      pass(world, sel, fx, fz, true);
    }
  }
}
