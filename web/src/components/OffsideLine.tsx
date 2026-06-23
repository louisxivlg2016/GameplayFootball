import * as THREE from "three";
import { useStore } from "../game/store";
import { PITCH } from "../game/levels";

/** A bright line across the pitch at world-x = x; `wall` adds a vertical sheet. */
function Line({
  x,
  color,
  wall,
}: {
  x: number;
  color: string;
  wall: boolean;
}): React.ReactNode {
  const len = PITCH.halfWidth * 2;
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[0.32, 0.12, len]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {wall && (
        <mesh position={[0, 0.8, 0]}>
          <boxGeometry args={[0.16, 1.6, len]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.4}
            side={THREE.DoubleSide}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}

/**
 * TV-style offside graphic: a yellow line on the last defender (the offside
 * line) and a blue line on the attacker — the gap between them shows you were
 * ahead of the line when you got the ball.
 */
export function OffsideLine(): React.ReactNode {
  const lineX = useStore((s) => s.offsideLineX);
  const playerX = useStore((s) => s.offsidePlayerX);
  if (lineX === null && playerX === null) return null;
  return (
    <>
      {lineX !== null && <Line x={lineX} color="#ffd60a" wall />}
      {/* the attacker's line is JUST a line (no wall) on the offside man */}
      {playerX !== null && <Line x={playerX} color="#2e8bff" wall={false} />}
    </>
  );
}
