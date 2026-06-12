import type { Entity, World } from "koota";
import { consumePress, isSprinting, moveDir } from "../input";
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
  Team,
  Velocity,
} from "../traits";
import { PITCH, SPEEDS, setSelected } from "../levels";
import { pass, shoot } from "./kicks";

export function controlSystem(world: World, dt: number): void {
  const ball = world.queryFirst(IsBall);
  const match = world.queryFirst(Match);
  if (!ball || !match) return;
  const bs = ball.get(BallState)!;
  const rb = ball.get(BallRef)!.value;
  const bp = rb ? rb.translation() : { x: 0, y: 0, z: 0 };

  let switchCooldown = Math.max(0, match.get(Match)!.switchCooldown - dt);
  let sel = world.queryFirst(Selected) ?? null;

  // Mirrors team.cpp:360-394 — control snaps to the teammate in possession,
  // otherwise to the closest outfield teammate to the ball (with hysteresis).
  const humanOwner =
    bs.owner && bs.owner.get(Team)!.id === 0 ? bs.owner : null;
  if (humanOwner && humanOwner !== sel) {
    setSelected(world, humanOwner);
    sel = humanOwner;
    switchCooldown = 0.4;
  } else if (!humanOwner && switchCooldown <= 0) {
    let best: Entity | null = null;
    let bestD = Infinity;
    for (const e of world.query(IsPlayer)) {
      if (e.get(Team)!.id !== 0 || e.get(PlayerInfo)!.role === Role.GK)
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
      setSelected(world, best);
      sel = best;
      switchCooldown = 0.5;
    }
  }
  match.set(Match, { switchCooldown });
  if (!sel) return;

  const dir = moveDir();
  const moving = dir.x !== 0 || dir.z !== 0;
  const hasBall = bs.owner === sel;
  const top =
    (isSprinting() ? SPEEDS.sprint : SPEEDS.walk) * (hasBall ? 0.82 : 1);
  const vel = sel.get(Velocity)!;
  const k = Math.min(1, dt * 8);
  vel.x += (dir.x * top - vel.x) * k;
  vel.z += (dir.z * top - vel.z) * k;
  if (moving) sel.set(Heading, { angle: Math.atan2(dir.x, dir.z) });

  if (hasBall) {
    const h = sel.get(Heading)!.angle;
    const fx = moving ? dir.x : Math.sin(h);
    const fz = moving ? dir.z : Math.cos(h);
    if (consumePress("Space")) {
      // vertical input steers toward a corner, like the original's aim bias
      shoot(world, sel, dir.z * PITCH.goalHalfWidth * 0.85 + (Math.random() - 0.5));
    } else if (consumePress("KeyX")) {
      pass(world, sel, fx, fz, false);
    } else if (consumePress("KeyC")) {
      pass(world, sel, fx, fz, true);
    }
  }
}
