import type { Entity, World } from "koota";
import {
  BallRef,
  BallState,
  Heading,
  IsBall,
  IsPlayer,
  Match,
  Name,
  PlayerInfo,
  Position,
  Role,
  Selected,
  Selected2,
  Stats,
  Team,
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
  clock: 0,
  phase: 0,
  firstKickoff: 0,
  ceremony: null as Ceremony | null,
  advantage: null as PendingFoul | null,
  flagged: new Map<Entity, { x: number; z: number }>(),
  flaggedTeam: -1,
  bannerT: 0,
  ended: false,
  /** game-clock time of the next radio score reminder */
  nextChatter: 500,
  shootout: null as {
    scores: [number, number];
    taken: [number, number];
    outcomes: [string[], string[]]; // "g" / "m" per kick, for the HUD board
    turn: number;
    awaiting: number; // >0: outcome timer after a kick
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
  const b = ballOf(world);
  if (!b) return;
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
  for (const e of world.query(IsPlayer)) {
    if (e === kicker || e.get(Team)!.id !== team) continue;
    const p = e.get(Position)!;
    // 0.2 relaxation zone toward the attacker, like the original
    if (p.x * s > line + 0.2 && p.x * s > 0) {
      refState.flagged.set(e, { x: p.x, z: p.z });
    }
  }
}

/** Called by possession when a flagged player takes the ball. */
export function refereeOffside(world: World, player: Entity): boolean {
  const spot = refState.flagged.get(player);
  if (!spot || refState.flaggedTeam !== player.get(Team)!.id) return false;
  whistle(2);
  banner("OFFSIDE");
  radio("offside");
  startSetPiece(
    world,
    "freekick",
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
  const foulType = severity <= 1.4 ? 1 : severity <= 2.0 ? 2 : 3;

  const defGoalX = -attackSign(foulerTeam) * PITCH.halfLength;
  const penalty =
    Math.abs(fp.z) < 20.15 &&
    Math.abs(fp.x - defGoalX) < 16.5 &&
    Math.sign(fp.x) === Math.sign(defGoalX);

  const award = (): void => {
    whistle(2);
    if (penalty) {
      banner("PENALTY!", 3);
      radio("penalty");
      startSetPiece(world, "penalty", victimTeam, Math.sign(defGoalX) * 44, 0);
    } else {
      banner("FOUL");
      radio("foul");
      startSetPiece(world, "freekick", victimTeam, clamp(fp.x, -52, 52), clamp(fp.z, -33, 33));
    }
  };

  // a booking always stops play: card close-up + tackle replay, no advantage.
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
  // advantage: play on up to 3s while the victim's team keeps the ball
  refState.advantage = {
    foulerTeam,
    victimTeam,
    x: fp.x,
    z: fp.z,
    until: 3,
    penalty: false,
  };
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
  // free kicks / corners / throw-ins: opponents retreat 9.15m; wall for close FKs
  if (teamId !== c.team) {
    const d = Math.hypot(p.x - c.x, p.z - c.z);
    if (c.type === "freekick") {
      const goalX = -attackSign(c.team) * -PITCH.halfLength; // goal the FK attacks
      const gx = attackSign(c.team) * PITCH.halfLength;
      const goalDist = Math.hypot(gx - c.x, c.z);
      if (goalDist < 30) {
        // two nearest defenders form a wall on the ball-goal line at 9.15m
        void goalX;
        const dirX = (gx - c.x) / goalDist;
        const dirZ = (0 - c.z) / goalDist;
        const idx = e.get(PlayerInfo)!.index % 2 === 0 ? 0.5 : -0.5;
        if (d < 12 && e.get(PlayerInfo)!.role !== Role.GK) {
          return { x: c.x + dirX * 9.15 - dirZ * idx, z: c.z + dirZ * 9.15 + dirX * idx };
        }
      }
    }
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
      shoot(world, taker, (Math.random() > 0.5 ? 1 : -1) * (2.2 + Math.random() * 0.9));
      penaltyDive(world, c.team);
      break;
    }
  }
}

function penaltyDive(world: World, attackingTeam: number): void {
  for (const e of world.query(IsPlayer)) {
    if (e.get(Team)!.id === attackingTeam || e.get(PlayerInfo)!.role !== Role.GK)
      continue;
    const v = e.get(Velocity)!;
    v.z = (Math.random() > 0.5 ? 1 : -1) * 7;
    v.x = 0;
  }
}

export function refereeSystem(world: World, dt: number): void {
  const store = useStore.getState();
  const match = world.queryFirst(Match);
  const b = ballOf(world);
  if (!match || !b) return;

  if (store.gen !== refState.gen) {
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
    store.setPhaseLabel(PHASE_LABEL[0]!);
    radio("kickoff", { team: refState.firstKickoff }); // opening whistle call
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

  const bp = b.rb.translation();

  // ---- ceremony staging ----
  const c = refState.ceremony;
  if (c) {
    if (!c.ready) {
      // dead ball until the whistle
      b.rb.setTranslation({ x: c.x, y: PITCH.ballRadius, z: c.z }, true);
      b.rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      c.t -= dt;
      if (c.t <= 0) {
        c.ready = true;
        whistle(1);
        // a human gets a comfortable window to take their own kicks — long
        // enough to aim, short enough that the frozen-pitch wait never drags
        // (the auto-take remains a stall safety, not a thief)
        if (humanSlotFor(c.team) !== null) {
          c.kickDelay = refState.shootout ? 10 : 8;
          banner("À TOI DE JOUER !", 2.5);
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

  // ---- goals ----
  const R = PITCH.ballRadius;
  const crossedGoalLine = Math.abs(bp.x) > PITCH.halfLength - R * 0.35;
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
      const defending = attackSign(0) * side > 0 ? 1 : 0;
      const lastTouch = match.get(Match)!.lastTouchTeam;
      if (lastTouch === defending) {
        startSetPiece(world, "corner", 1 - defending, side * 53.5, Math.sign(bp.z) * 34);
      } else {
        startSetPiece(world, "goalkick", defending, side * PITCH.halfLength * 0.92, 0);
      }
      return;
    }
  }
  if (Math.abs(bp.z) > PITCH.halfWidth + R) {
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
  startSetPiece(world, "penalty", team, 44, 0);
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
      p.set(41.5, 0, 0);
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
  const dead =
    so.awaiting <= 0 ||
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
