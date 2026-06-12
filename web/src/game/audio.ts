/** Synthesized stadium audio: crowd bed, kick thumps, referee whistle, goal roar. */

let ctx: AudioContext | null = null;
let crowdGain: GainNode | null = null;

export function initAudio(): void {
  if (ctx) return;
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
  crowdGain = ctx.createGain();
  crowdGain.gain.value = 0.05;
  src.connect(filter).connect(crowdGain).connect(ctx.destination);
  src.start();
}

export function kickSound(power = 1): void {
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.setValueAtTime(110, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);
  gain.gain.setValueAtTime(0.18 * Math.min(power, 1.4), t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.12);
}

/** 1 = short (restart), 2 = double (foul), 3 = long triple (period end). */
export function whistle(blasts: 1 | 2 | 3): void {
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
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    trill.start(t);
    trill.stop(t + dur + 0.02);
  }
}

export function crowdRoar(): void {
  if (!ctx || !crowdGain) return;
  const t = ctx.currentTime;
  crowdGain.gain.cancelScheduledValues(t);
  crowdGain.gain.setValueAtTime(crowdGain.gain.value, t);
  crowdGain.gain.linearRampToValueAtTime(0.35, t + 0.4);
  crowdGain.gain.exponentialRampToValueAtTime(0.05, t + 4);
}
