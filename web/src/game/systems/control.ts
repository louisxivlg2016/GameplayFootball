import type { Entity, World } from "koota";
import { consumePress, isSprintingFor, moveDirFor, padFor } from "../input";
import {
  BallRef,
  BallState,
  Heading,
  IsBall,
  IsPlayer,
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
import { PITCH, SPEEDS, setSelected } from "../levels";
import { useStore } from "../store";
import { pass, shoot } from "./kicks";
import { refState } from "./referee";

// per-slot auto-switch hysteresis (the Match trait keeps slot 0's for the
// original single-player flow; slot 1 only exists in two-player mode)
const switchState = { gen: -1, cd: [0, 0] as [number, number] };

export function controlSystem(world: World, dt: number): void {
  const { players, gen } = useStore.getState();
  if (gen !== switchState.gen) {
    switchState.gen = gen;
    switchState.cd = [0.5, 0.5];
  }
  controlSlot(world, dt, 0, players);
  if (players === 2) controlSlot(world, dt, 1, players);
}

function controlSlot(
  world: World,
  dt: number,
  slot: number,
  players: number,
): void {
  const ball = world.queryFirst(IsBall);
  const match = world.queryFirst(Match);
  if (!ball || !match) return;
  const bs = ball.get(BallState)!;
  const rb = ball.get(BallRef)!.value;
  const bp = rb ? rb.translation() : { x: 0, y: 0, z: 0 };

  const team = slot; // slot 0 steers RED (team 0), slot 1 steers BLU (team 1)
  const SelTrait = slot === 1 ? Selected2 : Selected;
  const pad = padFor(slot, players);

  let switchCooldown = Math.max(0, switchState.cd[slot]! - dt);
  let sel = world.queryFirst(SelTrait) ?? null;

  // Mirrors team.cpp:360-394 — control snaps to the teammate in possession,
  // otherwise to the closest outfield teammate to the ball (with hysteresis).
  const humanOwner =
    bs.owner && bs.owner.get(Team)!.id === team ? bs.owner : null;
  if (humanOwner && humanOwner !== sel) {
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
  if (penaltyTaker) {
    vel.x = 0;
    vel.z = 0;
  } else {
    vel.x += (dir.x * top - vel.x) * k;
    vel.z += (dir.z * top - vel.z) * k;
    // input is authoritative for the human's facing: at high fps a reversal sits
    // multiple frames in the low-speed band where velocity-derived heading stalls
    if (moving) sel.set(Heading, { angle: Math.atan2(dir.x, dir.z) });
  }

  // during a restart only the taker may play the ball, and only after the whistle
  if (ceremony && (!ceremony.ready || ceremony.taker !== sel)) return;

  // kicks need the ball physically in striking range
  const kickable =
    (hasBall || bs.owner === null) && dBall < 1.5 && bp.y < 1 && bs.kickCooldown <= 0;

  if (kickable) {
    const h = sel.get(Heading)!.angle;
    const fx = moving ? dir.x : Math.sin(h);
    const fz = moving ? dir.z : Math.cos(h);
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
