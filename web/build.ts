/**
 * Static build for Vercel (and any static host). Produces a self-contained
 * `dist/` that needs no server: the game bundle, the pre-bundled TTS worker,
 * and the WASM runtimes that serve.ts normally streams from node_modules.
 * The neural voice model itself still streams from HuggingFace at runtime
 * (cross-origin, cached in OPFS) exactly as in dev.
 */
import { join } from "node:path";
import { mkdir, cp, rm } from "node:fs/promises";

const ROOT = import.meta.dir;
const DIST = join(ROOT, "dist");
const ORT = join(ROOT, "node_modules/onnxruntime-web/dist");
const PIPER = join(ROOT, "node_modules/@diffusionstudio/piper-wasm/build");

await rm(DIST, { recursive: true, force: true });

// 1. the game itself (HTML entry → hashed JS/CSS bundles)
const app = await Bun.build({
  entrypoints: [join(ROOT, "index.html")],
  outdir: DIST,
  minify: true,
  sourcemap: "none",
});
if (!app.success) {
  console.error("app build failed:", app.logs);
  process.exit(1);
}

// 2. the TTS worker — the HTML bundler can't follow `new Worker(new URL(...))`,
// so it is bundled on its own and served from /tts/worker.js
const worker = await Bun.build({
  entrypoints: [join(ROOT, "src/game/ttsWorker.ts")],
  target: "browser",
  format: "esm",
  minify: true,
});
if (!worker.success) {
  console.error("worker build failed:", worker.logs);
  process.exit(1);
}
await mkdir(join(DIST, "tts", "onnx"), { recursive: true });
await Bun.write(join(DIST, "tts", "worker.js"), await worker.outputs[0]!.text());

// 3. the WASM runtimes the worker fetches at the paths radio.ts passes it
const ORT_FILES = [
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
];
for (const f of ORT_FILES) await cp(join(ORT, f), join(DIST, "tts", "onnx", f));
for (const f of ["piper_phonemize.wasm", "piper_phonemize.data"]) {
  await cp(join(PIPER, f), join(DIST, "tts", f));
}

console.log("static build complete → dist/ (game + /tts worker + WASM)");
