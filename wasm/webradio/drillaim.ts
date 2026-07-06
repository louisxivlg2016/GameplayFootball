// Training aim line. During a drill (penalty / free kick / corner), the C++
// referee calls window.gpfDrillReady() when the ball is live. We then let the
// user drag an aim line on top of the game: direction = where it goes, length =
// power. On release we hand three normalized values to the native shot hook
// (Module._gpf_drill_shoot), which converts them to a world velocity and kicks
// the ball. gpfDrillDone (all reps over) or a fired shot disarms the overlay.

interface DrillModule {
  _gpf_drill_shoot?: (aimRight: number, aimUp: number, power: number) => void;
}

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let hint: HTMLElement | null = null;
let armed = false;
let dragging = false;
let x0 = 0, y0 = 0, x1 = 0, y1 = 0;

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

function fit(): void {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function clear(): void {
  if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function draw(): void {
  if (!ctx) return;
  clear();
  if (!dragging) return;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // a plain white line, with a soft dark halo so it stays visible on the pitch
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  // small white dot at the start, so you see where the line begins
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x0, y0, 5, 0, Math.PI * 2);
  ctx.fill();
}

function onDown(e: PointerEvent): void {
  if (!armed) return;
  dragging = true;
  x0 = x1 = e.clientX;
  y0 = y1 = e.clientY;
  if (hint) hint.style.opacity = "0";
  canvas?.setPointerCapture(e.pointerId);
  e.preventDefault();
}

function onMove(e: PointerEvent): void {
  if (!dragging) return;
  x1 = e.clientX;
  y1 = e.clientY;
  draw();
  e.preventDefault();
}

function onUp(e: PointerEvent): void {
  if (!dragging) return;
  dragging = false;
  x1 = e.clientX;
  y1 = e.clientY;
  clear();
  const dx = x1 - x0;
  const dyUp = y0 - y1; // upward positive
  const len = Math.hypot(dx, y1 - y0);
  const H = window.innerHeight;
  if (len < 16) return; // a tap, not a shot — keep armed

  const aimRight = clamp(dx / (H * 0.35), -1, 1);          // left / right
  const aimUp = clamp(Math.max(0, dyUp) / (H * 0.7), 0.05, 1); // loft
  const power = clamp(len / (H * 0.5), 0.2, 1);            // pace

  const M = (window as unknown as { Module?: DrillModule }).Module;
  M?._gpf_drill_shoot?.(aimRight, aimUp, power);

  disarm(); // one shot per attempt; re-armed by the next gpfDrillReady
}

function arm(): void {
  armed = true;
  dragging = false;
  if (canvas) { canvas.style.display = "block"; canvas.style.pointerEvents = "auto"; }
  if (hint) hint.style.opacity = "1";
}

function disarm(): void {
  armed = false;
  dragging = false;
  clear();
  if (canvas) canvas.style.pointerEvents = "none";
  if (hint) hint.style.opacity = "0";
}

export function initDrillAim(): void {
  if (canvas) return;

  canvas = document.createElement("canvas");
  canvas.id = "gpf-drill-aim";
  Object.assign(canvas.style, {
    position: "fixed", inset: "0", zIndex: "40",
    display: "none", pointerEvents: "none", touchAction: "none",
  } as CSSStyleDeclaration);
  ctx = canvas.getContext("2d");

  hint = document.createElement("div");
  hint.id = "gpf-drill-hint";
  hint.textContent = "Trace un trait pour tirer";
  Object.assign(hint.style, {
    position: "fixed", left: "50%", bottom: "24px", transform: "translateX(-50%)",
    zIndex: "41", padding: "8px 18px", borderRadius: "999px",
    background: "rgba(0,0,0,0.55)", color: "#ffe94a", font: "600 15px system-ui, sans-serif",
    letterSpacing: ".02em", pointerEvents: "none", opacity: "0",
    transition: "opacity .2s ease", whiteSpace: "nowrap",
  } as CSSStyleDeclaration);

  document.body.append(canvas, hint);
  fit();

  window.addEventListener("resize", fit);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", () => { dragging = false; clear(); });

  const w = window as unknown as { gpfDrillReady?: () => void; gpfDrillDone?: () => void };
  w.gpfDrillReady = arm;
  // chain onto whatever gpfDrillDone the home menu installed (it shows the menu)
  const prevDone = w.gpfDrillDone;
  w.gpfDrillDone = (): void => { disarm(); try { prevDone?.(); } catch { /* ignore */ } };
}
