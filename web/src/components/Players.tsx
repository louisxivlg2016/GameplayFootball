import { useMemo } from "react";
import * as THREE from "three";
import type { Entity } from "koota";
import { useQuery, useQueryFirst } from "koota/react";
import {
  IsPlayer,
  IsReferee,
  MeshRef,
  Name,
  PlayerInfo,
  Position,
  Role,
  Team,
} from "../game/traits";
import { TEAMS } from "../game/store";
import { createPlayerRig } from "../render/playerRig";

const nameTextureCache = new Map<string, THREE.CanvasTexture>();

function nameTexture(name: string): THREE.CanvasTexture {
  let tex = nameTextureCache.get(name);
  if (tex) return tex;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 56;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "bold 30px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(0,0,0,0.75)";
  ctx.strokeText(name, 128, 28);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(name, 128, 28);
  tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  nameTextureCache.set(name, tex);
  return tex;
}

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

export function RefereeView(): React.ReactNode {
  const entity = useQueryFirst(IsReferee);
  const rig = useMemo(() => {
    if (!entity) return null;
    const r = createPlayerRig("referee", "#222222", 9, 1.86 / 1.92);
    const h = entity.get(MeshRef);
    if (h) {
      h.mixer = r.mixer;
      h.actions = r.actions;
      h.bones = r.bones;
      h.variant = "idle";
    }
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity]);
  if (!entity || !rig) return null;
  const p = entity.get(Position)!;
  return (
    <group
      position={[p.x, 0, p.z]}
      ref={(node) => {
        const h = entity.isAlive() ? entity.get(MeshRef) : undefined;
        if (h) h.value = node;
      }}
    >
      <primitive object={rig.root} />
    </group>
  );
}

function PlayerView({ entity }: { entity: Entity }): React.ReactNode {
  const rig = useMemo(() => {
    const team = entity.get(Team)!.id;
    const info = entity.get(PlayerInfo)!;
    const isKeeper = info.role === Role.GK;
    const kitKind: "team0" | "team1" | "gk0" | "gk1" = isKeeper
      ? team === 0
        ? "gk0"
        : "gk1"
      : team === 0
        ? "team0"
        : "team1";
    const variant = info.index + team * 11;
    // heights vary like the original's per-player DB scaling (default 1.92m model)
    const height = (1.78 + ((info.index * 37 + team * 13) % 16) / 100) / 1.92;
    const r = createPlayerRig(kitKind, TEAMS[team]!.color, variant, height);
    const h = entity.get(MeshRef);
    if (h) {
      h.mixer = r.mixer;
      h.actions = r.actions;
      h.bones = r.bones;
      h.variant = "idle";
    }
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const p = entity.get(Position)!;
  return (
    <group
      position={[p.x, 0, p.z]}
      ref={(node) => {
        const h = entity.isAlive() ? entity.get(MeshRef) : undefined;
        if (h) h.value = node;
      }}
    >
      <primitive object={rig.root} />
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
      <sprite
        position={[0, 2.45, 0]}
        scale={[2.2, 0.48, 1]}
        visible={false}
        ref={(node) => {
          const h = entity.isAlive() ? entity.get(MeshRef) : undefined;
          if (h) h.tag = node;
        }}
      >
        <spriteMaterial
          map={nameTexture(entity.get(Name)?.short ?? "")}
          transparent
          depthTest={false}
        />
      </sprite>
    </group>
  );
}
