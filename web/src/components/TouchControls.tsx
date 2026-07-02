import { useRef, useState } from "react";
import { holdKey, releaseKey, tapKey, touchMove } from "../game/input";
import { useI18n } from "../i18n";

/**
 * On-screen controls so the game is playable with touch or mouse, no keyboard:
 * an analog joystick (left) drives player 1's movement, action buttons (right)
 * fire shoot/pass/lob/tackle, and a held sprint pad. All via pointer events so
 * it works the same on phones and desktops.
 */
const SPRINT_CODE = "ShiftLeft";
const DEAD = 0.22; // joystick deadzone

export function TouchControls(): React.ReactNode {
  const { t } = useI18n();
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        // sit above the radar/scoreboard but let them show through the gaps
        zIndex: 5,
      }}
    >
      <Joystick />
      <Actions
        labels={{
          sprint: t("sprint"),
          header: t("header"),
          lob: t("lob"),
          lobSub: t("lobSub"),
          tackle: t("tackle"),
          pass: t("pass"),
          shoot: t("shoot"),
          power: t("power"),
        }}
      />
    </div>
  );
}

function Joystick(): React.ReactNode {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const R = 52; // max knob travel (px)

  const update = (clientX: number, clientY: number): void => {
    const base = baseRef.current;
    if (!base) return;
    const r = base.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const len = Math.hypot(dx, dy) || 1;
    if (len > R) {
      dx = (dx / len) * R;
      dy = (dy / len) * R;
    }
    setKnob({ x: dx, y: dy });
    const nx = dx / R;
    const nz = dy / R; // screen-down (+y) = toward camera (+z)
    const mag = Math.hypot(nx, nz);
    if (mag < DEAD) {
      touchMove.x = 0;
      touchMove.z = 0;
      touchMove.active = false;
    } else {
      // Match the keyboard feel: small thumb motions should not fling the
      // player away, but a full throw still reaches the same top pace.
      const dirX = nx / mag;
      const dirZ = nz / mag;
      const drive = Math.pow((mag - DEAD) / (1 - DEAD), 1.35);
      touchMove.x = dirX * drive;
      touchMove.z = dirZ * drive;
      touchMove.active = true;
    }
  };

  const end = (): void => {
    setKnob({ x: 0, y: 0 });
    touchMove.x = 0;
    touchMove.z = 0;
    touchMove.active = false;
  };

  return (
    <div
      ref={baseRef}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 0 && e.pointerType === "mouse") return;
        update(e.clientX, e.clientY);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      style={{
        position: "absolute",
        left: 26,
        bottom: 26,
        width: 132,
        height: 132,
        borderRadius: "50%",
        background: "rgba(8,12,24,0.4)",
        border: "2px solid rgba(255,255,255,0.25)",
        pointerEvents: "auto",
        touchAction: "none",
        userSelect: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 58,
          height: 58,
          marginLeft: -29,
          marginTop: -29,
          borderRadius: "50%",
          background: "rgba(255,233,74,0.85)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
          transform: `translate(${knob.x}px, ${knob.y}px)`,
          transition: knob.x === 0 && knob.y === 0 ? "transform 0.12s" : "none",
        }}
      />
    </div>
  );
}

function Btn({
  label,
  sub,
  color,
  size,
  onDown,
  onUp,
}: {
  label: string;
  sub?: string;
  color: string;
  size: number;
  onDown: () => void;
  onUp?: () => void;
}): React.ReactNode {
  const [active, setActive] = useState(false);
  return (
    <div
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setActive(true);
        onDown();
      }}
      onPointerUp={() => {
        setActive(false);
        onUp?.();
      }}
      onPointerCancel={() => {
        setActive(false);
        onUp?.();
      }}
      onLostPointerCapture={() => {
        setActive(false);
        onUp?.();
      }}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: active ? color : "rgba(8,12,24,0.55)",
        border: `2px solid ${color}`,
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: size > 64 ? 16 : 13,
        lineHeight: 1.05,
        pointerEvents: "auto",
        touchAction: "none",
        userSelect: "none",
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
      }}
    >
      {label}
      {sub && <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.85 }}>{sub}</span>}
    </div>
  );
}

function Actions({
  labels,
}: {
  labels: {
    sprint: string;
    header: string;
    lob: string;
    lobSub: string;
    tackle: string;
    pass: string;
    shoot: string;
    power: string;
  };
}): React.ReactNode {
  return (
    <div
      style={{
        position: "absolute",
        right: 22,
        bottom: 22,
        pointerEvents: "none",
      }}
    >
      {/* sprint + header pads */}
      <div style={{ position: "absolute", right: 188, bottom: 90 }}>
        <Btn
          label={labels.sprint}
          color="#7ddb5a"
          size={62}
          onDown={() => holdKey(SPRINT_CODE)}
          onUp={() => releaseKey(SPRINT_CODE)}
        />
      </div>
      <div style={{ position: "absolute", right: 190, bottom: 20 }}>
        <Btn label={labels.header} color="#c98bff" size={58} onDown={() => tapKey("KeyV")} />
      </div>
      {/* action diamond */}
      <div style={{ position: "relative", width: 176, height: 176 }}>
        <div style={{ position: "absolute", top: 0, left: 58 }}>
          <Btn
            label={labels.lob}
            sub={labels.lobSub}
            color="#4ad2ff"
            size={60}
            onDown={() => tapKey("KeyC")}
          />
        </div>
        <div style={{ position: "absolute", top: 58, left: 0 }}>
          <Btn label={labels.tackle} color="#ff6b4a" size={60} onDown={() => tapKey("KeyE")} />
        </div>
        <div style={{ position: "absolute", top: 58, right: 0 }}>
          <Btn label={labels.pass} color="#ffe94a" size={60} onDown={() => tapKey("KeyX")} />
        </div>
        <div style={{ position: "absolute", bottom: 6, right: -20 }}>
          {/* the cannonball: instant flat rocket (keyboard T) */}
          <Btn label={labels.power} color="#ff3b30" size={54} onDown={() => tapKey("KeyT")} />
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 50 }}>
          {/* hold to charge: a long press sends the ball very high */}
          <Btn
            label={labels.shoot}
            color="#2eb84a"
            size={76}
            onDown={() => holdKey("Space")}
            onUp={() => releaseKey("Space")}
          />
        </div>
      </div>
    </div>
  );
}
