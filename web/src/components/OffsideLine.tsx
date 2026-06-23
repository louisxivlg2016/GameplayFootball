import * as THREE from "three";
import { useStore } from "../game/store";
import { PITCH } from "../game/levels";

/**
 * TV-style offside line: a bright strip on the turf plus a translucent vertical
 * wall, drawn across the pitch at the offside position during an offside call.
 */
export function OffsideLine(): React.ReactNode {
  const x = useStore((s) => s.offsideLineX);
  if (x === null) return null;
  const len = PITCH.halfWidth * 2;
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[0.32, 0.12, len]} />
        <meshBasicMaterial color="#ffd60a" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[0.16, 1.6, len]} />
        <meshBasicMaterial
          color="#ffd60a"
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
