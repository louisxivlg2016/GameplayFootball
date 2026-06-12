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

async function serveFile(path: string): Promise<Response> {
  const f = Bun.file(path);
  return (await f.exists())
    ? new Response(f)
    : new Response("not found", { status: 404 });
}

const server = Bun.serve({
  port: 3000,
  hostname: "127.0.0.1",
  routes: {
    "/": index,
  },
  development: {
    hmr: true,
    console: true,
  },
  async fetch(req) {
    const { pathname } = new URL(req.url);
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
