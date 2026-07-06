// Verify the radio bridge: drive into a match, let it run, then read the
// C++->JS event/tick flow + the generated commentary. (Audio itself needs the
// user's browser + network for the Piper voice models; this checks plumbing.)
//   bun run radiotest.ts <port> [lang]
const port = Bun.argv[2] ?? "8080";
const lang = Bun.argv[3] ?? "fr";
const url = `http://127.0.0.1:${port}/?debug=1&lang=${lang}`;
const P = 9700 + Math.floor(Number(process.hrtime.bigint() % 90n));
const proc = Bun.spawn(
  ["/usr/bin/chromium", "--headless=new", "--no-sandbox", "--disable-gpu",
   "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--window-size=1280,860",
   `--remote-debugging-port=${P}`, "--remote-allow-origins=*", "about:blank"],
  { stdout: "ignore", stderr: "ignore" });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let t: any = null;
for (let i = 0; i < 60; i++) { await sleep(300);
  try { const l = await (await fetch(`http://127.0.0.1:${P}/json/list`)).json();
    t = l.find((x: any) => x.type === "page"); if (t?.webSocketDebuggerUrl) break; } catch {} }
if (!t) { console.log("FAIL no-chrome"); proc.kill(); process.exit(1); }
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pd = new Map<number, (v: any) => void>(); const logs: string[] = [];
const cmd = (m: string, q: any = {}) => new Promise<any>((res) => { const i = ++id; pd.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: q })); });
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data as string);
  if (m.id && pd.has(m.id)) { pd.get(m.id)!(m); pd.delete(m.id); return; }
  if (m.method === "Runtime.consoleAPICalled") logs.push((m.params.args || []).map((a: any) => a.value ?? "").join(" "));
  if (m.method === "Log.entryAdded") logs.push("LOG " + (m.params.entry?.text ?? "")); });
await new Promise<void>((r) => ws.addEventListener("open", () => r()));
await cmd("Runtime.enable"); await cmd("Page.enable"); await cmd("Log.enable"); await cmd("Page.navigate", { url });
const key = async () => { await cmd("Input.dispatchKeyEvent", { type: "keyDown", code: "Enter", key: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 }); await sleep(420); await cmd("Input.dispatchKeyEvent", { type: "keyUp", code: "Enter", key: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 }); };

await sleep(12000);
await cmd("Runtime.evaluate", { expression: "document.querySelector('canvas').focus()" });
for (let i = 0; i < 14 && !logs.some((x) => /Done creating match/i.test(x)); i++) { await key(); await sleep(2800); }
for (let i = 0; i < 20 && !logs.some((x) => /Done creating match/i.test(x)); i++) await sleep(2000);
const evalJson = async (expr: string): Promise<any> => {
  const r = await cmd("Runtime.evaluate", { expression: `JSON.stringify(${expr})`, returnByValue: true });
  try { return JSON.parse(r.result?.result?.value ?? "null"); } catch { return null; }
};

// run the match a long while, sampling to see if commentary stays continuous
await sleep(15000);
const s1 = await evalJson("({lines: window.__radioLines||0, ticks: (window.__gpfRadioBridge||{}).ticks||0, peak: window.__radioPeak||0, say: (window.__radioDebug||{}).lastSay})");
await sleep(45000);
const s2 = await evalJson("({lines: window.__radioLines||0, ticks: (window.__gpfRadioBridge||{}).ticks||0, peak: window.__radioPeak||0, say: (window.__radioDebug||{}).lastSay})");
console.log("sample @15s =", JSON.stringify(s1));
console.log("sample @60s =", JSON.stringify(s2));
const bridge = await evalJson("window.__gpfRadioBridge || null");
const rdbg = await evalJson("window.__radioDebug || null");
const engine = await evalJson("window.__radioEngine || null");
const lines = await evalJson("window.__radioLines || 0");
const peak = await evalJson("window.__radioPeak || 0");
const hooks = await evalJson("({event: typeof window.gpfRadioEvent, tick: typeof window.gpfRadioTick, reset: typeof window.gpfRadioReset})");
ws.close(); proc.kill();

console.log("reachedMatch =", logs.some((x) => /Done creating match/i.test(x)));
console.log("hooks installed =", JSON.stringify(hooks));
console.log("bridge =", JSON.stringify(bridge));
console.log("radioEngine =", engine, " flowLines =", lines);
console.log("radioDebug =", JSON.stringify(rdbg));
console.log("AUDIO PEAK =", peak, peak > 0.01 ? "  ✅ audible (non-silent samples)" : "  ❌ SILENT");
console.log("--- radio/tts/error console lines ---");
for (const l of logs.filter((x) => /\[radio\]|piper|voice|COEP|CORS|blocked|error|worker|tts/i.test(x)).slice(-20)) console.log(" ", l.slice(0, 160));
process.exit(0);
