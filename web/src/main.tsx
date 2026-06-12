import { createRoot } from "react-dom/client";
import { initInput } from "./game/input";
import { App } from "./components/App";

initInput();
createRoot(document.getElementById("root")!).render(<App />);
