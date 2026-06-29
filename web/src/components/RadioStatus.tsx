import { useEffect, useState } from "react";
import { useStore } from "../game/store";
import { initAudio, resumeAudio } from "../game/audio";
import {
  radioStatus,
  toggleRadio,
  reconnectRadio,
  resumeRadio,
  radioTest,
  type RadioStatusKind,
} from "../game/radio";

const LABEL: Record<RadioStatusKind, { text: string; color: string }> = {
  live: { text: "📻 à l'antenne", color: "#39d27f" },
  suspended: { text: "🔇 son en pause — cliquer", color: "#e0a93a" },
  loading: { text: "📻 chargement…", color: "#e0a93a" },
  reconnecting: { text: "📻 reconnexion…", color: "#e0a93a" },
  failed: { text: "📻 hors service — cliquer", color: "#e6584a" },
  muted: { text: "📻 coupée", color: "#9aa0a6" },
};

/**
 * Small radio state pill (top-left, in-match only). Diagnostic + control:
 * green = on air, amber = loading/reconnecting/sound-parked, red = dead,
 * grey = muted. Click (a user gesture): suspended → wake the audio context,
 * live → mute, muted → unmute, dead → force a reconnect.
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
    // the click is itself a user gesture — exactly what a parked context needs
    initAudio();
    resumeAudio();
    resumeRadio();
    if (status === "live" || status === "suspended") {
      radioTest(); // speak a test line now — proves whether sound reaches output
    } else if (status === "muted") {
      toggleRadio(); // un-mute
    } else {
      reconnectRadio(); // loading stuck / dead → force a fresh engine
    }
  };

  return (
    <button
      onClick={onClick}
      title="Cliquer pour tester le son de la radio / la réactiver (touche R pour couper)"
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
