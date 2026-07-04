/**
 * Headless-Chrome validator for the wasm build. Loads the served page, waits,
 * collects console + exceptions, screenshots, and checks the canvas is NON-BLANK
 * (pixel variance) — the "does it load a blank page" gate the task asks for.
 *
 *   bun run chrome-check.ts <url> [seconds] [screenshot.png]
 *
 * Exits 0 if the canvas rendered non-uniform pixels and no fatal error/abort;
 * 1 otherwise. Prints a compact report.
 */
const url = Bun.argv[2] ?? "http://127.0.0.1:8080/";
const secs = Number(Bun.argv[3] ?? 10);
const shot = Bun.argv[4] ?? "/tmp/gpf_wasm_shot.png";
const PORT = 9333 + Math.floor(Number(process.hrtime.bigint() % 200n));

const proc = Bun.spawn(
  ["/usr/bin/chromium", "--headless=new", "--no-sandbox", "--disable-gpu",
   "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--window-size=1280,760",
   `--remote-debugging-port=${PORT}`, "--remote-allow-origins=*", "about:blank"],
  { stdout: "ignore", stderr: "ignore" });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let target: any = null;
for (let i = 0; i < 60; i++) {
  await sleep(300);
  try {
    const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    target = l.find((t: any) => t.type === "page");
    if (target?.webSocketDebuggerUrl) break;
  } catch {}
}
if (!target) { console.log("FAIL: no chrome target"); proc.kill(); process.exit(1); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pending = new Map<number, (v: any) => void>();
const logs: string[] = []; const errs: string[] = [];
const cmd = (m: string, p: any = {}): Promise<any> =>
  new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data as string);
  if (m.id && pending.has(m.id)) { pending.get(m.id)!(m); pending.delete(m.id); return; }
  if (m.method === "Runtime.consoleAPICalled") {
    const t = (m.params.args || []).map((a: any) => a.value ?? a.description ?? "").join(" ");
    logs.push(t);
    if (m.params.type === "error" && !/GroupMarkerNotSet|swiftshader|Deprecation/i.test(t)) errs.push(t);
    // the game logs fatal errors to STDOUT (console.log), then exit(1)/abort —
    // catch those too, else an aborted run would look "fine"
    if (/FATAL ERROR|native code called abort|Aborted\(|thread constructor failed|memory access out of bounds/i.test(t))
      errs.push("APP " + t);
  }
  if (m.method === "Runtime.exceptionThrown") {
    const d = m.params.exceptionDetails;
    errs.push("EXC " + ((d.exception?.description ?? d.text) || "").split("\n")[0]);
    const frames = d.stackTrace?.callFrames?.map((f: any) => f.functionName).filter(Boolean).slice(0, 14);
    if (frames?.length) errs.push("STACK " + frames.join(" <- "));
  }
  if (m.method === "Log.entryAdded" && m.params.entry.level === "error") {
    const t = m.params.entry.text || "";
    // favicon and source-map 404s are noise, not app failures
    if (!/favicon\.ico|\.map\b/i.test(t + (m.params.entry.url || ""))) errs.push("LOG " + t);
  }
});
await new Promise<void>((r) => ws.addEventListener("open", () => r()));
await cmd("Runtime.enable"); await cmd("Page.enable"); await cmd("Log.enable");
await cmd("Page.navigate", { url });
await sleep(secs * 1000);

const isoRes = await cmd("Runtime.evaluate", { expression: "self.crossOriginIsolated", returnByValue: true });
const iso = isoRes.result?.result?.value;
const hasCanvasRes = await cmd("Runtime.evaluate", {
  expression: "(()=>{const c=document.querySelector('canvas');return c?c.width+'x'+c.height:'none';})()",
  returnByValue: true });
const canvasDim = hasCanvasRes.result?.result?.value;

// The reliable non-blank signal is the COMPOSITED screenshot (an in-page
// drawImage of a preserveDrawingBuffer:false WebGL canvas reads empty).
try { await Bun.file(shot).unlink(); } catch {}  // never analyse a stale shot
const capture = await cmd("Page.captureScreenshot", { format: "png" });
if (capture.result?.data) await Bun.write(shot, Buffer.from(capture.result.data, "base64"));
else console.log("WARN: screenshot capture returned no data");
ws.close(); proc.kill();

// pixel variance of the screenshot via python/PIL
let variance = -1, buckets = -1;
try {
  const py = Bun.spawnSync(["python3", "-c",
    `from PIL import Image;import statistics
im=Image.open('${shot}').convert('RGB');px=list(im.getdata())
lum=[(r+g+b)/3 for r,g,b in px[::53]]
b=set((r//16,g//16,bl//16) for r,g,bl in px[::101])
print(int(statistics.pvariance(lum)),len(b))`]);
  const out = py.stdout.toString().trim().split(/\s+/);
  variance = Number(out[0]); buckets = Number(out[1]);
} catch (e) { /* python missing */ }

console.log("── chrome-check ──");
console.log("url:", url, "| crossOriginIsolated:", iso, "| canvas:", canvasDim);
console.log(`screenshot: ${shot} | variance: ${variance} | colorBuckets: ${buckets}`);
console.log(`console lines: ${logs.length}, errors: ${errs.length}`);
for (const l of logs.slice(-70)) console.log("  · " + l.slice(0, 300));
if (errs.length) { console.log("ERRORS:"); for (const e of errs.slice(0, 12)) console.log("  ✗ " + e.slice(0, 400)); }

const nonBlank = variance > 15 && buckets > 4;
console.log(nonBlank ? "RESULT: NON-BLANK ✓" : "RESULT: BLANK/UNKNOWN ✗");
process.exit(nonBlank && errs.length === 0 ? 0 : 1);
