import { create } from "zustand";

export type Mode = "menu" | "play" | "goal" | "pause";

export const TEAMS = [
  { name: "RED", color: "#d8342c", shorts: "#7a130e" },
  { name: "BLU", color: "#2459d6", shorts: "#0d2a73" },
] as const;

interface Store {
  mode: Mode;
  /** bumping this remounts the match scene and reloads the world */
  gen: number;
  score: [number, number];
  clock: number;
  /** [x0,z0, x1,z1, ...] for 22 players then the ball; normalized to [-1,1] */
  radar: number[];
  setMode: (mode: Mode) => void;
  newMatch: () => void;
  addGoal: (team: number) => void;
  setClock: (clock: number) => void;
  setRadar: (radar: number[]) => void;
}

export const useStore = create<Store>((set) => ({
  mode: "menu",
  gen: 0,
  score: [0, 0],
  clock: 0,
  radar: [],
  setMode: (mode) => set({ mode }),
  newMatch: (): void =>
    set((s) => ({ mode: "play", gen: s.gen + 1, score: [0, 0], clock: 0 })),
  addGoal: (team) =>
    set((s) => {
      const score: [number, number] = [...s.score];
      score[team] += 1;
      return { score, mode: "goal" };
    }),
  setClock: (clock) => set({ clock }),
  setRadar: (radar) => set({ radar }),
}));
