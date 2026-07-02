import * as THREE from "three";
import { trait } from "koota";
import type { Entity } from "koota";
import type { RapierRigidBody } from "@react-three/rapier";

export const IsBall = trait();
export const IsPlayer = trait();
/** The match official: rendered and animated like a player, ignored by play logic. */
export const IsReferee = trait();
/** The player human 1 (RED) is currently steering. */
export const Selected = trait();
/** The player human 2 (BLU) steers in local two-player mode. */
export const Selected2 = trait();

export const Team = trait({ id: 0 });

/** Roles mirror the original's GK/defence/midfield/attack split. */
export const Role = { GK: 0, DEF: 1, MID: 2, ATT: 3 } as const;

export const PlayerInfo = trait({
  index: 0,
  role: Role.MID as number,
  /** seconds until this AI player may make a new kick decision */
  aiTimer: 0,
  yellows: 0,
});

/** Per-player ratings, 0..1, like playerdata.cpp; energy is live stamina. */
export const Stats = trait({
  velocity: 0.5, // playerbase.cpp:136 — max speed = sprint·(0.9 + 0.1·v)
  ballcontrol: 0.5,
  shortpass: 0.5,
  shot: 0.5,
  tackle: 0.5,
  energy: 1,
});

/** Generated player identity (fictional names). `spoken` is the bare surname
 *  the commentator says — TTS stumbles on initials like "K. Morel". */
export const Name = trait(() => ({ full: "", short: "", spoken: "" }));

export const Position = trait(() => new THREE.Vector3());
export const Velocity = trait(() => new THREE.Vector3());
export const Heading = trait({ angle: 0 });
/** A keeper mid-dive: committed flight along the original deflect anims.
 *  kind picks the clip by ball height at the save: 0 high, 1 mid, 2 ground. */
export const KeeperDive = trait({ t: 0, side: 1, kind: 1 });
/** A player leaping: the free-kick wall block (header 0), or heading the ball
 *  with the original anims — 1 jumping header, 2 standing nod. */
export const Jump = trait({ t: 0, header: 0 });
/** A player mid slide-tackle: low reclined pose along the locked yaw. */
export const SlideTackle = trait({ t: 0, yaw: 0 });
/** A tackled player going down: fall=1 full knockdown (foul), 0.5 stumble. */
export const Tripped = trait({ t: 0, yaw: 0, fall: 1 });
/** A scorer celebrating IN live play (shoot-out kicks, training goals) — the
 *  match-goal cinematic has its own scene; this one plays on the pitch. */
export const Celebrate = trait({ t: 0 });
/** Formation anchor at a neutral ball position (x/z only). */
export const HomePos = trait(() => new THREE.Vector3());

export const MeshRef = trait(() => ({
  value: null as THREE.Group | null,
  ring: null as THREE.Mesh | null,
  tag: null as THREE.Sprite | null,
  /** skinned-mesh rig: mocap clips selected by gait + angle quadrant */
  mixer: null as THREE.AnimationMixer | null,
  actions: null as Record<string, THREE.AnimationAction> | null,
  bones: null as Record<string, THREE.Bone> | null,
  variant: "idle",
  bridging: null as string | null,
  pending: null as string | null,
  /** one-shot situation clip (dive/slide/celebrate/showcard) owning the rig */
  action: null as string | null,
  prevSpeed: 0,
  lean: 0,
}));
export const BallRef = trait(() => ({ value: null as RapierRigidBody | null }));

/** Live possession bookkeeping, lives on the ball entity (AoS: mutate in place). */
export const BallState = trait(() => ({
  owner: null as Entity | null,
  lastKicker: null as Entity | null,
  /** seconds during which lastKicker may not recapture the ball */
  kickCooldown: 0,
  /** short no-recapture windows after releases and tackle pokes */
  recaptureBlocks: [] as Array<{ player: Entity; t: number }>,
  /** seconds until the carrier's next dribble touch */
  touchTimer: 0,
  /** pass assist: the receiver a played pass homes onto while in flight */
  passTarget: null as Entity | null,
  passHomingT: 0,
  /** human-commanded pass: do not let opponents become the accidental target */
  passProtected: false,
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
