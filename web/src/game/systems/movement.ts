import * as THREE from "three";
import type { World } from "koota";
import {
  BallState,
  Heading,
  IsBall,
  IsPlayer,
  KeeperDive,
  MeshRef,
  Position,
  Selected,
  Selected2,
  SlideTackle,
  Stats,
  Tripped,
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
  const owner = world.queryFirst(IsBall)?.get(BallState)?.owner ?? null;
  for (const e of world.query(IsPlayer)) {
    const p = e.get(Position)!;
    const v = e.get(Velocity)!;

    // the ball carrier never back-pedals: drop any velocity opposite his
    // facing so a reversal pivots through a stop instead of sliding backwards
    // with the ball glued to his feet. The heading below still turns from the
    // pre-clamp intent, so an AI carrier can complete the turn and re-engage.
    const intentX = v.x;
    const intentZ = v.z;
    if (e === owner) {
      const ang = e.get(Heading)!.angle;
      const fwdX = Math.sin(ang);
      const fwdZ = Math.cos(ang);
      const fwd = v.x * fwdX + v.z * fwdZ;
      if (fwd < 0) {
        v.x -= fwd * fwdX;
        v.z -= fwd * fwdZ;
      }
    }

    p.x = clamp(p.x + v.x * dt, -58, 58);
    p.z = clamp(p.z + v.z * dt, -39, 39);

    const speed = Math.hypot(v.x, v.z);

    // keeper-dive timer: flight, landing, then back to the feet — ticked here
    // (not in the AI) so it still expires when a human controls the keeper
    let dive = e.get(KeeperDive);
    if (dive) {
      const t = dive.t + dt;
      if (t > 1.15) {
        e.remove(KeeperDive);
        dive = undefined;
      } else {
        e.set(KeeperDive, { t });
        dive = { ...dive, t };
      }
    }

    // slide-tackle pose timer: 0.5s on the turf, then 0.5s getting back up
    let slide = e.get(SlideTackle);
    if (slide) {
      const t = slide.t + dt;
      if (t > 1.0) {
        e.remove(SlideTackle);
        slide = undefined;
      } else {
        e.set(SlideTackle, { t });
        slide = { ...slide, t };
      }
    }

    // tackled-and-down timer: face-plant + floor time on a foul (fall 1),
    // a quick clipped-legs stumble on a clean poke (fall 0.5)
    let trip = e.get(Tripped);
    if (trip) {
      const t = trip.t + dt;
      const total = trip.fall > 0.75 ? 1.5 : 0.6;
      if (t > total) {
        e.remove(Tripped);
        trip = undefined;
      } else {
        e.set(Tripped, { t });
        trip = { ...trip, t };
        if (trip.fall > 0.75 && t < 0.9) {
          // flat on the grass: nobody runs from down there
          const f = Math.pow(0.02, dt);
          v.x *= f;
          v.z *= f;
        }
      }
    }

    // heading lags velocity — the original turns through animation, not snapping
    let heading = e.get(Heading)!.angle;
    let angleDiff = 0;
    if (!dive && !slide && !trip && Math.hypot(intentX, intentZ) > 0.6) {
      const desired = Math.atan2(intentX, intentZ);
      const diff = normAngle(desired - heading);
      // the human's heading comes straight from input (control.ts) — deriving
      // it from velocity stalls in the low-speed band during reversals and
      // leaves the body visibly back-pedaling at high frame rates
      if (!e.has(Selected) && !e.has(Selected2)) {
        const maxTurn = (10 + speed * 0.5) * dt;
        heading = normAngle(heading + clamp(diff, -maxTurn, maxTurn));
        e.set(Heading, { angle: heading });
      }
      angleDiff = normAngle(desired - heading);
    }

    // stamina: sprinting drains, easing off recovers (physical_stamina-ish)
    const stats = e.get(Stats)!;
    const drain = speed > 6.5 ? 0.004 : speed > 4.2 ? 0.0012 : -0.0015;
    e.set(Stats, { energy: clamp(stats.energy - drain * dt * 7.69, 0.3, 1) });

    const h = e.get(MeshRef)!;
    if (h.value) {
      if (dive) {
        // procedural dive: roll horizontal toward the ball side, arms-first,
        // launch UP into an airborne arc, then settle (no clip exists for it).
        const inK = Math.min(dive.t / 0.22, 1); // launch ramp
        const upK = dive.t < 0.55 ? 1 : Math.max(0, 1 - (dive.t - 0.55) / 0.55);
        const amt = inK * upK;
        // the rig pivots around its feet, so a body rolled flat would sink half
        // into the pitch — lift it by the roll amount so it always floats on the
        // grass, then add a pronounced arc so he leaps UP like a real keeper
        const leap = Math.sin(Math.min(dive.t / 0.7, 1) * Math.PI) * 0.5;
        const air = amt * 0.5 + leap;
        h.value.position.set(p.x, air, p.z);
        h.value.rotation.set(0.3 * amt, heading, -dive.side * 1.4 * amt, "YZX");
      } else if (slide) {
        // procedural slide tackle: recline low along the locked lunge yaw,
        // ride the turf, then climb back to the feet
        const inK = Math.min(slide.t / 0.1, 1);
        const upK = slide.t < 0.5 ? 1 : Math.max(0, 1 - (slide.t - 0.5) / 0.5);
        const amt = inK * upK;
        h.value.position.set(p.x, -0.08 * amt, p.z);
        h.value.rotation.set(-1.05 * amt, slide.yaw, 0.18 * amt, "YZX");
      } else if (trip) {
        // tripped: pitch forward over the clipped legs along the run line,
        // hit the grass, then climb back up (stumbles only dip partway)
        const full = trip.fall > 0.75;
        const inK = Math.min(trip.t / (full ? 0.22 : 0.14), 1);
        const upStart = full ? 0.9 : 0.25;
        const upLen = full ? 0.6 : 0.35;
        const upK =
          trip.t < upStart ? 1 : Math.max(0, 1 - (trip.t - upStart) / upLen);
        const amt = inK * upK * trip.fall;
        h.value.position.set(p.x, -0.04 * amt, p.z);
        h.value.rotation.set(1.5 * amt, trip.yaw, 0.1 * amt, "YZX");
      } else {
        h.value.position.set(p.x, 0, p.z);
        h.value.rotation.set(0, heading, 0, "YZX");
      }
    }
    const selected = e.has(Selected) || e.has(Selected2);
    // the ring/tag are children of the posed group: hide them while a body is
    // on the turf or they pitch up into a giant hoop beside the player
    const posed = !!(dive || slide || trip);
    if (h.ring) {
      h.ring.visible = selected && !posed;
      if (selected) {
        // P1 keeps the yellow ring; P2's man gets a cyan one so the couch
        // can tell at a glance who steers whom
        (h.ring.material as THREE.MeshBasicMaterial).color.set(
          e.has(Selected2) ? "#4ad2ff" : "#ffe94a",
        );
      }
    }
    if (h.tag) h.tag.visible = selected && !posed;
    animateRig(h, posed ? 0.3 : speed, angleDiff, dt);
    if (trip && trip.fall > 0.75 && h.bones) {
      // arms shoot forward to brace the fall
      const amt =
        Math.min(trip.t / 0.22, 1) *
        (trip.t < 0.9 ? 1 : Math.max(0, 1 - (trip.t - 0.9) / 0.6));
      h.bones.left_shoulder?.quaternion.multiply(tmpQ.setFromAxisAngle(X_AXIS, -1.6 * amt));
      h.bones.right_shoulder?.quaternion.multiply(tmpQ.setFromAxisAngle(X_AXIS, -1.6 * amt));
    }
    if (dive && h.bones) {
      // arms stretched out toward the ball, like the reference dive
      const reach = Math.min(dive.t / 0.22, 1) * (dive.t < 0.7 ? 1 : Math.max(0, 1 - (dive.t - 0.7) / 0.45)) * 2.3;
      h.bones.left_shoulder?.quaternion.multiply(tmpQ.setFromAxisAngle(X_AXIS, -reach));
      h.bones.right_shoulder?.quaternion.multiply(tmpQ.setFromAxisAngle(X_AXIS, -reach));
    }
    if (slide && h.bones) {
      // lead leg shoots out along the lunge, trailing leg tucks under
      const amt =
        Math.min(slide.t / 0.1, 1) *
        (slide.t < 0.5 ? 1 : Math.max(0, 1 - (slide.t - 0.5) / 0.5));
      h.bones.right_thigh?.quaternion.multiply(tmpQ.setFromAxisAngle(X_AXIS, -1.3 * amt));
      h.bones.left_thigh?.quaternion.multiply(tmpQ.setFromAxisAngle(X_AXIS, -0.35 * amt));
      h.bones.left_knee?.quaternion.multiply(tmpQ.setFromAxisAngle(X_AXIS, 1.4 * amt));
      h.bones.left_shoulder?.quaternion.multiply(tmpQ.setFromAxisAngle(X_AXIS, -0.6 * amt));
      h.bones.right_shoulder?.quaternion.multiply(tmpQ.setFromAxisAngle(X_AXIS, -0.6 * amt));
    }
  }
}

export interface RigHolder {
  mixer: THREE.AnimationMixer | null;
  actions: Record<string, THREE.AnimationAction> | null;
  bones: Record<string, THREE.Bone> | null;
  variant: string;
  bridging: string | null;
  pending: string | null;
  prevSpeed: number;
  lean: number;
}

/** Gait/variant selection + bridges + post-mixer adaptation for one rig. */
export function animateRig(
  h: RigHolder,
  speed: number,
  angleDiff: number,
  dt: number,
): void {
  {
    if (!h.mixer || !h.actions) return;

    // gait by the original velocity bands, variant by the angle quadrant
    let gait =
      speed < 1.8 ? "idle" : speed < 4.2 ? "dribble" : speed < 6 ? "walk" : "sprint";
    // hysteresis: a reversal dips through the idle band for a few frames at
    // high fps — don't thrash into idle bridges while still clearly moving
    const curGait = CLIP_META[h.variant]?.gait;
    if (curGait && curGait !== "idle" && gait === "idle" && speed > 0.6) {
      gait = curGait;
    }
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
