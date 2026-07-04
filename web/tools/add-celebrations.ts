/**
 * Append extra signature goal celebrations to src/assets/players/anims.json
 * WITHOUT the original .anim source data: the poses compose onto the idle
 * cycle's first frame, and that idle clip already lives in anims.json. Uses the
 * exact same quaternion math as convert-player-assets.ts::buildCelebrationClip.
 *
 * Run once:  bun run tools/add-celebrations.ts
 */
import path from "node:path";

const OUT = path.resolve(import.meta.dir, "../src/assets/players/anims.json");

type Quat = [number, number, number, number];
const round = (n: number, p = 10000): number => Math.round(n * p) / p;
const qmul = (a: Quat, b: Quat): Quat => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const axisQ = (axis: "x" | "y" | "z", ang: number): Quat => {
  const s = Math.sin(ang / 2);
  return [axis === "x" ? s : 0, axis === "y" ? s : 0, axis === "z" ? s : 0, Math.cos(ang / 2)];
};

interface ClipJson {
  name: string;
  kind: string;
  gait: string;
  angle: number;
  duration: number;
  velocity: number;
  tracks: Record<string, { times: number[]; quats: number[] }>;
  rootZ: { times: number[]; values: number[] };
}

const data = JSON.parse(await Bun.file(OUT).text()) as { clips: ClipJson[] };

const idle = data.clips.find((c) => c.name === "idle");
if (!idle) throw new Error("no idle clip in anims.json");
const idleQ = new Map<string, Quat>();
for (const [bone, tr] of Object.entries(idle.tracks)) {
  idleQ.set(bone, tr.quats.slice(0, 4) as Quat);
}
const restZ = idle.rootZ.values[0] ?? -0.04;
const poseBase = (bone: string): Quat => idleQ.get(bone) ?? ([0, 0, 0, 1] as Quat);

type PoseKey = [number, Array<["x" | "y" | "z", number]>];
const K = (...keys: PoseKey[]): PoseKey[] => keys;
const still = (duration: number): PoseKey[] => [
  [0, []],
  [duration, []],
];

interface Spec {
  name: string;
  duration: number;
  bones: Record<string, PoseKey[]>;
  rootZ?: Array<[number, number]>;
}

function build(spec: Spec): ClipJson {
  const out: ClipJson = {
    name: spec.name,
    kind: "action",
    gait: "action",
    angle: 0,
    duration: spec.duration,
    velocity: 0,
    tracks: {},
    rootZ: { times: [], values: [] },
  };
  for (const [bone, keys] of Object.entries(spec.bones)) {
    const base = poseBase(bone);
    const times: number[] = [];
    const quats: number[] = [];
    for (const [t, rots] of keys) {
      let q: Quat = base;
      for (const [axis, ang] of rots) q = qmul(q, axisQ(axis, ang));
      times.push(round(t));
      quats.push(...q.map((v) => round(v)));
    }
    out.tracks[bone] = { times, quats };
  }
  for (const [t, z] of spec.rootZ ?? [[0, restZ], [spec.duration, restZ]]) {
    out.rootZ.times.push(round(t));
    out.rootZ.values.push(round(z));
  }
  return out;
}

// legs left still (pinned to idle) unless a pose bends them
const legsStill = {
  body: still(3.0),
  left_thigh: still(3.0),
  right_thigh: still(3.0),
  left_knee: still(3.0),
  right_knee: still(3.0),
  left_ankle: still(3.0),
  right_ankle: still(3.0),
};

const NEW: Spec[] = [
  {
    // both arms thrown STRAIGHT UP in a V — the triumphant "GOOOAL!"
    name: "cele_sky",
    duration: 3.0,
    bones: {
      middle: K([0, []], [0.4, [["x", -0.1]]], [3.0, [["x", -0.1]]]),
      neck: K([0, []], [0.4, [["x", -0.32]]], [3.0, [["x", -0.32]]]), // chin up to the sky
      left_shoulder: K(
        [0, []],
        [0.4, [["x", -2.75], ["y", -0.22]]],
        [1.4, [["x", -2.62], ["y", -0.22]]], // tiny pump
        [3.0, [["x", -2.75], ["y", -0.22]]],
      ),
      right_shoulder: K(
        [0, []],
        [0.4, [["x", -2.75], ["y", 0.22]]],
        [1.4, [["x", -2.62], ["y", 0.22]]],
        [3.0, [["x", -2.75], ["y", 0.22]]],
      ),
      left_elbow: K([0, []], [0.4, [["x", -0.08]]], [3.0, [["x", -0.08]]]),
      right_elbow: K([0, []], [0.4, [["x", -0.08]]], [3.0, [["x", -0.08]]]),
      ...legsStill,
    },
  },
  {
    // one arm shot up, index to the heavens — the finger-to-the-sky point
    name: "cele_point",
    duration: 3.0,
    bones: {
      neck: K([0, []], [0.4, [["x", -0.3]]], [3.0, [["x", -0.3]]]),
      right_shoulder: K(
        [0, []],
        [0.4, [["x", -2.82], ["y", 0.14]]],
        [3.0, [["x", -2.82], ["y", 0.14]]],
      ),
      right_elbow: K([0, []], [0.4, [["x", -0.05]]], [3.0, [["x", -0.05]]]),
      left_shoulder: K([0, []], [0.4, [["x", -0.2], ["y", -0.35]]], [3.0, [["x", -0.2], ["y", -0.35]]]),
      left_elbow: K([0, []], [0.4, [["x", -0.35]]], [3.0, [["x", -0.35]]]),
      ...legsStill,
    },
  },
  {
    // double-biceps flex, fists up beside the head — the strongman
    name: "cele_flex",
    duration: 3.0,
    bones: {
      middle: K([0, []], [0.4, [["x", 0.06]]], [3.0, [["x", 0.06]]]),
      neck: K([0, []], [0.4, [["x", 0.04]]], [3.0, [["x", 0.04]]]),
      left_shoulder: K(
        [0, []],
        [0.4, [["y", -1.05], ["x", -0.55]]],
        [3.0, [["y", -1.05], ["x", -0.55]]],
      ),
      right_shoulder: K(
        [0, []],
        [0.4, [["y", 1.05], ["x", -0.55]]],
        [3.0, [["y", 1.05], ["x", -0.55]]],
      ),
      left_elbow: K([0, []], [0.4, [["x", -2.5]]], [3.0, [["x", -2.5]]]),
      right_elbow: K([0, []], [0.4, [["x", -2.5]]], [3.0, [["x", -2.5]]]),
      ...legsStill,
    },
  },
];

const names = new Set(NEW.map((s) => s.name));
data.clips = data.clips.filter((c) => !names.has(c.name)); // idempotent re-run
for (const spec of NEW) {
  data.clips.push(build(spec));
  console.log(`+ ${spec.name}`);
}
await Bun.write(OUT, JSON.stringify(data));
console.log(`anims.json now has ${data.clips.length} clips`);
