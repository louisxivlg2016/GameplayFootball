/**
 * Autonomous self-test: launch the wasm game headless, drive through the menus
 * into a match (hammer Enter), wait for the match to load, screenshot, and
 * measure the PITCH region colour to decide GREEN vs DARK.
 *
 *   bun run autotest.ts <serve-dir-port> <shot.png>
 * Prints a JSON-ish line: RESULT=GREEN|DARK mean=(r,g,b) bright=.. green=..
 * Exit 0 if the field looks green+lit, 1 otherwise.
 */
const port = Bun.argv[2] ?? "8300";
const shot = Bun.argv[3] ?? "/tmp/gpf_auto_shot.png";
const url = `http://127.0.0.1:${port}/`;
const P = 9800 + Math.floor(Number(process.hrtime.bigint() % 180n));

const proc = Bun.spawn(
  ["/usr/bin/chromium", "--headless=new", "--no-sandbox", "--disable-gpu",
   "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--window-size=1280,860",
   `--remote-debugging-port=${P}`, "--remote-allow-origins=*", "about:blank"],
  { stdout: "ignore", stderr: "ignore" });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let t: any = null;
for (let i = 0; i < 60; i++) {
  await sleep(300);
  try { const l = await (await fetch(`http://127.0.0.1:${P}/json/list`)).json();
    t = l.find((x: any) => x.type === "page"); if (t?.webSocketDebuggerUrl) break; } catch {}
}
if (!t) { console.log("RESULT=FAIL no-chrome"); proc.kill(); process.exit(1); }
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pd = new Map<number, (v: any) => void>(); const logs: string[] = [];
const cmd = (m: string, q: any = {}) => new Promise<any>((res) => { const i = ++id; pd.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: q })); });
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data as string);
  if (m.id && pd.has(m.id)) { pd.get(m.id)!(m); pd.delete(m.id); return; }
  if (m.method === "Runtime.consoleAPICalled") logs.push((m.params.args || []).map((a: any) => a.value ?? "").join(" ")); });
await new Promise<void>((r) => ws.addEventListener("open", () => r()));
await cmd("Runtime.enable"); await cmd("Page.enable"); await cmd("Page.navigate", { url });
const key = async (h = 420) => { await cmd("Input.dispatchKeyEvent", { type: "keyDown", code: "Enter", key: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 }); await sleep(h); await cmd("Input.dispatchKeyEvent", { type: "keyUp", code: "Enter", key: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 }); };

await sleep(12000);                                   // intro
await cmd("Runtime.evaluate", { expression: "document.querySelector('canvas').focus()" });
for (let i = 0; i < 14 && !logs.some((x) => /Done creating match/i.test(x)); i++) {
  await key(); await sleep(2800);                     // Enter through menu pages
}
// wait for full match load
for (let i = 0; i < 20 && !logs.some((x) => /Done creating match/i.test(x)); i++) await sleep(2000);
await sleep(6000);                                    // let a few match frames render

const cap = await cmd("Page.captureScreenshot", { format: "png" });
if (cap.result?.data) await Bun.write(shot, Buffer.from(cap.result.data, "base64"));
ws.close(); proc.kill();

const reached = logs.some((x) => /Done creating match/i.test(x));
// analyse the pitch band (avoid HUD top, log overlay bottom, radar bottom-right)
const py = Bun.spawnSync(["python3", "-c", `
from PIL import Image
im=Image.open('${shot}').convert('RGB'); W,H=im.size; px=im.load()
rs=gs=bs=n=0
for y in range(int(H*0.12), int(H*0.42)):
  for x in range(int(W*0.15), int(W*0.85), 3):
    r,g,b=px[x,y]; rs+=r; gs+=g; bs+=b; n+=1
r,g,b=rs//n, gs//n, bs//n
bright=(r+g+b)//3
green = g > r+8 and g > b+8
print(f"{r} {g} {b} {bright} {1 if green else 0}")
`]);
const [r, g, b, bright, green] = py.stdout.toString().trim().split(/\s+/).map(Number);
const ok = reached && bright > 45 && green === 1;
console.log(`RESULT=${ok ? "GREEN" : "DARK"} reachedMatch=${reached} mean=(${r},${g},${b}) bright=${bright} green=${green} shot=${shot}`);
process.exit(ok ? 0 : 1);
