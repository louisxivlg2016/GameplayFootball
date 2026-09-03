/**
 * Drive: home → Match amical → JOUER → lineup start → into a match, then dump the
 * scoreboard-overlay element rects (flags/codes/scores) + a cropped screenshot so
 * we can see exactly whether the score digit covers the flag.
 * bun run cdp-score.ts <url>
 */
const url = Bun.argv[2] ?? "http://127.0.0.1:8230/?lang=fr";
const PORT = 9600 + Math.floor(Number(process.hrtime.bigint() % 300n));
const S = "/tmp/claude-1000/-home-louisxiv-GameplayFootball-web/c8dd1024-7d38-410b-b970-50eb20293864/scratchpad";
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
let id=0;const pend=new Map<number,(v:any)=>void>();
const cmd=(m:string,p:any={})=>new Promise<any>(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}));});
ws.addEventListener("message",ev=>{const m=JSON.parse(ev.data as string);if(m.id&&pend.has(m.id)){pend.get(m.id)!(m);pend.delete(m.id);}});
await new Promise<void>(r=>ws.addEventListener("open",()=>r()));
await cmd("Runtime.enable");await cmd("Page.enable");await cmd("Page.navigate",{url});
const evl=async(expr:string)=>(await cmd("Runtime.evaluate",{expression:expr,returnByValue:true})).result?.result?.value;
const shot=async(n:string)=>{const r=await cmd("Page.captureScreenshot",{format:"png"});if(r.result?.data)await Bun.write(`${S}/${n}.png`,Buffer.from(r.result.data,"base64"));console.log("  shot",n);};

await sleep(9000);
console.log("click Match amical…");
await evl(`(()=>{const el=[...document.querySelectorAll('#gpf-home *')].find(e=>/^\\s*Match amical/i.test(e.textContent)&&e.children.length<3);if(el){el.click();return true}return false})()`);
await sleep(2500); await shot("s1_friendly");
console.log("click JOUER…");
await evl(`document.querySelector('#gpf-friendly .fr-play')?.click()`);
await sleep(2500); await shot("s2_lineup");
console.log("click lineup start…");
await evl(`document.querySelector('#gpf-lineup .lineup-start')?.click()`);
console.log("wait match load…");
// poke the score bridge so the overlay renders even at 0-0, and force a score to test
await sleep(30000);
await evl(`(()=>{const b=window.__gpfRadioBridge;if(b){b.score=[3,1];}})()`);
await sleep(2000);
await shot("s3_match");
// dump rects
const rects = await evl(`(()=>{const c=document.getElementById('canvas');const cr=c.getBoundingClientRect();const root=document.getElementById('gpf-scoreflags');const names=['flag0','flag1','code0','code1','you','score0','score1'];const out={canvas:{l:cr.left,t:cr.top,w:cr.width,h:cr.height},ticks:window.__gpfRadioBridge?.ticks,homeHidden:!!document.querySelector('#gpf-home.hidden'),bodyClass:document.body.className};[...root.children].forEach((ch,i)=>{const r=ch.getBoundingClientRect();out[names[i]||i]={l:Math.round(r.left),r:Math.round(r.right),t:Math.round(r.top),disp:getComputedStyle(ch).display,txt:ch.textContent};});return JSON.stringify(out);})()`);
console.log("RECTS:", rects);
ws.close();proc.kill();process.exit(0);
