/**
 * One-off converter: Draco GLB (Hunyuan Messi, static mesh) → game rig asset.
 * Run: bun tools/serve-messi-convert.ts, then open http://127.0.0.1:3012/
 * (headless works too). POSTs messi.json + messi_kit.jpg back to the server.
 * - bakes the node transform, re-bases to model space (Z-up, forward -Y,
 *   feet z=0, head z=1.92 like the game skeleton)
 * - vertex-clustering decimation to game-friendly density
 * - proximity auto-skin onto the 13 game bones, bind pose matched to the
 *   mesh's arms-at-side stance (shoulder tilt measured from the mesh)
 * - extracts the baseColor texture
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import modelJson from "../src/assets/players/model.json";

const skeletonDef = (modelJson as { skeleton: Array<{ name: string; parent: number; pos: number[] }> }).skeleton;
const restDef = (modelJson as { rest: Record<string, number[]> }).rest;

const log = (...a: unknown[]): void => {
  console.log("[conv]", ...a);
  void fetch("/log", { method: "POST", body: a.map(String).join(" ") });
};

const HEIGHT = 1.92; // game skeleton height (head top)

async function main(): Promise<void> {
  const draco = new DRACOLoader();
  draco.setDecoderPath("/draco/");
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  const gltf = await loader.loadAsync("/messi.glb");

  let srcMesh: THREE.Mesh | null = null;
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!srcMesh && o instanceof THREE.Mesh) srcMesh = o;
  });
  if (!srcMesh) throw new Error("no mesh");
  const mesh = srcMesh as THREE.Mesh;
  const geo = mesh.geometry.clone().toNonIndexed();
  geo.applyMatrix4(mesh.matrixWorld); // bake: now glTF world space (Y-up)
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  const nVerts = pos.count;
  log("verts(world):", nVerts);

  // ---- facing: toes stick out along the facing in Y-up world ----
  const bb = new THREE.Box3().setFromBufferAttribute(pos);
  const h = bb.max.y - bb.min.y;
  let toeZ = 0;
  let toeN = 0;
  let midZ = 0;
  let midN = 0;
  for (let i = 0; i < nVerts; i++) {
    const y = pos.getY(i);
    if (y < bb.min.y + 0.05 * h) {
      toeZ += pos.getZ(i);
      toeN++;
    } else if (y > bb.min.y + 0.4 * h && y < bb.min.y + 0.6 * h) {
      midZ += pos.getZ(i);
      midN++;
    }
  }
  const facing = Math.sign(toeZ / toeN - midZ / midN) || 1;
  log("facing (world z):", facing, "height:", h.toFixed(3));

  // ---- to model space: forward -y, up z, feet z=0, head z=HEIGHT ----
  const s = HEIGHT / h;
  // pelvis-band centroid centers x/depth so the spine sits on the z axis
  let cx = 0;
  let cz = 0;
  let cN = 0;
  for (let i = 0; i < nVerts; i++) {
    const y = pos.getY(i);
    if (y > bb.min.y + 0.45 * h && y < bb.min.y + 0.55 * h) {
      cx += pos.getX(i);
      cz += pos.getZ(i);
      cN++;
    }
  }
  cx /= cN;
  cz /= cN;
  const P = new Float32Array(nVerts * 3);
  for (let i = 0; i < nVerts; i++) {
    const wx = (pos.getX(i) - cx) * facing; // yaw 180° if facing -z: x flips too
    const wy = pos.getY(i) - bb.min.y;
    const wz = (pos.getZ(i) - cz) * facing;
    P[i * 3] = wx * s;
    P[i * 3 + 1] = -wz * s; // world facing dir (+z after flip) → model -y
    P[i * 3 + 2] = wy * s;
  }

  // ---- vertex clustering decimation (adaptive: the face needs finer cells) ----
  const cellOf = (i: number): string => {
    const z = P[i * 3 + 2]!;
    const cell = z > 1.5 ? 0.01 : 0.022;
    return `${cell}:${Math.round(P[i * 3]! / cell)},${Math.round(P[i * 3 + 1]! / cell)},${Math.round(z / cell)}`;
  };
  const cellId = new Map<string, number>();
  const acc: number[][] = []; // x,y,z,u,v,count
  const vmap = new Int32Array(nVerts);
  for (let i = 0; i < nVerts; i++) {
    const key = cellOf(i);
    let id = cellId.get(key);
    if (id === undefined) {
      id = acc.length;
      cellId.set(key, id);
      acc.push([0, 0, 0, uv.getX(i), uv.getY(i), 0]);
    }
    const a = acc[id]!;
    a[0] += P[i * 3]!;
    a[1] += P[i * 3 + 1]!;
    a[2] += P[i * 3 + 2]!;
    a[5] += 1;
    vmap[i] = id;
  }
  const V = acc.length;
  const positions = new Float32Array(V * 3);
  const uvs = new Float32Array(V * 2);
  for (let i = 0; i < V; i++) {
    const a = acc[i]!;
    positions[i * 3] = a[0]! / a[5]!;
    positions[i * 3 + 1] = a[1]! / a[5]!;
    positions[i * 3 + 2] = a[2]! / a[5]!;
    uvs[i * 2] = a[3]!;
    uvs[i * 2 + 1] = a[4]!;
  }
  const index: number[] = [];
  const seenTri = new Set<string>();
  for (let t = 0; t < nVerts; t += 3) {
    const a = vmap[t]!;
    const b = vmap[t + 1]!;
    const c = vmap[t + 2]!;
    if (a === b || b === c || a === c) continue;
    const key = [a, b, c].sort((x, y) => x - y).join(",");
    if (seenTri.has(key)) continue;
    seenTri.add(key);
    index.push(a, b, c);
  }
  log("decimated:", V, "verts,", index.length / 3, "tris");

  // ---- game skeleton in the mesh-matching bind pose ----
  // measure the arm tilt from vertical: hand = lowest outer-arm cluster vert
  let handL: number[] | null = null;
  for (let i = 0; i < V; i++) {
    const x = positions[i * 3]!;
    const z = positions[i * 3 + 2]!;
    if (x > 0.17 && z > 0.55 && z < 1.2) {
      if (!handL || z < handL[2]!) handL = [x, positions[i * 3 + 1]!, z];
    }
  }
  const shoulderL = { x: 0.16, z: 0.96 + 0.15 + 0.48 };
  const armTilt = handL
    ? Math.atan2(handL[0]! - shoulderL.x, shoulderL.z - handL[2]!)
    : 0.18;
  log("armTilt(rad):", armTilt.toFixed(3), "hand:", JSON.stringify(handL));

  const bones: THREE.Bone[] = skeletonDef.map((j) => {
    const b = new THREE.Bone();
    b.name = j.name;
    b.position.set(j.pos[0]!, j.pos[1]!, j.pos[2]!);
    const q = restDef[j.name];
    if (q) b.quaternion.set(q[0]!, q[1]!, q[2]!, q[3]!);
    return b;
  });
  skeletonDef.forEach((j, i) => {
    if (j.parent >= 0) bones[j.parent]!.add(bones[i]!);
  });
  const byName = new Map(bones.map((b) => [b.name, b]));
  const Y = new THREE.Vector3(0, 1, 0);
  byName.get("left_shoulder")!.quaternion.setFromAxisAngle(Y, -armTilt);
  byName.get("right_shoulder")!.quaternion.setFromAxisAngle(Y, armTilt);
  byName.get("left_elbow")!.quaternion.identity();
  byName.get("right_elbow")!.quaternion.identity();
  bones[0]!.updateMatrixWorld(true);

  // ---- bone segments for proximity skinning ----
  const wp = (n: string): THREE.Vector3 =>
    byName.get(n)!.getWorldPosition(new THREE.Vector3());
  const off = (n: string, v: [number, number, number]): THREE.Vector3 =>
    byName.get(n)!.localToWorld(new THREE.Vector3(...v));
  // skin joint ids: skeleton order minus the root
  const segs: Array<{ joint: number; a: THREE.Vector3; b: THREE.Vector3; side: number; kind: string }> = [];
  const J = (n: string): number => skeletonDef.findIndex((j) => j.name === n) - 1;
  const side = (n: string): number => (n.startsWith("left") ? 1 : n.startsWith("right") ? -1 : 0);
  const add = (n: string, a: THREE.Vector3, b: THREE.Vector3, kind: string): void => {
    segs.push({ joint: J(n), a, b, side: side(n), kind });
  };
  add("body", wp("body"), wp("middle"), "torso");
  add("middle", wp("middle"), wp("neck"), "torso");
  add("neck", wp("neck"), off("neck", [0, 0, 0.26]), "head");
  for (const s2 of ["left", "right"]) {
    add(`${s2}_shoulder`, wp(`${s2}_shoulder`), wp(`${s2}_elbow`), "arm");
    add(`${s2}_elbow`, wp(`${s2}_elbow`), off(`${s2}_elbow`, [0, 0, -0.36]), "arm");
    add(`${s2}_thigh`, wp(`${s2}_thigh`), wp(`${s2}_knee`), "leg");
    add(`${s2}_knee`, wp(`${s2}_knee`), wp(`${s2}_ankle`), "leg");
    add(`${s2}_ankle`, wp(`${s2}_ankle`), off(`${s2}_ankle`, [0, -0.16, -0.04]), "leg");
  }
  log("segments:", segs.length);

  const skinIndices = new Uint8Array(V * 4);
  const skinWeights = new Float32Array(V * 4);
  const pv = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const segDist = (p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number => {
    tmp.subVectors(b, a);
    const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(tmp) / tmp.lengthSq()));
    return p.distanceTo(tmp.multiplyScalar(t).add(a));
  };
  for (let i = 0; i < V; i++) {
    pv.set(positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!);
    let b1 = -1;
    let b2 = -1;
    let d1 = 1e9;
    let d2 = 1e9;
    for (const sg of segs) {
      let d = segDist(pv, sg.a, sg.b);
      // wrong-side limbs are pushed away so thighs don't steal hip verts etc.
      if (sg.side !== 0 && pv.x * sg.side < -0.02) d *= 2.2;
      // arms at the sides: outer verts belong to the arm, inner to the leg/torso
      if (sg.kind === "arm" && Math.abs(pv.x) < 0.13 && pv.z < 1.35) d *= 1.8;
      if ((sg.kind === "leg" || sg.kind === "torso") && Math.abs(pv.x) > 0.18 && pv.z < 1.45 && pv.z > 0.6) d *= 1.8;
      if (d < d1) {
        d2 = d1;
        b2 = b1;
        d1 = d;
        b1 = sg.joint;
      } else if (d < d2 && sg.joint !== b1) {
        d2 = d;
        b2 = sg.joint;
      }
    }
    // blend the 2 nearest with a sharp falloff; far second bone → rigid
    let w1 = 1;
    let w2 = 0;
    if (b2 >= 0 && d2 < d1 * 1.6) {
      const k1 = 1 / Math.pow(d1 + 1e-4, 4);
      const k2 = 1 / Math.pow(d2 + 1e-4, 4);
      w1 = k1 / (k1 + k2);
      w2 = k2 / (k1 + k2);
    }
    skinIndices[i * 4] = b1;
    skinIndices[i * 4 + 1] = Math.max(b2, 0);
    skinWeights[i * 4] = w1;
    skinWeights[i * 4 + 1] = w2;
  }

  // ---- texture ----
  const mat = mesh.material as THREE.MeshStandardMaterial;
  const img = mat.map?.image as HTMLImageElement | ImageBitmap | undefined;
  let texBlob: Blob | null = null;
  if (img) {
    const c = document.createElement("canvas");
    const size = 1024;
    c.width = size;
    c.height = size;
    c.getContext("2d")!.drawImage(img as CanvasImageSource, 0, 0, size, size);
    texBlob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.9));
    log("texture:", (img as { width?: number }).width, "→", size);
  } else log("NO TEXTURE FOUND");

  // ---- ship it ----
  const payload = {
    bind: { armTilt },
    positions: Array.from(positions, (v) => Math.round(v * 10000) / 10000),
    uvs: Array.from(uvs, (v) => Math.round(v * 10000) / 10000),
    skinIndices: Array.from(skinIndices),
    skinWeights: Array.from(skinWeights, (v) => Math.round(v * 1000) / 1000),
    index,
  };
  await fetch("/out", { method: "POST", body: JSON.stringify(payload) });
  if (texBlob) await fetch("/tex", { method: "POST", body: texBlob });
  log("DONE");
  (globalThis as Record<string, unknown>).__done = true;
}

main().catch((e) => {
  log("ERROR", String(e), (e as Error).stack ?? "");
});
