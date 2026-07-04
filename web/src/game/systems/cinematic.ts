import * as THREE from "three";
import type { Entity, World } from "koota";
import {
  BallRef,
  Heading,
  IsBall,
  IsPlayer,
  IsReferee,
  Match,
  MeshRef,
  Position,
  Team,
  Velocity,
} from "../traits";
import { useStore } from "../store";
import { PITCH } from "../levels";
import { animateRig, playActionClip, stopActionClip } from "./movement";
import type { RigHolder } from "./movement";
// circular with referee.ts is safe: bindings are only touched inside functions
import {
  executeSendOff,
  practiceOffsideReset,
  startGoalRestart,
  startSetPiece,
} from "./referee";

/**
 * Broadcast cinematics: a rolling recorder of the last ~4s of play feeds
 * slow-motion replays of goals and bookings; the scorer applauds in close-up
 * and the on-pitch referee raises the actual card to the lens.
 */

interface PlayerSnap {
  e: Entity;
  x: number;
  z: number;
  heading: number;
  speed: number;
}
interface Frame {
  ball: { x: number; y: number; z: number };
  players: PlayerSnap[];
}

const RECORD_HZ = 30; // fixed-timestep recorder, framerate-independent
const RING_FRAMES = 250; // ~8s of footage at 30Hz
const GOAL_REPLAY_FRAMES = 85; // ~2.8s before the ball crossed the line
const CARD_REPLAY_FRAMES = 75; // ~2.5s before the whistle
const MIN_REPLAY_FRAMES = 12;
const REPLAY_SPEED = 0.5; // slow motion
const CARD_SECONDS = 4.0;

export const cineState = {
  ring: [] as Frame[],
  celebration: null as {
    scorer: Entity;
    t: number;
    /** which signature celebration the scorer performs (varies per goal) */
    clip: string;
    /** the corner flag he sprints off to before celebrating */
    tx: number;
    tz: number;
    /** true once he has reached the corner and switched to his signature move */
    arrived: boolean;
    /** teammates sprinting in to congratulate him */
    mates: Array<{ e: Entity; ox: number; oz: number; arrived: boolean }>;
  } | null,
  card: null as { red: boolean; t: number } | null,
  replay: null as { frames: Frame[]; i: number; after: "kickoff" | "resume" } | null,
  queued: null as Frame[] | null,
  sendOffScene: null as {
    player: Entity;
    t: number;
    exitZ: number;
  } | null,
  /** red-carded player whose send-off waits until the replay has aired */
  sendOffAfter: null as Entity | null,
  /** offside call: slow-mo of the lead-up with the line drawn, then the kick */
  offside: null as {
    player: Entity;
    lineX: number;
    team: number;
    x: number;
    z: number;
    t: number;
    frames: Frame[];
    i: number;
  } | null,
  gen: -1,
};

const OFFSIDE_SECONDS = 3.2; // static hold on the lines (drill, or no footage)
const OFFSIDE_REPLAY_FRAMES = 65; // ~2.2s of lead-up before the flag
const OFFSIDE_HOLD = 1.3; // beat held on the offside moment after the replay

function resetCine(gen: number): void {
  cineState.gen = gen;
  cineState.ring = [];
  cineState.celebration = null;
  cineState.card = null;
  cineState.replay = null;
  cineState.queued = null;
  cineState.sendOffScene = null;
  cineState.sendOffAfter = null;
  cineState.offside = null;
}

let recordAcc = 0;

/** Call every frame of live play; samples at a fixed 30Hz. */
export function recordFrame(world: World, dt: number): void {
  // sync here (every play frame) — cinematicSystem only runs once a scene is
  // already queued, which would wipe the very first queue of a new match
  const gen = useStore.getState().gen;
  if (gen !== cineState.gen) resetCine(gen);
  recordAcc += dt;
  if (recordAcc < 1 / RECORD_HZ) return;
  recordAcc %= 1 / RECORD_HZ;
  const rb = world.queryFirst(IsBall)?.get(BallRef)?.value;
  if (!rb) return;
  const bp = rb.translation();
  const players: PlayerSnap[] = [];
  for (const e of world.query(IsPlayer)) {
    const p = e.get(Position)!;
    const v = e.get(Velocity)!;
    players.push({
      e,
      x: p.x,
      z: p.z,
      heading: e.get(Heading)!.angle,
      speed: Math.hypot(v.x, v.z),
    });
  }
  cineState.ring.push({ ball: { x: bp.x, y: bp.y, z: bp.z }, players });
  if (cineState.ring.length > RING_FRAMES) cineState.ring.shift();
}

/** Release the scorer's AND the congratulators' one-shot clips back to idle. */
function releaseCelebration(fade: number): void {
  const cel = cineState.celebration;
  if (!cel) return;
  if (cel.scorer.isAlive()) {
    const ch = cel.scorer.get(MeshRef);
    if (ch) stopActionClip(ch, fade);
  }
  for (const mate of cel.mates) {
    if (!mate.e.isAlive()) continue;
    const mh = mate.e.get(MeshRef);
    if (mh) stopActionClip(mh, fade);
  }
}

// the scorer's repertoire of signature poses — open-arms shrug, kisses to the
// crowd, kneel, standing crossed arms. A different one each goal (no immediate
// repeats). NOTE: only clips that actually exist in anims.json belong here — a
// missing name makes playActionClip early-return and the scorer just stands
// there doing nothing.
const CELE_POOL = ["cele_open", "cele_kiss", "cele_kneel", "cele_cross"];
let lastCele = "";

/** Goal scored: stage the celebration close-up + the slow-mo of the shot. */
export function queueGoalCinematic(
  world: World,
  scorer: Entity | null,
  scoringTeam: number,
): void {
  // a deflection can leave lastKicker on the wrong side (or null) — the GOAL
  // still deserves its party. Celebrate through the scoring team's nearest
  // outfielder to the ball instead of silently skipping the whole scene.
  // (An own goal thus celebrates via the team that BENEFITS — correct.)
  if (!scorer || !scorer.isAlive() || scorer.get(Team)!.id !== scoringTeam) {
    const bp = world.queryFirst(IsBall)?.get(BallRef)?.value?.translation();
    let best: Entity | null = null;
    let bd = Infinity;
    for (const e of world.query(IsPlayer)) {
      if (e.get(Team)!.id !== scoringTeam || !e.get(MeshRef)?.value) continue;
      const p = e.get(Position)!;
      const d = bp ? Math.hypot(p.x - bp.x, p.z - bp.z) : Math.abs(p.x);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    scorer = best;
  }
  if (scorer && scorer.isAlive()) {
    const options = CELE_POOL.filter((c) => c !== lastCele);
    const clip = options[Math.floor(Math.random() * options.length)]!;
    lastCele = clip;
    // the scorer wheels away and SPRINTS to the corner flag before dropping
    // into his signature move — like the real thing. The corner is at the end
    // he scored in (he's already near it) and the nearest touchline; kept a few
    // metres inside the lines so the party never spills off the pitch or into
    // the net. The run itself carries him out of the goal.
    const sp = scorer.get(Position)!;
    const tx = (Math.sign(sp.x) || 1) * (PITCH.halfLength - 4);
    const tz = (Math.sign(sp.z) || 1) * (PITCH.halfWidth - 3);
    // the two-three nearest teammates sprint in to mob the scorer
    const mates = world
      .query(IsPlayer)
      .filter(
        (e) =>
          e !== scorer &&
          e.get(Team)!.id === scoringTeam &&
          e.get(MeshRef)?.value &&
          Math.hypot(e.get(Position)!.x - sp.x, e.get(Position)!.z - sp.z) < 45,
      )
      .sort(
        (a, b) =>
          Math.hypot(a.get(Position)!.x - sp.x, a.get(Position)!.z - sp.z) -
          Math.hypot(b.get(Position)!.x - sp.x, b.get(Position)!.z - sp.z),
      )
      .slice(0, 3)
      // arrival slots around the scorer, biased BEHIND him (the camera sits
      // on +z looking at his face — the mob must not block the close-up)
      .map((e, i) => ({
        e,
        ox: [-0.9, 0.9, -0.2][i]!,
        oz: [-0.7, -0.7, -1.1][i]!,
        arrived: false,
      }));
    cineState.celebration = { scorer, t: 0, clip, tx, tz, arrived: false, mates };
  } else {
    cineState.celebration = null;
  }
  cineState.queued = cineState.ring.slice(-GOAL_REPLAY_FRAMES);
}

/**
 * A booking: freeze play on the referee raising the card, then air the slow-mo
 * of the tackle. For reds the send-off itself waits until the replay ends.
 */
export function queueCardCinematic(red: boolean, sendOff: Entity | null): void {
  if (cineState.card || cineState.replay || cineState.sendOffScene) return;
  cineState.card = { red, t: 0 };
  cineState.sendOffAfter = sendOff;
  cineState.queued = cineState.ring.slice(-CARD_REPLAY_FRAMES);
  useStore.getState().setMode("cardScene");
}

/**
 * Offside flagged: freeze on a close-up of the offending player with the line
 * drawn across the pitch, then take the free kick once the scene has aired.
 */
export function queueOffsideCinematic(
  world: World,
  player: Entity,
  lineX: number,
  team: number,
  x: number,
  z: number,
  replay = true,
): void {
  if (cineState.offside || cineState.replay || cineState.card) return;
  const rb = world.queryFirst(IsBall)?.get(BallRef)?.value;
  if (rb) rb.setLinvel({ x: 0, y: 0, z: 0 }, true); // hold the scene still
  cineState.offside = {
    player,
    lineX,
    team,
    x,
    z,
    t: 0,
    // a match replays the lead-up; the drill just freezes clearly on the lines
    frames: replay ? cineState.ring.slice(-OFFSIDE_REPLAY_FRAMES) : [],
    i: 0,
  };
  useStore.getState().setOffsideLine(lineX);
  useStore.getState().setOffsidePlayer(player.get(Position)?.x ?? x);
  useStore.getState().setMode("offside");
}

function finishOffside(world: World): void {
  const off = cineState.offside;
  cineState.offside = null;
  const store = useStore.getState();
  store.setOffsideLine(null);
  store.setOffsidePlayer(null);
  store.setBanner("");
  if (off) {
    // in a drill, an offside just resets the scene; in a match it's a free kick
    if (store.practice >= 2) practiceOffsideReset();
    else startSetPiece(world, "freekick", off.team, off.x, off.z);
  }
  store.setMode("play");
}

/**
 * Skip the running goal/booking cinematic (celebration, card raise, slow-mo
 * replay or send-off) and resume play right away. A goal sequence jumps to the
 * kickoff restart; a booking resumes the free kick/penalty already staged.
 */
export function skipCinematic(world: World): void {
  const store = useStore.getState();
  const mode = store.mode;
  if (mode === "offside") {
    finishOffside(world);
    return;
  }
  if (mode !== "goal" && mode !== "replay" && mode !== "cardScene") return;

  // goal mode and goal-replays restart from the spot; bookings just resume the
  // set piece that refereeFoul already staged when it blew up.
  const goalSeq = mode === "goal" || cineState.replay?.after === "kickoff";
  const pendingOff = cineState.sendOffScene?.player ?? cineState.sendOffAfter;

  // release any situation clip mid-flight (celebration, card raise)
  releaseCelebration(0.1);
  cineState.celebration = null;
  cineState.card = null;
  cineState.replay = null;
  cineState.queued = null;
  cineState.sendOffScene = null;
  cineState.sendOffAfter = null;
  // hide a raised card if we skipped mid-raise
  const ref = world.queryFirst(IsReferee)?.get(MeshRef);
  if (ref) {
    stopActionClip(ref, 0.1);
    const mesh = cardProps.get(ref);
    if (mesh) mesh.visible = false;
  }
  store.setBanner("");

  if (pendingOff && pendingOff.isAlive()) executeSendOff(world, pendingOff);
  if (goalSeq) {
    const team = world.queryFirst(Match)?.get(Match)!.pendingKickoffTeam ?? 0;
    startGoalRestart(world, team);
  }
  store.setMode("play");
}

/** Goal celebration over: hand off to the replay. True if it took over. */
export function startGoalReplay(): boolean {
  releaseCelebration(0.15);
  cineState.celebration = null;
  if (!cineState.queued || cineState.queued.length < MIN_REPLAY_FRAMES) return false;
  cineState.replay = { frames: cineState.queued, i: 0, after: "kickoff" };
  cineState.queued = null;
  useStore.getState().setMode("replay");
  useStore.getState().setBanner("REPLAY");
  return true;
}

const cardProps = new WeakMap<object, THREE.Mesh>();

function cardMesh(h: RigHolder, bones: Record<string, THREE.Bone>): THREE.Mesh {
  let mesh = cardProps.get(h);
  if (!mesh) {
    mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.07, 0.1), // hand-sized — a card, not a billboard
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    );
    // gripped at the END of the forearm: the elbow's children (the forearm
    // geometry) extend ~0.33m along local -z to the hand, so the card rides
    // the hand through the WHOLE showcard anim — raise, hold and lower
    mesh.position.set(0, 0.02, -0.36);
    mesh.rotation.x = Math.PI / 2;
    bones.right_elbow?.add(mesh);
    cardProps.set(h, mesh);
  }
  return mesh;
}

function faceCamera(group: THREE.Group, dt: number): void {
  // the broadcast camera sits on +z: turn the actor toward the lens
  const k = Math.min(1, dt * 2.2);
  group.rotation.set(0, group.rotation.y + (0 - group.rotation.y) * k, 0);
}

export function cinematicSystem(world: World, dt: number): void {
  const store = useStore.getState();
  if (store.gen !== cineState.gen) resetCine(store.gen);

  // ---- offside: replay the lead-up in slow-mo with the line drawn, showing
  // exactly how it was offside, then take the free kick ----
  const off = cineState.offside;
  if (store.mode === "offside" && off) {
    if (off.frames.length >= MIN_REPLAY_FRAMES) {
      off.i += dt * RECORD_HZ * REPLAY_SPEED;
      const fr = off.frames[Math.min(Math.floor(off.i), off.frames.length - 1)]!;
      const rb = world.queryFirst(IsBall)?.get(BallRef)?.value;
      if (rb) {
        rb.setTranslation(fr.ball, true);
        rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
      for (const ps of fr.players) {
        if (!ps.e.isAlive()) continue;
        ps.e.get(Position)?.set(ps.x, 0, ps.z); // so the camera tracks the run
        const h = ps.e.get(MeshRef);
        if (!h?.value) continue;
        h.value.position.set(ps.x, 0, ps.z);
        h.value.rotation.set(0, ps.heading, 0);
        animateRig(h, ps.speed, 0, dt);
      }
      if (off.i >= off.frames.length - 1) {
        off.t += dt; // hold a beat on the offside moment
        if (off.t >= OFFSIDE_HOLD) finishOffside(world);
      }
    } else {
      off.t += dt; // no footage to replay (fresh play): just hold on the line
      if (off.t >= OFFSIDE_SECONDS) finishOffside(world);
    }
    return;
  }

  // ---- red card send-off: show the player leaving the pitch ----
  const sendOff = cineState.sendOffScene;
  if (store.mode === "cardScene" && sendOff) {
    if (!sendOff.player.isAlive()) {
      cineState.sendOffScene = null;
      store.setMode("play");
      return;
    }
    sendOff.t += dt;
    const p = sendOff.player.get(Position)!;
    const v = sendOff.player.get(Velocity)!;
    const tx = p.x;
    const tz = sendOff.exitZ;
    const dx = tx - p.x;
    const dz = tz - p.z;
    const dist = Math.hypot(dx, dz) || 1;
    const step = Math.min(dist, 4.4 * dt);
    p.x += (dx / dist) * step;
    p.z += (dz / dist) * step;
    v.set((dx / dist) * 4.4, 0, (dz / dist) * 4.4);
    sendOff.player.set(Heading, { angle: Math.atan2(dx, dz) });

    const h = sendOff.player.get(MeshRef);
    if (h?.value) {
      h.value.position.set(p.x, 0, p.z);
      h.value.rotation.set(0, sendOff.player.get(Heading)!.angle, 0);
      animateRig(h, 4.2, 0, dt);
    }

    if (dist < 0.2 || sendOff.t > 5.5) {
      executeSendOff(world, sendOff.player);
      cineState.sendOffScene = null;
      store.setBanner("");
      store.setMode("play");
    }
    return;
  }

  // ---- goal celebration: the scorer's signature move in close-up while
  // two-three teammates sprint in to mob him ----
  const cel = cineState.celebration;
  if (store.mode === "goal" && cel) {
    if (!cel.scorer.isAlive()) {
      cineState.celebration = null;
      return;
    }
    cel.t += dt;
    const h = cel.scorer.get(MeshRef)!;
    if (h.value) {
      if (!cel.arrived) {
        // wheel away and SPRINT to the corner flag first
        const dx = cel.tx - h.value.position.x;
        const dz = cel.tz - h.value.position.z;
        const dist = Math.hypot(dx, dz);
        // reached it, or the run has eaten enough of the scene — start the party
        if (dist <= 0.5 || cel.t > 3.2) {
          cel.arrived = true;
          // SNAP to face the lens the instant he stops. Running to the far
          // corner left him facing ~180° away, and faceCamera's slow ease then
          // burned the whole celebration turning around — so the signature move
          // only ever read when he'd run to the near corner. Snapping fixes the
          // "he only does it on one side" bug: front-on at every corner.
          h.value.rotation.set(0, 0, 0);
        } else {
          const step = Math.min(dist, 10 * dt); // full-tilt celebration sprint
          h.value.position.x += (dx / dist) * step;
          h.value.position.z += (dz / dist) * step;
          h.value.position.y = 0;
          h.value.rotation.set(0, Math.atan2(dx, dz), 0); // face the run
          animateRig(h, 10, 0, dt); // run cycle
          // keep the sim Position in step so the broadcast camera tracks the run
          cel.scorer.get(Position)?.set(h.value.position.x, 0, h.value.position.z);
        }
      }
      if (cel.arrived) {
        faceCamera(h.value, dt);
        h.value.position.y = 0;
        // a different signature each goal: the original full-body joy, the
        // open-arms shrug, kisses to the crowd, the kneel, the crossed arms
        playActionClip(h, cel.clip, { fade: 0.15 });
        animateRig(h, 0, 0, dt); // action path: advances the mixer
        cel.scorer.get(Position)?.set(h.value.position.x, 0, h.value.position.z);
      }
    }
    // congratulators: run to a slot beside the scorer, then celebrate along.
    // Purely visual (mesh only) — kickoff placement resets real positions.
    if (h.value) {
      const sx = h.value.position.x;
      const sz = h.value.position.z;
      for (const mate of cel.mates) {
        if (!mate.e.isAlive()) continue;
        const mh = mate.e.get(MeshRef);
        if (!mh?.value) continue;
        const tx = sx + mate.ox;
        const tz = sz + mate.oz;
        const dx = tx - mh.value.position.x;
        const dz = tz - mh.value.position.z;
        const dist = Math.hypot(dx, dz);
        // keep chasing while the scorer is still sprinting to the corner (the
        // slot moves with him) — only lock into the mob once he's stopped there
        if (!mate.arrived && (dist > 0.3 || !cel.arrived)) {
          const step = Math.min(dist, 9 * dt);
          mh.value.position.x += (dx / dist) * step;
          mh.value.position.z += (dz / dist) * step;
          mh.value.rotation.set(0, Math.atan2(dx, dz), 0);
          animateRig(mh, 9, 0, dt); // chase him down
        } else {
          if (!mate.arrived) {
            mate.arrived = true;
            // face the scorer and join in with the original happy bounce
            mh.value.rotation.set(0, Math.atan2(sx - tx, sz - tz), 0);
            playActionClip(mh, "celebrate", { fade: 0.12 });
          }
          animateRig(mh, 0, 0, dt);
        }
      }
    }
    return;
  }

  // ---- booking: the referee raises the card to the camera ----
  const card = cineState.card;
  if (store.mode === "cardScene" && card) {
    card.t += dt;
    const referee = world.queryFirst(IsReferee);
    const h = referee?.get(MeshRef);
    if (h && h.value && h.bones) {
      // snap to face the lens INSTANTLY — no slow turn, so the raised arm is
      // dead still and does not swing across the scene
      h.value.rotation.set(0, 0, 0);
      // the original special anim (000_showcard): raise, hold high, lower —
      // stretched across the scene; the card rides IN the raised hand
      playActionClip(h, "showcard", { duration: CARD_SECONDS - 0.5, fade: 0.15 });
      animateRig(h, 0, 0, dt); // action path: advances the mixer
      const mesh = cardMesh(h, h.bones);
      (mesh.material as THREE.MeshBasicMaterial).color.set(card.red ? 0xe53935 : 0xffd60a);
      mesh.visible = true;
    }
    if (card.t >= CARD_SECONDS) {
      if (h) {
        stopActionClip(h, 0.2);
        const mesh = cardProps.get(h);
        if (mesh) mesh.visible = false;
      }
      cineState.card = null;
      if (cineState.queued && cineState.queued.length >= MIN_REPLAY_FRAMES) {
        cineState.replay = { frames: cineState.queued, i: 0, after: "resume" };
        cineState.queued = null;
        store.setMode("replay");
        store.setBanner("REPLAY");
      } else {
        finishCardScene(world);
        store.setMode("play");
      }
    }
    return;
  }

  // ---- slow-motion replay from the recorder ----
  const rep = cineState.replay;
  if (store.mode === "replay" && rep) {
    rep.i += dt * RECORD_HZ * REPLAY_SPEED;
    const fr = rep.frames[Math.min(Math.floor(rep.i), rep.frames.length - 1)]!;
    const rb = world.queryFirst(IsBall)?.get(BallRef)?.value;
    if (rb) {
      rb.setTranslation(fr.ball, true);
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
    for (const ps of fr.players) {
      if (!ps.e.isAlive()) continue;
      const h = ps.e.get(MeshRef);
      if (!h?.value) continue;
      h.value.position.set(ps.x, 0, ps.z);
      h.value.rotation.set(0, ps.heading, 0);
      animateRig(h, ps.speed, 0, dt);
    }
    if (rep.i >= rep.frames.length - 1) {
      cineState.replay = null;
      store.setBanner("");
      if (rep.after === "kickoff") {
        const team = world.queryFirst(Match)?.get(Match)!.pendingKickoffTeam ?? 0;
        startGoalRestart(world, team);
      } else {
        finishCardScene(world);
      }
      store.setMode("play");
    }
    return;
  }
}

function finishCardScene(world: World): void {
  const off = cineState.sendOffAfter;
  cineState.sendOffAfter = null;
  if (off && off.isAlive()) {
    const p = off.get(Position)!;
    const exitZ = (p.z >= 0 ? 1 : -1) * (PITCH.halfWidth + 6);
    cineState.sendOffScene = {
      player: off,
      t: 0,
      exitZ,
    };
    useStore.getState().setBanner("RED CARD — OFF");
    useStore.getState().setMode("cardScene");
  }
}
