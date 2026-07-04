/**
 * Drive the wasm game from intro → main menu → MATCH → into a match, screenshot
 * each step.  bun run cdp-match.ts <url>
 */
const url = Bun.argv[2] ?? "http://127.0.0.1:8119/";
const PORT = 9600 + Math.floor(Number(process.hrtime.bigint() % 300n));
const S = "/tmp";
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
  if(m.method==="Runtime.consoleAPICalled"){const t=(m.params.args||[]).map((a:any)=>a.value??"").join(" ");logs.push(t);}});
await new Promise<void>(r=>ws.addEventListener("open",()=>r()));
await cmd("Runtime.enable");await cmd("Page.enable");await cmd("Page.navigate",{url});
const shot=async(n:string)=>{const r=await cmd("Page.captureScreenshot",{format:"png"});if(r.result?.data)await Bun.write(`${S}/${n}.png`,Buffer.from(r.result.data,"base64"));
  const py=Bun.spawnSync(["python3","-c",`from PIL import Image;import statistics
im=Image.open('${S}/${n}.png').convert('RGB');px=list(im.getdata())
print(int(statistics.pvariance([(r+g+b)/3 for r,g,b in px[::53]])))`]);
  console.log(`  ${n}: var ${py.stdout.toString().trim()}`);};
const key=async(code:string,vk:number,k:string,hold=260)=>{await cmd("Input.dispatchKeyEvent",{type:"keyDown",code,key:k,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});await sleep(hold);await cmd("Input.dispatchKeyEvent",{type:"keyUp",code,key:k,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});};
const click=async(x:number,y:number)=>{await cmd("Input.dispatchMouseEvent",{type:"mouseMoved",x,y});await sleep(80);await cmd("Input.dispatchMouseEvent",{type:"mousePressed",x,y,button:"left",clickCount:1});await sleep(60);await cmd("Input.dispatchMouseEvent",{type:"mouseReleased",x,y,button:"left",clickCount:1});};

await sleep(9000);
await cmd("Runtime.evaluate",{expression:"document.querySelector('canvas').focus()"});
console.log("dismiss intro…"); await key("Enter",13,"Enter"); await sleep(3000); await shot("m_1_menu");
console.log("activate MATCH (default focus)…"); await key("Enter",13,"Enter",400); await sleep(4000); await shot("m_2_afterMatch");
console.log("controller-select: Enter to confirm…"); await key("Enter",13,"Enter",400); await sleep(4000); await shot("m_3_afterEnter");
console.log("proceed…"); await key("Enter",13,"Enter",400); await sleep(4000); await shot("m_4_progress");
console.log("wait for match load…"); await sleep(20000); await shot("m_5_matchload");
console.log("=== match-related logs ===");
for(const l of logs.filter(x=>/Match|Team|player|pitch|stadium|Loading|anim|controller|Controller/i.test(x)).slice(-16))console.log("  · "+l.slice(0,150));
ws.close();proc.kill();process.exit(0);
