import type { World } from "koota";
import {
  Heading,
  IsPlayer,
  MeshRef,
  Position,
  Selected,
  Velocity,
} from "../traits";
import { CLIP_VELOCITY } from "../../render/playerRig";

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

export function movementSystem(world: World, dt: number): void {
  for (const e of world.query(IsPlayer)) {
    const p = e.get(Position)!;
    const v = e.get(Velocity)!;
    p.x = clamp(p.x + v.x * dt, -58, 58);
    p.z = clamp(p.z + v.z * dt, -39, 39);

    const speed = Math.hypot(v.x, v.z);
    if (!e.has(Selected) && speed > 0.6) {
      e.set(Heading, { angle: Math.atan2(v.x, v.z) });
    }

    const h = e.get(MeshRef)!;
    if (h.value) {
      h.value.position.set(p.x, 0, p.z);
      h.value.rotation.y = e.get(Heading)!.angle;
    }
    if (h.ring) h.ring.visible = e.has(Selected);

    // mocap gait selection, velocity bands from gamedefines.hpp:18-27
    if (h.mixer && h.actions) {
      const gait =
        speed < 1.8 ? "idle" : speed < 4.2 ? "dribble" : speed < 6 ? "walk" : "sprint";
      const action = h.actions[gait];
      if (action && gait !== h.gait) {
        const prev = h.actions[h.gait];
        action.reset().play();
        if (prev && prev !== action) prev.crossFadeTo(action, 0.16, true);
        h.gait = gait;
      }
      if (action && gait !== "idle") {
        // feet match ground speed: original anims are authored at fixed velocities
        action.timeScale = Math.min(1.8, Math.max(0.4, speed / (CLIP_VELOCITY[gait] ?? 5)));
      }
      h.mixer.update(dt);
    }
  }
}
