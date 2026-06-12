import * as THREE from "three";
import { useMemo } from "react";
import {
  CuboidCollider,
  CylinderCollider,
  RigidBody,
} from "@react-three/rapier";
import { PITCH } from "../game/levels";

const APRON_X = 7;
const APRON_Z = 6;
const GROUND_W = (PITCH.halfLength + APRON_X) * 2; // 124 m
const GROUND_H = (PITCH.halfWidth + APRON_Z) * 2; // 84 m

function makePitchTexture(): THREE.CanvasTexture {
  const px = 16; // pixels per meter
  const canvas = document.createElement("canvas");
  canvas.width = GROUND_W * px;
  canvas.height = GROUND_H * px;
  const ctx = canvas.getContext("2d")!;
  const X = (m: number): number => (m + GROUND_W / 2) * px;
  const Y = (m: number): number => (m + GROUND_H / 2) * px;
  const S = (m: number): number => m * px;

  // mowing stripes
  const stripeW = 110 / 18;
  for (let i = 0; i * stripeW < GROUND_W; i++) {
    ctx.fillStyle = i % 2 ? "#2e8033" : "#28732d";
    ctx.fillRect(S(stripeW) * i, 0, S(stripeW) + 1, canvas.height);
  }
  // darken the apron beyond the lines
  ctx.fillStyle = "rgba(0,18,0,0.22)";
  ctx.fillRect(0, 0, X(-PITCH.halfLength), canvas.height);
  ctx.fillRect(X(PITCH.halfLength), 0, canvas.width, canvas.height);
  ctx.fillRect(0, 0, canvas.width, Y(-PITCH.halfWidth));
  ctx.fillRect(0, Y(PITCH.halfWidth), canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = S(0.13);
  const rect = (x: number, y: number, w: number, h: number): void =>
    ctx.strokeRect(X(x), Y(y), S(w), S(h));
  const spot = (x: number, r: number): void => {
    ctx.beginPath();
    ctx.arc(X(x), Y(0), S(r), 0, Math.PI * 2);
    ctx.fill();
  };

  rect(-55, -36, 110, 72); // touch + goal lines
  ctx.beginPath(); // halfway line
  ctx.moveTo(X(0), Y(-36));
  ctx.lineTo(X(0), Y(36));
  ctx.stroke();
  ctx.beginPath(); // centre circle, r 9.15
  ctx.arc(X(0), Y(0), S(9.15), 0, Math.PI * 2);
  ctx.stroke();
  spot(0, 0.22);
  rect(-55, -20.16, 16.5, 40.32); // penalty areas
  rect(55 - 16.5, -20.16, 16.5, 40.32);
  rect(-55, -9.16, 5.5, 18.32); // goal areas
  rect(55 - 5.5, -9.16, 5.5, 18.32);
  spot(-44, 0.22); // penalty spots, 11 m out
  spot(44, 0.22);
  // penalty arcs: the part of the 9.15 m circle outside the box (±53°)
  ctx.beginPath();
  ctx.arc(X(-44), Y(0), S(9.15), -0.93, 0.93);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(X(44), Y(0), S(9.15), Math.PI - 0.93, Math.PI + 0.93);
  ctx.stroke();
  for (const sx of [-55, 55]) {
    for (const sy of [-36, 36]) {
      ctx.beginPath(); // corner arcs
      ctx.arc(X(sx), Y(sy), S(1), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function Pitch(): React.ReactNode {
  const texture = useMemo(makePitchTexture, []);
  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[GROUND_W, GROUND_H]} />
        <meshStandardMaterial map={texture} roughness={1} />
      </mesh>

      <RigidBody type="fixed" colliders={false}>
        {/* ground: restitution 0.62 averages with the ball's to ball.cpp's bounce */}
        <CuboidCollider
          args={[75, 1, 55]}
          position={[0, -1, 0]}
          friction={0.5}
          restitution={0.62}
        />
        {([1, -1] as const).map((s) => {
          const gx = s * PITCH.halfLength;
          const back = s * (PITCH.halfLength + PITCH.goalDepth);
          const mid = s * (PITCH.halfLength + PITCH.goalDepth / 2);
          return (
            <group key={s}>
              {/* woodwork: lively (ball.cpp post restitution 0.8) */}
              <CylinderCollider
                args={[PITCH.goalHeight / 2, PITCH.postRadius]}
                position={[gx, PITCH.goalHeight / 2, PITCH.goalHalfWidth]}
                restitution={0.98}
              />
              <CylinderCollider
                args={[PITCH.goalHeight / 2, PITCH.postRadius]}
                position={[gx, PITCH.goalHeight / 2, -PITCH.goalHalfWidth]}
                restitution={0.98}
              />
              <CylinderCollider
                args={[PITCH.goalHalfWidth + 0.07, PITCH.postRadius]}
                position={[gx, PITCH.goalHeight, 0]}
                rotation={[Math.PI / 2, 0, 0]}
                restitution={0.98}
              />
              {/* net cage: dead walls, ballSystem soaks momentum inside */}
              <CuboidCollider
                args={[0.05, PITCH.goalHeight / 2 + 0.05, PITCH.goalHalfWidth + 0.15]}
                position={[back, PITCH.goalHeight / 2, 0]}
                restitution={0}
              />
              <CuboidCollider
                args={[PITCH.goalDepth / 2, PITCH.goalHeight / 2 + 0.05, 0.05]}
                position={[mid, PITCH.goalHeight / 2, PITCH.goalHalfWidth + 0.05]}
                restitution={0}
              />
              <CuboidCollider
                args={[PITCH.goalDepth / 2, PITCH.goalHeight / 2 + 0.05, 0.05]}
                position={[mid, PITCH.goalHeight / 2, -PITCH.goalHalfWidth - 0.05]}
                restitution={0}
              />
              <CuboidCollider
                args={[PITCH.goalDepth / 2, 0.05, PITCH.goalHalfWidth + 0.15]}
                position={[mid, PITCH.goalHeight + 0.1, 0]}
                restitution={0}
              />
            </group>
          );
        })}
      </RigidBody>

      {([1, -1] as const).map((s) => (
        <Goal key={s} side={s} />
      ))}

      {/* ad boards + a dark stand as backdrop */}
      <mesh position={[0, 0.45, -38.5]}>
        <boxGeometry args={[120, 0.9, 0.2]} />
        <meshStandardMaterial color="#11264e" />
      </mesh>
      <mesh position={[0, 0.45, 39.5]}>
        <boxGeometry args={[120, 0.9, 0.2]} />
        <meshStandardMaterial color="#11264e" />
      </mesh>
      {([1, -1] as const).map((s) => (
        <mesh key={s} position={[s * 60, 0.45, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[78, 0.9, 0.2]} />
          <meshStandardMaterial color="#4a1140" />
        </mesh>
      ))}
      <mesh position={[0, 5, -50]}>
        <boxGeometry args={[150, 12, 14]} />
        <meshStandardMaterial color="#0c1016" />
      </mesh>
      {([1, -1] as const).map((s) => (
        <mesh key={s} position={[s * 70, 5, 0]}>
          <boxGeometry args={[14, 12, 110]} />
          <meshStandardMaterial color="#0c1016" />
        </mesh>
      ))}
    </group>
  );
}

function Goal({ side }: { side: number }): React.ReactNode {
  const x = side * PITCH.halfLength;
  return (
    <group>
      {([1, -1] as const).map((s) => (
        <mesh
          key={s}
          castShadow
          position={[x, PITCH.goalHeight / 2, s * PITCH.goalHalfWidth]}
        >
          <cylinderGeometry args={[0.09, 0.09, PITCH.goalHeight, 12]} />
          <meshStandardMaterial color="#f2f2f2" />
        </mesh>
      ))}
      <mesh castShadow position={[x, PITCH.goalHeight, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.09, 0.09, PITCH.goalHalfWidth * 2 + 0.18, 12]} />
        <meshStandardMaterial color="#f2f2f2" />
      </mesh>
      {/* netting */}
      <mesh
        position={[x + side * PITCH.goalDepth, PITCH.goalHeight / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <planeGeometry args={[PITCH.goalHalfWidth * 2 + 0.2, PITCH.goalHeight]} />
        <NetMaterial />
      </mesh>
      {([1, -1] as const).map((s) => (
        <mesh
          key={s}
          position={[
            x + (side * PITCH.goalDepth) / 2,
            PITCH.goalHeight / 2,
            s * (PITCH.goalHalfWidth + 0.08),
          ]}
        >
          <planeGeometry args={[PITCH.goalDepth, PITCH.goalHeight]} />
          <NetMaterial />
        </mesh>
      ))}
      <mesh
        position={[x + (side * PITCH.goalDepth) / 2, PITCH.goalHeight + 0.04, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[PITCH.goalDepth, PITCH.goalHalfWidth * 2 + 0.2]} />
        <NetMaterial />
      </mesh>
    </group>
  );
}

function NetMaterial(): React.ReactNode {
  return (
    <meshBasicMaterial
      color="#ffffff"
      transparent
      opacity={0.18}
      side={THREE.DoubleSide}
      depthWrite={false}
    />
  );
}
