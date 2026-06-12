import { useStore } from "./store";

const held = new Set<string>();
const pressed = new Set<string>();

const MOVE_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
]);

export function initInput(): void {
  window.addEventListener("keydown", (e) => {
    if (MOVE_KEYS.has(e.code) || e.code === "Space") e.preventDefault();
    if (e.repeat) return;
    held.add(e.code);
    pressed.add(e.code);

    const { mode, setMode, newMatch } = useStore.getState();
    if (e.code === "Enter") {
      if (mode === "menu") newMatch();
      else if (mode === "pause") setMode("play");
    }
    if (e.code === "Escape") {
      if (mode === "play") setMode("pause");
      else if (mode === "pause") setMode("play");
    }
  });
  window.addEventListener("keyup", (e) => held.delete(e.code));
  window.addEventListener("blur", () => held.clear());
}

/** World-space move direction (+x = toward the right/BLU goal, +z = toward camera). */
export function moveDir(): { x: number; z: number } {
  let x = 0;
  let z = 0;
  if (held.has("ArrowLeft") || held.has("KeyA")) x -= 1;
  if (held.has("ArrowRight") || held.has("KeyD")) x += 1;
  if (held.has("ArrowUp") || held.has("KeyW")) z -= 1;
  if (held.has("ArrowDown") || held.has("KeyS")) z += 1;
  const len = Math.hypot(x, z);
  return len > 0 ? { x: x / len, z: z / len } : { x: 0, z: 0 };
}

export const isSprinting = (): boolean =>
  held.has("ShiftLeft") || held.has("ShiftRight");

/** Edge-triggered: true exactly once per key press. */
export function consumePress(code: string): boolean {
  if (pressed.has(code)) {
    pressed.delete(code);
    return true;
  }
  return false;
}

/** Call at the end of every frame so stale presses don't fire later. */
export function flushPresses(): void {
  pressed.clear();
}
