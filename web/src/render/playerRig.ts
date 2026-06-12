/**
 * Runtime side of the original player pipeline: builds THREE.SkinnedMesh rigs
 * from the converted fullbody.ase (vertex-color skin weights), player.object
 * skeleton, base.anim.util bind pose, and .anim locomotion cycles.
 * See web/tools/convert-player-assets.ts for the conversion.
 */
import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import modelJson from "../assets/players/model.json";
import animsJson from "../assets/players/anims.json";

interface ModelData {
  skeleton: Array<{ name: string; parent: number; pos: [number, number, number] }>;
  rest: Record<string, number[]>;
  mesh: {
    positions: number[];
    uvs: number[];
    skinIndices: number[];
    skinWeights: number[];
    groups: Array<{ start: number; count: number; material: string }>;
  };
  hair: Record<string, { positions: number[]; uvs: number[] }>;
}

interface AnimsData {
  clips: Array<{
    name: string;
    duration: number;
    velocity: number;
    tracks: Record<string, { times: number[]; quats: number[] }>;
    rootZ: { times: number[]; values: number[] };
  }>;
}

const modelData = modelJson as unknown as ModelData;
const animData = animsJson as unknown as AnimsData;
import goalieKitUrl from "../assets/players/goalie_kit.png";
import skin01Url from "../assets/players/skin01.png";
import skin02Url from "../assets/players/skin02.png";
import skin03Url from "../assets/players/skin03.png";
import skin04Url from "../assets/players/skin04.png";
import shoeUrl from "../assets/players/shoe.jpg";
import soleUrl from "../assets/players/shoe_sole.jpg";
import hairBlackUrl from "../assets/players/hair_black.png";
import hairBrownUrl from "../assets/players/hair_brown.png";
import hairDarkblondeUrl from "../assets/players/hair_darkblonde.png";
import hairBlondeUrl from "../assets/players/hair_blonde.png";
import hairRedUrl from "../assets/players/hair_red.png";

const loader = new THREE.TextureLoader();
function loadTex(url: string): THREE.Texture {
  const t = loader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const goalieTex = loadTex(goalieKitUrl);
const skinTex = [skin01Url, skin02Url, skin03Url, skin04Url].map(loadTex);
const shoeTex = loadTex(shoeUrl);
const soleTex = loadTex(soleUrl);
const hairTex = {
  black: loadTex(hairBlackUrl),
  brown: loadTex(hairBrownUrl),
  darkblonde: loadTex(hairDarkblondeUrl),
  blonde: loadTex(hairBlondeUrl),
  red: loadTex(hairRedUrl),
};
const HAIR_COLORS = Object.keys(hairTex) as Array<keyof typeof hairTex>;
const HAIR_STYLES = ["short01", "short02", "medium01", "medium02", "long01", "bald"];

// ---------- geometry ----------

function buildBodyGeometry(): THREE.BufferGeometry {
  const m = modelData.mesh;
  let geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(m.positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(m.uvs, 2));
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(m.skinIndices, 4));
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(m.skinWeights, 4));
  const groupOrder = m.groups.map((g) => g.material);
  m.groups.forEach((g, i) => geo.addGroup(g.start, g.count, i));
  geo = mergeVertices(geo) as THREE.BufferGeometry;
  geo.computeVertexNormals();
  geo.userData.groupOrder = groupOrder;
  return geo;
}

const bodyGeometry = buildBodyGeometry();

// ---------- skeleton ----------

function buildBones(): { rootBone: THREE.Bone; skinBones: THREE.Bone[] } {
  const rest = modelData.rest as Record<string, number[]>;
  const all = modelData.skeleton.map((j) => {
    const b = new THREE.Bone();
    b.name = j.name;
    b.position.set(j.pos[0]!, j.pos[1]!, j.pos[2]!);
    const q = rest[j.name];
    if (q) b.quaternion.set(q[0]!, q[1]!, q[2]!, q[3]!);
    return b;
  });
  modelData.skeleton.forEach((j, i) => {
    if (j.parent >= 0) all[j.parent]!.add(all[i]!);
  });
  // skin joint IDs (vertex colors) index body..right_ankle, excluding the root
  return { rootBone: all[0]!, skinBones: all.slice(1) };
}

// shared inverse bind matrices, from the rest pose
const sharedInverses: THREE.Matrix4[] = (() => {
  const { rootBone, skinBones } = buildBones();
  rootBone.updateMatrixWorld(true);
  return skinBones.map((b) => b.matrixWorld.clone().invert());
})();

// hair geometries, re-based into neck-local space so they ride the neck bone
const neckBindInverse = sharedInverses[2]!.clone(); // skin joint 2 = neck
const hairGeometries = new Map<string, THREE.BufferGeometry>();
for (const [style, data] of Object.entries(modelData.hair)) {
  let geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute((data as { positions: number[] }).positions, 3),
  );
  geo.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute((data as { uvs: number[] }).uvs, 2),
  );
  geo = mergeVertices(geo) as THREE.BufferGeometry;
  geo.applyMatrix4(neckBindInverse);
  geo.computeVertexNormals();
  hairGeometries.set(style, geo);
}

// ---------- animation clips ----------

export const CLIP_VELOCITY: Record<string, number> = {};

const clips: THREE.AnimationClip[] = animData.clips.map((c) => {
  CLIP_VELOCITY[c.name] = c.velocity;
  const tracks: THREE.KeyframeTrack[] = [];
  for (const [bone, t] of Object.entries(
    c.tracks as Record<string, { times: number[]; quats: number[] }>,
  )) {
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, t.times, t.quats));
  }
  const posValues: number[] = [];
  for (const z of c.rootZ.values) posValues.push(0, 0, z);
  tracks.push(new THREE.VectorKeyframeTrack("player.position", c.rootZ.times, posValues));
  return new THREE.AnimationClip(c.name, c.duration, tracks);
});

// ---------- materials ----------

const shoeMat = new THREE.MeshStandardMaterial({ map: shoeTex, roughness: 0.7 });
const soleMat = new THREE.MeshStandardMaterial({ map: soleTex, roughness: 0.9 });
const skinMats = skinTex.map(
  (t) => new THREE.MeshStandardMaterial({ map: t, roughness: 0.75 }),
);
const kitMatCache = new Map<string, THREE.MeshStandardMaterial>();

/**
 * Flat-color kit in the original kit-texture layout (the engine falls back to
 * flat kits when a team has no kit art; kit_template.png is only the UV guide):
 * shirt = image rows 0-43%, shorts band 43-57%, socks boxes 57-76%.
 */
function makeKitTexture(shirt: string, shorts: string, socks: string): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = socks;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = shirt;
  ctx.fillRect(0, 0, size, Math.round(size * 0.43));
  ctx.fillStyle = shorts;
  ctx.fillRect(0, Math.round(size * 0.43), size, Math.round(size * 0.14));
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function kitMaterial(kind: string, teamColor: string): THREE.MeshStandardMaterial {
  let mat = kitMatCache.get(kind);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      map: kind.startsWith("gk")
        ? goalieTex
        : makeKitTexture(teamColor, "#f2f2f2", teamColor),
      roughness: 0.85,
    });
    kitMatCache.set(kind, mat);
  }
  return mat;
}

// ---------- rig factory ----------

export interface PlayerRig {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
}

export function createPlayerRig(
  kitKind: "team0" | "team1" | "gk0" | "gk1",
  teamColor: string,
  variant: number,
  heightScale: number,
): PlayerRig {
  const { rootBone, skinBones } = buildBones();

  const groupOrder = bodyGeometry.userData.groupOrder as string[];
  const skinIdx = variant % skinMats.length;
  const materials = groupOrder.map((name) => {
    if (name === "kit") return kitMaterial(kitKind, teamColor);
    if (name === "shoe") return shoeMat;
    if (name === "sole") return soleMat;
    return skinMats[skinIdx]!;
  });

  const skinned = new THREE.SkinnedMesh(bodyGeometry, materials);
  skinned.castShadow = true;
  skinned.frustumCulled = false;
  skinned.add(rootBone);
  skinned.bind(new THREE.Skeleton(skinBones, sharedInverses));

  const style = HAIR_STYLES[(variant * 5 + 3) % HAIR_STYLES.length]!;
  const hairGeo = hairGeometries.get(style);
  if (hairGeo && style !== "bald") {
    const color = HAIR_COLORS[(variant * 3 + 1) % HAIR_COLORS.length]!;
    const hair = new THREE.Mesh(
      hairGeo,
      new THREE.MeshStandardMaterial({ map: hairTex[color], roughness: 0.95 }),
    );
    hair.castShadow = true;
    skinBones[2]!.add(hair); // neck
  }

  // model space is Z-up facing -Y; this wrapper makes it Y-up facing +Z
  const zUp = new THREE.Group();
  zUp.rotation.x = -Math.PI / 2;
  zUp.add(skinned);
  const root = new THREE.Group();
  root.scale.setScalar(heightScale);
  root.add(zUp);

  const mixer = new THREE.AnimationMixer(skinned);
  const actions: Record<string, THREE.AnimationAction> = {};
  for (const clip of clips) actions[clip.name] = mixer.clipAction(clip);
  actions.idle!.play();

  return { root, mixer, actions };
}
