// Training aim curve. During a drill (penalty / free kick / corner) the C++
// referee calls window.gpfDrillReady() when the ball is live. The user then
// traces a FREE CURVE with the finger (or mouse) anywhere on screen; we draw it
// as a white poly-line. On release we turn it into a shot: the chord (start->end)
// gives direction + power, and how much the path bows sideways gives the swerve
// (curl). Those go to Module._gpf_drill_shoot(aimRight, aimUp, power, curl), which
// launches the ball and spins it so it bends the way you drew. Fires on release;
// gpfDrillDone (all reps over) disarms the overlay.

interface DrillModule {
  _gpf_drill_shoot?: (aimRight: number, aimUp: number, power: number, curl: number) => void;
  _gpf_freekick_pass?: (aimRight: number, aimUp: number, power: number) => void;
}

interface Pt { x: number; y: number; }

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let hint: HTMLElement | null = null;
let armed = false;
let dragging = false;
let pts: Pt[] = [];
// "shoot" = training drill (curl toward goal); "pass" = in-match offside free kick
// (trace toward a team-mate to pass). Same trace, different release.
let mode: "shoot" | "pass" = "shoot";

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
  if (!ctx || pts.length === 0) return;
  clear();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  // white dot at the start
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(pts[0].x, pts[0].y, 5, 0, Math.PI * 2);
  ctx.fill();
}

// Start / update / finish the drag — a mouse and a finger feed the same code.
function begin(cx: number, cy: number): void {
  if (!armed) return;
  dragging = true;
  pts = [{ x: cx, y: cy }];
  if (hint) hint.style.opacity = "0";
}

function move(cx: number, cy: number): void {
  if (!dragging) return;
  const last = pts[pts.length - 1];
  if (!last || Math.hypot(cx - last.x, cy - last.y) >= 2) pts.push({ x: cx, y: cy });
  draw();
}

function end(cx: number, cy: number): void {
  if (!dragging) return;
  dragging = false;
  pts.push({ x: cx, y: cy });
  clear();

  const s = pts[0];
  const e = pts[pts.length - 1];
  const dx = e.x - s.x;
  const dyUp = s.y - e.y; // screen up = positive
  const chordLen = Math.hypot(dx, e.y - s.y);
  const H = window.innerHeight;
  if (chordLen < 16) { if (armed && hint) hint.style.opacity = "1"; return; } // too short — keep armed

  const aimRight = clamp(dx / (H * 0.35), -1, 1);              // left / right
  const aimUp = clamp(Math.max(0, dyUp) / (H * 0.7), 0.05, 1); // loft
  const power = clamp(chordLen / (H * 0.5), 0.2, 1);           // pace

  // curl: peak signed sideways bow of the path off the chord (screen-right = +)
  let peak = 0;
  for (const p of pts) {
    const cz = dx * (p.y - s.y) - (e.y - s.y) * (p.x - s.x);
    if (Math.abs(cz) > Math.abs(peak)) peak = cz;
  }
  const perp = peak / chordLen;                     // px off the chord
  const curl = clamp(perp / (chordLen * 0.4), -1, 1);

  const M = (window as unknown as { Module?: DrillModule }).Module;
  if (mode === "pass") M?._gpf_freekick_pass?.(aimRight, aimUp, power); // pass toward where you drew
  else M?._gpf_drill_shoot?.(aimRight, aimUp, power, curl);             // curling shot at goal

  disarm(); // one attempt; re-armed by the next gpfDrillReady / gpfFreekickReady
}

function touchXY(e: TouchEvent): Touch | undefined {
  return e.changedTouches[0] || e.touches[0];
}

// Hide the top-right SON / RADIO / LANGUE pills while a drill runs — in the
// set-piece cameras they land right on top of the keeper / goal.
function setPillsHidden(hidden: boolean): void {
  const m = document.getElementById("gpf-menu");
  if (m) m.style.display = hidden ? "none" : "";
}

function arm(): void {
  mode = "shoot";
  armed = true;
  dragging = false;
  pts = [];
  setPillsHidden(true);
  document.body.classList.add("gpf-aim-active");
  if (canvas) { canvas.style.display = "block"; canvas.style.pointerEvents = "auto"; }
  if (hint) { hint.textContent = "Trace la trajectoire du tir au doigt"; hint.style.opacity = "1"; }
}

// in-match offside free kick: same trace, but it PASSES toward where you draw
function armPass(): void {
  mode = "pass";
  armed = true;
  dragging = false;
  pts = [];
  setPillsHidden(true);
  document.body.classList.add("gpf-aim-active");
  if (canvas) { canvas.style.display = "block"; canvas.style.pointerEvents = "auto"; }
  if (hint) { hint.textContent = "Trace un trait vers un coéquipier pour passer"; hint.style.opacity = "1"; }
}

function disarm(): void {
  armed = false;
  dragging = false;
  pts = [];
  clear();
  if (canvas) canvas.style.pointerEvents = "none";
  if (hint) hint.style.opacity = "0";
  document.body.classList.remove("gpf-aim-active");
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
  hint.textContent = "Trace la trajectoire du tir au doigt";
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

  // Touch (finger) — non-passive so preventDefault() stops the page scrolling
  // while you draw; touch-action:none on the canvas backs it up.
  canvas.addEventListener("touchstart", (e: TouchEvent) => {
    const t = touchXY(e); if (!t || !armed) return;
    begin(t.clientX, t.clientY); e.preventDefault();
  }, { passive: false });
  canvas.addEventListener("touchmove", (e: TouchEvent) => {
    const t = touchXY(e); if (!t || !dragging) return;
    move(t.clientX, t.clientY); e.preventDefault();
  }, { passive: false });
  canvas.addEventListener("touchend", (e: TouchEvent) => {
    const t = touchXY(e); if (!t) return;
    end(t.clientX, t.clientY); e.preventDefault();
  }, { passive: false });
  canvas.addEventListener("touchcancel", () => { dragging = false; clear(); });

  // Mouse (desktop) — track on window so a drag off-canvas still follows.
  canvas.addEventListener("mousedown", (e: MouseEvent) => begin(e.clientX, e.clientY));
  window.addEventListener("mousemove", (e: MouseEvent) => move(e.clientX, e.clientY));
  window.addEventListener("mouseup", (e: MouseEvent) => end(e.clientX, e.clientY));

  const w = window as unknown as {
    gpfDrillReady?: () => void; gpfDrillDone?: () => void;
    gpfFreekickReady?: () => void; gpfFreekickDone?: () => void;
  };
  w.gpfDrillReady = arm;
  const prevDone = w.gpfDrillDone;
  w.gpfDrillDone = (): void => { disarm(); setPillsHidden(false); try { prevDone?.(); } catch { /* ignore */ } };
  // in-match offside free kick the human takes: arm the trace in "pass" mode
  w.gpfFreekickReady = armPass;
  w.gpfFreekickDone = (): void => { disarm(); setPillsHidden(false); };
}
