/**
 * Score-bar flag overlay. The shipped squad DB has only a handful of teams, so a
 * NATIONAL / CLUB pick can't change the on-pitch team — but we can cover the two
 * badges in the C++ scoreboard (top-left) with the picked country's flag (emoji)
 * or the club's crest (image). Positioned over the game <canvas> and re-tracked
 * on resize. Cleared when we return to the menu.
 */
export interface ScoreFlag { emoji?: string; img?: string; code?: string }

let home: ScoreFlag | null = null;
let away: ScoreFlag | null = null;
let root: HTMLElement | null = null;
let slot0: HTMLElement | null = null;
let slot1: HTMLElement | null = null;
let lab0: HTMLElement | null = null;
let lab1: HTMLElement | null = null;

// positions as a fraction of the canvas (tuned to the C++ scoreboard)
const BADGE_Y = 0.026;
const BADGE_H = 0.052;
const BADGE_W = 1.42;   // flag width as a multiple of its height — wide enough to
                        // fully cover the old red club shield underneath
const BADGE_X0 = 0.286; // home team badge centre (over the C++ scoreboard)
const BADGE_X1 = 0.386; // away team badge centre
const NAME_X0 = 0.334;  // home team name ("ARS") centre
const NAME_X1 = 0.435;  // away team name centre

function fill(slot: HTMLElement, f: ScoreFlag | null): void {
  if (!f) { slot.innerHTML = ""; slot.style.display = "none"; return; }
  slot.style.display = "flex";
  const emojiSpan = `<span style="font-size:80%;line-height:1">${f.emoji ?? ""}</span>`;
  if (f.img) {
    slot.innerHTML =
      `<img src="${f.img}" style="width:100%;height:100%;object-fit:cover;border-radius:2px"` +
      ` onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${f.emoji ?? ""}',style:'font-size:80%'}))">`;
  } else {
    slot.innerHTML = emojiSpan;
  }
}

// paint the country/club code over the C++ team-name text ("ARS"), on a small
// dark plate so the baked-in name underneath doesn't bleed through.
function fillLabel(lab: HTMLElement, f: ScoreFlag | null): void {
  const code = (f?.code ?? "").trim();
  if (!code) { lab.style.display = "none"; return; }
  lab.style.display = "flex";
  lab.textContent = code;
}

function place(): void {
  const canvas = document.getElementById("canvas");
  if (!canvas || !root || !slot0 || !slot1 || !lab0 || !lab1) return;
  if (!home && !away) { root.style.display = "none"; return; }
  const r = canvas.getBoundingClientRect();
  if (r.width < 10) { root.style.display = "none"; return; }
  root.style.display = "block";
  const h = Math.max(14, r.height * BADGE_H);
  const y = r.top + r.height * BADGE_Y;
  const bw = h * BADGE_W;
  const style = (slot: HTMLElement, cx: number): void => {
    slot.style.left = `${r.left + r.width * cx - bw / 2}px`;
    slot.style.top = `${y}px`;
    slot.style.width = `${bw}px`;
    slot.style.height = `${h}px`;
    slot.style.fontSize = `${h}px`;
  };
  style(slot0, BADGE_X0);
  style(slot1, BADGE_X1);
  // code plate: same height as the badge, wide enough for 3 letters (ENG/WAL)
  const lw = h * 1.8;
  const styleLab = (lab: HTMLElement, cx: number): void => {
    lab.style.left = `${r.left + r.width * cx - lw / 2}px`;
    lab.style.top = `${y}px`;
    lab.style.width = `${lw}px`;
    lab.style.height = `${h}px`;
    lab.style.fontSize = `${h * 0.6}px`;
  };
  styleLab(lab0, NAME_X0);
  styleLab(lab1, NAME_X1);
}

export function setScoreFlags(h: ScoreFlag | null, a: ScoreFlag | null): void {
  home = h; away = a;
  if (slot0 && slot1) { fill(slot0, home); fill(slot1, away); }
  if (lab0 && lab1) { fillLabel(lab0, home); fillLabel(lab1, away); }
  place();
}
export function clearScoreFlags(): void { setScoreFlags(null, null); }

export function initScoreFlags(): void {
  if (root) return;
  root = document.createElement("div");
  root.id = "gpf-scoreflags";
  Object.assign(root.style, {
    position: "fixed", inset: "0", zIndex: "39", pointerEvents: "none", display: "none",
  } as CSSStyleDeclaration);
  const mkSlot = (): HTMLElement => {
    const s = document.createElement("div");
    Object.assign(s.style, {
      position: "fixed", display: "none", alignItems: "center", justifyContent: "center",
      overflow: "hidden", borderRadius: "3px",
    } as CSSStyleDeclaration);
    return s;
  };
  slot0 = mkSlot(); slot1 = mkSlot();
  const mkLab = (): HTMLElement => {
    const s = document.createElement("div");
    Object.assign(s.style, {
      position: "fixed", display: "none", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: "900", fontFamily: "Arial, Helvetica, sans-serif",
      letterSpacing: "0.02em", lineHeight: "1", overflow: "hidden", whiteSpace: "nowrap",
      background: "linear-gradient(#3b3b3b,#1e1e1e)", borderRadius: "2px",
      textShadow: "0 1px 1px #000",
    } as CSSStyleDeclaration);
    return s;
  };
  lab0 = mkLab(); lab1 = mkLab();
  root.append(slot0, slot1, lab0, lab1);
  document.body.appendChild(root);

  window.addEventListener("resize", place);
  // the canvas can be CSS-resized without a resize event (fullscreen, layout);
  // re-track a few times a second while flags are shown.
  window.setInterval(() => { if (home || away) place(); }, 500);
}
