import { useStore } from "./store";
import { initAudio } from "./audio";
import { resumeRadio, toggleRadio, warmupRadioVoice } from "./radio";

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
    initAudio(); // browsers unlock audio on the first user gesture
    warmupRadioVoice(); // start the neural voice download in the background
    resumeRadio(); // and wake the playback context if the browser suspended it
    held.add(e.code);
    pressed.add(e.code);

    const {
      mode,
      setMode,
      newMatch,
      toggleImportant,
      cycleDifficulty,
      togglePlayers,
    } = useStore.getState();
    if (e.code === "Enter") {
      if (mode === "menu") newMatch();
      else if (mode === "pause") setMode("play");
    }
    if (e.code === "KeyM" && mode === "menu") toggleImportant();
    if (e.code === "KeyD" && mode === "menu") cycleDifficulty();
    if (e.code === "KeyJ" && mode === "menu") togglePlayers();
    if (e.code === "Escape") {
      if (mode === "play") setMode("pause");
      else if (mode === "pause") setMode("play");
    }
    if (e.code === "KeyR") toggleRadio();
  });
  window.addEventListener("keyup", (e) => held.delete(e.code));
  window.addEventListener("blur", () => held.clear());
}

/** Per-player key layouts for local two-player mode. */
export interface Pad {
  up: string[];
  down: string[];
  left: string[];
  right: string[];
  sprint: string[];
  shoot: string;
  pass: string;
  lob: string;
  tackle: string;
}

/** Solo: both halves of the keyboard drive player 1. */
const SOLO_PAD: Pad = {
  up: ["KeyW", "ArrowUp"],
  down: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  sprint: ["ShiftLeft", "ShiftRight"],
  shoot: "Space",
  pass: "KeyX",
  lob: "KeyC",
  tackle: "KeyE",
};

export const PADS: [Pad, Pad] = [
  {
    up: ["KeyW"],
    down: ["KeyS"],
    left: ["KeyA"],
    right: ["KeyD"],
    sprint: ["ShiftLeft"],
    shoot: "Space",
    pass: "KeyX",
    lob: "KeyC",
    tackle: "KeyE",
  },
  {
    up: ["ArrowUp"],
    down: ["ArrowDown"],
    left: ["ArrowLeft"],
    right: ["ArrowRight"],
    sprint: ["ShiftRight"],
    shoot: "KeyK",
    pass: "KeyL",
    lob: "KeyM",
    tackle: "KeyI",
  },
];

export function padFor(slot: number, players: number): Pad {
  return players === 2 ? PADS[slot]! : SOLO_PAD;
}

const anyHeld = (codes: string[]): boolean => codes.some((c) => held.has(c));

/** World-space move direction (+x = toward the right/BLU goal, +z = toward camera). */
export function moveDirFor(pad: Pad): { x: number; z: number } {
  let x = 0;
  let z = 0;
  if (anyHeld(pad.left)) x -= 1;
  if (anyHeld(pad.right)) x += 1;
  if (anyHeld(pad.up)) z -= 1;
  if (anyHeld(pad.down)) z += 1;
  const len = Math.hypot(x, z);
  return len > 0 ? { x: x / len, z: z / len } : { x: 0, z: 0 };
}

export const isSprintingFor = (pad: Pad): boolean => anyHeld(pad.sprint);

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
