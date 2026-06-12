import type { World } from "koota";
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
import { radioFlow, radioIdle, teamName } from "../radio";
import { refState } from "./referee";

const pick = (lines: string[]): string =>
  lines[Math.floor(Math.random() * lines.length)]!;

let gap = 0; // breathing time between lines, counts only while the mic is idle
let lastKind = "";

/**
 * Continuous play-by-play: whenever the commentator is free, describe what is
 * happening — carrier, zone, pressure, runs, loose balls, the score.
 */
export function commentarySystem(world: World, dt: number): void {
  if (refState.ceremony || refState.ended) return;
  if (!radioIdle()) return;

  gap -= dt;
  if (gap > 0) return;
  gap = 0.7 + Math.random() * 1.6;

  const ball = world.queryFirst(IsBall);
  const rb = ball?.get(BallRef)?.value;
  const bs = ball?.get(BallState);
  if (!ball || !rb || !bs) return;
  const bp = rb.translation();

  // occasionally step back for the score
  if (Math.random() < 0.12) {
    const { score, clock } = useStore.getState();
    const lead =
      score[0] === score[1]
        ? `${score[0]} partout`
        : score[0] > score[1]
          ? `${teamName(0)} devant ${score[0]} à ${score[1]}`
          : `${teamName(1)} devant ${score[1]} à ${score[0]}`;
    radioFlow(`${Math.max(1, Math.floor(clock / 60))}e minute, ${lead}.`);
    lastKind = "score";
    return;
  }

  const owner = bs.owner;
  if (!owner || !owner.isAlive()) {
    if (lastKind !== "loose") {
      radioFlow(
        pick([
          "Le ballon est libre !",
          "Personne ne contrôle ce ballon.",
          "Ballon disputé au milieu de tous ces joueurs !",
        ]),
      );
      lastKind = "loose";
    }
    return;
  }

  const name = owner.get(Name)?.short ?? "";
  const teamId = owner.get(Team)!.id;
  const team = teamName(teamId);
  if (!name) return;

  if (owner.get(PlayerInfo)!.role === Role.GK) {
    radioFlow(
      pick([
        `Le gardien ${name} a le ballon dans les gants.`,
        `${name} va relancer pour ${team}.`,
      ]),
    );
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
      oppName = e.get(Name)?.short ?? "";
    }
  }

  if (oppDist < 2.5 && oppName && lastKind !== "duel") {
    radioFlow(
      pick([
        `${name} est pressé par ${oppName} !`,
        `${oppName} vient au duel sur ${name} !`,
        `Attention, ${oppName} est sur ${name} !`,
      ]),
    );
    lastKind = "duel";
    return;
  }

  if (speed > 6 && lastKind !== "run") {
    radioFlow(
      pick([
        `${name} accélère !`,
        `Quelle chevauchée de ${name} !`,
        `${name} prend la profondeur pour ${team} !`,
      ]),
    );
    lastKind = "run";
    return;
  }

  if (depth > PITCH.halfLength - 25 && lastKind !== "danger") {
    radioFlow(
      pick([
        `${name} approche de la surface !`,
        `${name} dans le dernier tiers, ça devient chaud !`,
        `Le porteur ${name} est aux abords de la surface adverse !`,
      ]),
    );
    lastKind = "danger";
    return;
  }

  if (depth < -PITCH.halfLength + 25 && lastKind !== "build") {
    radioFlow(
      pick([
        `${name} relance proprement depuis la défense.`,
        `${team} repartent de derrière avec ${name}.`,
      ]),
    );
    lastKind = "build";
    return;
  }

  if (lastKind !== "carry") {
    radioFlow(
      pick([
        `${name} au ballon pour ${team}.`,
        `${name} porte le ballon au milieu de terrain.`,
        `${name} en possession, ${team} font circuler.`,
        `Le jeu passe par ${name}.`,
      ]),
    );
    lastKind = "carry";
  }
}
