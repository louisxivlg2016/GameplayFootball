import { useFrame } from "@react-three/fiber";
import { world } from "../game/world";
import { useStore } from "../game/store";
import { flushPresses } from "../game/input";
import { possessionSystem } from "../game/systems/possession";
import { controlSystem } from "../game/systems/control";
import { tackleSystem } from "../game/systems/tackle";
import { aiSystem } from "../game/systems/ai";
import { movementSystem } from "../game/systems/movement";
import { ballSystem } from "../game/systems/ball";
import { refereeSystem } from "../game/systems/referee";
import { cameraSystem } from "../game/systems/camera";
import { radarSystem } from "../game/systems/radar";

export function Systems(): null {
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const mode = useStore.getState().mode;
    if (mode === "play") {
      possessionSystem(world, dt);
      controlSystem(world, dt);
      tackleSystem(world, dt);
      aiSystem(world, dt);
      movementSystem(world, dt);
      ballSystem(world, dt);
      refereeSystem(world, dt);
      radarSystem(world, dt);
    } else if (mode === "goal") {
      // celebration: ball keeps rolling in the net, countdown to kickoff
      ballSystem(world, dt);
      refereeSystem(world, dt);
      radarSystem(world, dt);
    }
    cameraSystem(world, dt, state.camera);
    flushPresses();
  });
  return null;
}
