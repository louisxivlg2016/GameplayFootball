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
  duration: number; // seconds
  velocity: number; // m/s of the original root motion
  tracks: Record<string, { times: number[]; quats: number[] }>;
  rootZ: { times: number[]; values: number[] };
}

const FRAME_S = 0.01; // 10ms per frame (animation.cpp velocity = delta/frames*100)

function buildLoopClip(name: string, tracks: AnimTracks): ClipJson {
  const player = tracks.get("player")!;
  const F = Math.max(...player.frames);
  const dx = player.values[player.values.length - 1]![0]! - player.values[0]![0]!;
  const dy = player.values[player.values.length - 1]![1]! - player.values[0]![1]!;
  const velocity = Math.hypot(dx, dy) / (F * FRAME_S);

  const out: ClipJson = {
    name,
    duration: round(2 * F * FRAME_S),
    velocity: round(velocity),
    tracks: {},
    rootZ: { times: [], values: [] },
  };

  for (const [bone, track] of tracks) {
    if (bone === "player") continue;
    const partner = tracks.get(MIRROR[bone] ?? bone) ?? track;
    const times: number[] = [];
    const quats: number[] = [];
    for (let k = 0; k < track.frames.length; k++) {
      times.push(round(track.frames[k]! * FRAME_S));
      quats.push(...track.values[k]!.map((v) => round(v)));
    }
    // second half: the L/R-mirrored partner, shifted by F frames
    for (let k = 0; k < partner.frames.length; k++) {
      if (partner.frames[k] === 0) continue; // junction key already present
      times.push(round((F + partner.frames[k]!) * FRAME_S));
      quats.push(...mirrorQuat(partner.values[k]!).map((v) => round(v)));
    }
    out.tracks[bone] = { times, quats };
  }

  // vertical bob only — x/y locomotion comes from the ECS, like noPos in animation.cpp:409
  for (let k = 0; k < player.frames.length; k++) {
    out.rootZ.times.push(round(player.frames[k]! * FRAME_S));
    out.rootZ.values.push(round(player.values[k]![2]!));
  }
  for (let k = 0; k < player.frames.length; k++) {
    if (player.frames[k] === 0) continue;
    out.rootZ.times.push(round((F + player.frames[k]!) * FRAME_S));
    out.rootZ.values.push(round(player.values[k]![2]!));
  }
  return out;
}

/** Straightest cycle in a velocity band: most forward motion, least drift/turn. */
async function findCycle(
  dir: string,
  vMin: number,
  vMax: number,
): Promise<string> {
  const candidates: Array<{ file: string; score: number }> = [];
  const walk = async (d: string): Promise<void> => {
    for (const entry of await readdir(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) await walk(p);
      else if (entry.name.endsWith(".anim")) {
        const tracks = await parseAnim(p);
        const player = tracks.get("player");
        if (!player || player.frames.length < 2) continue;
        const F = Math.max(...player.frames);
        const last = player.values[player.values.length - 1]!;
        const first = player.values[0]!;
        const dx = last[0]! - first[0]!;
        const dy = last[1]! - first[1]!;
        const v = Math.hypot(dx, dy) / (F * FRAME_S);
        if (v < vMin || v > vMax) continue;
        const drift = Math.abs(dx) / (Math.abs(dy) + 0.001);
        candidates.push({ file: p, score: drift });
      }
    }
  };
  await walk(dir);
  candidates.sort((a, b) => a.score - b.score);
  if (!candidates.length) throw new Error(`no cycle in ${dir} [${vMin},${vMax}]`);
  return candidates[0]!.file;
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

// locomotion cycles (velocity bands from gamedefines.hpp:18-27)
const animDir = path.join(DATA, "animations");
const cycles: Array<{ name: string; file: string }> = [
  { name: "idle", file: path.join(animDir, "movement/idle/000_idlelevel1.anim") },
  { name: "dribble", file: await findCycle(path.join(animDir, "movement/dribble"), 2.2, 4.2) },
  { name: "walk", file: await findCycle(path.join(animDir, "movement/walk"), 4.2, 6.2) },
  { name: "sprint", file: path.join(animDir, "movement/sprint/000_idlelevel1.anim") },
];
const clips: ClipJson[] = [];
for (const c of cycles) {
  const clip = buildLoopClip(c.name, await parseAnim(c.file));
  clips.push(clip);
  console.log(
    `clip ${c.name}: ${path.relative(animDir, c.file)} v=${clip.velocity} dur=${clip.duration}s`,
  );
}
await Bun.write(path.join(OUT, "anims.json"), JSON.stringify({ clips }));

// textures
const texDir = path.join(playersDir, "textures");
const copies = [
  "kit_template.png",
  "goalie_kit.png",
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
