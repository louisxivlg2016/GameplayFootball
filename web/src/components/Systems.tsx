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
import { officialsSystem } from "../game/systems/officials";
import { commentarySystem } from "../game/systems/commentary";
import { cinematicSystem, recordFrame } from "../game/systems/cinematic";
import { cameraSystem } from "../game/systems/camera";
import { radarSystem } from "../game/systems/radar";

export function Systems(): null {
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const mode = useStore.getState().mode;
    if (mode === "play" && useStore.getState().practice === 5) {
      // offside drill: freeze the AI so the back line holds still — you just
      // steer your man back onside before you're flagged
      controlSystem(world, dt);
      movementSystem(world, dt);
      refereeSystem(world, dt);
      radarSystem(world, dt);
    } else if (mode === "play") {
      possessionSystem(world, dt);
      controlSystem(world, dt);
      tackleSystem(world, dt);
      aiSystem(world, dt);
      movementSystem(world, dt);
      ballSystem(world, dt);
      refereeSystem(world, dt);
      officialsSystem(world, dt);
      commentarySystem(world, dt);
      recordFrame(world, dt); // rolling buffer feeding the slow-mo replays
      radarSystem(world, dt);
    } else if (mode === "goal") {
      // celebration: scorer applauds in close-up, countdown to the replay
      ballSystem(world, dt);
      refereeSystem(world, dt);
      officialsSystem(world, dt);
      cinematicSystem(world, dt);
      radarSystem(world, dt);
    } else if (mode === "replay" || mode === "cardScene" || mode === "offside") {
      cinematicSystem(world, dt);
      radarSystem(world, dt);
    }
    cameraSystem(world, dt, state.camera);
    flushPresses();
  });
  return null;
}
