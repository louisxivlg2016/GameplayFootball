import type { Entity, World } from "koota";
import {
  BallRef,
  BallState,
  Heading,
  IsBall,
  IsPlayer,
  PlayerInfo,
  Position,
  Role,
  Selected,
  Selected2,
  SlideTackle,
  Stats,
  Team,
  Tripped,
  Velocity,
} from "../traits";
import { consumePress, padFor } from "../input";
import { useStore } from "../store";
import { refState, refereeFoul } from "./referee";
import { releaseBall } from "./kicks";
import { AI_TEAM, difficulty } from "../difficulty";

/**
 * Slide tackles. A slide is a ~0.5s lunge along the heading; touching the ball
 * pokes it clear, touching the carrier without the ball is a foul whose
 * severity follows referee.cpp:321-446 (from-behind dot factor + ball distance).
 */

interface Slide {
  t: number; // remaining slide seconds
  dirX: number;
  dirZ: number;
}
const slides = new Map<Entity, Slide>();
const cooldowns = new Map<Entity, number>();
let aiTimer = 0;

export function tackleSystem(world: World, dt: number): void {
  const ball = world.queryFirst(IsBall);
  if (!ball) return;
  const bs = ball.get(BallState)!;
  const rb = ball.get(BallRef)!.value;
  if (!rb) return;
  const bp = rb.translation();

  for (const [e, cd] of cooldowns) {
    if (cd <= dt) cooldowns.delete(e);
    else cooldowns.set(e, cd - dt);
  }

  // human slides (one pad per control slot in two-player mode)
  const players = useStore.getState().players;
  for (let slot = 0; slot < players; slot++) {
    if (consumePress(padFor(slot, players).tackle) && !refState.ceremony) {
      const sel = world.queryFirst(slot === 1 ? Selected2 : Selected);
      if (sel && bs.owner !== sel && !slides.has(sel) && !cooldowns.has(sel)) {
        startSlide(sel);
      }
    }
  }

  // AI defenders slide when closing on the carrier
  aiTimer -= dt;
  if (aiTimer <= 0 && !refState.ceremony) {
    aiTimer = 0.25;
    const carrier = bs.owner;
    if (carrier) {
      const carrierTeam = carrier.get(Team)!.id;
      const cp = carrier.get(Position)!;
      for (const e of world.query(IsPlayer)) {
        if (
          e.get(Team)!.id === carrierTeam ||
          e.has(Selected) ||
          e.has(Selected2) ||
          e.get(PlayerInfo)!.role === Role.GK ||
          slides.has(e) ||
          cooldowns.has(e)
        )
          continue;
        const p = e.get(Position)!;
        const d = Math.hypot(cp.x - p.x, cp.z - p.z);
        const chance =
          (0.25 + e.get(Stats)!.tackle * 0.2) *
          (e.get(Team)!.id === AI_TEAM ? difficulty().tackleChance : 1);
        if (d > 1.2 && d < 2.6 && Math.random() < chance) {
          startSlide(e);
          break; // one new slide per tick
        }
      }
    }
  }

  // resolve active slides
  for (const [e, slide] of slides) {
    if (!e.isAlive()) {
      slides.delete(e);
      continue;
    }
    slide.t -= dt;
    const v = e.get(Velocity)!;
    const boost = slide.t > 0.25 ? 9 : 4; // lunge then slow on the turf
    v.x = slide.dirX * boost;
    v.z = slide.dirZ * boost;

    const p = e.get(Position)!;
    const dBall = Math.hypot(bp.x - p.x, bp.z - p.z);
    if (dBall < 0.8 && bp.y < 0.8) {
      // won the ball: poke it clear
      const owner = bs.owner;
      bs.owner = null;
      releaseBall(world, e, {
        x: slide.dirX * 8 + (Math.random() - 0.5) * 3,
        y: 0.5,
        z: slide.dirZ * 8 + (Math.random() - 0.5) * 3,
      });
      // at high fps the poke moves cm before the next possession pass — block
      // the dispossessed owner briefly or they instantly recapture
      if (owner) {
        bs.recaptureBlocks.push({ player: owner, t: 0.12 });
        // clean tackle still clips the legs: the dispossessed man stumbles
        if (owner.isAlive() && !owner.has(Tripped)) {
          owner.add(Tripped);
          owner.set(Tripped, { t: 0, yaw: owner.get(Heading)!.angle, fall: 0.5 });
        }
      }
      slides.delete(e);
      cooldowns.set(e, 1.2);
      continue;
    }

    const victim = bs.owner;
    if (victim && victim.get(Team)!.id !== e.get(Team)!.id) {
      const vp = victim.get(Position)!;
      const dVictim = Math.hypot(vp.x - p.x, vp.z - p.z);
      if (dVictim < 0.85) {
        // contact without the ball: foul, severity per referee.cpp:343-380
        const vh = victim.get(Heading)!.angle;
        const moveX = Math.sin(vh);
        const moveZ = Math.cos(vh);
        const toVictimX = (vp.x - p.x) / (dVictim || 1);
        const toVictimZ = (vp.z - p.z) / (dVictim || 1);
        const fromBehind = 0.5 * (toVictimX * moveX + toVictimZ * moveZ) + 0.5;
        const lateness = Math.min(dBall / 2, 1) * 0.5;
        const clumsiness = (1 - e.get(Stats)!.tackle) * 0.3;
        const severity = 1 + fromBehind * 0.5 + lateness + clumsiness + Math.random() * 0.2;
        // the victim goes down: kill momentum and send him to the turf
        const vv = victim.get(Velocity)!;
        const fallYaw =
          Math.hypot(vv.x, vv.z) > 1
            ? Math.atan2(vv.x, vv.z)
            : victim.get(Heading)!.angle;
        vv.x *= 0.1;
        vv.z *= 0.1;
        if (!victim.has(Tripped)) victim.add(Tripped);
        victim.set(Tripped, { t: 0, yaw: fallYaw, fall: 1 });
        slides.delete(e);
        cooldowns.set(e, 2);
        refereeFoul(world, e, victim, severity);
        continue;
      }
    }

    if (slide.t <= 0) {
      slides.delete(e);
      cooldowns.set(e, 1.5);
    }
  }
}

function startSlide(e: Entity): void {
  const h = e.get(Heading)!.angle;
  slides.set(e, { t: 0.5, dirX: Math.sin(h), dirZ: Math.cos(h) });
  // the visual pose lives in movementSystem and outlasts the physics window
  // (it includes the get-up), so it runs on its own timer
  e.add(SlideTackle);
  e.set(SlideTackle, { t: 0, yaw: h });
}
