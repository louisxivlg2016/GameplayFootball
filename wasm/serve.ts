/**
 * Static server for the wasm build. Sends the cross-origin-isolation headers
 * (COOP/COEP) that SharedArrayBuffer/pthreads need — harmless for the
 * single-threaded milestone, required later. Serves dist/ by default.
 *
 * Also hosts the browser radio (multi-language TTS commentary, ported from the
 * web version): bundles the radio module + TTS worker at startup and serves the
 * onnxruntime / piper wasm runtimes from ../web/node_modules, so the voice works
 * with no third-party CDN (only the Piper voice models come from huggingface).
 *
 *   bun run serve.ts [dir] [port]
 */
import { join } from "node:path";

const dir = Bun.argv[2] ?? "dist";
const port = Number(Bun.argv[3] ?? 8080);

const WEB = join(import.meta.dir, "..", "web");
const ORT_DIR = join(WEB, "node_modules/onnxruntime-web/dist");
const PIPER_DIR = join(WEB, "node_modules/@diffusionstudio/piper-wasm/build");
const GOAL_CLIP = join(WEB, "src/assets/audio/goal-but-but.mp3");
const AUDIO_DIR = join(WEB, "src/assets/audio"); // localized menu-theme-*.mp4 live here
const ASSETS_DIR = join(WEB, "src/assets"); // menu card PNGs (play/training/worldcup)

// bundle the radio module + TTS worker once at startup (the HTML shell can't
// bundle `new Worker(new URL(...))` or a bare module entry itself)
async function bundle(entry: string): Promise<string> {
  const out = await Bun.build({ entrypoints: [entry], target: "browser", format: "esm", minify: false });
  if (!out.success) {
    console.error(`bundle failed for ${entry}:`, out.logs);
    return `/* bundle failed: ${entry} */`;
  }
  return out.outputs[0]!.text();
}
// Bundle lazily (on first request) so the server binds the port INSTANTLY —
// bundling at startup added a ~2-3s window in which the launcher could kill it.
let _radioJs: Promise<string> | null = null;
let _workerJs: Promise<string> | null = null;
const radioJs = (): Promise<string> => (_radioJs ??= bundle(join(import.meta.dir, "webradio/radioMain.ts")));
const workerJs = (): Promise<string> => (_workerJs ??= bundle(join(WEB, "src/game/ttsWorker.ts")));

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".data": "application/octet-stream",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".mp3": "audio/mpeg",
  ".json": "application/json",
};

function ext(p: string): string {
  const i = p.lastIndexOf(".");
  return i < 0 ? "" : p.slice(i);
}

// cross-origin isolation — enables SharedArrayBuffer (onnx threads / pthreads),
// no-op for the single-threaded game build
const ISO = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "cross-origin",
};

function js(body: string): Response {
  return new Response(body, {
    headers: { ...ISO, "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function serveAbs(path: string, immutable = true): Promise<Response> {
  const f = Bun.file(path);
  if (!(await f.exists())) return new Response("not found", { status: 404 });
  const headers: Record<string, string> = { ...ISO };
  const m = MIME[ext(path)];
  if (m) headers["Content-Type"] = m;
  headers["Cache-Control"] = immutable ? "public, max-age=31536000, immutable" : "no-store";
  return new Response(f, { headers });
}

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    const path = decodeURIComponent(url.pathname);

    // --- radio + TTS routes ---
    if (path === "/radio.js") return js(await radioJs());
    if (path === "/tts/worker.js") return js(await workerJs());
    if (path === "/radio/goal-but-but.mp3") return serveAbs(GOAL_CLIP);
    // localized menu theme music: /menu-music/<lang> -> menu-theme-<lang>.mp4
    if (path.startsWith("/menu-music/")) {
      const lang = path.slice("/menu-music/".length);
      if (!/^[\w-]+$/.test(lang)) return new Response("bad", { status: 400 });
      const f = lang === "default" ? "menu-theme.mp4" : `menu-theme-${lang}.mp4`;
      const res = await serveAbs(join(AUDIO_DIR, f));
      if (res.status === 404 && lang !== "default") return serveAbs(join(AUDIO_DIR, "menu-theme.mp4"));
      return res;
    }
    if (path.startsWith("/tts/onnx/")) {
      const name = path.slice("/tts/onnx/".length);
      if (!/^[\w.-]+$/.test(name)) return new Response("bad", { status: 400 });
      return serveAbs(join(ORT_DIR, name));
    }
    if (path === "/tts/piper_phonemize.wasm" || path === "/tts/piper_phonemize.data") {
      return serveAbs(join(PIPER_DIR, path.slice("/tts/".length)));
    }
    // menu card art (play-button.png, training/penalty.jpeg, …). Allows one
    // subdir level; rejects path traversal.
    if (path.startsWith("/menu-assets/")) {
      const name = path.slice("/menu-assets/".length);
      if (!/^[\w.-]+(\/[\w.-]+)?$/.test(name) || name.includes("..")) {
        return new Response("bad", { status: 400 });
      }
      return serveAbs(join(ASSETS_DIR, name));
    }
    // image proxy: COEP require-corp blocks cross-origin images without CORP, so
    // fetch the remote menu images (Unsplash pitch, Wikimedia player photos)
    // server-side and re-serve them with our isolation headers.
    if (path === "/img-proxy") {
      const u = url.searchParams.get("u") || "";
      if (!/^https:\/\/(images\.unsplash\.com|upload\.wikimedia\.org)\//.test(u)) {
        return new Response("bad host", { status: 400 });
      }
      try {
        const r = await fetch(u);
        if (!r.ok) return new Response("upstream " + r.status, { status: 502 });
        const buf = await r.arrayBuffer();
        return new Response(buf, {
          headers: { ...ISO, "Content-Type": r.headers.get("content-type") || "image/jpeg",
            "Cache-Control": "public, max-age=86400" },
        });
      } catch {
        return new Response("proxy failed", { status: 502 });
      }
    }

    // --- game files from dist/ ---
    const rel = path === "/" ? "/index.html" : path;
    const file = Bun.file(`${dir}${rel}`);
    if (!(await file.exists())) return new Response("not found", { status: 404 });
    const headers: Record<string, string> = { ...ISO, "Cache-Control": "no-store" };
    const m = MIME[ext(rel)];
    if (m) headers["Content-Type"] = m;
    return new Response(file, { headers });
  },
});

console.log(`serving ./${dir} at http://127.0.0.1:${port}/  (COOP/COEP on, radio+TTS mounted)`);
