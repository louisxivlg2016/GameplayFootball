/**
 * Interactive driver: load the wasm game, then send keyboard + mouse to the
 * canvas and screenshot after each, to see whether input advances the menu.
 *   bun run cdp-input.ts <url>
 */
const url = Bun.argv[2] ?? "http://127.0.0.1:8118/";
const PORT = 9500 + Math.floor(Number(process.hrtime.bigint() % 300n));
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
await cmd("Runtime.enable");await cmd("Page.enable");
await cmd("Page.navigate",{url});
const shot=async(n:string)=>{const r=await cmd("Page.captureScreenshot",{format:"png"});if(r.result?.data)await Bun.write(`${S}/${n}.png`,Buffer.from(r.result.data,"base64"));
  const py=Bun.spawnSync(["python3","-c",`from PIL import Image;import statistics
im=Image.open('${S}/${n}.png').convert('RGB');px=list(im.getdata())
print(int(statistics.pvariance([(r+g+b)/3 for r,g,b in px[::53]])))`]);
  console.log(`  shot ${n}: variance ${py.stdout.toString().trim()}`);};
const key=async(code:string,vk:number,k:string)=>{
  await cmd("Input.dispatchKeyEvent",{type:"keyDown",code,key:k,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});
  await sleep(60);
  await cmd("Input.dispatchKeyEvent",{type:"keyUp",code,key:k,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});};
const click=async(x:number,y:number)=>{
  await cmd("Input.dispatchMouseEvent",{type:"mouseMoved",x,y});
  await cmd("Input.dispatchMouseEvent",{type:"mousePressed",x,y,button:"left",clickCount:1});
  await sleep(50);
  await cmd("Input.dispatchMouseEvent",{type:"mouseReleased",x,y,button:"left",clickCount:1});};

await sleep(12000); // let intro fade to menu
await cmd("Runtime.evaluate",{expression:"document.querySelector('canvas').focus()"});
await shot("in_00_menu");
console.log("sending Enter…"); await key("Enter",13,"Enter"); await sleep(2500); await shot("in_01_enter");
console.log("sending Space…"); await key("Space",32," "); await sleep(2500); await shot("in_02_space");
console.log("sending Return again + arrows…"); await key("Enter",13,"Enter"); await sleep(1500);
await key("ArrowDown",40,"ArrowDown"); await sleep(600); await key("Enter",13,"Enter"); await sleep(2500); await shot("in_03_nav");
console.log("clicking center…"); await click(640,300); await sleep(2500); await shot("in_04_click");
console.log("=== last logs ==="); for(const l of logs.slice(-14))console.log("  · "+l.slice(0,150));
ws.close();proc.kill();process.exit(0);
