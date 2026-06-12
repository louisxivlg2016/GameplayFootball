/**
 * Converts the original GameplayFootball player assets into JSON for the web app:
 * - player.object        → bone hierarchy + pivot offsets
 * - base.anim.util       → bind (rest) pose quaternions
 * - models/fullbody.ase  → skinned mesh; vertex colors encode bone weights
 *                          (channel value v: joint = floor(v/10), weight = (v%10)/9,
 *                          normalized — see src/onthepitch/player/humanoid/humanoidbase.cpp:318)
 * - hairstyles/*.ase     → rigid hair meshes attached to the neck joint
 * - movement/*.anim      → locomotion cycles (10ms per frame, local-to-parent
 *                          x,y,z,w quaternions; cycles are single steps ending in the
 *                          L/R-mirrored start pose, so we append a mirrored copy to loop)
 *
 * Run: bun tools/convert-player-assets.ts
 */
import * as path from "node:path";
import { mkdir, copyFile, readdir } from "node:fs/promises";

const DATA = path.resolve(import.meta.dir, "../../data/media");
const OUT = path.resolve(import.meta.dir, "../src/assets/players");

const round = (n: number, p = 10000): number => Math.round(n * p) / p;

// ---------- player.object: skeleton ----------

interface JointDef {
  name: string;
  parent: number;
  pos: [number, number, number];
}

async function parseSkeleton(): Promise<JointDef[]> {
  const text = await Bun.file(
    path.join(DATA, "objects/players/player.object"),
  ).text();
  const joints: JointDef[] = [{ name: "player", parent: -1, pos: [0, 0, 0] }];
  const stack: number[] = [0];
  const re = /<node>|<\/node>|<name>([^<]+)<\/name>|<position>([^<]+)<\/position>/g;
  let m: RegExpExecArray | null;
  let pendingIndex = -1;
  while ((m = re.exec(text))) {
    if (m[0] === "<node>") {
      joints.push({ name: "", parent: stack[stack.length - 1]!, pos: [0, 0, 0] });
      pendingIndex = joints.length - 1;
      stack.push(pendingIndex);
    } else if (m[0] === "</node>") {
      stack.pop();
    } else if (m[1] !== undefined && pendingIndex >= 0 && !joints[pendingIndex]!.name) {
      joints[pendingIndex]!.name = m[1].trim();
    } else if (m[2] !== undefined && pendingIndex >= 0) {
      const idx = stack[stack.length - 1]!;
      const v = m[2].split(",").map((s) => parseFloat(s));
      if (joints[idx]!.pos.every((c) => c === 0)) {
        joints[idx]!.pos = [v[0]!, v[1]!, v[2]!];
      }
    }
  }
  return joints;
}

// ---------- .anim parsing ----------

interface BoneTrack {
  frames: number[];
  // quats per key (x,y,z,w) for bones; positions (x,y,z) for "player"
  values: number[][];
}
type AnimTracks = Map<string, BoneTrack>;

async function parseAnim(file: string): Promise<AnimTracks> {
  const text = await Bun.file(file).text();
  const tracks: AnimTracks = new Map();
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("<")) {
      if (line.startsWith("<")) break;
      continue;
    }
    const tok = line.split(",");
    const name = tok[0]!.trim();
    const stride = name === "player" ? 4 : 5;
    const track: BoneTrack = { frames: [], values: [] };
    for (let i = 1; i + stride - 1 <= tok.length - 1; i += stride) {
      track.frames.push(parseInt(tok[i]!, 10));
      track.values.push(
        tok.slice(i + 1, i + stride).map((s) => parseFloat(s)),
      );
    }
    tracks.set(name, track);
  }
  return tracks;
}

const MIRROR: Record<string, string> = {};
for (const base of ["shoulder", "elbow", "thigh", "knee", "ankle"]) {
  MIRROR[`left_${base}`] = `right_${base}`;
  MIRROR[`right_${base}`] = `left_${base}`;
}

/** Mirror across the x=0 plane: swap L/R bones, quats (x,y,z,w) -> (x,-y,-z,w). */
function mirrorQuat(v: number[]): number[] {
  return [v[0]!, -v[1]!, -v[2]!, v[3]!];
}

interface ClipJson {
  name: string;
  kind: "cycle" | "bridge";
  gait: string;
  /** body-facing vs movement-direction angle in degrees (cycles only) */
  angle: number;
  duration: number; // seconds
  velocity: number; // m/s of the original root motion
  tracks: Record<string, { times: number[]; quats: number[] }>;
  rootZ: { times: number[]; values: number[] };
}

const FRAME_S = 0.01; // 10ms per frame (animation.cpp velocity = delta/frames*100)

const qdot = (a: number[], b: number[]): number =>
  a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]! + a[3]! * b[3]!;

/** Hemisphere-corrected normalized lerp; fine for the near-identical junction keys. */
function qblend(a: number[], b: number[], t: number): number[] {
  const sign = qdot(a, b) < 0 ? -1 : 1;
  const out = a.map((v, i) => v * (1 - t) + b[i]! * sign * t);
  const len = Math.hypot(out[0]!, out[1]!, out[2]!, out[3]!) || 1;
  return out.map((v) => round(v / len));
}

/** Yaw about +Z (model up) of an x,y,z,w quaternion. */
const quatYaw = (q: number[]): number =>
  Math.atan2(2 * (q[3]! * q[2]! + q[0]! * q[1]!), 1 - 2 * (q[1]! * q[1]! + q[2]! * q[2]!));

const normDeg = (d: number): number => (((d + 180) % 360) + 360) % 360 - 180;

/**
 * Original-style classification (animation.cpp GetIncoming/OutgoingVelocity):
 * velocities from root-track deltas ×100; body-vs-movement angle from the body
 * bone yaw against the displacement direction (forward = -Y); loopability from
 * end pose vs (mirrored) start pose.
 */
interface AnimInfo {
  file: string;
  tracks: AnimTracks;
  F: number;
  vIn: number;
  vOut: number;
  v: number;
  bodyDev: number; // degrees
  /** how much the body yaw rotates across the clip — a true cycle holds it */
  yawDelta: number;
  mirrorScore: number;
  rawScore: number;
}

function classify(file: string, tracks: AnimTracks): AnimInfo | null {
  const player = tracks.get("player");
  const body = tracks.get("body");
  if (!player || !body || player.frames.length < 2) return null;
  const F = Math.max(...player.frames);
  if (F < 4) return null;
  const first = player.values[0]!;
  const last = player.values[player.values.length - 1]!;
  const seg = (i: number, j: number): number => {
    const df = player.frames[j]! - player.frames[i]!;
    if (df <= 0) return 0;
    return (
      Math.hypot(
        player.values[j]![0]! - player.values[i]![0]!,
        player.values[j]![1]! - player.values[i]![1]!,
      ) /
      (df * FRAME_S)
    );
  };
  const vIn = seg(0, 1);
  const vOut = seg(player.frames.length - 2, player.frames.length - 1);
  const dx = last[0]! - first[0]!;
  const dy = last[1]! - first[1]!;
  const v = Math.hypot(dx, dy) / (F * FRAME_S);

  // movement angle relative to facing: forward is -Y in model space
  const moveAngle = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const yawStart = (quatYaw(body.values[0]!) * 180) / Math.PI;
  const yawEnd = (quatYaw(body.values[body.values.length - 1]!) * 180) / Math.PI;
  const yawDelta = Math.abs(normDeg(yawEnd - yawStart));
  // NOTE: averaging start/end yaw is fooled by turning clips (+135 → -135
  // averages to 0); yawDelta below is what rejects those
  const bodyYaw = (yawStart + yawEnd) / 2;
  const bodyDev = v > 0.5 ? normDeg(moveAngle - bodyYaw) : 0;

  let mirrorScore = 0;
  let rawScore = 0;
  for (const [bone, track] of tracks) {
    if (bone === "player") continue;
    const end = track.values[track.values.length - 1]!;
    const start = track.values[0]!;
    const partner = tracks.get(MIRROR[bone] ?? bone) ?? track;
    mirrorScore += 1 - Math.abs(qdot(end, mirrorQuat(partner.values[0]!)));
    rawScore += 1 - Math.abs(qdot(end, start));
  }
  const zJump = Math.abs(last[2]! - first[2]!);
  mirrorScore += zJump * 2;
  rawScore += zJump * 2;
  return { file, tracks, F, vIn, vOut, v, bodyDev, yawDelta, mirrorScore, rawScore };
}

/**
 * Loopable cycle. method "mirror": append the L/R-mirrored copy (single-step
 * cycles end in the mirrored start pose); junction key blended 50/50, wrap key
 * forced to the start pose so loops have no per-stride hitch. method "raw":
 * the file is already a full cycle; only the wrap key is forced.
 */
function buildCycleClip(
  name: string,
  gait: string,
  angle: number,
  info: AnimInfo,
  method: "mirror" | "raw",
): ClipJson {
  const { tracks, F } = info;
  const out: ClipJson = {
    name,
    kind: "cycle",
    gait,
    angle,
    duration: round((method === "mirror" ? 2 * F : F) * FRAME_S),
    velocity: round(info.v),
    tracks: {},
    rootZ: { times: [], values: [] },
  };

  for (const [bone, track] of tracks) {
    if (bone === "player") continue;
    const times: number[] = [];
    const quats: number[] = [];
    const start = track.values[0]!;
    if (method === "raw") {
      for (let k = 0; k < track.frames.length; k++) {
        const isLast = k === track.frames.length - 1;
        times.push(round(track.frames[k]! * FRAME_S));
        quats.push(...(isLast ? start.map((v) => round(v)) : track.values[k]!.map((v) => round(v))));
      }
    } else {
      const partner = tracks.get(MIRROR[bone] ?? bone) ?? track;
      const mirroredPartnerStart = mirrorQuat(partner.values[0]!);
      for (let k = 0; k < track.frames.length; k++) {
        const isLast = k === track.frames.length - 1;
        times.push(round(track.frames[k]! * FRAME_S));
        quats.push(
          ...(isLast
            ? qblend(track.values[k]!, mirroredPartnerStart, 0.5)
            : track.values[k]!.map((v) => round(v))),
        );
      }
      for (let k = 1; k < partner.frames.length; k++) {
        const isLast = k === partner.frames.length - 1;
        times.push(round((F + partner.frames[k]!) * FRAME_S));
        quats.push(
          ...(isLast ? start.map((v) => round(v)) : mirrorQuat(partner.values[k]!).map((v) => round(v))),
        );
      }
    }
    out.tracks[bone] = { times, quats };
  }

  const player = tracks.get("player")!;
  const z0 = player.values[0]![2]!;
  const pushZ = (frameOffset: number, forceStartAtEnd: boolean): void => {
    for (let k = frameOffset === 0 ? 0 : 1; k < player.frames.length; k++) {
      const isLast = k === player.frames.length - 1;
      out.rootZ.times.push(round((frameOffset + player.frames[k]!) * FRAME_S));
      out.rootZ.values.push(
        round(isLast && forceStartAtEnd ? z0 : player.values[k]![2]!),
      );
    }
  };
  if (method === "raw") {
    pushZ(0, true);
  } else {
    pushZ(0, false);
    pushZ(F, true);
  }
  return out;
}

/** One-shot accel/decel bridge, played sequentially like humanoidbase.cpp:587-592. */
function buildBridgeClip(name: string, gait: string, info: AnimInfo): ClipJson {
  const out: ClipJson = {
    name,
    kind: "bridge",
    gait,
    angle: 0,
    duration: round(info.F * FRAME_S),
    velocity: round(Math.max(info.vIn, info.vOut)),
    tracks: {},
    rootZ: { times: [], values: [] },
  };
  for (const [bone, track] of info.tracks) {
    if (bone === "player") continue;
    const times: number[] = [];
    const quats: number[] = [];
    for (let k = 0; k < track.frames.length; k++) {
      times.push(round(track.frames[k]! * FRAME_S));
      quats.push(...track.values[k]!.map((v) => round(v)));
    }
    out.tracks[bone] = { times, quats };
  }
  const player = info.tracks.get("player")!;
  for (let k = 0; k < player.frames.length; k++) {
    out.rootZ.times.push(round(player.frames[k]! * FRAME_S));
    out.rootZ.values.push(round(player.values[k]![2]!));
  }
  return out;
}

/** Full-clip mirror: the ∓angle variant of an angled cycle. */
function mirrorClip(clip: ClipJson, name: string): ClipJson {
  const out: ClipJson = {
    ...clip,
    name,
    angle: -clip.angle,
    tracks: {},
    rootZ: clip.rootZ,
  };
  for (const [bone, t] of Object.entries(clip.tracks)) {
    const partner = MIRROR[bone] ?? bone;
    const src = clip.tracks[partner] ?? t;
    const quats: number[] = [];
    for (let k = 0; k < src.quats.length; k += 4) {
      quats.push(...mirrorQuat(src.quats.slice(k, k + 4)).map((v) => round(v)));
    }
    out.tracks[bone] = { times: src.times, quats };
  }
  return out;
}

async function scanAnims(dir: string): Promise<AnimInfo[]> {
  const infos: AnimInfo[] = [];
  const walk = async (d: string): Promise<void> => {
    for (const entry of await readdir(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) await walk(p);
      else if (entry.name.endsWith(".anim")) {
        const info = classify(p, await parseAnim(p));
        if (info) infos.push(info);
      }
    }
  };
  await walk(dir);
  return infos;
}

// ---------- ASE parsing ----------

interface AseObject {
  name: string;
  materialRef: number;
  verts: number[][];
  faces: number[][]; // a,b,c
  tverts: number[][];
  tfaces: number[][];
  cverts: number[][]; // 0-255 rounded, like gamedefines.cpp:90
  cfaces: number[][];
}

async function parseAse(
  file: string,
): Promise<{ materials: string[]; objects: AseObject[] }> {
  const text = await Bun.file(file).text();
  const materials: string[] = [];
  const objects: AseObject[] = [];
  let cur: AseObject | null = null;
  for (const rawLine of text.split("\n")) {
    const tok = rawLine.trim().split(/[\s\t]+/);
    const key = tok[0];
    if (key === "*MATERIAL_NAME" && !cur && materials.length < 64) {
      materials.push(tok.slice(1).join(" ").replace(/"/g, ""));
    } else if (key === "*GEOMOBJECT") {
      cur = {
        name: "",
        materialRef: -1,
        verts: [],
        faces: [],
        tverts: [],
        tfaces: [],
        cverts: [],
        cfaces: [],
      };
      objects.push(cur);
    } else if (!cur) {
      continue;
    } else if (key === "*NODE_NAME" && !cur.name) {
      cur.name = tok[1]!.replace(/"/g, "");
    } else if (key === "*MESH_VERTEX") {
      cur.verts.push([+tok[2]!, +tok[3]!, +tok[4]!]);
    } else if (key === "*MESH_FACE") {
      // ASE winding is opposite to three.js front-face convention
      cur.faces.push([+tok[3]!, +tok[7]!, +tok[5]!]);
    } else if (key === "*MESH_TVERT") {
      cur.tverts.push([+tok[2]!, +tok[3]!]);
    } else if (key === "*MESH_TFACE") {
      cur.tfaces.push([+tok[2]!, +tok[4]!, +tok[3]!]);
    } else if (key === "*MESH_VERTCOL") {
      cur.cverts.push([
        Math.round(+tok[2]! * 255),
        Math.round(+tok[3]! * 255),
        Math.round(+tok[4]! * 255),
      ]);
    } else if (key === "*MESH_CFACE") {
      cur.cfaces.push([+tok[2]!, +tok[4]!, +tok[3]!]);
    } else if (key === "*MATERIAL_REF") {
      cur.materialRef = +tok[1]!;
    }
  }
  return { materials, objects };
}

/** humanoidbase.cpp:318-338 — decode one vertex color into up to 3 normalized weights. */
function decodeWeights(color: number[]): Array<{ joint: number; weight: number }> {
  const bones = color.map((c) => ({
    joint: Math.floor(c * 0.1),
    weight: (c - Math.floor(c * 0.1) * 10) / 9,
  }));
  const total = bones.reduce((s, b) => s + b.weight, 0);
  return bones
    .filter((b) => b.weight > 0.01)
    .map((b) => ({ joint: b.joint, weight: b.weight / total }));
}

// material name → render group
const MATERIAL_GROUP: Record<string, string> = {
  kit: "kit",
  skin: "skin",
  knee: "skin",
  arm: "skin",
  shoe: "shoe",
  shoe_sole: "sole",
};

interface MeshJson {
  positions: number[];
  uvs: number[];
  skinIndices: number[];
  skinWeights: number[];
  groups: Array<{ start: number; count: number; material: string }>;
}

function buildMesh(materials: string[], objects: AseObject[]): MeshJson {
  const byGroup = new Map<
    string,
    { positions: number[]; uvs: number[]; si: number[]; sw: number[] }
  >();
  for (const obj of objects) {
    const matName = materials[obj.materialRef] ?? "kit";
    const group = MATERIAL_GROUP[matName];
    if (!group) continue;
    let g = byGroup.get(group);
    if (!g) {
      g = { positions: [], uvs: [], si: [], sw: [] };
      byGroup.set(group, g);
    }
    for (let f = 0; f < obj.faces.length; f++) {
      for (let c = 0; c < 3; c++) {
        const v = obj.verts[obj.faces[f]![c]!]!;
        g.positions.push(round(v[0]!), round(v[1]!), round(v[2]!));
        const t = obj.tverts[obj.tfaces[f]?.[c] ?? 0] ?? [0, 0];
        g.uvs.push(round(t[0]!), round(t[1]!));
        const weights = decodeWeights(obj.cverts[obj.cfaces[f]![c]!]!);
        for (let i = 0; i < 4; i++) {
          g.si.push(weights[i]?.joint ?? 0);
          g.sw.push(round(weights[i]?.weight ?? 0));
        }
      }
    }
  }
  const mesh: MeshJson = {
    positions: [],
    uvs: [],
    skinIndices: [],
    skinWeights: [],
    groups: [],
  };
  for (const [material, g] of byGroup) {
    mesh.groups.push({
      start: mesh.positions.length / 3,
      count: g.positions.length / 3,
      material,
    });
    mesh.positions.push(...g.positions);
    mesh.uvs.push(...g.uvs);
    mesh.skinIndices.push(...g.si);
    mesh.skinWeights.push(...g.sw);
  }
  return mesh;
}

// ---------- main ----------

await mkdir(OUT, { recursive: true });

const skeleton = await parseSkeleton();
console.log("skeleton:", skeleton.map((j) => j.name).join(" "));

// bind pose = base.anim.util frame 0 (humanoidbase.cpp:209-219)
const baseTracks = await parseAnim(path.join(DATA, "animations/base.anim.util"));
const rest: Record<string, number[]> = {};
for (const [bone, track] of baseTracks) {
  if (bone === "player") continue;
  rest[bone] = track.values[0]!.map((v) => round(v));
}

const playersDir = path.join(DATA, "objects/players");
const { materials, objects } = await parseAse(
  path.join(playersDir, "models/fullbody.ase"),
);
console.log("materials:", materials.join(", "));
console.log(
  "objects:",
  objects.map((o) => `${o.name}(${materials[o.materialRef]})`).join(" "),
);
const mesh = buildMesh(materials, objects);
console.log(
  "mesh corners:",
  mesh.positions.length / 3,
  "groups:",
  mesh.groups.map((g) => `${g.material}:${g.count}`).join(" "),
);

// hairstyles: rigid meshes, world space (attached to neck at runtime)
const hair: Record<string, { positions: number[]; uvs: number[] }> = {};
for (const file of await readdir(path.join(playersDir, "hairstyles"))) {
  if (!file.endsWith(".ase")) continue;
  const parsed = await parseAse(path.join(playersDir, "hairstyles", file));
  const positions: number[] = [];
  const uvs: number[] = [];
  for (const obj of parsed.objects) {
    for (let f = 0; f < obj.faces.length; f++) {
      for (let c = 0; c < 3; c++) {
        const v = obj.verts[obj.faces[f]![c]!]!;
        positions.push(round(v[0]!), round(v[1]!), round(v[2]!));
        const t = obj.tverts[obj.tfaces[f]?.[c] ?? 0] ?? [0, 0];
        uvs.push(round(t[0]!), round(t[1]!));
      }
    }
  }
  hair[file.replace(".ase", "")] = { positions, uvs };
}
console.log(
  "hair:",
  Object.entries(hair)
    .map(([k, v]) => `${k}:${v.positions.length / 3}`)
    .join(" "),
);

await Bun.write(
  path.join(OUT, "model.json"),
  JSON.stringify({ skeleton, rest, mesh, hair }),
);

// locomotion cycles + bridges, classified like animcollection.cpp's quadrant
// system: steady-state (vIn ≈ vOut in the gait band), body-vs-movement angle
// quantized to 0/±45/±90/±135, loopability scored against the (mirrored) start.
const animDir = path.join(DATA, "animations");
const all = await scanAnims(path.join(animDir, "movement"));
console.log(`scanned ${all.length} movement anims`);

const BANDS: Record<string, [number, number]> = {
  idle: [0, 1.2],
  dribble: [2.0, 4.6],
  walk: [4.2, 6.2],
  sprint: [6.2, 8.5],
};
const clips: ClipJson[] = [];

function pickCycle(gait: string, targetAngle: number): void {
  const [lo, hi] = BANDS[gait]!;
  const mid = (lo + hi) / 2;
  let best: { info: AnimInfo; method: "mirror" | "raw"; score: number } | null = null;
  for (const info of all) {
    const steady = Math.abs(info.vIn - info.vOut) <= 1.2;
    const inBand =
      gait === "idle"
        ? info.v <= hi
        : info.vIn >= lo && info.vIn <= hi + 0.3 && info.vOut >= lo && info.vOut <= hi + 0.3;
    if (!steady || !inBand) continue;
    // turning transitions (body pivoting through the clip) are not cycles —
    // looping them makes players visibly run sideways/backwards
    if (info.yawDelta > 15) continue;
    const angleDist = Math.abs(normDeg(info.bodyDev - targetAngle));
    if (angleDist > (targetAngle === 0 ? 25 : 22)) continue;
    // angled cycles must self-loop: a mirrored second half would flip the angle
    const method: "mirror" | "raw" =
      targetAngle === 0
        ? info.mirrorScore <= info.rawScore
          ? "mirror"
          : "raw"
        : "raw";
    const loopScore = method === "mirror" ? info.mirrorScore : info.rawScore;
    if (targetAngle !== 0 && info.rawScore > 0.15) continue; // not cleanly loopable
    const score =
      loopScore * 2 +
      angleDist / 45 +
      Math.abs(info.vIn - info.vOut) / 3 +
      (gait === "idle" ? 0 : Math.abs(info.v - mid) * 0.4);
    if (!best || score < best.score) best = { info, method, score };
  }
  if (!best) {
    console.log(`cycle ${gait}@${targetAngle}: none found`);
    return;
  }
  const name = targetAngle === 0 ? gait : `${gait}_${targetAngle}`;
  const clip = buildCycleClip(name, gait, targetAngle, best.info, best.method);
  clips.push(clip);
  console.log(
    `cycle ${name}: ${path.relative(animDir, best.info.file)} v=${clip.velocity} ` +
      `dev=${best.info.bodyDev.toFixed(0)} ${best.method} loop=${best.score.toFixed(3)}`,
  );
  if (targetAngle !== 0) clips.push(mirrorClip(clip, `${gait}_${-targetAngle}`));
}

function pickBridge(from: string, to: string): void {
  const moving = from === "idle" ? to : from;
  const [lo, hi] = BANDS[moving]!;
  const startsIdle = from === "idle";
  let best: { info: AnimInfo; score: number } | null = null;
  for (const info of all) {
    const vStart = startsIdle ? info.vIn : info.vOut;
    const vEnd = startsIdle ? info.vOut : info.vIn;
    if (vStart > 1.8) continue;
    if (vEnd < lo - 0.8 || vEnd > hi + 1) continue;
    if (Math.abs(info.bodyDev) > 30) continue;
    const score = Math.abs(info.bodyDev) / 45 + Math.abs(vEnd - (lo + hi) / 2) / 5;
    if (!best || score < best.score) best = { info, score };
  }
  if (!best) {
    console.log(`bridge ${from}->${to}: none found`);
    return;
  }
  const name = `${from}_to_${to}`;
  clips.push(buildBridgeClip(name, to, best.info));
  console.log(
    `bridge ${name}: ${path.relative(animDir, best.info.file)} ` +
      `vIn=${best.info.vIn.toFixed(1)} vOut=${best.info.vOut.toFixed(1)}`,
  );
}

pickCycle("idle", 0);
for (const gait of ["dribble", "walk", "sprint"]) {
  pickCycle(gait, 0);
  for (const angle of [45, 90, 135]) pickCycle(gait, angle);
}

// the data has no TRUE straight cycles at walk/dribble pace (only turning
// transitions, which loop as visible moonwalking) — reuse the sprint cycle;
// keeping its source velocity means timeScale recadences the feet correctly
function aliasCycle(from: string, to: string): void {
  const src = clips.find((c) => c.name === from && c.kind === "cycle");
  if (!src || clips.some((c) => c.name === to)) return;
  clips.push({ ...src, name: to, gait: to });
  console.log(`cycle ${to}: aliased from ${from} (feet matched via timeScale)`);
}
aliasCycle("sprint", "walk");
aliasCycle("sprint", "dribble");
for (const gait of ["dribble", "walk", "sprint"]) {
  pickBridge("idle", gait);
  pickBridge(gait, "idle");
}

await Bun.write(path.join(OUT, "anims.json"), JSON.stringify({ clips }));

// textures
const texDir = path.join(playersDir, "textures");
const copies = [
  "kit_template.png",
  "goalie_kit.png",
  "referee_kit.png",
  "skin01.png",
  "skin02.png",
  "skin03.png",
  "skin04.png",
  "shoe.jpg",
  "shoe_sole.jpg",
];
for (const f of copies) await copyFile(path.join(texDir, f), path.join(OUT, f));
for (const f of await readdir(path.join(texDir, "hair"))) {
  await copyFile(path.join(texDir, "hair", f), path.join(OUT, `hair_${f}`));
}
console.log("textures copied");
console.log("done →", OUT);
