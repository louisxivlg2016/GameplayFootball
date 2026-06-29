import { create } from "zustand";
import { radioReset } from "./radio";

export type Mode =
  | "menu"
  | "play"
  | "goal"
  | "pause"
  | "replay"
  | "cardScene"
  | "offside";

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
  /** 1 = solo vs the AI, 2 = local versus on one keyboard (P2 steers BLU) */
  players: number;
  /** solo only: team controlled by player 1, 0 = RED, 1 = BLU */
  humanTeam: 0 | 1;
  /** starting eleven names chosen from the lineup screen */
  lineupNames: string[];
  /** game mode: 0 match, 1 shoot-out, 2 free-kick, 3 corner, 4 penalty, 5 offside drill, 6 tackle drill, 7 dribble drill */
  practice: number;
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
  /** short name of player 2's man in two-player mode */
  selectedName2: string;
  /** [x0,z0, x1,z1, ...] for 22 players then the ball; normalized to [-1,1] */
  radar: number[];
  /** world-x of the offside line to draw during an offside call, or null */
  offsideLineX: number | null;
  /** world-x of the offside player (the blue line: where you were ahead) */
  offsidePlayerX: number | null;
  setMode: (mode: Mode) => void;
  toggleImportant: () => void;
  cycleDifficulty: () => void;
  togglePlayers: () => void;
  toggleHumanTeam: () => void;
  setHumanTeam: (team: 0 | 1) => void;
  setLineupNames: (lineupNames: string[]) => void;
  cyclePractice: () => void;
  setPractice: (practice: number) => void;
  newMatch: () => void;
  addGoal: (team: number) => void;
  addGoalQuiet: (team: number) => void;
  setClock: (clock: number) => void;
  setPhaseLabel: (phaseLabel: string) => void;
  setBanner: (banner: string) => void;
  setPens: (pens: number[] | null) => void;
  setPensDetail: (pensDetail: [string[], string[]] | null) => void;
  setSelectedName: (selectedName: string) => void;
  setSelectedName2: (selectedName2: string) => void;
  setRadar: (radar: number[]) => void;
  setOffsideLine: (offsideLineX: number | null) => void;
  setOffsidePlayer: (offsidePlayerX: number | null) => void;
}

export const useStore = create<Store>((set) => ({
  mode: "menu",
  gen: 0,
  important: false,
  difficulty: 1,
  players: 1,
  humanTeam: 0,
  lineupNames: [],
  practice: 0,
  score: [0, 0],
  clock: 0,
  phaseLabel: "1ST",
  banner: "",
  pens: null,
  pensDetail: null,
  selectedName: "",
  selectedName2: "",
  radar: [],
  offsideLineX: null,
  offsidePlayerX: null,
  setMode: (mode) => set({ mode }),
  toggleImportant: () => set((s) => ({ important: !s.important })),
  cycleDifficulty: () => set((s) => ({ difficulty: (s.difficulty + 1) % 3 })),
  togglePlayers: () => set((s) => ({ players: s.players === 1 ? 2 : 1 })),
  toggleHumanTeam: () => set((s) => ({ humanTeam: s.humanTeam === 0 ? 1 : 0 })),
  setHumanTeam: (humanTeam) => set({ humanTeam }),
  setLineupNames: (lineupNames) => set({ lineupNames }),
  cyclePractice: () => set((s) => ({ practice: (s.practice + 1) % 8 })),
  setPractice: (practice) => set({ practice }),
  newMatch: (): void => {
    radioReset(); // clean mic/queue so the commentary never starts a match mute
    set((s) => ({
      mode: "play",
      gen: s.gen + 1,
      score: [0, 0],
      clock: 0,
      phaseLabel: "1ST",
      banner: "",
      pens: null,
      pensDetail: null,
      selectedName2: "",
    }));
  },
  addGoal: (team) =>
    set((s) => {
      const score: [number, number] = [...s.score];
      score[team] += 1;
      return { score, mode: "goal" };
    }),
  /** practice tally: bump the score without the goal celebration/mode switch */
  addGoalQuiet: (team: number) =>
    set((s) => {
      const score: [number, number] = [...s.score];
      score[team] += 1;
      return { score };
    }),
  setClock: (clock) => set({ clock }),
  setPhaseLabel: (phaseLabel) => set({ phaseLabel }),
  setBanner: (banner) => set({ banner }),
  setPens: (pens) => set({ pens }),
  setPensDetail: (pensDetail) => set({ pensDetail }),
  setSelectedName: (selectedName) =>
    set((s) => (s.selectedName === selectedName ? s : { selectedName })),
  setSelectedName2: (selectedName2) =>
    set((s) => (s.selectedName2 === selectedName2 ? s : { selectedName2 })),
  setRadar: (radar) => set({ radar }),
  setOffsideLine: (offsideLineX) => set({ offsideLineX }),
  setOffsidePlayer: (offsidePlayerX) => set({ offsidePlayerX }),
}));
