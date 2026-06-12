import type { World } from "koota";
import {
  Heading,
  IsPlayer,
  MeshRef,
  Position,
  Selected,
  Velocity,
} from "../traits";
import { SPEEDS } from "../levels";

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

    // procedural run cycle: stride speeds up and deepens with velocity
    const norm = Math.min(1, speed / SPEEDS.sprint);
    h.phase += dt * (1.5 + speed * 1.7);
    const a = Math.sin(h.phase) * norm;
    if (h.legL) h.legL.rotation.x = a * 0.85;
    if (h.legR) h.legR.rotation.x = -a * 0.85;
    if (h.armL) h.armL.rotation.x = -a * 0.7;
    if (h.armR) h.armR.rotation.x = a * 0.7;
    if (h.body) h.body.rotation.x = norm * 0.17; // lean into the sprint
  }
}
