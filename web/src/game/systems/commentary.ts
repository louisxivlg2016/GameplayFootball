import type { World } from "koota";
import { getRadioPack } from "../radioI18n";
import {
  BallRef,
  BallState,
  IsBall,
  IsPlayer,
  Name,
  PlayerInfo,
  Position,
  Role,
  Team,
  Velocity,
} from "../traits";
import { PITCH, attackSign } from "../levels";
import { useStore } from "../store";
import { radioFlow, radioLanguage, teamName } from "../radio";
import { refState } from "./referee";

let gap = 0; // breathing time between lines, counts only while the mic is idle
let lastKind = "";
// seconds since the last line: when a situation PERSISTS (same kind), the
// commentator re-describes it after this long instead of going quiet
let sinceLine = 0;
const STALE = 4.5;
let commentaryGen = -1;
let openingBurst = false;

/**
 * Continuous play-by-play: whenever the commentator is free, describe what is
 * happening — carrier, zone, pressure, runs, loose balls, the score.
 */
export function commentarySystem(world: World, dt: number): void {
  if (refState.ceremony || refState.ended) return;
  const gen = useStore.getState().gen;
  if (gen !== commentaryGen) {
    commentaryGen = gen;
    gap = 0.1;
    lastKind = "";
    sinceLine = 0;
    openingBurst = true;
  }

  sinceLine += dt;
  gap -= dt;
  if (gap > 0) return;
  // radioFlow pre-synthesizes while the mic is busy, chaining without dead air.
  // a short breath keeps the commentator nearly constant without overlapping
  gap = openingBurst ? 0.3 + Math.random() * 0.35 : 0.55 + Math.random() * 0.75;
  openingBurst = refState.clock < 14;

  const ball = world.queryFirst(IsBall);
  const rb = ball?.get(BallRef)?.value;
  const bs = ball?.get(BallState);
  if (!ball || !rb || !bs) return;
  const bp = rb.translation();
  const language = radioLanguage();
  const copy = getRadioPack(language);

  // occasionally step back for the score (no ordinals — Piper mangles "2e")
  if (Math.random() < 0.12) {
    const { score } = useStore.getState();
    radioFlow(copy.scoreStatus(score, teamName(0, language), teamName(1, language)));
    sinceLine = 0;
    lastKind = "score";
    return;
  }

  const owner = bs.owner;
  if (!owner || !owner.isAlive()) {
    if (lastKind !== "loose" || sinceLine > STALE) {
      radioFlow(copy.loose);
    sinceLine = 0;
      lastKind = "loose";
    }
    return;
  }

  const ownerName = owner.get(Name);
  const name = ownerName?.full || ownerName?.spoken || ownerName?.short || "";
  const teamId = owner.get(Team)!.id;
  const team = teamName(teamId, language);
  if (!name) return;

  if (owner.get(PlayerInfo)!.role === Role.GK) {
    radioFlow(copy.keeper(name, team));
    sinceLine = 0;
    lastKind = "keeper";
    return;
  }

  const p = owner.get(Position)!;
  const v = owner.get(Velocity)!;
  const speed = Math.hypot(v.x, v.z);
  const s = attackSign(teamId);
  const depth = p.x * s; // -55 own goal .. +55 opponent goal

  // pressure: nearest opponent
  let oppName = "";
  let oppDist = Infinity;
  for (const e of world.query(IsPlayer)) {
    if (e.get(Team)!.id === teamId) continue;
    const op = e.get(Position)!;
    const d = Math.hypot(op.x - p.x, op.z - p.z);
    if (d < oppDist) {
      oppDist = d;
      const opp = e.get(Name);
      oppName = opp?.full || opp?.spoken || opp?.short || "";
    }
  }

  if (oppDist < 2.5 && oppName && lastKind !== "duel" || sinceLine > STALE) {
    radioFlow(copy.duel(name, oppName));
    sinceLine = 0;
    lastKind = "duel";
    return;
  }

  if (speed > 6 && lastKind !== "run" || sinceLine > STALE) {
    radioFlow(copy.run(name, team));
    sinceLine = 0;
    lastKind = "run";
    return;
  }

  if (depth > PITCH.halfLength - 25 && lastKind !== "danger" || sinceLine > STALE) {
    radioFlow(copy.danger(name));
    sinceLine = 0;
    lastKind = "danger";
    return;
  }

  if (depth < -PITCH.halfLength + 25 && lastKind !== "build" || sinceLine > STALE) {
    radioFlow(copy.build(name, team));
    sinceLine = 0;
    lastKind = "build";
    return;
  }

  if (lastKind !== "carry" || sinceLine > STALE) {
    radioFlow(copy.carry(name, team));
    sinceLine = 0;
    lastKind = "carry";
  }
}
