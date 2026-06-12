import { useStore } from "./store";

/** The AI-controlled opposition is team 1 (BLU). */
export const AI_TEAM = 1;

export interface DifficultyPreset {
  name: string;
  /** multiplier on the AI team's movement speed */
  aiSpeed: number;
  /** multiplier on the AI team's pass/shot technique error */
  aiErr: number;
  /** added to the AI carrier's shoot eagerness threshold */
  shootBoost: number;
  /** multiplier on the AI slide-tackle attempt probability */
  tackleChance: number;
}

export const DIFFICULTIES: DifficultyPreset[] = [
  { name: "FACILE", aiSpeed: 0.85, aiErr: 1.8, shootBoost: -0.08, tackleChance: 0.5 },
  { name: "NORMAL", aiSpeed: 1.0, aiErr: 1.0, shootBoost: 0, tackleChance: 1.0 },
  { name: "DIFFICILE", aiSpeed: 1.08, aiErr: 0.6, shootBoost: 0.06, tackleChance: 1.6 },
];

export const difficulty = (): DifficultyPreset =>
  DIFFICULTIES[useStore.getState().difficulty] ?? DIFFICULTIES[1]!;
