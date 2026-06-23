import * as THREE from "three";
import type { World } from "koota";
import { BallRef, IsBall, IsReferee, Position, Selected } from "../traits";
import { PITCH, attackSign } from "../levels";
import { refState } from "./referee";
import { cineState } from "./cinematic";
import { useStore } from "../store";

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

const focus = new THREE.Vector3(0, 0, 0);
const camPos = new THREE.Vector3(0, 14.5, 43);
const camLook = new THREE.Vector3(0, 0.6, 0);
const desiredPos = new THREE.Vector3();
const desiredLook = new THREE.Vector3();
let fov = 25;
// identity of the active set-piece, so a brand-new one cuts the camera
// straight to its framing instead of lazily panning over from midfield
// (which read as "just a normal match" for the first second)
let lastSetPieceId: string | null = null;

/**
 * Broadcast camera modeled on match.cpp:723-843: telephoto (25° FOV), parked
 * ~42m off the near touchline, ~14m up, tracking a smoothed blend of ball and
 * controlled player. Penalties and shoot-out kicks switch to the classic
 * behind-the-taker view: low, on the spot-goal axis, wide FOV, keeper framed.
 */
export function cameraSystem(
  world: World,
  dt: number,
  camera: THREE.Camera,
): void {
  // expose the live camera so the HUD's draw-to-shoot overlay can raycast
  // screen drags onto the pitch / goal plane
  (globalThis as { __gpfCam?: THREE.Camera }).__gpfCam = camera;
  const ball = world.queryFirst(IsBall);
  const rb = ball?.get(BallRef)!.value;
  const bp = rb ? rb.translation() : { x: 0, y: 0, z: 0 };
  const bv = rb ? rb.linvel() : { x: 0, y: 0, z: 0 };

  const c = refState.ceremony;
  const penalty =
    (c && c.type === "penalty") ||
    (refState.shootout !== null && (c !== null || refState.shootout.awaiting > 0));
  let desiredFov: number;

  const mode = useStore.getState().mode;
  const celeb = mode === "goal" ? cineState.celebration : null;
  const sendOff = mode === "cardScene" ? cineState.sendOffScene : null;
  const refp =
    mode === "cardScene" && !sendOff ? world.queryFirst(IsReferee)?.get(Position) : undefined;
  const offside = mode === "offside" ? cineState.offside : null;

  if (offside && offside.player.isAlive()) {
    // close TV cut centred between the offside line and the offending player,
    // so both the line across the pitch and the man beyond it are clearly framed
    const p = offside.player.get(Position)!;
    const midX = (offside.lineX + p.x) / 2;
    desiredPos.set(midX, 6, 26);
    desiredLook.set(midX, 0.5, p.z * 0.5);
    desiredFov = 34;
  } else if (celeb && celeb.scorer.isAlive()) {
    // close-up: the scorer applauds straight into the lens
    const p = celeb.scorer.get(Position)!;
    desiredPos.set(p.x, 1.7, p.z + 5.2);
    desiredLook.set(p.x, 1.25, p.z);
    desiredFov = 30;
  } else if (sendOff && sendOff.player.isAlive()) {
    // tighter touchline shot: the sent-off player walks out of the match
    const p = sendOff.player.get(Position)!;
    const side = Math.sign(sendOff.exitZ) || 1;
    desiredPos.set(p.x + 2.1, 1.55, p.z - side * 3.1);
    desiredLook.set(p.x, 1.05, p.z + side * 0.9);
    desiredFov = 42;
  } else if (refp) {
    // close-up: the referee raises the card to the camera
    desiredPos.set(refp.x, 1.7, refp.z + 5.0);
    desiredLook.set(refp.x, 1.35, refp.z);
    desiredFov = 30;
  } else if (mode === "replay") {
    // slow-mo replay: tight chase on the recorded ball
    desiredPos.set(bp.x, 4.5, bp.z + 9);
    desiredLook.set(bp.x, 0.6, bp.z);
    desiredFov = 35;
  } else if (penalty) {
    const spotX = c ? c.x : 44;
    const s = Math.sign(spotX || 1);
    // close behind the taker so HE is the prominent figure in the foreground
    // (radar is hidden during the kick, so nothing covers him); aim at the goal
    // so the keeper he must beat stays framed beyond him
    desiredPos.set(spotX - s * 6, 2.5, 1.1);
    desiredLook.set(s * PITCH.halfLength, 1.3, 0);
    desiredFov = 52;
  } else if (c && (c.type === "freekick" || c.type === "corner")) {
    // dedicated set-piece framing so a free kick / corner never looks like
    // open play: sit behind the ball with the target goal filling the frame
    const gx = attackSign(c.team) * PITCH.halfLength;
    const s = Math.sign(gx || 1);
    if (c.type === "corner") {
      // behind & above the taker so his WHOLE body is in frame (feet included),
      // with the packed box and goal beyond him (verified in the pose preview)
      const zside = Math.sign(c.z || 1);
      desiredPos.set(c.x + s * 0.5, 9, c.z + zside * 10);
      desiredLook.set(c.x - s * 4, 1.2, c.z * 0.65);
      desiredFov = 52;
    } else {
      // free kick, TV style: sit behind the taker ALONG the ball→goal line (so
      // he stays centred in frame at any angle), a touch to the side and raised,
      // looking at the goal — taker foreground, wall across the middle, keeper beyond
      const tgx = gx - c.x;
      const tgz = 0 - c.z;
      const d = Math.hypot(tgx, tgz) || 1;
      const ux = tgx / d;
      const uz = tgz / d;
      desiredPos.set(c.x - ux * 7 - uz * 3.5, 3.4, c.z - uz * 7 + ux * 3.5);
      desiredLook.set(gx, 1.5, 0);
      desiredFov = 50;
    }
  } else {
    const sp = world.queryFirst(Selected)?.get(Position);
    const fx = bp.x * (sp ? 0.75 : 1) + (sp ? sp.x * 0.25 : 0) + bv.x * 0.4;
    const fz = bp.z * 0.45;
    const k = 1 - Math.exp(-3 * dt);
    focus.x += (fx - focus.x) * k;
    focus.z += (fz - focus.z) * k;
    const tx = clamp(focus.x, -44, 44);
    desiredPos.set(tx * 0.93, 14.5, 43 + focus.z * 0.3);
    desiredLook.set(tx, 0.6, focus.z);
    desiredFov = 25;
  }

  // one shared damp so cuts between broadcast and penalty views glide…
  let blend = 1 - Math.exp(-5 * dt);
  // …but cut HARD to a fresh set piece, so it's framed from the very first
  // frame and the player instantly sees the penalty / free kick / corner
  const setPieceId =
    c && (c.type === "penalty" || c.type === "freekick" || c.type === "corner")
      ? `${c.type}:${Math.round(c.x)}:${Math.round(c.z)}:${c.team}`
      : null;
  if (setPieceId !== null && setPieceId !== lastSetPieceId) blend = 1;
  lastSetPieceId = setPieceId;
  camPos.lerp(desiredPos, blend);
  camLook.lerp(desiredLook, blend);
  camera.position.copy(camPos);
  camera.lookAt(camLook);

  fov += (desiredFov - fov) * blend;
  const pc = camera as THREE.PerspectiveCamera;
  if (pc.isPerspectiveCamera && Math.abs(pc.fov - fov) > 0.05) {
    pc.fov = fov;
    pc.updateProjectionMatrix();
  }
}
