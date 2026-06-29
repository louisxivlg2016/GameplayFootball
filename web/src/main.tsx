import { createRoot } from "react-dom/client";
import { initInput } from "./game/input";
import { App } from "./components/App";
import { I18nProvider } from "./i18n";
initInput();
createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <App />
  </I18nProvider>,
);
