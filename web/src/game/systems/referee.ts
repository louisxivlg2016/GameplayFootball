import type { Entity, World } from "koota";
import {
  BallRef,
  BallState,
  Heading,
  IsBall,
  IsPlayer,
  Jump,
  KeeperDive,
  Match,
  Name,
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
import {
  PITCH,
  attackSign,
  humanSlotFor,
  placeKickoff,
  setSelected,
  swapSides,
} from "../levels";
import { useStore } from "../store";
import { crowdRoar, setTension, whistle } from "../audio";
import { radio, radioScore } from "../radio";
import { evaluateBestPass, executePass, pass, releaseBall, shoot } from "./kicks";
import {
  queueCardCinematic,
  queueGoalCinematic,
  queueOffsideCinematic,
  startGoalReplay,
} from "./cinematic";

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

/** Clock speed: 90 game-minutes in 3 real minutes (45' half = 90s real). */
const GAME_SPEED = 30;
const PHASE_END = [2700, 5400, 6300, 7200]; // 45' / 90' / 105' / 120'
const PHASE_LABEL = ["1ST", "2ND", "ET1", "ET2", "PENS"];

export type SetPieceType =
  | "kickoff"
  | "throwin"
  | "corner"
  | "goalkick"
  | "freekick"
  | "penalty";

interface Ceremony {
  type: SetPieceType;
  team: number;
  x: number;
  z: number;
  /** prepare countdown; whistle + ready when it hits 0 (referee.cpp ~2s) */
  t: number;
  ready: boolean;
  kickDelay: number;
  taker: Entity | null;
}

interface PendingFoul {
  foulerTeam: number;
  victimTeam: number;
  x: number;
  z: number;
  until: number;
  penalty: boolean;
}

export const refState = {
  gen: -1,
  /** matches loadMatch's epoch; a mismatch means a fresh set of entities to set up */
  epoch: -1,
  clock: 0,
  phase: 0,
  firstKickoff: 0,
  ceremony: null as Ceremony | null,
  advantage: null as PendingFoul | null,
  flagged: new Map<Entity, { x: number; z: number }>(),
  flaggedTeam: -1,
  /** world-x of the last offside line snapshot, for the offside cutaway */
  flaggedLineX: 0,
  bannerT: 0,
  ended: false,
  /** last frame's free-ball x, to detect a genuine line crossing */
  prevBallX: 0,
  /** set-piece practice: seconds until the next attempt is re-staged */
  practiceResetT: 0,
  /** offside drill: how long the human has held an offside / onside position */
  drillOffT: 0,
  drillSafeT: 0,
  /** game-clock time of the next radio score reminder */
  nextChatter: 500,
  shootout: null as {
    scores: [number, number];
    taken: [number, number];
    outcomes: [string[], string[]]; // "g" / "m" per kick, for the HUD board
    turn: number;
    awaiting: number; // >0: outcome timer after a kick
    keeperFaced?: number; // kicks the AI keeper has faced
    keeperSaved?: boolean; // it must pull off at least one save
    takerKicks?: number; // kicks the AI has taken
    takerMissed?: boolean; // it must miss at least one
  } | null,
};

function banner(text: string, seconds = 2.5): void {
  useStore.getState().setBanner(text);
  refState.bannerT = seconds;
}

function ballOf(world: World): { rb: NonNullable<ReturnType<typeof getRb>>; bs: ReturnType<typeof getBs> } | null {
  const ball = world.queryFirst(IsBall);
  if (!ball) return null;
  const rb = ball.get(BallRef)!.value;
  if (!rb) return null;
  return { rb, bs: ball.get(BallState)! };
}
const getRb = (world: World) => world.queryFirst(IsBall)?.get(BallRef)!.value ?? null;
const getBs = (world: World) => world.queryFirst(IsBall)!.get(BallState)!;

/** Indirect/direct restart with the 2s prepare ceremony (referee.cpp:15-28). */
export function startSetPiece(
  world: World,
  type: SetPieceType,
  team: number,
  x: number,
  z: number,
): void {
  // The ball body may not have attached yet on a fresh match — that's fine:
  // we still set the ceremony and place the taker now (so the camera cuts to
  // the set piece this frame), and the staging loop drops the ball on the spot
  // as soon as its body is live.
  const b = ballOf(world);
  if (b) {
    b.rb.setTranslation({ x, y: PITCH.ballRadius, z }, true);
    b.rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    b.rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
    b.bs.owner = null;
    b.bs.lastKicker = null;
    b.bs.passTarget = null;
    b.bs.passHomingT = 0;
    b.bs.passProtected = false;
    b.bs.kickCooldown = 0;
    b.bs.recaptureBlocks = [];
  }

  // taker: nearest outfielder, except goal kicks (the keeper takes those)
  let taker: Entity | null = null;
  let bestD = Infinity;
  for (const e of world.query(IsPlayer)) {
    if (e.get(Team)!.id !== team) continue;
    const isKeeper = e.get(PlayerInfo)!.role === Role.GK;
    if (type === "goalkick" ? !isKeeper : isKeeper) continue;
    const p = e.get(Position)!;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD) {
      bestD = d;
      taker = e;
    }
  }
  const slot = humanSlotFor(team);
  if (slot !== null && taker) setSelected(world, taker, slot);

  if (taker) {
    const s = attackSign(team);
    taker.get(Position)!.set(x - s * 0.8, 0, z);
    taker.get(Velocity)!.set(0, 0, 0);
    taker.set(Heading, { angle: Math.atan2(s, 0) });
  }

  refState.ceremony = { type, team, x, z, t: 2, ready: false, kickDelay: 0.8, taker };

  // a free kick near goal: snap the wall (and the forwards beside it) into place
  // the instant the whistle blows, instead of a long jog — a proper wall, like
  // the real thing, ready to leap when you strike it
  if (type === "freekick") {
    for (const e of world.query(IsPlayer)) {
      if (e === taker) continue;
      const t = ceremonyTarget(world, e);
      if (!t) continue;
      e.get(Position)!.set(t.x, 0, t.z);
      e.get(Velocity)!.set(0, 0, 0);
    }
  }

  world.queryFirst(Match)?.set(Match, { lastTouchTeam: team });
  refState.flagged.clear();
  if (type !== "kickoff") whistle(1);
  if (type === "kickoff") radio("kickoff", { team });
  else if (type === "corner") radio("corner", { team });
  else if (type === "goalkick") radio("goalkick", { team });
  else if (type === "throwin") radio("throwin", { team });
}

/**
 * Post-goal restart, playground style: no walk back to the centre spot — the
 * ball goes straight to the conceding keeper, who punts from his own box.
 */
export function startGoalRestart(world: World, team: number): void {
  startSetPiece(
    world,
    "goalkick",
    team,
    -attackSign(team) * PITCH.halfLength * 0.92,
    0,
  );
}

/** Offside snapshot at the moment of every kick (AIfunctions.cpp:333-372). */
export function refereeOnKick(world: World, kicker: Entity): void {
  const c = refState.ceremony;
  if (c) {
    if (!c.ready) return; // dead ball — shouldn't happen, possession is gated
    refState.ceremony = null; // taken: play on
    if (refState.shootout) {
      refState.shootout.awaiting = 3.5;
      setTension(false); // the kick releases the held breath
    }
    // penalty/shoot-out struck: the defending keeper commits to a guess now
    if (c.type === "penalty") {
      penaltyDive(world, c.team);
    }
    // free kick struck: the wall (and the forwards beside it) leap to block
    if (c.type === "freekick") {
      const gx = attackSign(c.team) * PITCH.halfLength;
      const goalDist = Math.hypot(gx - c.x, c.z) || 1;
      const wallX = c.x + ((gx - c.x) / goalDist) * 9.15;
      const wallZ = c.z + ((0 - c.z) / goalDist) * 9.15;
      for (const e of world.query(IsPlayer)) {
        if (e === kicker || e.get(PlayerInfo)!.role === Role.GK) continue;
        const p = e.get(Position)!;
        if (Math.hypot(p.x - wallX, p.z - wallZ) < 6 && !e.has(Jump)) {
          e.add(Jump);
          e.set(Jump, { t: 0 });
        }
      }
    }
  }
  const team = kicker.get(Team)!.id;
  const s = attackSign(team);
  const b = ballOf(world);
  if (!b) return;
  const bp = b.rb.translation();

  refState.flagged.clear();
  refState.flaggedTeam = team;
  // second-deepest opponent, ball can also play the line
  let deepest = -Infinity;
  let second = -Infinity;
  for (const e of world.query(IsPlayer)) {
    if (e.get(Team)!.id === team) continue;
    const depth = e.get(Position)!.x * s;
    if (depth > deepest) {
      second = deepest;
      deepest = depth;
    } else if (depth > second) second = depth;
  }
  const line = Math.max(second, bp.x * s);
  refState.flaggedLineX = line * s; // world-x of the line, for the cutaway
  for (const e of world.query(IsPlayer)) {
    if (e === kicker || e.get(Team)!.id !== team) continue;
    const p = e.get(Position)!;
    // flag tight on the line (no lenient buffer) so offside is called more often
    if (p.x * s > line && p.x * s > 0) {
      refState.flagged.set(e, { x: p.x, z: p.z });
    }
  }
}

/** Called by possession when a flagged player takes the ball. */
export function refereeOffside(world: World, player: Entity): boolean {
  const spot = refState.flagged.get(player);
  if (!spot || refState.flaggedTeam !== player.get(Team)!.id) return false;
  whistle(2);
  banner("HORS-JEU", 4);
  radio("offside");
  // hold a close-up with the line drawn, then the free kick is taken
  queueOffsideCinematic(
    world,
    player,
    refState.flaggedLineX,
    1 - player.get(Team)!.id,
    clamp(spot.x, -52, 52),
    clamp(spot.z, -33, 33),
  );
  return true;
}

/** Foul from the tackle system; severity thresholds from referee.cpp:382-446. */
export function refereeFoul(
  world: World,
  fouler: Entity,
  victim: Entity,
  severity: number,
): void {
  const foulerTeam = fouler.get(Team)!.id;
  const victimTeam = victim.get(Team)!.id;
  const fp = fouler.get(Position)!;
  let foulType = severity <= 1.4 ? 1 : severity <= 2.0 ? 2 : 3;
  // rubber-band rule (both ways): fouling a player on the team that is currently
  // in the lead is a straight red card — you get sent off for hacking down the
  // leader whether the leader is you or the AI.
  const score = useStore.getState().score;
  if ((score[victimTeam] ?? 0) > (score[foulerTeam] ?? 0)) {
    foulType = 3;
  }

  const defGoalX = -attackSign(foulerTeam) * PITCH.halfLength;
  const penalty =
    Math.abs(fp.z) < 20.15 &&
    Math.abs(fp.x - defGoalX) < 16.5 &&
    Math.sign(fp.x) === Math.sign(defGoalX);
  const attGoalX = attackSign(victimTeam) * PITCH.halfLength; // victim's target goal
  const dangerousSpot = Math.abs(attGoalX - fp.x) < 28;

  const playOnWithVictim = (): void => {
    const b = ballOf(world);
    if (b && victim.isAlive()) {
      b.bs.owner = victim;
      b.bs.lastKicker = null;
      b.bs.kickCooldown = 0;
    }
  };

  const award = (): void => {
    whistle(2);
    if (penalty) {
      banner("PENALTY !", 3);
      radio("penalty", { team: victimTeam });
      startSetPiece(world, "penalty", victimTeam, Math.sign(defGoalX) * 51, 0);
      return;
    }
    // A foul committed against you deep in your OWN defensive area (the other
    // side fouled you in front of your net) isn't a fussy free kick — your
    // keeper just collects it and plays out, like a goal kick. (A penalty here
    // only happens when YOU foul in your own box, handled above.)
    const ownGoalX = -attackSign(victimTeam) * PITCH.halfLength;
    if (Math.sign(fp.x) === Math.sign(ownGoalX) && Math.abs(fp.x - ownGoalX) < 22) {
      startGoalRestart(world, victimTeam); // keeper's ball (announces the goal kick)
      return;
    }
    banner("COUP FRANC");
    radio("foul", { team: victimTeam });
    startSetPiece(world, "freekick", victimTeam, clamp(fp.x, -52, 52), clamp(fp.z, -33, 33));
  };

  // In midfield, normal hard contacts should not stop everything for a fussy
  // free kick/card cutscene. Let play continue unless it is dangerous or red.
  if (foulType === 2 && !penalty && !dangerousSpot) {
    playOnWithVictim();
    return;
  }

  // a booking in a dangerous area always stops play: card close-up + replay.
  // The red-carded man leaves only after the replay (so he appears in it).
  if (foulType >= 2) {
    const info = fouler.get(PlayerInfo)!;
    const second = foulType === 2 && info.yellows >= 1;
    const nm = fouler.get(Name);
    const foulerName = nm?.short ?? ""; // banner (visual): initial + surname
    const foulerSpoken = nm?.spoken ?? ""; // radio (TTS): surname only
    const red = foulType === 3 || second;
    if (red) {
      banner(
        (second ? "SECOND YELLOW — RED CARD" : "RED CARD") +
          (foulerName ? ` — ${foulerName}` : ""),
        3,
      );
      radio("red", { player: foulerSpoken });
    } else {
      banner("YELLOW CARD" + (foulerName ? ` — ${foulerName}` : ""), 3);
      radio("yellow", { player: foulerSpoken });
      fouler.set(PlayerInfo, { yellows: info.yellows + 1 });
    }
    award();
    queueCardCinematic(red, red ? fouler : null);
    return;
  }

  if (penalty) {
    award();
    return;
  }

  // A minor foul only stops play if it's somewhere dangerous. A foul in midfield
  // isn't worth a free kick — you just play on, the fouled player keeps the ball
  // (whoever did NOT commit the foul).
  if (dangerousSpot) {
    // dangerous attacking spot: play advantage, free kick if it breaks down
    refState.advantage = { foulerTeam, victimTeam, x: fp.x, z: fp.z, until: 3, penalty: false };
    return;
  }
  // anywhere else (midfield, or down by your own goal) — no whistle, no free
  // kick: the fouled team simply plays on with the ball. A foul on the AI in
  // front of THEIR net just gives them the ball back, no pointless free kick.
  playOnWithVictim();
}

/** Aliased for the cinematic system, which defers reds until after the replay. */
export { sendOff as executeSendOff };

function sendOff(world: World, player: Entity): void {
  const b = ballOf(world);
  if (b && b.bs.owner === player) b.bs.owner = null;
  const slot = player.has(Selected) ? 0 : player.has(Selected2) ? 1 : -1;
  const team = player.get(Team)!.id;
  player.destroy();
  if (slot >= 0) {
    let best: Entity | null = null;
    let bestD = Infinity;
    const bp = b?.rb.translation() ?? { x: 0, z: 0 };
    for (const e of world.query(IsPlayer)) {
      if (e.get(Team)!.id !== team || e.get(PlayerInfo)!.role === Role.GK) continue;
      const p = e.get(Position)!;
      const d = Math.hypot(p.x - bp.x, p.z - bp.z);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    setSelected(world, best, slot);
  }
}

/** Ceremony position for off-the-ball players; null = normal positioning. */
export function ceremonyTarget(
  world: World,
  e: Entity,
): { x: number; z: number } | null {
  const c = refState.ceremony;
  if (!c) return null;
  if (e === c.taker) {
    const s = attackSign(c.team);
    return { x: c.x - s * 0.8, z: c.z };
  }
  const teamId = e.get(Team)!.id;
  const p = e.get(Position)!;

  if (c.type === "penalty") {
    if (teamId !== c.team && e.get(PlayerInfo)!.role === Role.GK) {
      return { x: Math.sign(c.x) * (PITCH.halfLength - 0.5), z: 0 }; // on the line
    }
    // shoot-out: everyone already staged around the centre circle — hold there
    if (refState.shootout) {
      return { x: clamp(p.x, -16, 8), z: clamp(p.z, -16, 16) };
    }
    // everyone else outside the box — and clear of the behind-the-taker camera axis
    const edge = Math.sign(c.x) * (PITCH.halfLength - 20);
    let waitZ = clamp(p.z, -19, 19);
    if (Math.abs(waitZ) < 6) waitZ = waitZ >= 0 ? 6 : -6;
    return { x: edge, z: waitZ };
  }
  if (c.type === "kickoff") {
    // own half (teams were already placed by placeKickoff; hold position)
    const s = attackSign(teamId);
    return { x: Math.min(p.x * s, -1) * s, z: p.z };
  }
  // free kick near goal: both teams form up by the ball — a defensive wall
  // and the attackers crowding alongside it (two little groups), set to leap
  if (c.type === "freekick") {
    const gx = attackSign(c.team) * PITCH.halfLength; // goal the FK attacks
    const goalDist = Math.hypot(gx - c.x, c.z);
    const role = e.get(PlayerInfo)!.role;
    if (goalDist < 32 && role !== Role.GK) {
      const dirX = (gx - c.x) / goalDist;
      const dirZ = (0 - c.z) / goalDist;
      const perpX = -dirZ; // along the wall, square to the ball-goal line
      const perpZ = dirX;
      const idx = e.get(PlayerInfo)!.index;
      if (teamId !== c.team) {
        if (role === Role.DEF) {
          // the wall: four defenders shoulder to shoulder, on the line
          const slot = idx - 1 - 1.5; // idx 1..4 → -1.5,-0.5,0.5,1.5
          return {
            x: c.x + dirX * 9.15 + perpX * slot * 0.82,
            z: c.z + dirZ * 9.15 + perpZ * slot * 0.82,
          };
        }
        if (role === Role.MID && idx <= 6) {
          // two midfielders drop into the box to mark, wide of the wall
          const slot = idx === 5 ? -2.4 : 2.4;
          return {
            x: c.x + dirX * 13 + perpX * slot,
            z: c.z + dirZ * 13 + perpZ * slot,
          };
        }
        // their remaining mids/forwards stay up the pitch for a counter
      } else {
        if (role === Role.ATT) {
          // my forwards attack the box, wide either side, for the cross/rebound
          const slot = idx === 9 ? -2.6 : 2.6;
          return {
            x: c.x + dirX * 10.5 + perpX * slot,
            z: c.z + dirZ * 10.5 + perpZ * slot,
          };
        }
        if (role === Role.MID && idx <= 6) {
          // two midfielders join them, tighter in
          const slot = idx === 5 ? -1 : 1;
          return {
            x: c.x + dirX * 12 + perpX * slot,
            z: c.z + dirZ * 12 + perpZ * slot,
          };
        }
        return null; // my defenders hold for the counter
      }
    }
  }
  // corner: both teams crowd the box in front of the attacked goal, like a real
  // corner (the taker stays out at the flag, handled at the top of this fn)
  if (c.type === "corner") {
    const role = e.get(PlayerInfo)!.role;
    const gx = attackSign(c.team) * PITCH.halfLength; // goal under attack
    const sg = Math.sign(gx) || 1;
    if (role === Role.GK) {
      return teamId !== c.team
        ? { x: sg * (PITCH.halfLength - 0.6), z: 0 } // defending keeper on his line
        : { x: -sg * (PITCH.halfLength - 10), z: 0 }; // attacking keeper stays back
    }
    const idx = e.get(PlayerInfo)!.index;
    // pack everyone TIGHT into the six-yard box, like a real corner
    const depth = 2.5 + (idx % 3) * 2.3; // 2.5 / 4.8 / 7.1 m off the goal line
    const lane = ((idx * 2) % 7) - 3; // spread across the face of goal
    const zoff = teamId === c.team ? 0 : 1.3; // defenders offset to mark, not overlap
    return { x: gx - sg * depth, z: clamp(lane * 2.1 + zoff, -7.5, 7.5) };
  }
  // opponents otherwise retreat the regulation 9.15m from the ball
  if (teamId !== c.team) {
    const d = Math.hypot(p.x - c.x, p.z - c.z);
    if (d < 9.15) {
      const dd = d || 1;
      return {
        x: clamp(c.x + ((p.x - c.x) / dd) * 9.5, -52, 52),
        z: clamp(c.z + ((p.z - c.z) / dd) * 9.5, -34, 34),
      };
    }
  }
  return null;
}

function aiTakeSetPiece(world: World, c: Ceremony): void {
  const taker = c.taker;
  if (!taker || !taker.isAlive()) {
    refState.ceremony = null;
    return;
  }
  const s = attackSign(c.team);
  const gx = s * PITCH.halfLength;
  switch (c.type) {
    case "kickoff":
      pass(world, taker, -s, Math.random() > 0.5 ? 0.3 : -0.3, false);
      break;
    case "throwin": {
      const choice = evaluateBestPass(world, taker, s * 0.5, -Math.sign(c.z), false ? 0 : 0);
      if (choice) executePass(world, taker, { ...choice, high: false });
      else pass(world, taker, s * 0.7, -Math.sign(c.z) * 0.7, false);
      break;
    }
    case "corner":
      releaseBall(world, taker, {
        x: (gx - s * 8 - c.x) * 1.4 + (Math.random() - 0.5) * 2,
        y: 7.5,
        z: (0 - c.z) * 1.1 + (Math.random() - 0.5) * 4,
      });
      break;
    case "goalkick":
      releaseBall(world, taker, { x: s * 16, y: 8.5, z: (Math.random() - 0.5) * 10 });
      break;
    case "freekick": {
      const goalDist = Math.hypot(gx - c.x, c.z);
      if (goalDist < 27) shoot(world, taker, (Math.random() - 0.5) * 5);
      else {
        const choice = evaluateBestPass(world, taker, s, 0, 0);
        if (choice) executePass(world, taker, choice);
        else pass(world, taker, s, 0, true);
      }
      break;
    }
    case "penalty": {
      const side = Math.random() > 0.5 ? 1 : -1;
      let wide = Math.random() < 0.32; // ~a third he drags wide of the post
      // a shoot-out taker MUST miss at least one: force it by his third kick
      const so = refState.shootout;
      if (so) {
        so.takerKicks = (so.takerKicks ?? 0) + 1;
        if (!so.takerMissed && so.takerKicks >= 3) wide = true;
        if (wide) so.takerMissed = true;
      }
      const aim = side * (wide ? 4.4 + Math.random() * 1.6 : 2.2 + Math.random() * 0.9);
      shoot(world, taker, aim);
      break; // the keeper guesses in refereeOnKick, as the ball is struck
    }
  }
}

/**
 * On a penalty/shoot-out, the DEFENDING keeper (when it's an AI keeper — a human
 * dives his own) makes a genuine guess: he commits fully to a side, left OR
 * right at random, in a proper dive you can actually watch (not a blink-fast
 * flick). Pick the side he doesn't and you score.
 */
function penaltyDive(world: World, attackingTeam: number): void {
  const defending = 1 - attackingTeam;
  if (humanSlotFor(defending) !== null) return; // a human keeps this goal — he dives himself
  // the ball has just been struck, so its z direction is known: the keeper can
  // either guess (random side) or commit to a genuine save (dive at the ball)
  const b = ballOf(world);
  const vz = b ? b.rb.linvel().z : 0;
  const shotSide = Math.sign(vz) || (Math.random() < 0.5 ? -1 : 1);
  let save = Math.random() < 0.33; // a third of his kicks he reads right
  // a shoot-out keeper MUST pull off at least one save: if he hasn't by his
  // third kick faced, force the next one
  const so = refState.shootout;
  if (so) {
    so.keeperFaced = (so.keeperFaced ?? 0) + 1;
    if (!so.keeperSaved && so.keeperFaced >= 3) save = true;
    if (save) so.keeperSaved = true;
  }
  for (const e of world.query(IsPlayer)) {
    if (e.get(Team)!.id !== defending || e.get(PlayerInfo)!.role !== Role.GK) continue;
    if (e.has(KeeperDive)) continue;
    const side = save ? shotSide : Math.random() < 0.5 ? -1 : 1;
    e.add(KeeperDive);
    e.set(KeeperDive, { t: 0, side });
    const v = e.get(Velocity)!;
    // a SLOW, watchable dive that reaches the post over its flight instead of
    // fusing across the goal in a blink (the big catch radius makes the save)
    v.z = side * (save ? 2.6 : 2);
    v.x = 0;
  }
}

export function refereeSystem(world: World, dt: number): void {
  const store = useStore.getState();
  const match = world.queryFirst(Match);
  const b = ballOf(world);
  // NB: the match-reset below runs with only the Match entity — it does NOT
  // wait for the ball's physics body to attach. That way a chosen mode
  // (shoot-out, free kick…) is staged and the camera cuts to it on the very
  // FIRST frame, instead of briefly showing the kickoff while the ball spins up.
  if (!match) return;

  // Key the one-time setup off loadMatch's epoch, NOT the store's gen. On a
  // menu→play remount the old screen's last frame sees the new gen before
  // loadMatch has rebuilt the world; keying off gen there would stage the
  // about-to-be-destroyed entities (dead taker → no player, then it collapses
  // into open play). The epoch only bumps once loadMatch creates the new set.
  const epoch = (globalThis as { __gpfEpoch?: number }).__gpfEpoch ?? 0;
  if (epoch !== refState.epoch) {
    refState.epoch = epoch;
    refState.gen = store.gen;
    refState.clock = 0;
    refState.phase = 0;
    refState.ceremony = null;
    refState.advantage = null;
    refState.flagged.clear();
    refState.ended = false;
    refState.shootout = null;
    refState.nextChatter = 500;
    setTension(false);
    refState.firstKickoff = match.get(Match)!.lastTouchTeam;
    refState.practiceResetT = 0;
    store.setOffsideLine(null); // clear any leftover drill line
    store.setOffsidePlayer(null);
    store.setPhaseLabel(PHASE_LABEL[0]!);
    if (store.practice === 1) {
      // straight to a penalty shoot-out
      refState.phase = 4;
      store.setPhaseLabel("PENS");
      refState.shootout = {
        scores: [0, 0],
        taken: [0, 0],
        outcomes: [[], []],
        turn: 0,
        awaiting: 0,
      };
      store.setPensDetail([[], []]);
      banner("TIRS AU BUT", 3);
      radio("shootout");
      startShootoutKick(world);
    } else if (store.practice >= 2) {
      // set-piece practice: free kick / corner / penalty, on a loop
      store.setPhaseLabel("ENTR.");
      placePractice(world);
    } else {
      radio("kickoff", { team: refState.firstKickoff }); // opening whistle call
    }
  }

  if (refState.bannerT > 0) {
    refState.bannerT -= dt;
    if (refState.bannerT <= 0) store.setBanner("");
  }
  if (refState.ended) return;

  // goal celebration countdown → slow-mo replay (or straight to kickoff)
  if (store.mode === "goal") {
    const t = match.get(Match)!.resetTimer - dt;
    if (t <= 0) {
      if (startGoalReplay()) return; // cinematic airs, then runs the restart
      startGoalRestart(world, match.get(Match)!.pendingKickoffTeam);
      store.setMode("play");
    } else {
      match.set(Match, { resetTimer: t });
    }
    return;
  }

  if (!b) return; // everything below needs the ball's physics body
  const bp = b.rb.translation();

  // ---- ceremony staging ----
  const c = refState.ceremony;
  if (c) {
    if (!c.ready) {
      // dead ball until the whistle — held on the spot, detached from anyone
      b.rb.setTranslation({ x: c.x, y: PITCH.ballRadius, z: c.z }, true);
      b.rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      b.bs.owner = null;
      c.t -= dt;
      if (c.t <= 0) {
        c.ready = true;
        whistle(1);
        const playOn =
          c.type === "kickoff" || c.type === "throwin" || c.type === "goalkick";
        if (humanSlotFor(c.team) !== null && playOn) {
          // hand the taker the ball and play on. No countdown that dumps it
          // backward to a teammate and throws away a good attacking restart —
          // you keep it and dribble, pass or shoot from here as you wish.
          if (c.taker && c.taker.isAlive()) {
            b.bs.owner = c.taker;
            b.bs.lastKicker = null;
            b.bs.kickCooldown = 0;
          }
          refState.ceremony = null;
          banner("À TOI DE JOUER !", 1.5);
          return;
        }
        if (humanSlotFor(c.team) !== null) {
          // free kick / corner / penalty: a deliberate set-piece you AIM by
          // drawing a line (or with the buttons). 10s window before it auto-fires.
          c.kickDelay = 10;
          banner("TRACE UN TRAIT POUR TIRER", 2.5);
        } else {
          c.kickDelay = 0.6 + Math.random() * 0.6;
        }
      }
    } else {
      c.kickDelay -= dt;
      if (c.kickDelay <= 0) aiTakeSetPiece(world, c);
    }
    return; // clock pauses during restarts (close to the original's stop time)
  }

  // ---- shootout outcome tracking ----
  if (refState.shootout) {
    shootoutSystem(world, dt, bp);
    return;
  }

  // ---- set-piece practice loop (free kick / corner / penalty) ----
  if (useStore.getState().practice >= 2) {
    practiceSystem(world, dt, bp);
    return;
  }

  // ---- clock & phases ----
  refState.clock += dt * GAME_SPEED;
  const secs = Math.floor(refState.clock);
  if (secs !== store.clock) store.setClock(secs);

  // colour commentary between actions (~ every 20-35 real seconds)
  if (refState.clock >= refState.nextChatter) {
    refState.nextChatter = refState.clock + 600 + Math.random() * 450;
    radioScore(store.score, refState.clock / 60);
  }

  if (refState.clock >= PHASE_END[refState.phase]!) {
    endPhase(world, store.score);
    return;
  }

  // ---- advantage countdown ----
  const adv = refState.advantage;
  if (adv) {
    adv.until -= dt;
    const ownerTeam = b.bs.owner ? b.bs.owner.get(Team)!.id : -1;
    if (ownerTeam === adv.foulerTeam) {
      whistle(2);
      banner("FOUL — ADVANTAGE OVER");
      startSetPiece(world, "freekick", adv.victimTeam, clamp(adv.x, -52, 52), clamp(adv.z, -33, 33));
      refState.advantage = null;
      return;
    }
    if (adv.until <= 0) refState.advantage = null; // advantage played out
  }

  // ---- goals & out of play ----
  // a goal needs a FREE ball over the line — a ball glued to a carrier's feet
  // (the dribble model keeps it ~0.55m ahead) is owned, so you can't just walk
  // it into the OPPONENT's net (that needs a shot). The ONE exception: dribbling
  // it into your OWN net is still an own goal, and it counts.
  const R = PITCH.ballRadius;
  const lineX = PITCH.halfLength - R * 0.35;
  const owner = b.bs.owner;
  const inGoalMouth =
    Math.abs(bp.x) > lineX &&
    Math.abs(bp.z) < PITCH.goalHalfWidth &&
    bp.y < PITCH.goalHeight;
  // carrier walking it into the net on HIS OWN side = own goal for the others
  const ownGoalCarry =
    owner !== null &&
    inGoalMouth &&
    (attackSign(0) * Math.sign(bp.x) > 0 ? 0 : 1) !== owner.get(Team)!.id;
  if (ownGoalCarry) b.bs.lastKicker = owner; // credit the carrier (c.s.c.)
  const ballFree = owner === null;
  const crossedGoalLine = (ballFree && Math.abs(bp.x) > lineX) || ownGoalCarry;
  if (crossedGoalLine) {
    const side = Math.sign(bp.x);
    if (Math.abs(bp.z) < PITCH.goalHalfWidth && bp.y < PITCH.goalHeight) {
      const scorer = attackSign(0) * side > 0 ? 0 : 1;
      crowdRoar();
      store.addGoal(scorer);
      const newScore: [number, number] = [...store.score];
      newScore[scorer] += 1;
      // credit the last kicker — opposite team means an own goal
      const kicker = b.bs.lastKicker;
      const kNm = kicker?.isAlive() ? kicker.get(Name) : undefined;
      const kickerName = kNm?.short ?? ""; // banner (visual)
      const ownGoal = kicker?.isAlive() && kicker.get(Team)!.id !== scorer;
      const scorerName = ownGoal ? `${kickerName} (c.s.c.)` : kickerName;
      store.setBanner(scorerName ? `GOAL — ${scorerName}` : "");
      radio("goal", {
        team: scorer,
        score: newScore,
        player: ownGoal ? "" : (kNm?.spoken ?? ""), // radio (TTS): surname
      });
      b.bs.owner = null;
      // celebration runs in "goal" mode where movement (and its pose timers)
      // is paused — clear any dive/slide/trip so nobody freezes face-down on
      // the turf for the whole replay
      for (const e of world.query(IsPlayer)) {
        if (e.has(KeeperDive)) e.remove(KeeperDive);
        if (e.has(SlideTackle)) e.remove(SlideTackle);
        if (e.has(Tripped)) e.remove(Tripped);
      }
      queueGoalCinematic(kicker?.isAlive() ? kicker : null, scorer);
      match.set(Match, { resetTimer: 3.2, pendingKickoffTeam: 1 - scorer });
      return;
    }
    if (Math.abs(bp.x) > PITCH.halfLength + 0.4) {
      // a fast ball out just beside or above the frame: everyone thought goal
      const bvOut = b.rb.linvel();
      if (Math.hypot(bvOut.x, bvOut.y, bvOut.z) > 11 && Math.abs(bp.z) < 9) {
        radio("miss");
      }
      // ball out behind a goal: if the DEFENDING side knocked it out (a
      // clearance or deflection off your own man) it's a CORNER for the
      // attackers; if the attackers put it out, the keeper takes a goal kick.
      const defending = attackSign(0) * side > 0 ? 1 : 0;
      const lastTouch = match.get(Match)!.lastTouchTeam;
      if (lastTouch === defending) {
        // you knocked it behind your own line → corner for the OTHER team
        startSetPiece(world, "corner", 1 - defending, side * 54.5, Math.sign(bp.z) * 35.4);
      } else {
        startSetPiece(world, "goalkick", defending, side * PITCH.halfLength * 0.92, 0);
      }
      return;
    }
  }
  if (ballFree && Math.abs(bp.z) > PITCH.halfWidth + R) {
    const lastTouch = match.get(Match)!.lastTouchTeam;
    startSetPiece(
      world,
      "throwin",
      lastTouch === 0 ? 1 : 0,
      clamp(bp.x, -52, 52),
      Math.sign(bp.z) * 35.4,
    );
  }
}

function endPhase(world: World, score: [number, number]): void {
  const store = useStore.getState();
  whistle(3);
  const tied = score[0] === score[1];
  const phase = refState.phase;

  if (phase === 0 || phase === 2) {
    banner(phase === 0 ? "HALF TIME" : "ET — SECOND HALF", 3);
    if (phase === 0) radio("halftime", { score });
    refState.phase++;
    store.setPhaseLabel(PHASE_LABEL[refState.phase]!);
    swapSides();
    for (const e of world.query(IsPlayer)) {
      const st = e.get(Stats)!;
      e.set(Stats, { energy: Math.min(1, st.energy + 0.25) });
    }
    const team = 1 - refState.firstKickoff;
    placeKickoff(world, team);
    startSetPiece(world, "kickoff", team, 0, 0);
    return;
  }
  // extra time and penalties are for important matches only — a friendly
  // that is level after 90 minutes simply ends in a draw
  if (phase === 1 && tied && store.important) {
    banner("EXTRA TIME", 3);
    radio("extratime");
    refState.phase = 2;
    store.setPhaseLabel(PHASE_LABEL[2]!);
    const team = refState.firstKickoff;
    placeKickoff(world, team);
    startSetPiece(world, "kickoff", team, 0, 0);
    return;
  }
  if (phase === 3 && tied) {
    banner("PENALTY SHOOT-OUT", 3);
    radio("shootout");
    refState.phase = 4;
    store.setPhaseLabel(PHASE_LABEL[4]!);
    refState.shootout = {
      scores: [0, 0],
      taken: [0, 0],
      outcomes: [[], []],
      turn: 0,
      awaiting: 0,
    };
    store.setPensDetail([[], []]);
    startShootoutKick(world);
    return;
  }
  finishMatch(store, score, null);
}

function finishMatch(
  store: ReturnType<typeof useStore.getState>,
  score: [number, number],
  pens: [number, number] | null,
): void {
  const [a, bScore] = pens ?? score;
  const winner = a === bScore ? "DRAW" : a > bScore ? "RED WINS" : "BLU WINS";
  banner(
    pens
      ? `${winner} ${pens[0]}-${pens[1]} ON PENS`
      : `FULL TIME — ${winner} ${score[0]}-${score[1]}`,
    6,
  );
  radio("fulltime", { score: pens ?? score });
  setTension(false);
  refState.ended = true;
  setTimeout(() => useStore.getState().setMode("menu"), 5000);
}

function startShootoutKick(world: World): void {
  const so = refState.shootout!;
  const team = so.turn;
  // shooter's goal is always +x; point the sides that way
  if (attackSign(team) < 0) swapSides();
  startSetPiece(world, "penalty", team, 51, 0);
  const round = so.taken[team]!;
  // rotate takers through the outfield
  const candidates = world
    .query(IsPlayer)
    .filter((e) => e.get(Team)!.id === team && e.get(PlayerInfo)!.role !== Role.GK);
  const taker = candidates[round % Math.max(candidates.length, 1)] ?? null;
  if (refState.ceremony && taker) {
    refState.ceremony.taker = taker;
    const slot = humanSlotFor(team);
    if (slot !== null) setSelected(world, taker, slot);
    radio("penTaker", { player: taker.get(Name)?.spoken ?? "" });
  }

  // stage the scene: ceremonies are too short to run across the pitch, so
  // place everyone — defending keeper ON his line, taker at the spot, the
  // rest grouped around the centre circle like a real shoot-out
  for (const e of world.query(IsPlayer)) {
    const p = e.get(Position)!;
    const v = e.get(Velocity)!;
    v.set(0, 0, 0);
    if (e === taker) {
      p.set(50.2, 0, 0); // right at the spot, almost on the keeper
      e.set(Heading, { angle: Math.PI / 2 }); // facing the goal (+x)
    } else if (e.get(Team)!.id !== team && e.get(PlayerInfo)!.role === Role.GK) {
      p.set(PITCH.halfLength - 0.7, 0, 0);
      e.set(Heading, { angle: -Math.PI / 2 }); // on the line, facing the taker
    } else if (p.x > 10 || Math.abs(p.z) > 22) {
      p.set(-4 - Math.random() * 10, 0, (Math.random() - 0.5) * 26);
      e.set(Heading, { angle: Math.PI / 2 });
    }
  }
  setTension(true); // hush the crowd, heartbeat in
}

function shootoutSystem(
  world: World,
  dt: number,
  bp: { x: number; y: number; z: number },
): void {
  const so = refState.shootout!;
  const store = useStore.getState();
  if (so.awaiting <= 0) return;
  so.awaiting -= dt;

  const goal =
    bp.x > PITCH.halfLength + PITCH.ballRadius &&
    Math.abs(bp.z) < PITCH.goalHalfWidth &&
    bp.y < PITCH.goalHeight;
  // a miss is over the instant the ball settles — no waiting around for a
  // rebound, and the kick is dead so nobody can knock it back in
  const bb = ballOf(world);
  const bv = bb ? bb.rb.linvel() : { x: 0, y: 0, z: 0 };
  const stopped =
    so.awaiting < 3.2 && Math.hypot(bv.x, bv.y, bv.z) < 1.2 && !goal;
  const dead =
    so.awaiting <= 0 ||
    stopped ||
    Math.abs(bp.x) > PITCH.halfLength + 0.5 ||
    Math.hypot(bp.x - 55, bp.z) > 30;

  if (!goal && !dead) return;
  if (goal) {
    crowdRoar();
    so.scores[so.turn] += 1;
    banner("GOAL!");
    radio("penGoal");
  } else {
    banner("MISSED!");
    radio("penMiss");
  }
  so.taken[so.turn] += 1;
  so.outcomes[so.turn]!.push(goal ? "g" : "m");
  store.setPens([...so.scores]);
  store.setPensDetail([[...so.outcomes[0]!], [...so.outcomes[1]!]]);

  // decided? best of 5, then sudden death
  const [s0, s1] = so.scores;
  const [t0, t1] = so.taken;
  const remaining0 = Math.max(0, 5 - t0);
  const remaining1 = Math.max(0, 5 - t1);
  const decided =
    (t0 >= 5 && t1 >= 5 && t0 === t1 && s0 !== s1) ||
    s0 > s1 + remaining1 ||
    s1 > s0 + remaining0;
  if (decided) {
    finishMatch(store, store.score, [s0, s1]);
    return;
  }
  so.turn = 1 - so.turn;
  so.awaiting = 0;
  startShootoutKick(world);
}

/** Stage the chosen set-piece practice scenario for the human team (team 0). */
function placePractice(world: World): void {
  const practice = useStore.getState().practice;
  const s = attackSign(0); // the human team attacks +x
  if (practice === 2) {
    // a dangerous free kick ~18-23m out: sometimes flat and central, sometimes
    // off to one side at an angle (with a proper wall, like a real one)
    const side = Math.random() < 0.5 ? -1 : 1;
    const z = Math.random() < 0.35 ? (Math.random() - 0.5) * 6 : side * (6 + Math.random() * 6);
    startSetPiece(world, "freekick", 0, s * (PITCH.halfLength - (18 + Math.random() * 5)), z);
  } else if (practice === 3) {
    // a corner, alternating flags
    startSetPiece(world, "corner", 0, s * 54.5, (Math.random() < 0.5 ? 1 : -1) * 35.4);
  } else if (practice === 4) {
    // a penalty
    startSetPiece(world, "penalty", 0, s * 51, 0);
  } else {
    stageOffsideDrill(world);
  }
}

/**
 * Offside drill: you spawn BEYOND a flat (frozen) defensive line — offside. The
 * yellow line is drawn so you can see it; you have a few seconds to steer back
 * onside. Loiter offside too long and you're flagged (cutaway), then it resets.
 */
function stageOffsideDrill(world: World): void {
  const s = attackSign(0); // the human team (0) attacks +x
  const lineX = s * (18 + Math.random() * 8); // the back line, 18..26m out
  const startX = lineX + s * (2 + Math.random() * 2); // you, 2..4m past it (offside)
  let runner: Entity | null = null;
  let di = 0;
  for (const e of world.query(IsPlayer)) {
    const team = e.get(Team)!.id;
    const role = e.get(PlayerInfo)!.role;
    const p = e.get(Position)!;
    e.get(Velocity)!.set(0, 0, 0);
    if (team === 1) {
      if (role === Role.GK) p.set(s * (PITCH.halfLength - 0.7), 0, 0);
      else if (role === Role.DEF) {
        p.set(lineX, 0, (di++ - 1.5) * 8); // flat back four = the offside line
        e.set(Heading, { angle: Math.atan2(-s, 0) });
      } else p.set(-s * 8, 0, ((e.get(PlayerInfo)!.index % 5) - 2) * 7); // out of the way
    } else {
      if (role === Role.GK) p.set(-s * (PITCH.halfLength - 6), 0, 0);
      else if (role === Role.ATT && !runner) {
        runner = e; // the man you steer — placed OFFSIDE
        p.set(startX, 0, 0);
        e.set(Heading, { angle: Math.atan2(-s, 0) }); // facing back, ready to drop
      } else p.set(-s * 6, 0, ((e.get(PlayerInfo)!.index % 5) - 2) * 8);
    }
  }
  const b = ballOf(world);
  if (b) {
    // keep the ball with YOU (not at the centre circle) so the scene reads clearly
    b.rb.setTranslation({ x: startX, y: PITCH.ballRadius, z: 0 }, true);
    b.rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    b.bs.owner = null;
  }
  const slot = humanSlotFor(0);
  if (slot !== null && runner) setSelected(world, runner, slot);
  refState.ceremony = null;
  refState.flagged.clear();
  refState.drillOffT = 0;
  refState.drillSafeT = 0;
  useStore.getState().setOffsideLine(lineX); // show the line to stay behind
  useStore.getState().setOffsidePlayer(null);
}

/** Per-frame offside drill: a grace window to drop onside, else you're flagged. */
function offsideDrillTick(world: World, dt: number): void {
  const sel = world.queryFirst(Selected);
  if (!sel) return;
  const s = attackSign(0);
  // offside line = second-deepest defender (team 1)
  let deepest = -Infinity;
  let second = -Infinity;
  for (const e of world.query(IsPlayer)) {
    if (e.get(Team)!.id !== 1) continue;
    const d = e.get(Position)!.x * s;
    if (d > deepest) {
      second = deepest;
      deepest = d;
    } else if (d > second) second = d;
  }
  const line = second;
  useStore.getState().setOffsideLine(line * s); // keep the line drawn while you play
  const hp = sel.get(Position)!;
  const offside = hp.x * s > line && hp.x * s > 0;
  if (offside) {
    banner("⚠ HORS-JEU — RECULE", 0.4); // live status
    refState.drillSafeT = 0;
    refState.drillOffT += dt;
    // you get ~2.5s to get back onside; loiter offside longer and you're flagged
    if (refState.drillOffT >= 2.5) {
      refState.drillOffT = 0;
      banner("HORS-JEU !", 4);
      queueOffsideCinematic(world, sel, line * s, 1, clamp(hp.x, -52, 52), clamp(hp.z, -33, 33), false);
    }
  } else {
    banner("✓ ONSIDE — BIEN !", 0.4); // live status
    refState.drillOffT = 0;
    refState.drillSafeT += dt;
    if (refState.drillSafeT >= 2.0) {
      // you got back onside in time — well done, line up the next rep
      refState.drillSafeT = 0;
      refState.practiceResetT = 0.01;
    }
  }
}

/** A drill offside resets the scenario instead of awarding a free kick. */
export function practiceOffsideReset(): void {
  refState.practiceResetT = 1.2;
  banner("HORS-JEU !", 1.5);
}

/** Set-piece practice loop: take an attempt, then re-stage it. */
function practiceSystem(
  world: World,
  dt: number,
  bp: { x: number; y: number; z: number },
): void {
  const store = useStore.getState();
  if (refState.practiceResetT > 0) {
    refState.practiceResetT -= dt;
    if (refState.practiceResetT <= 0) {
      store.setBanner("");
      placePractice(world);
    }
    return;
  }
  if (store.practice === 5) {
    offsideDrillTick(world, dt);
    return;
  }
  const b = ballOf(world);
  if (!b) return;
  const free = b.bs.owner === null;
  const bv = b.rb.linvel();
  const speed = Math.hypot(bv.x, bv.y, bv.z);
  const lineX = PITCH.halfLength - PITCH.ballRadius * 0.35;
  const goalSide = attackSign(0);
  const isGoal =
    free &&
    Math.sign(bp.x) === goalSide &&
    Math.abs(bp.x) > lineX &&
    Math.abs(bp.z) < PITCH.goalHalfWidth &&
    bp.y < PITCH.goalHeight;
  const out =
    Math.abs(bp.x) > PITCH.halfLength + 0.6 ||
    Math.abs(bp.z) > PITCH.halfWidth + 0.6;
  const gathered = b.bs.owner !== null && b.bs.owner.get(Team)!.id !== 0;
  const idleFree = free && speed < 1.2 && Math.abs(bp.x) < PITCH.halfLength;

  if (isGoal) {
    crowdRoar();
    radio("penGoal");
    store.addGoalQuiet(0);
    banner("BUT !", 1.4);
    b.bs.owner = null;
    refState.practiceResetT = 1.6;
  } else if (gathered || out || idleFree) {
    banner(gathered ? "ARRÊT !" : "RATÉ !", 1.2);
    refState.practiceResetT = 1.4;
  }
}
