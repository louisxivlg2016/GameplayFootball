import { useEffect, useState } from "react";
import { useStore } from "../game/store";
import {
  radioStatus,
  toggleRadio,
  reconnectRadio,
  type RadioStatusKind,
} from "../game/radio";

const LABEL: Record<RadioStatusKind, { text: string; color: string }> = {
  live: { text: "📻 à l'antenne", color: "#39d27f" },
  loading: { text: "📻 chargement…", color: "#e0a93a" },
  reconnecting: { text: "📻 reconnexion…", color: "#e0a93a" },
  failed: { text: "📻 hors service — cliquer", color: "#e6584a" },
  muted: { text: "📻 coupée", color: "#9aa0a6" },
};

/**
 * Small radio state pill (top-left, in-match only). Diagnostic + control:
 * green = on air, amber = loading/reconnecting, red = dead, grey = muted.
 * Click: live → mute, muted → unmute, any problem state → force a reconnect.
 */
export function RadioStatus(): React.ReactNode {
  const mode = useStore((s) => s.mode);
  const [status, setStatus] = useState<RadioStatusKind>("loading");

  useEffect(() => {
    const t = setInterval(() => setStatus(radioStatus()), 500);
    return (): void => clearInterval(t);
  }, []);

  if (mode === "menu") return null;
  const { text, color } = LABEL[status];

  const onClick = (): void => {
    if (status === "live" || status === "muted") toggleRadio();
    else reconnectRadio();
  };

  return (
    <button
      onClick={onClick}
      title="Radio : cliquer pour couper / réactiver ou reconnecter (touche R)"
      style={{
        position: "fixed",
        top: "8px",
        left: "8px",
        zIndex: 60,
        background: "rgba(0,0,0,0.5)",
        color,
        border: "none",
        borderRadius: "999px",
        padding: "4px 10px",
        font: "600 12px system-ui, sans-serif",
        letterSpacing: "0.02em",
        cursor: "pointer",
        WebkitBackdropFilter: "blur(4px)",
        backdropFilter: "blur(4px)",
      }}
    >
      {text}
    </button>
  );
}
