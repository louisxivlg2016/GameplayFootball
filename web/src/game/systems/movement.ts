import * as THREE from "three";
import type { World } from "koota";
import {
  Heading,
  IsPlayer,
  MeshRef,
  Position,
  Selected,
  Velocity,
} from "../traits";
import { CLIP_META, VARIANTS } from "../../render/playerRig";

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));
const normAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const tmpQ = new THREE.Quaternion();

function startLoop(
  h: { actions: Record<string, THREE.AnimationAction> | null; variant: string; bridging: string | null },
  name: string,
  fade: number,
): void {
  const next = h.actions?.[name];
  if (!next) return;
  const cur = h.actions?.[h.bridging ?? h.variant];
  next.reset().play();
  if (cur && cur !== next) cur.crossFadeTo(next, fade, true);
  h.variant = name;
}

export function movementSystem(world: World, dt: number): void {
  for (const e of world.query(IsPlayer)) {
    const p = e.get(Position)!;
    const v = e.get(Velocity)!;
    p.x = clamp(p.x + v.x * dt, -58, 58);
    p.z = clamp(p.z + v.z * dt, -39, 39);

    const speed = Math.hypot(v.x, v.z);

    // heading lags velocity — the original turns through animation, not snapping
    let heading = e.get(Heading)!.angle;
    let angleDiff = 0;
    if (speed > 0.6) {
      const desired = Math.atan2(v.x, v.z);
      const diff = normAngle(desired - heading);
      const maxTurn = (4 + speed * 0.6) * dt;
      heading = normAngle(heading + clamp(diff, -maxTurn, maxTurn));
      e.set(Heading, { angle: heading });
      angleDiff = normAngle(desired - heading);
    }

    const h = e.get(MeshRef)!;
    if (h.value) {
      h.value.position.set(p.x, 0, p.z);
      h.value.rotation.y = heading;
    }
    if (h.ring) h.ring.visible = e.has(Selected);
    if (!h.mixer || !h.actions) continue;

    // gait by the original velocity bands, variant by the angle quadrant
    const gait =
      speed < 1.8 ? "idle" : speed < 4.2 ? "dribble" : speed < 6 ? "walk" : "sprint";
    const deg = (angleDiff * 180) / Math.PI;
    const variants = VARIANTS[gait] ?? [0];
    let bestA = 0;
    let bestD = Infinity;
    for (const a of variants) {
      const d = Math.abs(deg - a);
      if (d < bestD) {
        bestD = d;
        bestA = a;
      }
    }
    const curMeta = CLIP_META[h.variant];
    if (curMeta && curMeta.gait === gait && curMeta.kind === "cycle") {
      // hysteresis so variants don't flap at quadrant borders
      if (Math.abs(deg - curMeta.angle) < bestD + 12) bestA = curMeta.angle;
    }
    const targetName = bestA === 0 ? gait : `${gait}_${bestA}`;

    if (h.bridging) {
      const bridge = h.actions[h.bridging];
      const meta = CLIP_META[h.bridging];
      const pendingGait = CLIP_META[h.pending ?? ""]?.gait;
      if (!bridge || !meta || pendingGait !== gait) {
        startLoop(h, targetName, 0.14); // plan changed mid-bridge
        h.bridging = null;
        h.pending = null;
      } else if (bridge.time >= meta.duration - 0.12) {
        startLoop(h, h.pending!, 0.12); // bridge done: chain into the cycle
        h.bridging = null;
        h.pending = null;
      }
    } else if (targetName !== h.variant) {
      // accel/decel one-shot bridges on idle<->gait changes (humanoidbase.cpp:587-592)
      const fromGait = CLIP_META[h.variant]?.gait ?? "idle";
      const bridgeName = `${fromGait}_to_${gait}`;
      const bridge =
        (fromGait === "idle" || gait === "idle") && fromGait !== gait
          ? h.actions[bridgeName]
          : undefined;
      if (bridge && CLIP_META[bridgeName]) {
        bridge.reset().play();
        h.actions[h.variant]?.crossFadeTo(bridge, 0.08, true);
        h.bridging = bridgeName;
        h.pending = targetName;
      } else {
        startLoop(h, targetName, 0.16);
      }
    }

    // feet match ground speed
    const activeName = h.bridging ?? h.variant;
    const active = h.actions[activeName];
    const activeMeta = CLIP_META[activeName];
    if (active && activeMeta && activeMeta.kind === "cycle" && activeMeta.velocity > 0.5) {
      active.timeScale = clamp(speed / activeMeta.velocity, 0.5, 1.6);
    }
    h.mixer.update(dt);

    // SetOffset-style per-limb adaptation (humanoid.cpp:786-844), post-mixer
    if (h.bones) {
      if (Math.abs(angleDiff) > 0.02 && h.bones.middle) {
        // torso leads into the travel direction
        h.bones.middle.quaternion.multiply(
          tmpQ.setFromAxisAngle(Z_AXIS, clamp(angleDiff * 0.3, -0.45, 0.45)),
        );
      }
      const accel = dt > 0 ? (speed - h.prevSpeed) / dt : 0;
      h.prevSpeed = speed;
      h.lean += (clamp(accel * 0.012, -0.1, 0.16) - h.lean) * Math.min(1, dt * 6);
      if (Math.abs(h.lean) > 0.01 && h.bones.body) {
        h.bones.body.quaternion.multiply(tmpQ.setFromAxisAngle(X_AXIS, h.lean));
      }
      // stride-amplitude correction against foot-slide when timeScale clamps
      if (active && activeMeta && activeMeta.kind === "cycle" && activeMeta.velocity > 0.5) {
        const effective = activeMeta.velocity * active.timeScale;
        const residual = clamp(speed / Math.max(effective, 0.1) - 1, -0.3, 0.3);
        if (Math.abs(residual) > 0.03) {
          const phase = (active.time / activeMeta.duration) * Math.PI * 2;
          const amp = residual * 0.18 * Math.min(1, speed / 4);
          h.bones.left_thigh?.quaternion.multiply(
            tmpQ.setFromAxisAngle(X_AXIS, amp * Math.sin(phase)),
          );
          h.bones.right_thigh?.quaternion.multiply(
            tmpQ.setFromAxisAngle(X_AXIS, -amp * Math.sin(phase)),
          );
        }
      }
    }
  }
}
