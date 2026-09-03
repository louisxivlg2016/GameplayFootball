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
const GOAL_CLIP = join(WEB, "src/assets/audio/goal-shout-v5.mp3");
const AUDIO_DIR = join(WEB, "src/assets/audio"); // localized menu-theme-*.mp4 live here
const ASSETS_DIR = join(WEB, "src/assets"); // menu card PNGs (play/training/worldcup)
const CAPTAINS_DIR = join(import.meta.dir, "captains"); // full-body captain figures (wasm-side asset)
const VOICES_DIR = join(import.meta.dir, "ttsvoices"); // self-hosted Piper voice models (gitignored 63MB blobs); optional locally
// in-memory cache for proxied remote assets (anthems/flags/photos) — avoids
// re-hitting Wikimedia (and its rate limits) for the same file every match.
const proxyCache = new Map<string, { buf: ArrayBuffer; type: string }>();

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
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
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
    // remote diagnosis: the page posts a radio-state snapshot every few seconds
    // (localhost only, see radioMain) — appended here so the dev can read the
    // USER's live radio state instead of guessing. Plain text, one JSON per line.
    if (path === "/radio-diag" && req.method === "POST") {
      try {
        const body = await req.text();
        const line = `${new Date().toISOString()} ${body.slice(0, 2000)}\n`;
        const f = join(import.meta.dir, "radio-diag.log");
        const prev = (await Bun.file(f).exists()) ? await Bun.file(f).text() : "";
        await Bun.write(f, (prev.length > 400_000 ? prev.slice(-200_000) : prev) + line);
      } catch { /* diagnostics must never break the page */ }
      return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
    }
    if (path === "/radio.js") return js(await radioJs());
    if (path === "/tts/worker.js") return js(await workerJs());
    // narrow voice-rerouting service worker (must be same-origin, root scope)
    if (path === "/sw.js") return js(await Bun.file(join(import.meta.dir, "sw.js")).text());
    // self-hosted Piper voice models (mirror of huggingface's layout). Optional
    // locally; if absent the SW falls back to huggingface. Allows nested subdirs.
    if (path.startsWith("/tts/voices/")) {
      const name = path.slice("/tts/voices/".length);
      if (!/^[\w./-]+$/.test(name) || name.includes("..")) return new Response("bad", { status: 400 });
      return serveAbs(join(VOICES_DIR, name));
    }
    if (path === "/radio/goal-shout-v5.mp3") return serveAbs(GOAL_CLIP);
    // kickoff music the user supplied — played when a match starts
    if (path === "/radio/match-intro.mp3") return serveAbs(join(AUDIO_DIR, "match-intro.mp3"));
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
    // full-body captain figures (e.g. /captains/argentine.png), served from wasm/captains
    if (path.startsWith("/captains/")) {
      const name = path.slice("/captains/".length);
      if (!/^[\w.-]+$/.test(name) || name.includes("..")) return new Response("bad", { status: 400 });
      return serveAbs(join(CAPTAINS_DIR, name));
    }
    // misc UI images (e.g. /uiassets/loading.png), served from wasm/uiassets
    if (path.startsWith("/uiassets/")) {
      const name = path.slice("/uiassets/".length);
      if (!/^[\w.-]+$/.test(name) || name.includes("..")) return new Response("bad", { status: 400 });
      return serveAbs(join(import.meta.dir, "uiassets", name));
    }
    // image proxy: COEP require-corp blocks cross-origin images without CORP, so
    // fetch the remote menu images (Unsplash pitch, Wikimedia player photos)
    // server-side and re-serve them with our isolation headers.
    // "talk to a player" AI relay (mirrors wasm/vercel-assets/talk.js). Needs
    // ANTHROPIC_API_KEY in the env; without it, returns nokey so the game falls
    // back to its built-in emotional replies.
    if (path === "/api/talk") {
      if (req.method !== "POST") return new Response("POST only", { status: 405, headers: ISO });
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) return Response.json({ reply: null, nokey: true }, { headers: ISO });
      let data: { name?: string; message?: string; history?: { role: string; text: string }[] } = {};
      try { data = await req.json(); } catch { /* empty */ }
      const name = String(data.name || "Le joueur").slice(0, 40);
      const message = String(data.message || "").slice(0, 300);
      const history = Array.isArray(data.history) ? data.history.slice(-8) : [];
      const system =
        `Tu es ${name}, footballeur professionnel, sur le terrain PENDANT un match. ` +
        `L'ARBITRE vient te parler. Réponds toujours EN FRANÇAIS, en 1 à 2 phrases courtes, ` +
        `comme un vrai joueur qui parle à l'arbitre : tu contestes les fautes et cartons, tu ` +
        `plaides ta cause, tu peux t'énerver si on t'insulte ou te provoque, te calmer si ` +
        `l'arbitre est correct, et obéir aux ordres raisonnables. Donne UNIQUEMENT ta réplique, sans narration.`;
      const messages = history.map((h) => ({ role: h.role === "ref" ? "user" : "assistant", content: String(h.text || "").slice(0, 300) }));
      messages.push({ role: "user", content: message });
      try {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 120, system, messages }),
        });
        if (!r.ok) return Response.json({ reply: null, error: "upstream " + r.status }, { headers: ISO });
        const j = await r.json() as { content?: { text?: string }[] };
        const reply = j?.content?.[0]?.text?.trim() || null;
        return Response.json({ reply }, { headers: ISO });
      } catch (e) {
        return Response.json({ reply: null, error: String(e) }, { headers: ISO });
      }
    }

    if (path === "/img-proxy") {
      const u = url.searchParams.get("u") || "";
      if (!/^https:\/\/(images\.unsplash\.com|upload\.wikimedia\.org|flagcdn\.com)\//.test(u)) {
        return new Response("bad host", { status: 400 });
      }
      const cached = proxyCache.get(u);
      if (cached) return new Response(cached.buf, { headers: { ...ISO, "Content-Type": cached.type, "Cache-Control": "public, max-age=86400" } });
      try {
        // Wikimedia REQUIRES a descriptive User-Agent (else 429/403), which is why
        // anthems/flags/player photos were failing to load. Send a real one.
        const r = await fetch(u, { headers: {
          "User-Agent": "GameplayFootballWeb/1.0 (https://github.com/BazkieBumpercar/GameplayFootball; wasm port; anthem/flag/photo proxy)",
          "Accept": "*/*",
        } });
        if (!r.ok) return new Response("upstream " + r.status, { status: 502 });
        const buf = await r.arrayBuffer();
        const type = r.headers.get("content-type") || "image/jpeg";
        if (buf.byteLength < 8_000_000) proxyCache.set(u, { buf, type }); // cache smaller assets
        return new Response(buf, {
          headers: { ...ISO, "Content-Type": type, "Cache-Control": "public, max-age=86400" },
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
