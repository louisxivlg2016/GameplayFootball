/**
 * REFEREE MODE — play AS the referee.
 *
 * When enabled (home-menu "ARBITRE" toggle → gpf_set_referee_mode), the match runs
 * AI-vs-AI and the human sees only this control bar. From it the ref blows the
 * whistle, shows cards (a big card animates "into the hand"), awards penalties /
 * free kicks, reviews the VAR, and decides injuries (treat vs send off).
 *
 * All buttons drive native bridges added in gametask.cpp:
 *   _gpf_ref_whistle()             blow the whistle
 *   _gpf_ref_card(team,color)      card a player (team<0 = whoever holds the ball; 1=yellow,3=red)
 *   _gpf_ref_setpiece(type,team)   6=penalty,3=free kick,4=corner… for team 0/1
 *   _gpf_ref_injury_off(team)      send a random outfield player off (injury exit)
 *   _gpf_replay(ms)                VAR / instant replay
 */
import { L } from "./i18n";
import { radioSay, radio } from "./radioEngine";
import { dialogLine, type Intent } from "./refdialog";

// Speak a player's line out loud in the radio commentator voice. Strips leading
// emoji/symbols (they'd be spelled out by the neural voice) and speaks the words.
function voice(text: string): void {
  const words = (text || "").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, "").trim();
  if (words) try { radioSay(words); } catch { /* radio not ready */ }
}

interface RefModule {
  _gpf_ref_whistle?: () => void;
  _gpf_ref_card?: (team: number, color: number) => void;
  _gpf_ref_setpiece?: (type: number, team: number) => void;
  _gpf_ref_injury_off?: (team: number) => void;
  _gpf_ref_walk?: (x: number, y: number) => void;
  _gpf_ref_look?: (yaw: number, pitch: number) => void;
  _gpf_ref_talk_order?: (order: number) => void;
  _gpf_ref_talk_end?: () => void;
  _gpf_replay?: (ms: number) => void;
  _gpf_sim_frame?: () => number;
  _gpf_ref_awaiting_whistle?: () => number;
  _gpf_ref_injured_dist?: () => number;
  _gpf_ref_injury_resolve?: (sendOff: number) => void;
  ccall?: (name: string, ret: string, argTypes: string[], args: unknown[]) => string;
}
const PI = Math.PI;

// The nearest player's name (via the native bridge), for the "talk to a player"
// dialogue. Returns a plain string ("" if unavailable).
function nearestName(): string {
  try { return M()?.ccall?.("gpf_ref_nearest_name", "string", [], []) || ""; } catch { return ""; }
}

// Canned player replies with a rising MOOD (0 calm → 3 furious). Offline game → no
// LLM, so it's keyword-driven banter, but it varies every time, escalates with
// insults/threats, calms with apologies, and acknowledges orders. An emoji shows
// the current emotion so you SEE him react.
let mood = 0;
let disputeMode = false; // a dispute is ongoing → players deny starting it
function resetMood(): void { mood = 0; }
function playerReply(input: string): string {
  const t = input.toLowerCase();

  // opening line (empty input). During a dispute he immediately swears innocence.
  if (!t.trim()) {
    if (disputeMode) return (mood >= 2 ? "😠 " : "😤 ") + dialogLine("disputeOpen", mood >= 2);
    return "🙂 " + dialogLine("greet", false);
  }

  // mood shifts — keywords in FR + EN (the two most likely typing languages)
  if (/idiot|nul|aveugle|triche|con\b|conn|merde|ferme|abruti|vendu|stupid|blind|cheat|shit|useless|clown|rubbish/.test(t)) mood = Math.min(3, mood + 2);
  else if (/rouge|expuls|dehors|vire|sors\b|red\b|sent off/.test(t)) mood = Math.min(3, mood + 1);
  else if (/calme|respect|pardon|désol|d'accord|ok\b|tranquille|bien jou|arrêt|suffit|stop|sorry|calm|well played|enough|easy/.test(t)) mood = Math.max(0, mood - 1);

  const hot = mood >= 2;
  // classify the message into an intent (same order/meaning as before, now with
  // English + a few universal football words so it works in any typing language)
  let intent: Intent;
  if (/repren|reprend|on joue|c'est bon|allez.*jou|le jeu|on reprend|jouons|play on|resume|let'?s play|continue/.test(t)) intent = "resume";
  else if (/pourquoi|qu'est.*passe|c'est quoi|raconte|explique|le problème|il se passe|why|what happened|explain|problem/.test(t)) intent = "why";
  else if (/qui a commenc|c'est qui|qui a fait|c'est lui|who started|who did|whose fault/.test(t)) intent = "who";
  else if (/arrêt|arretez|ça suffit|suffit|calme|du calme|stop|tranquille|enough|settle|relax/.test(t)) intent = "calm";
  else if (/recule|écarte|dégage|pousse|va-t'?en|bouge|step back|move back|back off|move away|get back/.test(t)) intent = "order";
  else if (/tais|silence|ferme-la|chut|shut up|be quiet|quiet/.test(t)) intent = "silence";
  else if (/rouge|expuls|red card|sent off/.test(t)) intent = "red";
  else if (/jaune|carton|yellow|booking|book\b/.test(t)) intent = "yellow";
  else if (/main|hand|handball/.test(t)) intent = "hand";
  else if (/penalty|penal|penalti|spot kick/.test(t)) intent = "penalty";
  else if (/faute|foul|free kick/.test(t)) intent = "foul";
  else if (/insult|idiot|nul|aveugle|triche|con\b|vendu|abruti|cheat|blind|stupid|useless/.test(t)) intent = "insult";
  else if (/bravo|bien jou|beau geste|good|well done|nice|great/.test(t)) intent = "praise";
  else intent = "default";

  const face = mood >= 3 ? "🤬 " : mood >= 2 ? "😠 " : mood >= 1 ? "😤 " : "🙂 ";
  return face + dialogLine(intent, hot);
}
const M = (): RefModule | undefined => (window as unknown as { Module?: RefModule }).Module;

// First-person referee arms: a real forearm photo (background removed), placed at
// the bottom-left as-is and mirrored at the bottom-right. Embedded as a data URI so
// it needs no server asset. (The base64 is injected at build time.)
const ARM_URI = "data:image/png;base64,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";
const ARMS_HTML =
  `<img class="fa l" src="${ARM_URI}" alt="">` +
  `<img class="fa r" src="${ARM_URI}" alt="">`;

let bar: HTMLElement | null = null;
let handEl: HTMLElement | null = null;
let injuryBox: HTMLElement | null = null;
let armsEl: HTMLElement | null = null;
let moveHint: HTMLElement | null = null;
let visible = false;

// keyboard walking: track pressed movement keys, push camera-relative steering.
const pressed = new Set<string>();
let lastX = 0, lastY = 0;
function pumpWalk(): void {
  let x = 0, y = 0;
  if (pressed.has("up")) y += 1;
  if (pressed.has("down")) y -= 1;
  if (pressed.has("right")) x += 1;
  if (pressed.has("left")) x -= 1;
  if (x === lastX && y === lastY) return;
  lastX = x; lastY = y;
  M()?._gpf_ref_walk?.(x, y);
}
const KEYMAP: Record<string, string> = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", s: "down", a: "left", d: "right", z: "up", q: "left",
};

// mouse/touch look: drag over the pitch turns the head. yaw = world heading (rad),
// pitch around X (0.47π ≈ just below level; higher = up, lower = down).
let camYaw = 0, camPitch = 0.47 * PI;
let dragging = false, dragX = 0, dragY = 0, downX = 0, downY = 0, moved = false;
const LOOK_SENS = 0.006;
function pushLook(): void { M()?._gpf_ref_look?.(camYaw, camPitch); }

// referee dialogue state
let stopped = false;      // true after a whistle stops play
let dlgOpen = false;
let dlgEl: HTMLElement | null = null;
let dlgName: HTMLElement | null = null;
let dlgLog: HTMLElement | null = null;
let dlgInput: HTMLInputElement | null = null;
let dlgCurrentName = "";
let dlgHistory: { role: string; text: string }[] = [];
let aiOnline = true; // set false once /api/talk reports no key, to stop retrying

function dlgLine(who: "ref" | "pl", text: string): void {
  if (!dlgLog) return;
  const d = document.createElement("div");
  d.className = "dl " + who;
  d.textContent = text;
  dlgLog.appendChild(d);
  dlgLog.scrollTop = dlgLog.scrollHeight;
}
function openDialogue(tappedName?: string): void {
  if (!dlgEl) return;
  resetMood();
  // If a tapped player's name is passed, gpf_ref_pick_player already SELECTED him
  // (he faces the ref). Otherwise fall back to the nearest player to the referee.
  let name = tappedName || "";
  if (!name) { try { name = M()?.ccall?.("gpf_ref_talk_begin", "string", [], []) || ""; } catch { /* no bridge */ } }
  dlgCurrentName = name || nearestName() || L("Le joueur");
  dlgHistory = [];
  if (dlgName) dlgName.textContent = "💬 " + dlgCurrentName;
  if (dlgLog) dlgLog.innerHTML = "";
  const greet = playerReply("");
  dlgLine("pl", greet); dlgHistory.push({ role: "pl", text: greet });
  voice(greet); // the player speaks it out loud in the radio voice
  dlgEl.style.display = "flex";
  dlgOpen = true;
  dlgInput?.focus();
}
function closeDialogue(): void {
  if (dlgEl) dlgEl.style.display = "none";
  dlgOpen = false;
  M()?._gpf_ref_talk_end?.(); // the player goes back to normal play
}

// Ask the real AI (serverless /api/talk → Claude). Returns null if no key / offline
// so the caller can fall back to the built-in canned replies.
async function aiReply(message: string): Promise<string | null> {
  if (!aiOnline) return null;
  try {
    const r = await fetch("/api/talk", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: dlgCurrentName, message, history: dlgHistory.slice(-8) }),
    });
    const j = await r.json() as { reply?: string | null; nokey?: boolean };
    if (j.nokey) { aiOnline = false; return null; }
    return j.reply || null;
  } catch { return null; }
}
// Big prompt shown while a restart is waiting for YOUR whistle (kick-off,
// penalty, free kick…). In referee mode nothing restarts on its own any more.
let whistleEl: HTMLElement | null = null;
function showWhistlePrompt(on: boolean): void {
  if (!whistleEl) {
    const d = document.createElement("div");
    d.id = "gpf-ref-whistle";
    d.style.cssText = [
      "position:fixed", "top:64px", "left:50%", "transform:translateX(-50%)",
      "z-index:2147483400", "display:none", "pointer-events:none",
      "background:rgba(8,12,18,.9)", "color:#ffe94a", "border-radius:999px",
      "padding:11px 22px", "font:800 17px/1 system-ui,sans-serif",
      "box-shadow:0 4px 16px rgba(0,0,0,.55)", "white-space:nowrap",
      "animation:gpfwhistle 1.1s ease-in-out infinite",
    ].join(";");
    const st = document.createElement("style");
    st.textContent = "@keyframes gpfwhistle{0%,100%{opacity:.75}50%{opacity:1}}";
    document.head.appendChild(st);
    document.body.appendChild(d);
    whistleEl = d;
  }
  whistleEl.textContent = "🔔 " + L("À toi de siffler pour lancer le jeu");
  whistleEl.style.display = on ? "block" : "none";
}

// Injury flow: a player is down, the referee has to REACH him (< 3 m) before the
// heal / carry-off box appears — you can't judge an injury from the far side.
let injuredName = "";
let injuryBoxOpen = false;
function pollInjury(): void {
  if (!injuredName) return;
  let d = -1;
  try { d = M()?._gpf_ref_injured_dist?.() ?? -1; } catch { /* */ }
  if (d < 0) { injuredName = ""; injuryBoxOpen = false; showWhistlePrompt(false); return; }
  if (!injuryBoxOpen && d < 3.0) {       // you're next to him -> decide
    injuryBoxOpen = true;
    openInjury();
  } else if (!injuryBoxOpen) {
    showEvent("🏥 " + injuredName + " — " + L("va voir le joueur à terre !") + "  (" + d.toFixed(0) + " m)");
  }
}

function refreshHint(): void {
  if (!moveHint) return;
  moveHint.innerHTML = stopped
    ? `⏸️ ${L("Jeu arrêté")} — 💬 ${L("tape un joueur pour lui parler")}<br>🔔 ${L("Re-siffler : reprendre")}`
    : `🚶 ${L("Flèches / ZQSD : te déplacer")}<br>👀 ${L("Glisse : tourner la tête")}<br>🔔 ${L("Siffle pour arrêter puis parler à un joueur")}`;
}

// incidents (disputes / injuries) that fire now and then and want the ref's attention
let eventEl: HTMLElement | null = null;
let nextEventAt = 0;
function showEvent(msg: string): void {
  if (!eventEl) return;
  eventEl.textContent = msg;
  eventEl.classList.add("show");
  window.setTimeout(() => eventEl?.classList.remove("show"), 5000);
}
function maybeEvent(): void {
  if (nextEventAt === 0) { nextEventAt = Date.now() + 20000 + Math.random() * 20000; return; } // 20-40s
  if (Date.now() < nextEventAt || stopped || dlgOpen) return;
  nextEventAt = Date.now() + 20000 + Math.random() * 20000;
  if (Math.random() < 0.55) {
    showEvent("😠 " + L("Dispute entre joueurs — siffle et va leur parler !"));
    disputeMode = true; // the players will now deny starting it when you talk to them
  } else {
    // Put a REAL player on the ground, then make the referee walk over to him:
    // the decision box only opens once you are actually next to the poor guy.
    let who = "";
    try { who = M()?.ccall?.("gpf_ref_injure", "string", ["number"], [Math.random() < 0.5 ? 0 : 1]) || ""; }
    catch { /* bridge missing */ }
    if (!who) return;              // couldn't injure anyone — skip this event
    injuredName = who;
    showEvent("🏥 " + who + " — " + L("va voir le joueur à terre !"));
    whistle(); stopped = true; refreshHint();     // play stops for the injury
  }
}
function sendDialogue(): void {
  const v = (dlgInput?.value || "").trim();
  if (!v) return;
  dlgLine("ref", v); dlgHistory.push({ role: "ref", text: v });
  if (dlgInput) dlgInput.value = "";
  // physical obedience: turn keywords into a real move order (he walks, then stops)
  const lt = v.toLowerCase();
  let order = 0;
  if (/recule|écarte|dégage|éloigne|recul|pousse-toi|va-t'?en/.test(lt)) order = 1;
  else if (/avance|approche|viens|rapproche|reviens/.test(lt)) order = 2;
  if (order) {
    M()?._gpf_ref_talk_order?.(order);
    window.setTimeout(() => M()?._gpf_ref_talk_order?.(0), 2600); // walk ~2.6s then stand
  }
  // typing indicator while we wait for the AI
  const typing = document.createElement("div");
  typing.className = "dl pl typing"; typing.textContent = "…";
  dlgLog?.appendChild(typing); if (dlgLog) dlgLog.scrollTop = dlgLog.scrollHeight;
  void aiReply(v).then((ai) => {
    typing.remove();
    const line = ai || playerReply(v); // real AI, else built-in emotional reply
    dlgLine("pl", line); dlgHistory.push({ role: "pl", text: line });
    voice(line); // spoken out loud in the radio voice
  });
}

const refModeOn = (): boolean => localStorage.getItem("gpf-referee-active") === "1";

// true while the pre-match anthem ceremony banner is on screen — the ref bar must
// stay hidden then so it doesn't cover the "Passer" button and the line-up cards.
function anthemOnScreen(): boolean {
  const a = document.getElementById("gpf-anthem");
  return !!a && getComputedStyle(a).opacity !== "0";
}

// show a big card sliding up from the bottom, as if held up in the ref's hand
function showCardInHand(red: boolean): void {
  if (!handEl) return;
  handEl.style.background = red ? "#e0322b" : "#f4c534";
  handEl.style.boxShadow = `0 0 34px ${red ? "#ff5b52" : "#ffe06b"}`;
  handEl.classList.remove("show");
  void handEl.offsetWidth; // restart the animation
  handEl.classList.add("show");
  window.setTimeout(() => handEl && handEl.classList.remove("show"), 2600);
}

let pendingCard = 0; // 1=yellow / 3=red, waiting for you to tap WHO gets it

// Actually deliver the card. The native gpf_ref_card cards gpf_talkPlayer (the
// player you tapped/selected), so this always goes to the chosen player. The
// commentator announces it (through the stoppage) with the player's name.
function doCard(color: number, name?: string): void {
  M()?._gpf_ref_card?.(-1, color);
  showCardInHand(color >= 3);
  radio(color >= 3 ? "red" : "yellow", name ? { player: name } : {});
}

// You must CHOOSE who gets the card. If you're already talking to a player he's
// selected → card him now. Otherwise freeze the game and arm "tap the player":
// the next tap on a player books him (handled in onUp).
function card(color: number): void {
  if (dlgOpen) { doCard(color, dlgCurrentName); return; }        // the player you're talking to
  pendingCard = color;
  if (!stopped) { M()?._gpf_ref_whistle?.(); stopped = true; refreshHint(); }
  showEvent((color >= 3 ? "🟥 " : "🟨 ") + L("Appuie sur le joueur à sanctionner"));
}
function setpiece(type: number, team: number): void {
  M()?._gpf_ref_setpiece?.(type, team);
  // announce your decision in the commentator's voice (through the stoppage)
  if (type === 6) radio("penalty", { team });          // penalty
  else if (type === 3) radioSay(L("Coup franc !"));     // free kick (no dedicated event)
}
function whistle(): void { M()?._gpf_ref_whistle?.(); }
function varReview(): void { M()?._gpf_replay?.(5000); }

function openInjury(): void { if (injuryBox) injuryBox.style.display = "flex"; }
function closeInjury(): void { if (injuryBox) injuryBox.style.display = "none"; }
function injuryDecide(sendOff: boolean, team: number): void {
  void team;
  try { M()?._gpf_ref_injury_resolve?.(sendOff ? 1 : 0); } catch { /* */ }
  injuredName = "";
  injuryBoxOpen = false;
  closeInjury();
}


function setVisible(v: boolean): void {
  if (v === visible) return;
  visible = v;
  if (bar) bar.style.display = v ? "flex" : "none";
  if (armsEl) armsEl.style.display = v ? "block" : "none";
  if (moveHint) moveHint.style.display = v ? "block" : "none";
  if (v) { camYaw = 0; camPitch = 0.47 * PI; dragging = false; stopped = false; nextEventAt = 0; refreshHint(); } // fresh view
  if (!v) {
    closeInjury(); closeDialogue(); handEl?.classList.remove("show");
    pressed.clear(); lastX = lastY = 0; M()?._gpf_ref_walk?.(0, 0); // stop walking
  }
}

const CSS = `
#gpf-ref { position:fixed; left:50%; transform:translateX(-50%); top:12px; z-index:2147483300;
  display:none; gap:8px; flex-wrap:wrap; justify-content:center; align-items:center; max-width:96vw;
  padding:8px 10px; background:rgba(8,12,18,.82); border:1px solid rgba(255,255,255,.12); border-radius:14px;
  font-family:"Segoe UI",Arial,sans-serif; pointer-events:auto; box-shadow:0 6px 22px rgba(0,0,0,.5); }
/* first-person arms: two forearms rising from the bottom corners, so the human
   "sees just their arms" over the 3D pitch (SVG, anchored to the bottom band). */
#gpf-ref-arms { position:fixed; left:0; right:0; bottom:0; height:44vh; z-index:2147483280;
  display:none; pointer-events:none; overflow:hidden; }
/* two forearms rising from the bottom corners, framing the first-person view. */
#gpf-ref-arms .fa { position:absolute; bottom:-3vh; width:42vw; max-width:520px; height:auto;
  transform-origin:center bottom; filter:drop-shadow(0 6px 14px rgba(0,0,0,.55)); }
#gpf-ref-arms .fa.l { left:-2vw; transform:rotate(-9deg); }
#gpf-ref-arms .fa.r { right:-2vw; transform:scaleX(-1) rotate(-9deg); }
#gpf-ref-move { position:fixed; left:12px; bottom:12px; z-index:2147483300; display:none; pointer-events:none;
  font:700 12px/1.5 "Segoe UI",Arial,sans-serif; color:#dfe9e2; background:rgba(8,12,18,.7); padding:7px 10px;
  border-radius:9px; border:1px solid rgba(255,255,255,.12); }
/* incident banner (disputes / injuries that need the ref's attention) */
#gpf-ref-event { position:fixed; left:50%; top:78px; transform:translateX(-50%) translateY(-16px); z-index:2147483330;
  pointer-events:none; opacity:0; transition:opacity .25s, transform .25s; max-width:92vw; text-align:center;
  font:800 15px/1.35 "Segoe UI",Arial,sans-serif; color:#fff; background:linear-gradient(#c0392b,#8e2a20);
  padding:10px 16px; border-radius:12px; box-shadow:0 6px 20px rgba(0,0,0,.5); }
#gpf-ref-event.show { opacity:1; transform:translateX(-50%) translateY(0); }
/* talk-to-a-player speech bubble */
#gpf-ref-dlg { position:fixed; left:50%; top:15%; transform:translateX(-50%); z-index:2147483360; display:none;
  pointer-events:auto; font-family:"Segoe UI",Arial,sans-serif; }
#gpf-ref-dlg .dc { width:min(430px,92vw); background:#f6f8fb; color:#12161c; border-radius:16px; padding:10px 12px;
  box-shadow:0 12px 40px rgba(0,0,0,.55); position:relative; }
#gpf-ref-dlg .dc::after { content:""; position:absolute; bottom:-15px; left:50%; transform:translateX(-50%);
  border:9px solid transparent; border-top-color:#f6f8fb; border-bottom:0; }
#gpf-ref-dlg .dh { display:flex; justify-content:space-between; align-items:center; }
#gpf-ref-dlg .dn { font-weight:900; font-size:15px; }
#gpf-ref-dlg .dx { cursor:pointer; font-size:20px; color:#68727d; line-height:1; }
#gpf-ref-dlg .dlog { max-height:34vh; overflow:auto; margin:8px 0; display:flex; flex-direction:column; gap:6px; }
#gpf-ref-dlg .dl { padding:6px 10px; border-radius:12px; font-size:13.5px; max-width:86%; line-height:1.35; }
#gpf-ref-dlg .dl.pl { background:#e6ebf1; align-self:flex-start; border-bottom-left-radius:4px; }
#gpf-ref-dlg .dl.ref { background:#1e6fff; color:#fff; align-self:flex-end; border-bottom-right-radius:4px; }
#gpf-ref-dlg .drow { display:flex; gap:6px; }
#gpf-ref-dlg .din { flex:1; min-width:0; border:1px solid #c7d0da; border-radius:9px; padding:9px; font-size:14px; color:#12161c; background:#fff; }
#gpf-ref-dlg .dsend { background:#1e6fff; color:#fff; border:none; border-radius:9px; padding:9px 13px; font-weight:800; cursor:pointer; }
#gpf-ref .rb { border:none; border-radius:10px; padding:9px 12px; font-weight:800; font-size:13px; cursor:pointer;
  color:#fff; background:#28405e; white-space:nowrap; }
#gpf-ref .rb:active { transform:scale(.94); }
#gpf-ref .rb.wh { background:#3b3f46; }
#gpf-ref .rb.y { background:#e7c02f; color:#241f00; }
#gpf-ref .rb.r { background:#dd352d; }
#gpf-ref .rb.pen { background:#1e7a3c; }
#gpf-ref .rb.fk { background:#2b6fb0; }
#gpf-ref .rb.var { background:#6a3bb0; }
#gpf-ref .rb.inj { background:#b06a1e; }
#gpf-ref .sep { width:1px; align-self:stretch; background:rgba(255,255,255,.14); margin:2px 2px; }
#gpf-ref-hand { position:fixed; left:50%; bottom:74px; transform:translateX(-50%) translateY(60px) rotate(-6deg);
  width:78px; height:112px; border-radius:8px; z-index:2147483320; opacity:0; pointer-events:none;
  transition:transform .28s cubic-bezier(.2,1.3,.4,1), opacity .2s; }
#gpf-ref-hand.show { opacity:1; transform:translateX(-50%) translateY(0) rotate(-6deg); }
#gpf-ref-inj { position:fixed; inset:0; z-index:2147483340; display:none; align-items:center; justify-content:center;
  background:rgba(3,5,8,.66); pointer-events:auto; font-family:"Segoe UI",Arial,sans-serif; }
#gpf-ref-inj .ic { background:#0e141c; color:#eaf1f6; border:1px solid rgba(255,255,255,.12); border-radius:14px;
  padding:18px; width:min(420px,92vw); text-align:center; box-shadow:0 10px 40px rgba(0,0,0,.6); }
#gpf-ref-inj h4 { margin:0 0 10px; font-size:17px; }
#gpf-ref-inj p { margin:0 0 14px; font-size:13px; color:#b9c6d1; }
#gpf-ref-inj .row { display:flex; gap:8px; flex-wrap:wrap; justify-content:center; }
#gpf-ref-inj button { border:none; border-radius:9px; padding:10px 12px; font-weight:800; cursor:pointer; color:#fff; }
#gpf-ref-inj .heal { background:#1e7a3c; }
#gpf-ref-inj .off0 { background:#b06a1e; }
#gpf-ref-inj .off1 { background:#8a4b12; }
`;

export function initRefmode(): void {
  const style = document.createElement("style");
  style.id = "gpf-ref-style"; style.textContent = CSS;
  document.head.appendChild(style);

  bar = document.createElement("div");
  bar.id = "gpf-ref";
  bar.innerHTML =
    `<button class="rb wh" data-a="wh">🔔 ${L("Sifflet")}</button>` +
    `<button class="rb y" data-a="y">🟨 ${L("Jaune")}</button>` +
    `<button class="rb r" data-a="r">🟥 ${L("Rouge")}</button>` +
    `<div class="sep"></div>` +
    `<button class="rb pen" data-a="pen0">⚽ ${L("Penalty")} ◀</button>` +
    `<button class="rb pen" data-a="pen1">⚽ ${L("Penalty")} ▶</button>` +
    `<button class="rb fk" data-a="fk0">🆓 ${L("Coup franc")} ◀</button>` +
    `<button class="rb fk" data-a="fk1">🆓 ${L("Coup franc")} ▶</button>` +
    `<div class="sep"></div>` +
    `<button class="rb var" data-a="var">📺 ${L("VAR")}</button>` +
    `<button class="rb inj" data-a="inj">🏥 ${L("Blessure")}</button>`;
  document.body.appendChild(bar);

  handEl = document.createElement("div");
  handEl.id = "gpf-ref-hand";
  document.body.appendChild(handEl);

  injuryBox = document.createElement("div");
  injuryBox.id = "gpf-ref-inj";
  injuryBox.innerHTML =
    `<div class="ic"><h4>🏥 ${L("Joueur à terre")}</h4>` +
    `<p>${L("Décide : le laisser jouer, ou le faire sortir (blessé).")}</p>` +
    `<div class="row">` +
    `<button class="heal" data-i="heal">${L("Le soigner (il reste)")}</button>` +
    `<button class="off0" data-i="off0">${L("Faire sortir ◀")}</button>` +
    `<button class="off1" data-i="off1">${L("Faire sortir ▶")}</button>` +
    `</div></div>`;
  document.body.appendChild(injuryBox);

  armsEl = document.createElement("div");
  armsEl.id = "gpf-ref-arms";
  armsEl.innerHTML = ARMS_HTML;
  document.body.appendChild(armsEl);

  moveHint = document.createElement("div");
  moveHint.id = "gpf-ref-move";
  document.body.appendChild(moveHint);
  refreshHint();

  eventEl = document.createElement("div");
  eventEl.id = "gpf-ref-event";
  document.body.appendChild(eventEl);

  // "talk to a player" speech bubble
  dlgEl = document.createElement("div");
  dlgEl.id = "gpf-ref-dlg";
  dlgEl.innerHTML =
    `<div class="dc"><div class="dh"><span class="dn">💬</span><span class="dx">×</span></div>` +
    `<div class="dlog"></div>` +
    `<div class="drow"><input class="din" placeholder="${L("Écris à ce joueur…")}" autocomplete="off" spellcheck="false"><button class="dsend">${L("Envoyer")}</button></div></div>`;
  document.body.appendChild(dlgEl);
  dlgName = dlgEl.querySelector(".dn");
  dlgLog = dlgEl.querySelector(".dlog");
  dlgInput = dlgEl.querySelector(".din");
  dlgEl.querySelector(".dx")?.addEventListener("click", closeDialogue);
  dlgEl.querySelector(".dsend")?.addEventListener("click", () => { sendDialogue(); dlgInput?.focus(); });
  // the game (SDL) blocks default key insertion, so rebuild the field manually on
  // desktop; the soft-keyboard `input` path covers tablets.
  dlgInput?.addEventListener("keydown", (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") { sendDialogue(); e.preventDefault(); }
    else if (e.key === "Backspace") { dlgInput!.value = dlgInput!.value.slice(0, -1); e.preventDefault(); }
    else if (e.key.length === 1) { dlgInput!.value += e.key; e.preventDefault(); }
  });
  dlgInput?.addEventListener("keyup", (e) => e.stopPropagation());

  // keyboard walking (only while the ref bar is visible = match live in ref mode)
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (!visible || dlgOpen) return; // don't walk while typing to a player
    const dir = KEYMAP[e.key] || KEYMAP[e.key.toLowerCase()];
    if (!dir) return;
    pressed.add(dir); pumpWalk(); e.preventDefault();
  });
  window.addEventListener("keyup", (e: KeyboardEvent) => {
    const dir = KEYMAP[e.key] || KEYMAP[e.key.toLowerCase()];
    if (!dir) return;
    pressed.delete(dir); pumpWalk();
  });

  // On the pitch: a DRAG turns the head; a quick TAP while play is stopped talks to
  // the nearest player. Drags/taps on the bar, injury box or dialogue are ignored.
  const onDown = (x: number, y: number, t: EventTarget | null): void => {
    if (!visible) return;
    if (t instanceof HTMLElement && t.closest("#gpf-ref, #gpf-ref-inj, #gpf-ref-dlg")) return;
    dragging = true; dragX = x; dragY = y; downX = x; downY = y; moved = false;
  };
  const onMove = (x: number, y: number): void => {
    if (!dragging) return;
    if (Math.abs(x - downX) + Math.abs(y - downY) > 8) moved = true;
    camYaw += (x - dragX) * LOOK_SENS;                              // drag right -> look right
    camPitch = Math.max(0.36 * PI, Math.min(0.58 * PI, camPitch - (y - dragY) * LOOK_SENS)); // drag up -> look up
    dragX = x; dragY = y;
    if (moved) pushLook();
  };
  const onUp = (): void => {
    // talk to a player only after a WHISTLE (game stopped), on a TAP (not a drag),
    // and only if the tap actually landed ON a player.
    if (dragging && !moved && !dlgOpen && stopped) {
      const cv = document.getElementById("canvas");
      const r = cv ? cv.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
      const nx = (downX - r.left) / r.width;
      const ny = (downY - r.top) / r.height;
      let name = "";
      try { name = M()?.ccall?.("gpf_ref_pick_player", "string", ["number", "number"], [nx, ny]) || ""; } catch { /* no bridge */ }
      if (name && pendingCard) {
        doCard(pendingCard, name);         // the tapped player is now selected → book HIM
        showEvent((pendingCard >= 3 ? "🟥 " : "🟨 ") + name);
        pendingCard = 0;
      } else if (name) {
        openDialogue(name); // the tapped player is now selected (faces you), open his bubble
      }
    }
    dragging = false;
  };
  // capture phase so these fire BEFORE the game canvas' own mouse handlers (SDL),
  // otherwise the drag-to-look events could be swallowed by the canvas.
  window.addEventListener("mousedown", (e) => onDown(e.clientX, e.clientY, e.target), true);
  window.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY), true);
  window.addEventListener("mouseup", onUp, true);
  window.addEventListener("touchstart", (e) => { const t = e.touches[0]; if (t) onDown(t.clientX, t.clientY, e.target); }, { capture: true, passive: true });
  window.addEventListener("touchmove", (e) => { const t = e.touches[0]; if (t) onMove(t.clientX, t.clientY); }, { capture: true, passive: true });
  window.addEventListener("touchend", onUp, true);

  bar.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement)?.dataset?.a;
    if (!a) return;
    if (a === "wh") { whistle(); stopped = !stopped; if (!stopped) disputeMode = false; refreshHint(); }
    else if (a === "y") card(1);
    else if (a === "r") card(3);
    else if (a === "pen0") setpiece(6, 0);
    else if (a === "pen1") setpiece(6, 1);
    else if (a === "fk0") setpiece(3, 0);
    else if (a === "fk1") setpiece(3, 1);
    else if (a === "var") varReview();
    else if (a === "inj") openInjury();
  });
  injuryBox.addEventListener("click", (e) => {
    const i = (e.target as HTMLElement)?.dataset?.i;
    if (!i) return;
    if (i === "heal") injuryDecide(false, 0);
    else if (i === "off0") injuryDecide(true, 0);
    else if (i === "off1") injuryDecide(true, 1);
  });

  // Self-managed visibility: show the bar only while a match is actually running
  // AND referee mode is enabled. Polling keeps this decoupled from the menu flow.
  window.setInterval(() => {
    const f = M()?._gpf_sim_frame?.() ?? -1;
    setVisible(refModeOn() && f >= 0 && !anthemOnScreen());
    if (visible) maybeEvent();
    // waiting on the referee's whistle? tell him plainly
    try {
      const wait = (M()?._gpf_ref_awaiting_whistle?.() ?? 0) === 1;
      showWhistlePrompt(visible && wait);
      if (visible) pollInjury();
    } catch { /* bridge not up yet */ }
  }, 500);
}
