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
  /** index into DIFFICULTIES: 0 facile, 1 normal, 2 difficile */
  difficulty: number;
  score: [number, number];
  /** game-time seconds (1 real second ≈ 7.7 game seconds, like the original) */
  clock: number;
  phaseLabel: string;
  /** referee banner: OFFSIDE / FOUL / cards / HALF TIME ... */
  banner: string;
  pens: number[] | null;
  /** per-kick shoot-out outcomes ("g" goal / "m" miss) for the HUD board */
  pensDetail: [string[], string[]] | null;
  /** short name of the player under human control */
  selectedName: string;
  /** [x0,z0, x1,z1, ...] for 22 players then the ball; normalized to [-1,1] */
  radar: number[];
  setMode: (mode: Mode) => void;
  toggleImportant: () => void;
  cycleDifficulty: () => void;
  newMatch: () => void;
  addGoal: (team: number) => void;
  setClock: (clock: number) => void;
  setPhaseLabel: (phaseLabel: string) => void;
  setBanner: (banner: string) => void;
  setPens: (pens: number[] | null) => void;
  setPensDetail: (pensDetail: [string[], string[]] | null) => void;
  setSelectedName: (selectedName: string) => void;
  setRadar: (radar: number[]) => void;
}

export const useStore = create<Store>((set) => ({
  mode: "menu",
  gen: 0,
  important: false,
  difficulty: 1,
  score: [0, 0],
  clock: 0,
  phaseLabel: "1ST",
  banner: "",
  pens: null,
  pensDetail: null,
  selectedName: "",
  radar: [],
  setMode: (mode) => set({ mode }),
  toggleImportant: () => set((s) => ({ important: !s.important })),
  cycleDifficulty: () => set((s) => ({ difficulty: (s.difficulty + 1) % 3 })),
  newMatch: (): void =>
    set((s) => ({
      mode: "play",
      gen: s.gen + 1,
      score: [0, 0],
      clock: 0,
      phaseLabel: "1ST",
      banner: "",
      pens: null,
      pensDetail: null,
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
  setPensDetail: (pensDetail) => set({ pensDetail }),
  setSelectedName: (selectedName) =>
    set((s) => (s.selectedName === selectedName ? s : { selectedName })),
  setRadar: (radar) => set({ radar }),
}));
