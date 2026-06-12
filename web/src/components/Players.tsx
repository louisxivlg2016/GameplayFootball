import type { Entity } from "koota";
import type * as THREE from "three";
import { useQuery } from "koota/react";
import {
  IsPlayer,
  MeshRef,
  PlayerInfo,
  Position,
  Role,
  Team,
} from "../game/traits";

type Kit = { shirt: string; shorts: string; socks: string };

const KITS: Kit[] = [
  { shirt: "#d8342c", shorts: "#ffffff", socks: "#d8342c" },
  { shirt: "#2459d6", shorts: "#ffffff", socks: "#2459d6" },
];
const GK_KITS: Kit[] = [
  { shirt: "#e8c83c", shorts: "#1c1c1c", socks: "#e8c83c" },
  { shirt: "#3ce0c0", shorts: "#1c1c1c", socks: "#3ce0c0" },
];

const SKIN = ["#8d5524", "#c68642", "#e0ac69", "#f1c27d", "#ffdbac", "#6b4226"];
// null = bald, like the original's hairstyle set
const HAIR: Array<string | null> = [
  "#1b1b1b",
  "#3a2a1a",
  "#6b4a2a",
  "#b8902a",
  null,
  "#15100c",
  "#4d3319",
];

export function Players(): React.ReactNode {
  const players = useQuery(IsPlayer);
  return (
    <>
      {players.map((e) => (
        <PlayerView key={e.id()} entity={e} />
      ))}
    </>
  );
}

type LimbKey = "value" | "body" | "armL" | "armR" | "legL" | "legR";

function PlayerView({ entity }: { entity: Entity }): React.ReactNode {
  const team = entity.get(Team)!.id;
  const info = entity.get(PlayerInfo)!;
  const kit = (info.role === Role.GK ? GK_KITS : KITS)[team]!;
  const skin = SKIN[(info.index * 7 + team * 3) % SKIN.length]!;
  const hair = HAIR[(info.index * 5 + team * 2) % HAIR.length];
  const p = entity.get(Position)!;

  const setRef =
    (key: LimbKey) =>
    (node: THREE.Group | null): void => {
      const h = entity.isAlive() ? entity.get(MeshRef) : undefined;
      if (h) h[key] = node;
    };

  return (
    <group position={[p.x, 0, p.z]} ref={setRef("value")}>
      {/* hip pivot: lean + limbs animate from here (movement system) */}
      <group ref={setRef("body")} position={[0, 0.85, 0]}>
        {/* torso */}
        <mesh castShadow position={[0, 0.32, 0]}>
          <capsuleGeometry args={[0.19, 0.35, 4, 10]} />
          <meshStandardMaterial color={kit.shirt} roughness={0.8} />
        </mesh>
        {/* shorts */}
        <mesh castShadow position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.185, 0.2, 0.26, 10]} />
          <meshStandardMaterial color={kit.shorts} roughness={0.85} />
        </mesh>
        {/* head + hair */}
        <mesh castShadow position={[0, 0.72, 0]}>
          <sphereGeometry args={[0.125, 14, 10]} />
          <meshStandardMaterial color={skin} roughness={0.7} />
        </mesh>
        {hair && (
          <mesh position={[0, 0.775, -0.015]} scale={[1, 0.62, 1]}>
            <sphereGeometry args={[0.13, 12, 8]} />
            <meshStandardMaterial color={hair} roughness={0.95} />
          </mesh>
        )}
        {/* arms: pivot at the shoulder */}
        {([1, -1] as const).map((s) => (
          <group
            key={s}
            ref={setRef(s > 0 ? "armL" : "armR")}
            position={[s * 0.26, 0.55, 0]}
          >
            <mesh castShadow position={[0, -0.06, 0]}>
              <sphereGeometry args={[0.075, 10, 8]} />
              <meshStandardMaterial color={kit.shirt} roughness={0.8} />
            </mesh>
            <mesh castShadow position={[0, -0.28, 0]}>
              <cylinderGeometry args={[0.048, 0.042, 0.42, 8]} />
              <meshStandardMaterial color={skin} roughness={0.7} />
            </mesh>
          </group>
        ))}
        {/* legs: pivot at the hip */}
        {([1, -1] as const).map((s) => (
          <group
            key={s}
            ref={setRef(s > 0 ? "legL" : "legR")}
            position={[s * 0.11, 0, 0]}
          >
            <mesh castShadow position={[0, -0.21, 0]}>
              <cylinderGeometry args={[0.075, 0.065, 0.42, 8]} />
              <meshStandardMaterial color={skin} roughness={0.7} />
            </mesh>
            <mesh castShadow position={[0, -0.61, 0]}>
              <cylinderGeometry args={[0.06, 0.05, 0.38, 8]} />
              <meshStandardMaterial color={kit.socks} roughness={0.8} />
            </mesh>
            <mesh castShadow position={[0, -0.82, 0.04]}>
              <boxGeometry args={[0.11, 0.07, 0.22]} />
              <meshStandardMaterial color="#181818" roughness={0.6} />
            </mesh>
          </group>
        ))}
      </group>
      <mesh
        position={[0, 0.05, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
        ref={(node) => {
          const h = entity.isAlive() ? entity.get(MeshRef) : undefined;
          if (h) h.ring = node;
        }}
      >
        <ringGeometry args={[0.55, 0.78, 24]} />
        <meshBasicMaterial color="#ffe94a" />
      </mesh>
    </group>
  );
}
