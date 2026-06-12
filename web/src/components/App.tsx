import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { WorldProvider } from "koota/react";
import { world } from "../game/world";
import { useStore } from "../game/store";
import { Game } from "./Game";
import { Hud } from "./Hud";

export function App(): React.ReactNode {
  const gen = useStore((s) => s.gen);
  const paused = useStore((s) => s.mode === "menu" || s.mode === "pause");
  return (
    <>
      {/* 25° telephoto from the original's TV camera (match.cpp:161) */}
      <Canvas
        shadows
        camera={{ fov: 25, near: 1, far: 320, position: [0, 14.5, 43] }}
      >
        <WorldProvider world={world}>
          <color attach="background" args={["#07120a"]} />
          <hemisphereLight args={["#bcd8ff", "#1c3a22", 0.7]} />
          <directionalLight
            castShadow
            position={[35, 70, 25]}
            intensity={1.7}
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-75}
            shadow-camera-right={75}
            shadow-camera-top={55}
            shadow-camera-bottom={-55}
            shadow-camera-far={180}
          />
          <Suspense fallback={null}>
            <Physics paused={paused} timeStep={1 / 60}>
              <Game key={gen} />
            </Physics>
          </Suspense>
        </WorldProvider>
      </Canvas>
      <Hud />
    </>
  );
}
