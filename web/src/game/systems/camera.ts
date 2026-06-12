import * as THREE from "three";
import type { World } from "koota";
import { BallRef, IsBall, Position, Selected } from "../traits";

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

const focus = new THREE.Vector3(0, 0, 0);

/**
 * Broadcast camera modeled on match.cpp:723-843: telephoto (25° FOV set on the
 * Canvas), parked ~42m off the near touchline, ~14m up, tracking a smoothed
 * blend of ball (with velocity lookahead) and the controlled player.
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
  const sp = world.queryFirst(Selected)?.get(Position);

  const fx = bp.x * (sp ? 0.75 : 1) + (sp ? sp.x * 0.25 : 0) + bv.x * 0.4;
  const fz = bp.z * 0.45;
  const k = 1 - Math.exp(-3 * dt);
  focus.x += (fx - focus.x) * k;
  focus.z += (fz - focus.z) * k;

  const tx = clamp(focus.x, -44, 44);
  camera.position.set(tx * 0.93, 14.5, 43 + focus.z * 0.3);
  camera.lookAt(tx, 0.6, focus.z);
}
