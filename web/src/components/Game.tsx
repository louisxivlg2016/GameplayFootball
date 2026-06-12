import { useMemo } from "react";
import { world } from "../game/world";
import { loadMatch } from "../game/levels";
import { Pitch } from "./Pitch";
import { Ball } from "./Ball";
import { Players, RefereeView } from "./Players";
import { Systems } from "./Systems";

/** One match. Remounted (keyed on gen) for every new game. */
export function Game(): React.ReactNode {
  useMemo(() => loadMatch(world), []);
  return (
    <>
      <Pitch />
      <Ball />
      <Players />
      <RefereeView />
      <Systems />
    </>
  );
}
