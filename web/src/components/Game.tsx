import { useMemo } from "react";
import { world } from "../game/world";
import { loadMatch } from "../game/levels";
import { useStore } from "../game/store";
import { Pitch } from "./Pitch";
import { Ball } from "./Ball";
import { Players, RefereeView } from "./Players";
import { OffsideLine } from "./OffsideLine";
import { Systems } from "./Systems";

const g = globalThis as { __gpfLoadedMatchGen?: number };

/** One match. Remounted (keyed on gen) for every new game. */
export function Game(): React.ReactNode {
  const gen = useStore((s) => s.gen);
  useMemo(() => {
    if (g.__gpfLoadedMatchGen === gen) return;
    loadMatch(world);
    g.__gpfLoadedMatchGen = gen;
  }, [gen]);
  return (
    <>
      <Pitch />
      <Ball />
      <Players />
      <RefereeView />
      <OffsideLine />
      <Systems />
    </>
  );
}
