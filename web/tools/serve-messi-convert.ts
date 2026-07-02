// One-off server for the Messi GLB conversion: serves the tool page, the GLB,
// the Draco decoder, and writes the POSTed results into src/assets/players/.
import { join } from "node:path";
import page from "./messi-convert.html";

const ROOT = import.meta.dir;
const DRACO = join(ROOT, "../node_modules/three/examples/jsm/libs/draco");

Bun.serve({
  port: 3012,
  hostname: "127.0.0.1",
  routes: { "/": page },
  development: { hmr: false },
  async fetch(req) {
    const { pathname } = new URL(req.url);
    if (pathname === "/messi.glb") {
      return new Response(Bun.file(join(ROOT, "../../messi.glb")));
    }
    if (pathname.startsWith("/draco/")) {
      const f = Bun.file(join(DRACO, pathname.slice(7)));
      return (await f.exists()) ? new Response(f) : new Response("nf", { status: 404 });
    }
    if (req.method === "POST" && pathname === "/log") {
      console.log("[page]", await req.text());
      return new Response("ok");
    }
    if (req.method === "POST" && pathname === "/out") {
      const body = await req.text();
      await Bun.write(join(ROOT, "../src/assets/players/messi.json"), body);
      console.log("wrote messi.json", body.length, "bytes");
      return new Response("ok");
    }
    if (req.method === "POST" && pathname === "/tex") {
      const buf = await req.arrayBuffer();
      await Bun.write(join(ROOT, "../src/assets/players/messi_kit.jpg"), buf);
      console.log("wrote messi_kit.jpg", buf.byteLength, "bytes");
      return new Response("ok");
    }
    return new Response("not found", { status: 404 });
  },
});
console.log("messi converter on http://127.0.0.1:3012");
