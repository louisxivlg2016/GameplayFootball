import { createRoot } from "react-dom/client";
import { initInput } from "./game/input";
import { App } from "./components/App";
// TEMP verify — expose world state for runtime observation
import { world } from "./game/world";
import * as traits from "./game/traits";
import { useStore } from "./game/store";
(window as unknown as Record<string, unknown>).__debug = { world, traits, useStore };

initInput();
createRoot(document.getElementById("root")!).render(<App />);
