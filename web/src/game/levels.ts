import type { Entity, World } from "koota";
import { useStore } from "./store";
import {
  BallRef,
  BallState,
  Heading,
  HomePos,
  IsBall,
  IsPlayer,
  IsReferee,
  Match,
  MeshRef,
  Name,
  PlayerInfo,
  Position,
  Role,
  Selected,
  Selected2,
  Stats,
  Team,
  Velocity,
} from "./traits";

/** Dimensions straight from the C++ source (gamedefines.hpp:271-279, ball.cpp). */
export const PITCH = {
  halfLength: 55, // goal-to-goal, goals at x = ±55
  halfWidth: 36, // touchline-to-touchline, z = ±36
  goalHalfWidth: 3.7,
  goalHeight: 2.5,
  goalDepth: 2.55,
  postRadius: 0.07,
  ballRadius: 0.11,
} as const;

/** Player velocities from gamedefines.hpp:18-27, in m/s. */
export const SPEEDS = { dribble: 3.5, walk: 5.0, sprint: 8.0 } as const;

/** Team 0 attacks +x in the first half; sides swap at halftime. */
const sides: [number, number] = [1, -1];
export const attackSign = (team: number): number => sides[team]!;
export function resetSides(): void {
  sides[0] = 1;
  sides[1] = -1;
}
export function swapSides(): void {
  sides[0] = -sides[0]!;
  sides[1] = -sides[1]!;
}

/** 4-4-2 anchors for a team attacking +x, at a neutral ball position. */
const FORMATION: ReadonlyArray<{ role: number; x: number; z: number }> = [
  { role: Role.GK, x: -52, z: 0 },
  { role: Role.DEF, x: -36, z: -26 },
  { role: Role.DEF, x: -38, z: -9 },
  { role: Role.DEF, x: -38, z: 9 },
  { role: Role.DEF, x: -36, z: 26 },
  { role: Role.MID, x: -12, z: -24 },
  { role: Role.MID, x: -15, z: -7 },
  { role: Role.MID, x: -15, z: 7 },
  { role: Role.MID, x: -12, z: 24 },
  { role: Role.ATT, x: 6, z: -10 },
  { role: Role.ATT, x: 6, z: 10 },
];

export function anchor(team: number, index: number): { x: number; z: number } {
  const f = FORMATION[index]!;
  const s = attackSign(team);
  return { x: f.x * s, z: f.z * s };
}

/** Deterministic 0..1 pseudo-random for stat generation. */
const statRand = (seed: number): number => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// fictional squad names: common given names + generic surnames, combined randomly
const FIRST_NAMES = [
  "Karim", "Théo", "Moussa", "Lucas", "Pablo", "Enzo", "Idriss", "Mathis",
  "Diego", "Yanis", "Rafael", "Antoine", "Kofi", "Nolan", "Samuel", "Aurélien",
  "Dario", "Malik", "Jules", "Oscar", "Tiago", "Bakary", "Léo", "Marco",
];
const LAST_NAMES = [
  "Morel", "Duval", "Lefort", "Charrier", "Vasseur", "Toussaint", "Beaulieu",
  "Janvier", "Falcone", "Marchetti", "Ribeiro", "Cardoso", "Almeida", "Brunet",
  "Okafor", "Mendes", "Roussel", "Maréchal", "Sylla", "Costa", "Perrin",
  "Delgado", "Marin", "Verdier",
];

function makeName(
  seed: number,
  taken: Set<string>,
): { full: string; short: string; spoken: string } {
  for (let attempt = 0; attempt < 8; attempt++) {
    const first = FIRST_NAMES[Math.floor(statRand(seed * 13 + attempt * 7 + 1) * FIRST_NAMES.length)]!;
    const last = LAST_NAMES[Math.floor(statRand(seed * 17 + attempt * 11 + 2) * LAST_NAMES.length)]!;
    if (!taken.has(last)) {
      taken.add(last);
      return { full: `${first} ${last}`, short: `${first[0]}. ${last}`, spoken: last };
    }
  }
  const last = LAST_NAMES[seed % LAST_NAMES.length]!;
  return { full: `Rémi ${last}`, short: `R. ${last}`, spoken: last };
}

export function loadMatch(world: World): void {
  for (const e of [...world.query(IsPlayer)]) e.destroy();
  for (const e of [...world.query(IsBall)]) e.destroy();
  for (const e of [...world.query(Match)]) e.destroy();
  for (const e of [...world.query(IsReferee)]) e.destroy();
  resetSides();

  world.spawn(IsBall, BallRef, BallState);
  world.spawn(Match);
  world.spawn(IsReferee, Position, Velocity, Heading, MeshRef);

  const takenNames = new Set<string>();
  for (let team = 0; team < 2; team++) {
    for (let i = 0; i < FORMATION.length; i++) {
      const role = FORMATION[i]!.role;
      const seed = team * 31 + i;
      const name = makeName(seed, takenNames);
      // role-flavored ratings: attackers shoot, defenders tackle, mids pass
      const r = (n: number): number => 0.3 + statRand(seed * 7 + n) * 0.6;
      world.spawn(
        IsPlayer,
        Team({ id: team }),
        PlayerInfo({ index: i, role, aiTimer: Math.random() * 0.3, yellows: 0 }),
        Stats({
          // keepers get strong reflexes: high ballcontrol drives save reach,
          // velocity gets them set / off the line quickly
          velocity: r(1) + (role === Role.ATT ? 0.1 : role === Role.GK ? 0.2 : 0),
          ballcontrol:
            role === Role.GK ? 0.85 + statRand(seed * 7 + 2) * 0.15 : r(2) + (role === Role.ATT ? 0.1 : 0),
          shortpass: r(3) + (role === Role.MID ? 0.15 : 0),
          shot: r(4) + (role === Role.ATT ? 0.15 : 0),
          tackle: r(5) + (role === Role.DEF ? 0.15 : 0),
          energy: 1,
        }),
        Name(name),
        Position,
        Velocity,
        Heading,
        HomePos,
        MeshRef,
      );
    }
  }
  placeKickoff(world, Math.random() < 0.5 ? 0 : 1);

  // bump an epoch tied to THIS fresh set of entities. The referee keys its
  // one-time match setup (shoot-out staging, kickoff, etc.) off this — not off
  // the store's gen — so the setup always runs on the entities loadMatch just
  // created, never on a stale set about to be destroyed by a remount.
  const g = globalThis as { __gpfEpoch?: number };
  g.__gpfEpoch = (g.__gpfEpoch ?? 0) + 1;
}

/** Everyone to their own half, ball dead on the centre spot, one striker on it. */
export function placeKickoff(world: World, kickingTeam: number): void {
  const ball = world.queryFirst(IsBall);
  const match = world.queryFirst(Match);
  if (!ball || !match) return;

  const players = world.query(IsPlayer);
  for (const e of players) {
    const team = e.get(Team)!.id;
    const info = e.get(PlayerInfo)!;
    const a = anchor(team, info.index);
    const s = attackSign(team);
    // own half is -x for team 0, +x for team 1
    const x = s > 0 ? Math.min(a.x, -2) : Math.max(a.x, 2);
    e.get(Position)!.set(x, 0, a.z);
    e.get(Velocity)!.set(0, 0, 0);
    e.set(Heading, { angle: Math.atan2(-x, -a.z) });
    e.get(HomePos)!.set(a.x, 0, a.z);
  }

  const kicker = players.find(
    (e) =>
      e.get(Team)!.id === kickingTeam && e.get(PlayerInfo)!.role === Role.ATT,
  );
  if (kicker) {
    kicker.get(Position)!.set(-attackSign(kickingTeam) * 1.0, 0, 0);
    kicker.set(Heading, { angle: Math.atan2(attackSign(kickingTeam), 0) });

    // a partner stands at the centre circle, just behind and to the side in the
    // kicking team's own half — like a real kickoff, so the taker always has a
    // simple tap-back option (you can also lay it back to the keeper).
    const partner =
      players.find(
        (e) =>
          e !== kicker &&
          e.get(Team)!.id === kickingTeam &&
          e.get(PlayerInfo)!.role === Role.ATT,
      ) ??
      players.find(
        (e) =>
          e !== kicker &&
          e.get(Team)!.id === kickingTeam &&
          e.get(PlayerInfo)!.role === Role.MID,
      );
    if (partner) {
      const s = attackSign(kickingTeam);
      partner.get(Position)!.set(-s * 2.5, 0, 3.5);
      partner.get(Velocity)!.set(0, 0, 0);
      partner.set(Heading, { angle: Math.atan2(s, 0) });
    }
  }

  const referee = world.queryFirst(IsReferee);
  if (referee) {
    referee.get(Position)!.set(-2, 0, -9);
    referee.get(Velocity)!.set(0, 0, 0);
    referee.set(Heading, { angle: Math.atan2(2, 9) });
  }

  const bs = ball.get(BallState)!;
  bs.owner = kicker ?? null;
  bs.lastKicker = null;
  bs.passTarget = null;
  bs.passHomingT = 0;
  bs.passProtected = false;
  bs.kickCooldown = 0;
  bs.recaptureBlocks = [];
  const rb = ball.get(BallRef)!.value;
  if (rb) {
    rb.setTranslation({ x: 0, y: PITCH.ballRadius, z: 0 }, true);
    rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  for (const team of [0, 1] as const) {
    const slot = humanSlotFor(team);
    if (slot === null) continue;
    setSelected(
      world,
      kickingTeam === team ? (kicker ?? null) : nearestOutfield(world, team, 0, 0),
      slot,
    );
  }
  match.set(Match, {
    lastTouchTeam: kickingTeam,
    resetTimer: 0,
    pendingKickoffTeam: -1,
    switchCooldown: 0.5,
  });
}

/** Which control slot steers `team`: solo follows the chosen side, versus is RED=P1 and BLU=P2. */
export function humanSlotFor(team: number): number | null {
  const { players, humanTeam } = useStore.getState();
  if (players === 2) return team === 0 ? 0 : team === 1 ? 1 : null;
  return team === humanTeam ? 0 : null;
}

export function setSelected(
  world: World,
  entity: Entity | null,
  slot = 0,
): void {
  const Trait = slot === 1 ? Selected2 : Selected;
  for (const e of [...world.query(Trait)]) e.remove(Trait);
  entity?.add(Trait);
  const name = entity ? (entity.get(Name)?.short ?? "") : "";
  // deferred: loadMatch runs inside a render (useMemo) and React warns on
  // store updates issued while rendering another component
  queueMicrotask(() => {
    const s = useStore.getState();
    if (slot === 1) s.setSelectedName2(name);
    else s.setSelectedName(name);
  });
}

/** Nearest outfield player of `team` to a point. */
export function nearestOutfield(
  world: World,
  team: number,
  x: number,
  z: number,
): Entity | null {
  let best: Entity | null = null;
  let bestD = Infinity;
  for (const e of world.query(IsPlayer)) {
    if (e.get(Team)!.id !== team || e.get(PlayerInfo)!.role === Role.GK) continue;
    const p = e.get(Position)!;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}
