/** Load a URL, warm the radio, dump [radio]/piper/worker/onnx console + errors. */
const url = Bun.argv[2] ?? "https://gameplay-football.vercel.app/?lang=fr";
const PORT = 9600 + Math.floor(Number(process.hrtime.bigint() % 300n));
const proc = Bun.spawn(
  ["/usr/bin/chromium","--headless=new","--no-sandbox","--disable-gpu",
   "--use-gl=swiftshader","--enable-unsafe-swiftshader","--window-size=1280,760",
   `--remote-debugging-port=${PORT}`,"--remote-allow-origins=*","about:blank"],
  { stdout:"ignore", stderr:"ignore" });
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
let target:any=null;
for(let i=0;i<60;i++){await sleep(300);try{const l=await(await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();target=l.find((t:any)=>t.type==="page");if(target?.webSocketDebuggerUrl)break;}catch{}}
if(!target){console.log("no target");proc.kill();process.exit(1);}
const ws=new WebSocket(target.webSocketDebuggerUrl);
let id=0;const pend=new Map<number,(v:any)=>void>();const logs:string[]=[];
const cmd=(m:string,p:any={})=>new Promise<any>(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}));});
ws.addEventListener("message",ev=>{const m=JSON.parse(ev.data as string);
  if(m.id&&pend.has(m.id)){pend.get(m.id)!(m);pend.delete(m.id);return;}
  if(m.method==="Runtime.consoleAPICalled"){const t=(m.params.args||[]).map((a:any)=>a.value??JSON.stringify(a.preview?.properties)??"").join(" ");logs.push("LOG "+t);}
  if(m.method==="Log.entryAdded"){logs.push("LOGENTRY "+m.params.entry.level+" "+m.params.entry.text+" "+(m.params.entry.url||""));}
  if(m.method==="Runtime.exceptionThrown"){logs.push("EXC "+(m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text));}
  if(m.method==="Network.loadingFailed"){logs.push("NETFAIL "+m.params.type+" "+(m.params.errorText||"")+" "+(m.params.blockedReason||""));}
  if(m.method==="Network.requestWillBeSent"){const u=m.params.request?.url||"";if(/hugging|piper|onnx|\.onnx|voices\.json|tts/i.test(u))logs.push("REQ "+u.slice(0,150));}
  if(m.method==="Network.responseReceived"){const u=m.params.response?.url||"";if(/hugging|piper|onnx|\.onnx|voices\.json|\/tts\/voices/i.test(u))logs.push("RESP "+m.params.response.status+" "+u.slice(0,120));}
  if(m.method==="Network.loadingFinished"){}});
await new Promise<void>(r=>ws.addEventListener("open",()=>r()));
await cmd("Runtime.enable");await cmd("Log.enable");await cmd("Page.enable");await cmd("Network.enable");
await cmd("Page.navigate",{url});
await sleep(40000);
const eng = (await cmd("Runtime.evaluate",{expression:"String((window).__radioEngine)+' | crossOriginIsolated='+self.crossOriginIsolated+' | peak='+String((window).__radioPeak)",returnByValue:true})).result?.result?.value;
console.log("=== __radioEngine:", eng);
console.log("=== relevant logs ===");
for(const l of logs.filter(x=>!/AudioContext was not allowed/.test(x)).filter(x=>/\[radio\]|piper|hugging|voices|NETFAIL|RESP |EXC |on air|failed|SharedArray|COEP|blocked|isolat|Failed/i.test(x)).slice(-45))console.log("  "+l.slice(0,240));
ws.close();proc.kill();process.exit(0);
