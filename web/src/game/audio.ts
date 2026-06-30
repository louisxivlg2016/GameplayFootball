/** Synthesized stadium audio: crowd bed, kick thumps, referee whistle, goal roar.
 *
 * The AudioContext and the crowd graph live on globalThis: hot reloads
 * re-evaluate this module, and stacking a fresh AudioContext per reload hits
 * Chrome's 6-context page limit — at which point ALL sound dies until a full
 * page reload. Sharing one global context makes audio immortal across HMR. */

interface SharedAudio {
  ctx: AudioContext;
  crowdGain: GainNode;
  masterGain: GainNode;
  muted: boolean;
}
const AUDIO_MUTED_STORAGE_KEY = "gpf-audio-muted-v1";

function loadMutedPreference(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(AUDIO_MUTED_STORAGE_KEY) === "1";
}

const g = globalThis as {
  __gpfAudio?: SharedAudio | null;
  __gpfAudioMuted?: boolean;
  __gpfAudioDebug?: {
    state: string;
    lastResumeAt: number;
    lastError: string;
  };
};

let ctx: AudioContext | null = g.__gpfAudio?.ctx ?? null;
let crowdGain: GainNode | null = g.__gpfAudio?.crowdGain ?? null;
let masterGain: GainNode | null = g.__gpfAudio?.masterGain ?? null;
let muted = g.__gpfAudio?.muted ?? g.__gpfAudioMuted ?? loadMutedPreference();
g.__gpfAudioMuted = muted;
const audioDebug = (g.__gpfAudioDebug ??= {
  state: ctx?.state ?? "none",
  lastResumeAt: 0,
  lastError: "",
});

function applyMuteState(): void {
  if (!ctx || !masterGain) return;
  const t = ctx.currentTime;
  masterGain.gain.cancelScheduledValues(t);
  masterGain.gain.setValueAtTime(masterGain.gain.value, t);
  masterGain.gain.linearRampToValueAtTime(muted ? 0 : 1, t + 0.04);
}

function ensureMasterGain(): void {
  if (!ctx || masterGain) return;
  masterGain = ctx.createGain();
  masterGain.gain.value = muted ? 0 : 1;
  masterGain.connect(ctx.destination);
  if (crowdGain) {
    try {
      crowdGain.disconnect();
    } catch {
      /* already disconnected */
    }
    crowdGain.connect(masterGain);
  }
}

/** One page-wide AudioContext, shared with the radio. */
export function sharedAudioContext(): AudioContext | null {
  initAudio();
  resumeAudio();
  return ctx;
}

export function sharedAudioOutput(): AudioNode | null {
  initAudio();
  resumeAudio();
  return masterGain;
}

export function audioMuted(): boolean {
  return muted;
}

export function setAudioMuted(next: boolean): void {
  muted = next;
  g.__gpfAudioMuted = next;
  if (g.__gpfAudio) g.__gpfAudio.muted = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(AUDIO_MUTED_STORAGE_KEY, next ? "1" : "0");
  }
  applyMuteState();
}

export function resumeAudio(): void {
  if (!ctx) return;
  audioDebug.state = ctx.state;
  if (ctx.state === "running") return;
  void ctx
    .resume()
    .then(() => {
      audioDebug.state = ctx?.state ?? "none";
      audioDebug.lastResumeAt = Date.now();
    })
    .catch((err: unknown) => {
      audioDebug.lastError = String(err);
    });
}

export function initAudio(): void {
  if (ctx) {
    ensureMasterGain();
    applyMuteState();
    resumeAudio();
    return;
  }
  if (g.__gpfAudio) {
    ctx = g.__gpfAudio.ctx;
    crowdGain = g.__gpfAudio.crowdGain;
    masterGain = g.__gpfAudio.masterGain;
    muted = g.__gpfAudio.muted;
    ensureMasterGain();
    g.__gpfAudio = { ctx, crowdGain: crowdGain!, masterGain: masterGain!, muted };
    applyMuteState();
    resumeAudio();
    return;
  }
  try {
    ctx = new AudioContext();
  } catch {
    return;
  }
  // crowd bed: looped noise through a low band-pass
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = last * 0.97 + (Math.random() * 2 - 1) * 0.03; // brown-ish noise
    data[i] = last * 8;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 420;
  filter.Q.value = 0.4;
  masterGain = ctx.createGain();
  masterGain.gain.value = muted ? 0 : 1;
  masterGain.connect(ctx.destination);
  crowdGain = ctx.createGain();
  crowdGain.gain.value = 0.07; // audible on phone speakers, still under the radio
  src.connect(filter).connect(crowdGain).connect(masterGain);
  src.start();
  g.__gpfAudio = { ctx, crowdGain, masterGain, muted };
  audioDebug.state = ctx.state;
  applyMuteState();
  resumeAudio();
}

export function kickSound(power = 1): void {
  initAudio();
  resumeAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.setValueAtTime(110, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);
  gain.gain.setValueAtTime(0.18 * Math.min(power, 1.4), t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  osc.connect(gain).connect(masterGain ?? ctx.destination);
  osc.start(t);
  osc.stop(t + 0.12);
}

/** 1 = short (restart), 2 = double (foul), 3 = long triple (period end). */
export function whistle(blasts: 1 | 2 | 3): void {
  initAudio();
  resumeAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  for (let i = 0; i < blasts; i++) {
    const t = t0 + i * 0.22;
    const dur = blasts === 3 && i === 2 ? 0.55 : 0.13;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 2150;
    const trill = ctx.createOscillator();
    trill.frequency.value = 33;
    const trillGain = ctx.createGain();
    trillGain.gain.value = 240;
    trill.connect(trillGain).connect(osc.frequency);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.setValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(masterGain ?? ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    trill.start(t);
    trill.stop(t + dur + 0.02);
  }
}

// heartbeat handle is global too — an orphaned interval from a hot-reloaded
// module copy would keep thumping forever
const gHeart = globalThis as { __gpfHeartbeat?: ReturnType<typeof setInterval> | null };
let heartbeatTimer: ReturnType<typeof setInterval> | null =
  gHeart.__gpfHeartbeat ?? null;

function thump(volume = 1): void {
  initAudio();
  resumeAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.setValueAtTime(58, t);
  osc.frequency.exponentialRampToValueAtTime(36, t + 0.12);
  gain.gain.setValueAtTime(0.22 * volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  osc.connect(gain).connect(masterGain ?? ctx.destination);
  osc.start(t);
  osc.stop(t + 0.22);
}

/** Shoot-out tension: the crowd hushes and a heartbeat sets in. */
export function setTension(on: boolean): void {
  initAudio();
  resumeAudio();
  if (ctx && crowdGain) {
    const t = ctx.currentTime;
    crowdGain.gain.cancelScheduledValues(t);
    crowdGain.gain.setValueAtTime(crowdGain.gain.value, t);
    crowdGain.gain.linearRampToValueAtTime(on ? 0.018 : 0.07, t + 0.8);
  }
  if (on && heartbeatTimer === null) {
    const beat = (): void => {
      thump();
      setTimeout(() => thump(0.6), 300);
    };
    beat();
    heartbeatTimer = setInterval(beat, 1150);
    gHeart.__gpfHeartbeat = heartbeatTimer;
  } else if (!on && heartbeatTimer !== null) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    gHeart.__gpfHeartbeat = null;
  }
}

export function crowdRoar(): void {
  initAudio();
  resumeAudio();
  if (!ctx || !crowdGain) return;
  const t = ctx.currentTime;
  crowdGain.gain.cancelScheduledValues(t);
  crowdGain.gain.setValueAtTime(crowdGain.gain.value, t);
  crowdGain.gain.linearRampToValueAtTime(0.35, t + 0.4);
  crowdGain.gain.exponentialRampToValueAtTime(0.09, t + 4);
}
