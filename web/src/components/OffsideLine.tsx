import { useStore } from "../game/store";
import { PITCH } from "../game/levels";

/** A flat bright line on the turf across the pitch at world-x = x. */
function Line({ x, color }: { x: number; color: string }): React.ReactNode {
  return (
    <mesh position={[x, 0.07, 0]}>
      <boxGeometry args={[0.34, 0.14, PITCH.halfWidth * 2]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

/**
 * Offside graphic: a yellow line on the last defender (the offside line) and a
 * blue line on the attacker — both just flat lines on the grass, no walls.
 */
export function OffsideLine(): React.ReactNode {
  const lineX = useStore((s) => s.offsideLineX);
  const playerX = useStore((s) => s.offsidePlayerX);
  if (lineX === null && playerX === null) return null;
  return (
    <>
      {lineX !== null && <Line x={lineX} color="#ffd60a" />}
      {playerX !== null && <Line x={playerX} color="#2e8bff" />}
    </>
  );
}
