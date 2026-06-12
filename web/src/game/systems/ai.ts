import type { Entity, World } from "koota";
import {
  BallRef,
  BallState,
  HomePos,
  IsBall,
  IsPlayer,
  PlayerInfo,
  Position,
  Role,
  Selected,
  Stats,
  Team,
  Velocity,
} from "../traits";
import { PITCH, SPEEDS, attackSign } from "../levels";
import { useStore } from "../store";
import {
  MINDSET,
  evaluateBestPass,
  executePass,
  panicClear,
  shoot,
  shotOdds,
} from "./kicks";
import { ceremonyTarget, refState } from "./referee";
import { AI_TEAM, difficulty } from "../difficulty";

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

/** Opponent-repulsion weight by role (elizacontroller.cpp:709-727). */
const REPEL_WEIGHT = [0, 2.2, 1.6, 1.0];

interface TeamState {
  /** 0..1 recent possession share (the original's fadingTeamPossessionAmount) */
  fading: number;
  support: Entity | null;
  supportT: number;
  presser: Entity | null;
  marks: Map<Entity, Entity>;
  assignT: number;
}

const newTeam = (): TeamState => ({
  fading: 0.5,
  support: null,
  supportT: 0,
  presser: null,
  marks: new Map(),
  assignT: 0,
});

const state = {
  gen: -1,
  time: 0,
  avgBX: 0,
  avgBZ: 0,
  teams: [newTeam(), newTeam()] as [TeamState, TeamState],
  runs: new Map<Entity, { until: number; tx: number; tz: number }>(),
  carrier: null as Entity | null,
  carrierSeconds: 0,
  /** keepers' committed (imperfect) reads of incoming shots */
  reads: new Map<Entity, { until: number; off: number }>(),
};

function seek(e: Entity, tx: number, tz: number, dt: number, maxSpeed: number = SPEEDS.sprint): void {
  const p = e.get(Position)!;
  const v = e.get(Velocity)!;
  const stats = e.get(Stats)!;
  // physical_velocity + stamina multipliers (playerbase.cpp:136-139)
  let top = maxSpeed * (0.9 + 0.1 * stats.velocity) * (0.75 + 0.25 * stats.energy);
  if (e.get(Team)!.id === AI_TEAM) top *= difficulty().aiSpeed;
  const dx = tx - p.x;
  const dz = tz - p.z;
  const d = Math.hypot(dx, dz);
  const speed = d < 0.4 ? 0 : Math.min(d * 2.6, top); // gamedefines.hpp:54
  const k = Math.min(1, dt * 6);
  v.x += ((d > 0 ? (dx / d) * speed : 0) - v.x) * k;
  v.z += ((d > 0 ? (dz / d) * speed : 0) - v.z) * k;
}

/** Second-deepest opponent (AIfunctions.cpp:333-372); the line `team` attacks against. */
function offsideLine(world: World, team: number, ballX: number): number {
  const s = attackSign(team);
  let deepest = -Infinity;
  let second = -Infinity;
  for (const e of world.query(IsPlayer)) {
    if (e.get(Team)!.id === team) continue;
    const depth = e.get(Position)!.x * s;
    if (depth > deepest) {
      second = deepest;
      deepest = depth;
    } else if (depth > second) {
      second = depth;
    }
  }
  return Math.max(second, ballX * s) * s;
}

/** Dynamic possession/territory bias (teamAIcontroller.cpp:329-340). */
function possessionBias(team: number): number {
  const pb = clamp(state.teams[team]!.fading, 0.3, 0.7);
  const bb = clamp((state.avgBX / PITCH.halfLength) * attackSign(team), -0.7, 0.7) * 0.5 + 0.5;
  const bbb = (1 - Math.abs(2 * pb - 1)) * 0.6;
  return pb * (1 - bbb) + bb * bbb;
}

export function aiSystem(world: World, dt: number): void {
  const ball = world.queryFirst(IsBall);
  if (!ball) return;
  const bs = ball.get(BallState)!;
  const rb = ball.get(BallRef)!.value;
  if (!rb) return;
  const bp = rb.translation();
  const bv = rb.linvel();

  const gen = useStore.getState().gen;
  if (gen !== state.gen) {
    state.gen = gen;
    state.time = 0;
    state.avgBX = 0;
    state.avgBZ = 0;
    state.teams = [newTeam(), newTeam()];
    state.runs.clear();
    state.reads.clear();
    state.carrier = null;
    state.carrierSeconds = 0;
  }
  state.time += dt;

  const carrier = bs.owner;
  const carrierTeam = carrier ? carrier.get(Team)!.id : -1;

  if (carrier === state.carrier) state.carrierSeconds += dt;
  else {
    state.carrier = carrier;
    state.carrierSeconds = 0;
  }

  // fading possession + smoothed ball focus (3.5s window in the original)
  for (let t = 0; t < 2; t++) {
    const target = carrier ? (carrierTeam === t ? 1 : 0) : 0.5;
    state.teams[t]!.fading += (target - state.teams[t]!.fading) * Math.min(1, dt / 1.8);
  }
  state.avgBX += (bp.x - state.avgBX) * Math.min(1, dt / 3);
  state.avgBZ += (bp.z - state.avgBZ) * Math.min(1, dt / 3);

  const players = world.query(IsPlayer);
  const lines = [offsideLine(world, 0, bp.x), offsideLine(world, 1, bp.x)];

  updateAssignments(world, players, carrier, carrierTeam, bp, dt);
  updateRuns(world, players, carrier, carrierTeam);

  for (const e of players) {
    if (e.has(Selected)) continue; // human steers this one
    const teamId = e.get(Team)!.id;
    const info = e.get(PlayerInfo)!;

    // restart ceremony: everyone moves to their staged spot
    if (refState.ceremony) {
      const target = ceremonyTarget(world, e);
      if (target) {
        seek(e, target.x, target.z, dt, SPEEDS.walk * 1.25);
        continue;
      }
      // others fall back to formation holding, never chasing the dead ball
      const a = e.get(HomePos)!;
      if (info.role !== Role.GK) {
        seek(e, state.avgBX * 0.4 + a.x * 0.8, a.z * 0.8, dt, SPEEDS.walk);
        continue;
      }
    }

    if (info.role === Role.GK) {
      keeper(world, e, teamId, bs, bp, bv, dt);
      continue;
    }
    if (carrier === e) {
      aiCarrier(world, e, teamId, dt);
      continue;
    }

    const ts = state.teams[teamId]!;
    const teamHasBall = carrierTeam === teamId || (carrier === null && ts.fading > 0.6);
    if (teamHasBall) {
      attackPosition(world, e, teamId, carrier, lines[teamId]!, dt);
    } else {
      defendPosition(world, e, teamId, carrier, bp, bv, dt);
    }
  }
}

/** Presser + man-marking assignments, recomputed every 300ms (teamAIcontroller.cpp). */
function updateAssignments(
  world: World,
  players: readonly Entity[],
  carrier: Entity | null,
  carrierTeam: number,
  bp: { x: number; z: number },
  dt: number,
): void {
  for (let t = 0; t < 2; t++) {
    const ts = state.teams[t]!;
    ts.assignT -= dt;
    if (ts.assignT > 0) continue;
    ts.assignT = 0.3;
    ts.presser = null;
    ts.marks.clear();

    const defendersGoalX = -attackSign(t) * PITCH.halfLength;
    const eligible = players.filter(
      (e) =>
        e.get(Team)!.id === t && e.get(PlayerInfo)!.role !== Role.GK && !e.has(Selected),
    );

    // presser: nearest to the ball / carrier
    let bestD = Infinity;
    for (const e of eligible) {
      const p = e.get(Position)!;
      const d = Math.hypot(p.x - bp.x, p.z - bp.z);
      if (d < bestD) {
        bestD = d;
        ts.presser = e;
      }
    }

    if (carrierTeam === t || carrierTeam === -1) continue;
    // mark the 3 most dangerous opponents (closest to our goal, besides the carrier)
    const dangerous = players
      .filter((e) => e.get(Team)!.id !== t && e !== carrier && e.get(PlayerInfo)!.role !== Role.GK)
      .map((e) => {
        const p = e.get(Position)!;
        return { e, danger: Math.hypot(p.x - defendersGoalX, p.z) };
      })
      .sort((a, b) => a.danger - b.danger)
      .slice(0, 3);
    const free = new Set(eligible.filter((e) => e !== ts.presser));
    for (const { e: opp } of dangerous) {
      const op = opp.get(Position)!;
      let marker: Entity | null = null;
      let md = 25; // markers only within range
      for (const def of free) {
        const p = def.get(Position)!;
        const d = Math.hypot(p.x - op.x, p.z - op.z);
        if (d < md) {
          md = d;
          marker = def;
        }
      }
      if (marker) {
        ts.marks.set(marker, opp);
        free.delete(marker);
      }
    }
  }
}

/** Support player + forward-run triggers (elizacontroller.cpp:670-690, teamAIcontroller.cpp:203-242). */
function updateRuns(
  world: World,
  players: readonly Entity[],
  carrier: Entity | null,
  carrierTeam: number,
): void {
  for (const [e, run] of state.runs) {
    if (state.time > run.until || !e.isAlive()) state.runs.delete(e);
  }
  if (!carrier || carrierTeam === -1) return;
  const ts = state.teams[carrierTeam]!;
  const cp = carrier.get(Position)!;
  const s = attackSign(carrierTeam);

  if (state.time > ts.supportT) {
    ts.supportT = state.time + 1.5;
    ts.support = null;
    let bestD = Infinity;
    for (const e of players) {
      if (e === carrier || e.has(Selected) || e.get(Team)!.id !== carrierTeam) continue;
      const role = e.get(PlayerInfo)!.role;
      if (role !== Role.MID && role !== Role.ATT) continue;
      const p = e.get(Position)!;
      const d = Math.hypot(p.x - cp.x, p.z - cp.z);
      if (d < bestD) {
        bestD = d;
        ts.support = e;
      }
    }
  }

  let active = 0;
  for (const [e] of state.runs) if (e.get(Team)!.id === carrierTeam) active++;
  if (active >= 2) return;
  for (const e of players) {
    if (
      e === carrier ||
      e === ts.support ||
      e.has(Selected) ||
      e.get(Team)!.id !== carrierTeam ||
      state.runs.has(e)
    )
      continue;
    const role = e.get(PlayerInfo)!.role;
    if (role !== Role.MID && role !== Role.ATT) continue;
    const p = e.get(Position)!;
    const d = Math.hypot(p.x - cp.x, p.z - cp.z);
    if (d > 40) continue;
    let oppsNear = 0;
    for (const o of players) {
      if (o.get(Team)!.id === carrierTeam) continue;
      const op = o.get(Position)!;
      if (Math.hypot(op.x - p.x, op.z - p.z) < 15) oppsNear++;
    }
    // distanceRating - 0.3 per nearby opponent, needs >= 0.5 (teamAIcontroller.cpp:203-242)
    const rating = Math.pow(1 - clamp(d / 40, 0, 1), 0.5) - 0.3 * oppsNear;
    if (rating >= 0.5) {
      state.runs.set(e, {
        until: state.time + 2.5,
        tx: clamp(cp.x + s * 14, -52, 52),
        tz: clamp(p.z * 0.4 + cp.z * 0.4 + (p.z > cp.z ? 8 : -8), -33, 33),
      });
      active++;
      if (active >= 2) break;
    }
  }
}

/** Off-ball attacking position: dynamic formation + support/run + repulsion force-field. */
function attackPosition(
  world: World,
  e: Entity,
  teamId: number,
  carrier: Entity | null,
  offside: number,
  dt: number,
): void {
  const s = attackSign(teamId);
  const info = e.get(PlayerInfo)!;
  const a = e.get(HomePos)!;
  const ts = state.teams[teamId]!;
  const bias = possessionBias(teamId);

  // depth/width blend between defense (0.75/0.8) and offense (0.9/0.9) tactics
  const depth = 0.75 + 0.15 * bias;
  const width = 0.8 + 0.1 * bias;
  let tx = state.avgBX * 0.5 + a.x * depth + s * (bias - 0.5) * 10;
  let tz = state.avgBZ * 0.22 + a.z * width;

  if (ts.support === e) tx += s * (0.3 + 0.7 * MINDSET[info.role]!) * 12;

  const run = state.runs.get(e);
  if (run) {
    tx = run.tx;
    tz = run.tz;
  }

  // opponent repulsion clears passing lanes (role-weighted, scale 5)
  const w = REPEL_WEIGHT[info.role]!;
  for (const o of world.query(IsPlayer)) {
    if (o.get(Team)!.id === teamId) continue;
    const op = o.get(Position)!;
    const d = Math.hypot(op.x - tx, op.z - tz);
    if (d < 5 && d > 0.01) {
      const push = w * (1 - d / 5) * 3;
      tx += ((tx - op.x) / d) * push;
      tz += ((tz - op.z) / d) * push;
    }
  }
  // teammate separation while in clear possession (weight 0.4, scale ~8)
  if (ts.fading > 0.68) {
    for (const o of world.query(IsPlayer)) {
      if (o === e || o.get(Team)!.id !== teamId) continue;
      const op = o.get(Position)!;
      const d = Math.hypot(op.x - tx, op.z - tz);
      if (d < 8 && d > 0.01) {
        const push = 0.4 * (1 - d / 8) * 4;
        tx += ((tx - op.x) / d) * push;
        tz += ((tz - op.z) / d) * push;
      }
    }
  }

  // offside-aware: stay 0.2m onside of the second-last defender unless carrying
  if (carrier && carrier !== e) {
    if (tx * s > offside * s - 0.2) tx = (offside * s - 0.2) * s;
  }

  tx = clamp(tx, -52, 52);
  tz = clamp(tz, -34, 34);
  seek(e, tx, tz, dt, run ? SPEEDS.sprint : SPEEDS.walk * 1.25);
}

/** Defensive position: press goal-side, man-mark, or hold the line. */
function defendPosition(
  world: World,
  e: Entity,
  teamId: number,
  carrier: Entity | null,
  bp: { x: number; z: number },
  bv: { x: number; z: number },
  dt: number,
): void {
  const s = attackSign(teamId);
  const ownGoalX = -s * PITCH.halfLength;
  const ts = state.teams[teamId]!;

  if (ts.presser === e) {
    if (carrier) {
      // goal-side pressing point (playercontroller.cpp:65-134)
      const cp = carrier.get(Position)!;
      const gd = Math.hypot(ownGoalX - cp.x, cp.z) || 1;
      seek(e, cp.x + ((ownGoalX - cp.x) / gd) * 0.8, cp.z + (-cp.z / gd) * 0.8, dt);
    } else {
      seek(e, bp.x + bv.x * 0.25, bp.z + bv.z * 0.25, dt);
    }
    return;
  }

  const marked = ts.marks.get(e);
  if (marked && carrier) {
    const op = marked.get(Position)!;
    const gd = Math.hypot(ownGoalX - op.x, op.z) || 1;
    seek(e, op.x + ((ownGoalX - op.x) / gd) * 1.5, op.z + (-op.z / gd) * 1.5, dt);
    return;
  }

  const a = e.get(HomePos)!;
  const bias = possessionBias(teamId);
  let tx = state.avgBX * 0.45 + a.x * (0.75 + 0.15 * bias);
  let tz = state.avgBZ * 0.25 + a.z * 0.8;

  // defensive line: hold 4m goal-side of the ball, never deeper than 6m off our line
  if (e.get(PlayerInfo)!.role === Role.DEF) {
    const lineDepth = Math.max(6, Math.min(tx * -s + PITCH.halfLength, bp.x * -s + PITCH.halfLength - 4));
    tx = (lineDepth - PITCH.halfLength) * -s;
  }
  tx = clamp(tx, -52, 52);
  tz = clamp(tz, -34, 34);
  seek(e, tx, tz, dt, SPEEDS.walk * 1.25);
}

/** Carrier: force-field dribble + shoot/pass/panic decisions (AIfunctions.cpp:374-473). */
function aiCarrier(world: World, e: Entity, teamId: number, dt: number): void {
  const p = e.get(Position)!;
  const s = attackSign(teamId);
  const info = e.get(PlayerInfo)!;
  const mindset = MINDSET[info.role]!;

  let nearestOpp = Infinity;
  for (const o of world.query(IsPlayer)) {
    if (o.get(Team)!.id === teamId) continue;
    const op = o.get(Position)!;
    nearestOpp = Math.min(nearestOpp, Math.hypot(op.x - p.x, op.z - p.z));
  }

  const aiTimer = info.aiTimer - dt;
  if (aiTimer <= 0) {
    e.set(PlayerInfo, { aiTimer: 0.28 });
    const goalX = s * PITCH.halfLength;
    const distGoal = Math.hypot(goalX - p.x, p.z);

    const shot = shotOdds(world, e);
    const eagerness = teamId === AI_TEAM ? difficulty().shootBoost : 0;
    if (
      distGoal < 32 &&
      shot.idealFactor > 0.1 &&
      Math.pow(shot.odds, 0.5) + Math.random() * 0.5 > 0.55 - eagerness
    ) {
      shoot(world, e, shot.aimZ + (Math.random() - 0.5) * 1.2);
      return;
    }

    const choice = evaluateBestPass(world, e, 0, 0, state.carrierSeconds);
    if (choice && (nearestOpp < 6 || choice.total > 0.22)) {
      executePass(world, e, choice);
      return;
    }

    // defenders panic-clear under pressure near their own goal
    const ownGoalDist = Math.hypot(-goalX - p.x, p.z);
    if (mindset < 0.25 && !choice && ownGoalDist < 16 && nearestOpp < 3) {
      panicClear(world, e);
      return;
    }
  } else {
    e.set(PlayerInfo, { aiTimer });
  }

  // force-field dribble direction
  let fx = 0;
  let fz = 0;
  const opps = world
    .query(IsPlayer)
    .filter((o) => o.get(Team)!.id !== teamId)
    .map((o) => {
      const op = o.get(Position)!;
      const ov = o.get(Velocity)!;
      const ox = op.x + ov.x * 0.25;
      const oz = op.z + ov.z * 0.25;
      return { ox, oz, d: Math.hypot(ox - p.x, oz - p.z) };
    })
    .sort((a, b) => a.d - b.d)
    .slice(0, 5);
  for (const o of opps) {
    if (o.d < 10 && o.d > 0.01) {
      const f = 2 * (1 - o.d / 10);
      fx += ((p.x - o.ox) / o.d) * f;
      fz += ((p.z - o.oz) / o.d) * f;
    }
  }
  // sideline + backline repulsion (power 4, scale 20, exp 0.7)
  const sideD = 41 - Math.abs(p.z);
  if (sideD < 20) fz -= Math.sign(p.z) * 4 * Math.pow(1 - sideD / 20, 0.7);
  const backD = 60 - Math.abs(p.x);
  if (backD < 20) fx -= Math.sign(p.x) * 4 * Math.pow(1 - backD / 20, 0.7);
  // goal attraction, center-magnet grows near the backline
  const nearBackline = clamp(Math.abs(p.x) / PITCH.halfLength, 0, 1);
  const gx = s * PITCH.halfLength;
  const gz = p.z * 0.5 * (1 - nearBackline * nearBackline * 0.5);
  const gd = Math.hypot(gx - p.x, gz - p.z) || 1;
  const offense = 0.7 + mindset * 0.1;
  fx += ((gx - p.x) / gd) * offense * 2;
  fz += ((gz - p.z) / gd) * offense * 2;

  const fl = Math.hypot(fx, fz) || 1;
  const speed = nearestOpp < 4 ? SPEEDS.sprint * 0.85 : SPEEDS.walk;
  const v = e.get(Velocity)!;
  const k = Math.min(1, dt * 6);
  v.x += ((fx / fl) * speed - v.x) * k;
  v.z += ((fz / fl) * speed - v.z) * k;
}

/** Keeper: angle-narrowing on the ball-post bisector, rush-out, goal-bound intercept, distribution. */
function keeper(
  world: World,
  e: Entity,
  teamId: number,
  bs: { owner: Entity | null },
  bp: { x: number; y: number; z: number },
  bv: { x: number; y: number; z: number },
  dt: number,
): void {
  const s = attackSign(teamId);
  const gx = -s * PITCH.halfLength;

  // distribution: keeper holds briefly, then plays out
  if (bs.owner === e) {
    const info = e.get(PlayerInfo)!;
    const aiTimer = info.aiTimer - dt;
    e.set(PlayerInfo, { aiTimer });
    if (aiTimer <= 0) {
      e.set(PlayerInfo, { aiTimer: 0.5 });
      const choice = evaluateBestPass(world, e, 0, 0, state.carrierSeconds);
      if (choice) executePass(world, e, choice);
      else panicClear(world, e);
    }
    return;
  }

  // goal-bound ball: sprint to the predicted crossing point (the low gate
  // keeps him active even on soft rollers heading for his net)
  if (!bs.owner && bv.x * -s > 3) {
    const tCross = (gx - bp.x) / bv.x;
    if (tCross > 0 && tCross < 1.3) {
      const zAtGoal = bp.z + bv.z * tCross;
      if (Math.abs(zAtGoal) < 4.4) {
        // one imperfect read per shot: the dive commits to a guessed crossing
        // point (worse on fast strikes), so a clean hit can beat him outright
        let read = state.reads.get(e);
        if (!read || state.time > read.until) {
          const shotSpeed = Math.hypot(bv.x, bv.z);
          const spread =
            (0.25 + shotSpeed * 0.02) * (1.15 - 0.5 * e.get(Stats)!.ballcontrol);
          read = {
            until: state.time + tCross + 0.2,
            off: (Math.random() - 0.5) * 2 * spread,
          };
          state.reads.set(e, read);
        }
        seek(e, gx + s * 0.4, clamp(zAtGoal + read.off, -3.5, 3.5), dt);
        return;
      }
    }
  }

  // rush out when an opponent bears down and no teammate covers (goalie_default.cpp:85-152)
  let out = 1.2;
  const opp = bs.owner;
  if (opp && opp.get(Team)!.id !== teamId) {
    const op = opp.get(Position)!;
    const oppGoalDist = Math.hypot(gx - op.x, op.z);
    if (oppGoalDist < 20) {
      let mateCovers = false;
      for (const m of world.query(IsPlayer)) {
        if (m === e || m.get(Team)!.id !== teamId) continue;
        const mp = m.get(Position)!;
        if (Math.hypot(mp.x - op.x, mp.z - op.z) < Math.hypot(e.get(Position)!.x - op.x, e.get(Position)!.z - op.z) + 1) {
          mateCovers = true;
          break;
        }
      }
      if (!mateCovers) out = clamp(20 - oppGoalDist, 0.7, 7);
    }
  } else if (!bs.owner && Math.hypot(gx - bp.x, bp.z) < 10) {
    seek(e, bp.x, bp.z, dt); // claim the loose ball in the box
    return;
  }

  // angle narrowing: stand on the ball→goal-centre ray, `out` meters off the line
  const bd = Math.hypot(bp.x - gx, bp.z) || 1;
  const tx = gx + ((bp.x - gx) / bd) * out;
  const tz = clamp((bp.z / bd) * out + bp.z * 0.12, -3.4, 3.4);
  seek(e, tx, tz, dt);
}
