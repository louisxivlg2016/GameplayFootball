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
import { animateRig, poseIdleRig } from "./movement";
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
  celebration: null as { scorer: Entity; t: number } | null,
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

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const tmpQ = new THREE.Quaternion();
const smooth01 = (v: number): number => {
  const x = Math.min(1, Math.max(0, v));
  return x * x * (3 - 2 * x);
};

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

/** Goal scored: stage the applauding close-up + the slow-mo of the shot. */
export function queueGoalCinematic(scorer: Entity | null, scoringTeam: number): void {
  cineState.celebration =
    scorer && scorer.isAlive() && scorer.get(Team)!.id === scoringTeam
      ? { scorer, t: 0 }
      : null;
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

  cineState.celebration = null;
  cineState.card = null;
  cineState.replay = null;
  cineState.queued = null;
  cineState.sendOffScene = null;
  cineState.sendOffAfter = null;
  // hide a raised card if we skipped mid-raise
  const ref = world.queryFirst(IsReferee)?.get(MeshRef);
  if (ref) {
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
      new THREE.PlaneGeometry(0.26, 0.36), // big, reads clearly to the lens
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    );
    // up in the raised hand, turned flat to FACE the camera (verified in a
    // render against the arm-raised pose below)
    mesh.position.set(0, 0.5, 0.04);
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

  // ---- goal celebration: the scorer applauds the crowd in close-up ----
  const cel = cineState.celebration;
  if (store.mode === "goal" && cel) {
    if (!cel.scorer.isAlive()) {
      cineState.celebration = null;
      return;
    }
    cel.t += dt;
    const h = cel.scorer.get(MeshRef)!;
    if (h.value && h.bones) {
      faceCamera(h.value, dt);
      // ONE celebratory beat: a single hop, the hands brought together once in
      // applause and then held there — not a 50,000x loop of claps and bounces
      const ramp = smooth01(cel.t / 0.4);
      const hop = Math.sin(Math.min(cel.t / 0.55, 1) * Math.PI) * 0.18; // one hop
      h.value.position.y = hop;
      animateRig(h, 0, 0, dt);
      // both arms up in front at chest height, elbows bent so the hands meet
      const lift = 1.15 * ramp;
      const bend = 1.3 * ramp;
      h.bones.left_shoulder?.quaternion.multiply(tmpQ.setFromAxisAngle(X_AXIS, -lift));
      h.bones.right_shoulder?.quaternion.multiply(tmpQ.setFromAxisAngle(X_AXIS, -lift));
      h.bones.left_elbow?.quaternion.multiply(tmpQ.setFromAxisAngle(X_AXIS, -bend));
      h.bones.right_elbow?.quaternion.multiply(tmpQ.setFromAxisAngle(X_AXIS, -bend));
      // the forearms swing together ONCE (apart -> clasped), then stay there
      const together = smooth01((cel.t - 0.35) / 0.4);
      const spread = (1 - together) * 0.5 * ramp;
      h.bones.left_shoulder?.quaternion.multiply(tmpQ.setFromAxisAngle(Z_AXIS, spread));
      h.bones.right_shoulder?.quaternion.multiply(tmpQ.setFromAxisAngle(Z_AXIS, -spread));
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
      faceCamera(h.value, dt);
      poseIdleRig(h);
      // ONE clean raise: right arm straight up, card held high facing the crowd,
      // left arm relaxed down at his side. Calibrated against the idle@0 base
      // that poseIdleRig actually leaves each frame (verified in a MULTI-frame
      // render — a single-frame preview starts from the wrong base and misleads).
      const up = smooth01(card.t / 0.6);
      h.bones.right_shoulder?.quaternion.multiply(tmpQ.setFromAxisAngle(X_AXIS, -2.7 * up));
      h.bones.right_shoulder?.quaternion.multiply(tmpQ.setFromAxisAngle(Z_AXIS, 0.05 * up));
      const mesh = cardMesh(h, h.bones);
      (mesh.material as THREE.MeshBasicMaterial).color.set(card.red ? 0xe53935 : 0xffd60a);
      mesh.visible = true;
    }
    if (card.t >= CARD_SECONDS) {
      if (h) {
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
