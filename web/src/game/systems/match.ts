import type { World } from "koota";
import {
  BallRef,
  BallState,
  IsBall,
  Match,
  Position,
  Role,
  Team,
  Velocity,
  IsPlayer,
  PlayerInfo,
} from "../traits";
import { PITCH, placeKickoff, setSelected } from "../levels";
import { useStore } from "../store";

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

let clockAcc = 0;
let lastGen = -1;

/**
 * Restart rules follow referee.cpp:116-184: goals and corner/goal-kick/throw-in
 * by last touch — simplified to "dead ball at the spot, nearest restarter takes it".
 */
export function matchSystem(world: World, dt: number): void {
  const store = useStore.getState();
  const match = world.queryFirst(Match);
  const ball = world.queryFirst(IsBall);
  if (!match || !ball) return;

  if (store.gen !== lastGen) {
    lastGen = store.gen;
    clockAcc = 0;
  }

  if (store.mode === "goal") {
    const t = match.get(Match)!.resetTimer - dt;
    if (t <= 0) {
      placeKickoff(world, match.get(Match)!.pendingKickoffTeam);
      store.setMode("play");
    } else {
      match.set(Match, { resetTimer: t });
    }
    return;
  }

  clockAcc += dt;
  const secs = Math.floor(clockAcc);
  if (secs !== store.clock) store.setClock(secs);

  const rb = ball.get(BallRef)!.value;
  if (!rb) return;
  const bp = rb.translation();
  const R = PITCH.ballRadius;

  if (Math.abs(bp.x) > PITCH.halfLength + R) {
    const side = Math.sign(bp.x);
    const inMouth =
      Math.abs(bp.z) < PITCH.goalHalfWidth && bp.y < PITCH.goalHeight;
    if (inMouth) {
      const scorer = side > 0 ? 0 : 1; // team 0 attacks +x
      store.addGoal(scorer);
      match.set(Match, { resetTimer: 2.8, pendingKickoffTeam: 1 - scorer });
      return;
    }
    if (Math.abs(bp.x) > PITCH.halfLength + 0.4) {
      const defending = side > 0 ? 1 : 0;
      const lastTouch = match.get(Match)!.lastTouchTeam;
      if (lastTouch === defending) {
        // corner for the attackers
        restart(world, 1 - defending, side * 53.5, Math.sign(bp.z) * 34);
      } else {
        // goal kick, taken at 92% of the pitch like referee.cpp:154
        restart(world, defending, side * PITCH.halfLength * 0.92, 0);
      }
      return;
    }
  }

  if (Math.abs(bp.z) > PITCH.halfWidth + R) {
    const lastTouch = match.get(Match)!.lastTouchTeam;
    const taker = lastTouch === 0 ? 1 : 0;
    restart(world, taker, clamp(bp.x, -52, 52), Math.sign(bp.z) * 35.2);
  }
}

function restart(world: World, teamId: number, x: number, z: number): void {
  const ball = world.queryFirst(IsBall);
  const match = world.queryFirst(Match);
  if (!ball || !match) return;
  const rb = ball.get(BallRef)!.value;
  if (!rb) return;

  rb.setTranslation({ x, y: PITCH.ballRadius, z }, true);
  rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
  rb.setAngvel({ x: 0, y: 0, z: 0 }, true);

  // nearest outfielder of the restarting team becomes the taker
  let taker = null;
  let bestD = Infinity;
  for (const e of world.query(IsPlayer)) {
    if (e.get(Team)!.id !== teamId || e.get(PlayerInfo)!.role === Role.GK)
      continue;
    const p = e.get(Position)!;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD) {
      bestD = d;
      taker = e;
    }
  }
  if (taker) {
    taker
      .get(Position)!
      .set(x - Math.sign(x) * 0.7, 0, z - Math.sign(z) * 0.7);
    taker.get(Velocity)!.set(0, 0, 0);
    if (teamId === 0) setSelected(world, taker);
  }

  const bs = ball.get(BallState)!;
  bs.owner = taker;
  bs.lastKicker = null;
  bs.kickCooldown = 0;
  match.set(Match, { lastTouchTeam: teamId, switchCooldown: 0.5 });
}
