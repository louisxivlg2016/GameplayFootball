import { useStore } from "./store";

/** Historical default: BLU is AI when solo player keeps RED. Prefer aiTeam() for live logic. */
export const AI_TEAM = 1;
export const aiTeam = (): 0 | 1 => {
  const s = useStore.getState();
  return s.players === 2 ? 1 : s.humanTeam === 0 ? 1 : 0;
};

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
  /** multiplier on the AI keeper's save odds against a real strike */
  keeperSave: number;
}

export const DIFFICULTIES: DifficultyPreset[] = [
  { name: "FACILE", aiSpeed: 0.85, aiErr: 1.8, shootBoost: -0.08, tackleChance: 0.5, keeperSave: 0.7 },
  { name: "NORMAL", aiSpeed: 1.0, aiErr: 1.0, shootBoost: 0, tackleChance: 1.0, keeperSave: 1.0 },
  // aiSpeed never exceeds 1: hard mode plays smarter, not faster than you
  { name: "DIFFICILE", aiSpeed: 1.0, aiErr: 0.6, shootBoost: 0.06, tackleChance: 1.7, keeperSave: 1.35 },
];

export const difficulty = (): DifficultyPreset => {
  const s = useStore.getState();
  // local versus: team 1 is human-led, so its AI teammates play it straight —
  // no handicaps or boosts in either direction
  if (s.players === 2) return DIFFICULTIES[1]!;
  return DIFFICULTIES[s.difficulty] ?? DIFFICULTIES[1]!;
};
