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
  /** important match: extra time then penalties when level after 90' */
  important: boolean;
  score: [number, number];
  /** game-time seconds (1 real second ≈ 7.7 game seconds, like the original) */
  clock: number;
  phaseLabel: string;
  /** referee banner: OFFSIDE / FOUL / cards / HALF TIME ... */
  banner: string;
  pens: number[] | null;
  /** [x0,z0, x1,z1, ...] for 22 players then the ball; normalized to [-1,1] */
  radar: number[];
  setMode: (mode: Mode) => void;
  toggleImportant: () => void;
  newMatch: () => void;
  addGoal: (team: number) => void;
  setClock: (clock: number) => void;
  setPhaseLabel: (phaseLabel: string) => void;
  setBanner: (banner: string) => void;
  setPens: (pens: number[] | null) => void;
  setRadar: (radar: number[]) => void;
}

export const useStore = create<Store>((set) => ({
  mode: "menu",
  gen: 0,
  important: false,
  score: [0, 0],
  clock: 0,
  phaseLabel: "1ST",
  banner: "",
  pens: null,
  radar: [],
  setMode: (mode) => set({ mode }),
  toggleImportant: () => set((s) => ({ important: !s.important })),
  newMatch: (): void =>
    set((s) => ({
      mode: "play",
      gen: s.gen + 1,
      score: [0, 0],
      clock: 0,
      phaseLabel: "1ST",
      banner: "",
      pens: null,
    })),
  addGoal: (team) =>
    set((s) => {
      const score: [number, number] = [...s.score];
      score[team] += 1;
      return { score, mode: "goal" };
    }),
  setClock: (clock) => set({ clock }),
  setPhaseLabel: (phaseLabel) => set({ phaseLabel }),
  setBanner: (banner) => set({ banner }),
  setPens: (pens) => set({ pens }),
  setRadar: (radar) => set({ radar }),
}));
