import * as THREE from "three";
import type { World } from "koota";
import { BallRef, IsBall, IsReferee, Position, Selected } from "../traits";
import { PITCH } from "../levels";
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

  if (celeb && celeb.scorer.isAlive()) {
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
    // behind and slightly beside the taker, low — ball ahead, goal + keeper framed
    desiredPos.set(spotX - s * 6.5, 2.3, 1.5);
    desiredLook.set(s * PITCH.halfLength, 1.1, 0);
    desiredFov = 50;
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

  // one shared damp so cuts between broadcast and penalty views glide
  const blend = 1 - Math.exp(-5 * dt);
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
