import * as THREE from "three";
import type { Entity, World } from "koota";
import {
  BallState,
  Heading,
  IsBall,
  IsPlayer,
  Jump,
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

/**
 * Play a one-shot situation clip (dive/slide/celebrate/showcard — the
 * original .anim data) through the mixer. While it owns the rig, animateRig
 * only advances the mixer; gait logic and per-limb adaptation stand down.
 * `duration` stretches the clip to a gameplay window (timeScale = clip/target).
 */
export function playActionClip(
  h: RigHolder,
  name: string,
  opts?: { duration?: number; fade?: number },
): void {
  if (!h.mixer || !h.actions || h.action === name) return;
  const next = h.actions[name];
  const meta = CLIP_META[name];
  if (!next || !meta) return;
  const cur = h.actions[h.action ?? h.bridging ?? h.variant];
  next.reset().play();
  next.timeScale = opts?.duration ? meta.duration / opts.duration : 1;
  if (cur && cur !== next) cur.crossFadeTo(next, opts?.fade ?? 0.12, false);
  h.action = name;
  h.bridging = null;
  h.pending = null;
}

/** Release the rig back to locomotion after a one-shot situation clip. */
export function stopActionClip(h: RigHolder, fade = 0.3): void {
  if (!h.action || !h.mixer || !h.actions) return;
  const cur = h.actions[h.action];
  const idle = h.actions.idle;
  if (cur && idle) {
    idle.reset().play();
    cur.crossFadeTo(idle, fade, false);
  }
  h.action = null;
  h.variant = "idle";
  h.bridging = null;
  h.pending = null;
}

export function movementSystem(world: World, dt: number): void {
  const owner = world.queryFirst(IsBall)?.get(BallState)?.owner ?? null;
  for (const e of world.query(IsPlayer)) {
    const p = e.get(Position)!;
    const v = e.get(Velocity)!;

    // never let a corrupted velocity/position survive a frame: a NaN here flows
    // into the ball carry and crashes Rapier's step. Scrub it back to sane.
    if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z))
      v.set(0, 0, 0);
    if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) p.set(0, 0, 0);

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

    // keeper-dive timer: a long committed flight, landing, then back to the
    // feet — ticked here (not in the AI) so it still expires when a human
    // controls the keeper, and so the slide scrub works for either keeper.
    let dive = e.get(KeeperDive);
    if (dive) {
      const t = dive.t + dt;
      if (t > 3.4) {
        e.remove(KeeperDive);
        dive = undefined;
        const hh = e.get(MeshRef);
        if (hh) stopActionClip(hh); // get up off the turf, back to locomotion
      } else {
        e.set(KeeperDive, { t });
        dive = { ...dive, t };
        // a short lunge to the ball, THEN he decelerates and holds the dive
        // pose laid out (watchable) instead of sliding on across the goal
        if (t > 0.9) {
          const f = Math.pow(0.06, dt);
          v.x *= f;
          v.z *= f;
        }
      }
    }

    // slide-tackle pose timer: drop into the lunge, slide on the turf, then get back up
    let slide = e.get(SlideTackle);
    if (slide) {
      const t = slide.t + dt;
      if (t > 1.55) {
        v.x = 0;
        v.z = 0;
        e.remove(SlideTackle);
        slide = undefined;
        const hh = e.get(MeshRef);
        if (hh) stopActionClip(hh); // climb back up into locomotion
      } else {
        e.set(SlideTackle, { t });
        slide = { ...slide, t };
        if (t > 1.1) {
          const f = Math.pow(0.005, dt);
          v.x *= f;
          v.z *= f;
        }
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

    // wall-jump timer: a quick ~0.7s leap to block the free kick
    let jump = e.get(Jump);
    if (jump) {
      const t = jump.t + dt;
      if (t > 0.75) {
        e.remove(Jump);
        jump = undefined;
      } else {
        e.set(Jump, { t });
        jump = { ...jump, t };
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
        // original deflect anims do the whole dive — launch, full-stretch
        // flight, landing on the turf — through the bone + root-height tracks.
        // The mesh stays upright here; physics slides the body to the ball.
        h.value.position.set(p.x, 0, p.z);
        h.value.rotation.set(0, heading, 0, "YZX");
      } else if (slide) {
        // original sliding anim: drop, slide on the turf along the locked yaw.
        h.value.position.set(p.x, 0, p.z);
        h.value.rotation.set(0, slide.yaw, 0, "YZX");
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
      } else if (jump) {
        // a clean vertical leap — arms up implied, feet off the turf
        const hop = Math.sin(Math.min(jump.t / 0.75, 1) * Math.PI) * 0.95;
        h.value.position.set(p.x, hop, p.z);
        h.value.rotation.set(0, heading, 0, "YZX");
      } else {
        h.value.position.set(p.x, 0, p.z);
        h.value.rotation.set(0, heading, 0, "YZX");
      }
    }
    const selected = e.has(Selected) || e.has(Selected2);
    // the ring/tag are children of the posed group: hide them while a body is
    // on the turf or they pitch up into a giant hoop beside the player
    const posed = !!(dive || slide || trip || jump);
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
    // situation clips: the original deflect/sliding anims own the skeleton.
    // Back in live play with no dive/slide component, ANY lingering one-shot
    // (a yanked dive, a celebrate that outlived its scene) must release the
    // rig here or the body would stay clamped in its final pose forever.
    if (!dive && !slide && h.action) stopActionClip(h);
    if (dive) {
      // base clips dive to the actor's RIGHT; world-side vs facing picks the
      // mirror (right_world = (-cos θ, 0, sin θ), dive dir = (0,0,side))
      const base = ["dive_high", "dive_mid", "dive_low"][dive.kind] ?? "dive_mid";
      const name = dive.side * Math.sin(heading) < 0 ? `${base}_m` : base;
      // stretch the ~0.8s clip over the lunge window; he then holds the
      // landed pose on the turf (clamped) until the dive timer releases him
      playActionClip(h, name, { duration: 1.5 });
    } else if (slide) {
      playActionClip(h, "sliding", { duration: 0.95 });
    }
    animateRig(h, slide || dive || (speed < 1.2 && h.variant !== "idle") ? 0 : posed ? 0.3 : speed, angleDiff, dt);
    if (trip && trip.fall > 0.75 && h.bones) {
      // arms shoot forward to brace the fall
      const amt =
        Math.min(trip.t / 0.22, 1) *
        (trip.t < 0.9 ? 1 : Math.max(0, 1 - (trip.t - 0.9) / 0.6));
      h.bones.left_shoulder?.quaternion.multiply(tmpQ.setFromAxisAngle(X_AXIS, -1.6 * amt));
      h.bones.right_shoulder?.quaternion.multiply(tmpQ.setFromAxisAngle(X_AXIS, -1.6 * amt));
    }
  }

  // solid bodies: opponents can't merge into the ball carrier. Resolve overlaps
  // so a defender shepherds/contains at arm's length instead of ghosting right
  // inside you to block your run (he can still get close enough to tackle).
  separatePlayers(world, owner);
}

/** Push overlapping players apart; the ball carrier holds his ground. */
function separatePlayers(world: World, owner: Entity | null): void {
  const BODY = 0.34; // shoulder radius; the min gap between two bodies is 2×
  const MIN = BODY * 2;
  const list: Entity[] = [];
  for (const e of world.query(IsPlayer)) list.push(e);
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!;
      const b = list[j]!;
      const pa = a.get(Position)!;
      const pb = b.get(Position)!;
      let dx = pb.x - pa.x;
      let dz = pb.z - pa.z;
      const d = Math.hypot(dx, dz);
      if (d >= MIN || d < 1e-5) continue;
      const overlap = MIN - d;
      dx /= d;
      dz /= d;
      // the carrier holds his ground; everyone else yields around him, so a
      // defender gets pushed off you rather than you being shoved off the ball
      const aShare = a === owner ? 0 : b === owner ? 1 : 0.5;
      const bShare = 1 - aShare;
      pa.x = clamp(pa.x - dx * overlap * aShare, -58, 58);
      pa.z = clamp(pa.z - dz * overlap * aShare, -39, 39);
      pb.x = clamp(pb.x + dx * overlap * bShare, -58, 58);
      pb.z = clamp(pb.z + dz * overlap * bShare, -39, 39);
    }
  }
  // commit the resolved x/z to the meshes (the pose code above owns y)
  for (const e of list) {
    const h = e.get(MeshRef);
    if (!h?.value) continue;
    const p = e.get(Position)!;
    h.value.position.x = p.x;
    h.value.position.z = p.z;
  }
}

export interface RigHolder {
  mixer: THREE.AnimationMixer | null;
  actions: Record<string, THREE.AnimationAction> | null;
  bones: Record<string, THREE.Bone> | null;
  variant: string;
  bridging: string | null;
  pending: string | null;
  /** one-shot situation clip currently owning the rig, or null */
  action: string | null;
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

    // a situation clip owns the whole skeleton: just advance the mixer
    if (h.action) {
      h.mixer.update(dt);
      return;
    }

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

export function poseIdleRig(h: RigHolder): void {
  if (!h.mixer || !h.actions) return;
  const idle = h.actions.idle;
  if (!idle) return;
  for (const action of Object.values(h.actions)) {
    if (action !== idle) action.stop();
  }
  idle.reset().play();
  idle.time = 0;
  h.variant = "idle";
  h.bridging = null;
  h.pending = null;
  h.action = null;
  h.mixer.update(0);
}
