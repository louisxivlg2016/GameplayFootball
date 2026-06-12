import * as THREE from "three";
import { trait } from "koota";
import type { Entity } from "koota";
import type { RapierRigidBody } from "@react-three/rapier";

export const IsBall = trait();
export const IsPlayer = trait();
/** The player the human is currently steering. */
export const Selected = trait();

export const Team = trait({ id: 0 });

/** Roles mirror the original's GK/defence/midfield/attack split. */
export const Role = { GK: 0, DEF: 1, MID: 2, ATT: 3 } as const;

export const PlayerInfo = trait({
  index: 0,
  role: Role.MID as number,
  /** seconds until this AI player may make a new kick decision */
  aiTimer: 0,
});

export const Position = trait(() => new THREE.Vector3());
export const Velocity = trait(() => new THREE.Vector3());
export const Heading = trait({ angle: 0 });
/** Formation anchor at a neutral ball position (x/z only). */
export const HomePos = trait(() => new THREE.Vector3());

export const MeshRef = trait(() => ({
  value: null as THREE.Group | null,
  ring: null as THREE.Mesh | null,
  /** skinned-mesh rig: mocap clips selected by gait */
  mixer: null as THREE.AnimationMixer | null,
  actions: null as Record<string, THREE.AnimationAction> | null,
  gait: "idle",
}));
export const BallRef = trait(() => ({ value: null as RapierRigidBody | null }));

/** Live possession bookkeeping, lives on the ball entity (AoS: mutate in place). */
export const BallState = trait(() => ({
  owner: null as Entity | null,
  lastKicker: null as Entity | null,
  /** seconds during which lastKicker may not recapture the ball */
  kickCooldown: 0,
}));

/** Match-flow singleton. */
export const Match = trait({
  lastTouchTeam: -1,
  /** seconds until the pending kickoff is executed (goal celebration) */
  resetTimer: 0,
  pendingKickoffTeam: -1,
  /** hysteresis so auto-switching doesn't flicker */
  switchCooldown: 0,
});
