import type { World } from "koota";
import {
  BallRef,
  IsBall,
  IsPlayer,
  Position,
  Selected,
  Selected2,
  Team,
} from "../traits";
import { PITCH } from "../levels";
import { useStore } from "../store";

let acc = 0;

/** Mirror positions into zustand ~7×/s for the HUD radar (codes: 0/1 team, +2 selected, 4 ball). */
export function radarSystem(world: World, dt: number): void {
  acc += dt;
  if (acc < 0.15) return;
  acc = 0;
  const out: number[] = [];
  for (const e of world.query(IsPlayer)) {
    const p = e.get(Position)!;
    out.push(
      p.x / PITCH.halfLength,
      p.z / PITCH.halfWidth,
      e.get(Team)!.id + (e.has(Selected) || e.has(Selected2) ? 2 : 0),
    );
  }
  const rb = world.queryFirst(IsBall)?.get(BallRef)!.value;
  if (rb) {
    const bp = rb.translation();
    out.push(bp.x / PITCH.halfLength, bp.z / PITCH.halfWidth, 4);
  }
  useStore.getState().setRadar(out);
}
