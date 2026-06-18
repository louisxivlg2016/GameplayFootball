/**
 * Dev/run server: serves the game (HTML import with HMR) plus the TTS WASM
 * runtimes locally from node_modules, so the radio voice works without any
 * third-party CDN (cdnjs/jsdelivr are unreachable on some networks).
 */
import { join } from "node:path";
import index from "./index.html";

const ORT_DIR = join(import.meta.dir, "node_modules/onnxruntime-web/dist");
const PIPER_DIR = join(
  import.meta.dir,
  "node_modules/@diffusionstudio/piper-wasm/build",
);

// the TTS worker is bundled once at startup and served from /tts/worker.js —
// the dev HTML bundler does not handle `new Worker(new URL(...))` entries
const workerBuild = await Bun.build({
  entrypoints: [join(import.meta.dir, "src/game/ttsWorker.ts")],
  target: "browser",
  format: "esm",
  minify: false,
});
const workerJs = await workerBuild.outputs[0]!.text();

const MIME: Record<string, string> = {
  wasm: "application/wasm",
  data: "application/octet-stream",
  mjs: "text/javascript",
  js: "text/javascript",
};

async function serveFile(path: string): Promise<Response> {
  const f = Bun.file(path);
  if (!(await f.exists())) return new Response("not found", { status: 404 });
  const ext = path.split(".").pop() ?? "";
  return new Response(f, {
    headers: {
      "content-type": MIME[ext] ?? "application/octet-stream",
      // immutable: the browser keeps serving these across dev-server restarts,
      // so an in-flight voice never dies to a NetworkError mid-match
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

const server = Bun.serve({
  port: 3000,
  hostname: "127.0.0.1",
  routes: {
    "/": index,
  },
  development: {
    // HMR off on purpose: hot-patching modules into an OPEN page mid-edit left
    // the game in half-broken states (missing taker, "normal match", crashes).
    // A plain reload always loads a clean, consistent bundle. Flip to true only
    // if you want live reload and accept the occasional broken in-between state.
    hmr: false,
    console: true,
  },
  async fetch(req) {
    const { pathname } = new URL(req.url);
    if (pathname === "/tts/worker.js") {
      return new Response(workerJs, {
        headers: { "content-type": "text/javascript" },
      });
    }
    if (pathname.startsWith("/tts/onnx/")) {
      const name = pathname.slice("/tts/onnx/".length);
      if (!/^[\w.-]+$/.test(name)) return new Response("bad", { status: 400 });
      return serveFile(join(ORT_DIR, name));
    }
    if (pathname === "/tts/piper_phonemize.wasm" || pathname === "/tts/piper_phonemize.data") {
      return serveFile(join(PIPER_DIR, pathname.slice("/tts/".length)));
    }
    return new Response("not found", { status: 404 });
  },
});

console.log(`Gameplay Football on ${server.url}`);
