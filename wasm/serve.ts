/**
 * Static server for the wasm build. Sends the cross-origin-isolation headers
 * (COOP/COEP) that SharedArrayBuffer/pthreads need — harmless for the
 * single-threaded milestone, required later. Serves dist/ by default.
 *
 *   bun run serve.ts [dir] [port]
 */
const dir = Bun.argv[2] ?? "dist";
const port = Number(Bun.argv[3] ?? 8080);

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".data": "application/octet-stream",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".json": "application/json",
};

function ext(p: string): string {
  const i = p.lastIndexOf(".");
  return i < 0 ? "" : p.slice(i);
}

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    let path = decodeURIComponent(url.pathname);
    if (path === "/") path = "/index.html";
    const file = Bun.file(`${dir}${path}`);
    if (!(await file.exists())) return new Response("not found", { status: 404 });
    const headers: Record<string, string> = {
      // cross-origin isolation — enables SharedArrayBuffer (pthreads) later,
      // no-op for the single-threaded build
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Cache-Control": "no-store",
    };
    const m = MIME[ext(path)];
    if (m) headers["Content-Type"] = m;
    return new Response(file, { headers });
  },
});

console.log(`serving ./${dir} at http://127.0.0.1:${port}/  (COOP/COEP on)`);
