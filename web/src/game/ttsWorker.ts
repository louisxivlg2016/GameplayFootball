/**
 * TTS worker: Piper synthesis runs here so the multi-second WASM inference
 * never blocks the game's render loop.
 *
 * Two engines:
 * - Piper (@mintplex-labs/piper-tts-web) for the languages it covers;
 * - a small MMS-VITS runner (onnxruntime-web) for Thai and Korean, which
 *   Piper has no models for. Voice ids "mms-tha"/"mms-kor" pick it.
 */
import { PATH_MAP, TtsSession } from "@mintplex-labs/piper-tts-web";
import * as ort from "onnxruntime-web";

// The lib gates voices on a hard-coded PATH_MAP; the hi/id voices only exist
// upstream. Register their paths — the fetch rewrite below points them at the
// rhasspy repo (same layout, same CORS), and cache keys stay distinct.
(PATH_MAP as Record<string, string>)["hi_IN-pratham-medium"] =
  "hi/hi_IN/pratham/medium/hi_IN-pratham-medium.onnx";
(PATH_MAP as Record<string, string>)["id_ID-news_tts-medium"] =
  "id/id_ID/news_tts/medium/id_ID-news_tts-medium.onnx";

// Force onnxruntime to a SINGLE thread for the Piper session. On some desktops
// the multi-threaded init (SharedArrayBuffer + a nested worker under
// crossOriginIsolated) hangs forever — TtsSession.create() then never resolves
// and the radio is stuck on "loading" for the whole match (the "works on the
// tablet, silent on the computer" bug). Piper shares this onnxruntime-web module
// singleton, so setting it here applies to it too. Single-thread synthesis of a
// short sentence is still only a couple of seconds — slow beats silent. (The MMS
// engine re-raises this in initMms where it genuinely needs the threads.)
ort.env.wasm.numThreads = 1;

interface InitMsg {
  type: "init";
  voiceId: string;
  wasmPaths: { onnxWasm: string; piperData: string; piperWasm: string };
}
interface SayMsg {
  type: "say";
  id: number;
  text: string;
}

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<InitMsg | SayMsg>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: string, cb: (e: Event & { preventDefault?: () => void; message?: string }) => void): void;
};

// the TTS engine spawns internal sub-workers whose async failures would
// otherwise bubble up as uncaught page errors — swallow them, a dropped
// line is invisible while an error overlay is not
ctx.addEventListener("error", (e) => {
  e.preventDefault?.();
  console.info("[tts-worker] swallowed:", e.message ?? "error");
});
ctx.addEventListener("unhandledrejection", (e) => {
  e.preventDefault?.();
  console.info("[tts-worker] swallowed rejection");
});

// The diffusionstudio mirror lacks the hi/id voices; they live on the
// upstream rhasspy repo. Rewrite just those fetches — same layout, same CORS.
const origFetch = self.fetch.bind(self);
(self as unknown as { fetch: typeof fetch }).fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (
    url.includes("diffusionstudio/piper-voices/resolve/main/hi/") ||
    url.includes("diffusionstudio/piper-voices/resolve/main/id/") ||
    // the mirror's manifest doesn't KNOW the hi/id voices — use upstream's
    url.includes("diffusionstudio/piper-voices/resolve/main/voices.json")
  ) {
    const upstream = url.replace("diffusionstudio/piper-voices", "rhasspy/piper-voices");
    // some upstream voice configs (id_ID) ship no speaker_id_map — the lib
    // Object.keys() it unconditionally, so default it to {} on the way in
    if (upstream.endsWith(".onnx.json")) {
      return origFetch(upstream, init).then(async (res) => {
        const cfg = (await res.json()) as Record<string, unknown>;
        cfg.speaker_id_map ??= {};
        return new Response(JSON.stringify(cfg), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      });
    }
    return origFetch(upstream, init);
  }
  return origFetch(input as RequestInfo, init);
}) as typeof fetch;

// ---------------------------------------------------------------------------
// MMS-VITS engine (Thai, Korean)
// ---------------------------------------------------------------------------

interface MmsSpec {
  model: string;
  /** "json" = HF vocab.json (char→id); "tokens" = sherpa tokens.txt lines */
  vocab: { kind: "json" | "tokens"; url: string };
  /** romanize Hangul first (the kor model is trained on uroman text) */
  hangul?: boolean;
  /** digits → words in this language before tokenizing */
  digits: (n: number) => string;
  sampleRate: number;
}

const THAI_DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
function thaiNumber(n: number): string {
  if (n < 10) return THAI_DIGITS[n]!;
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const unit = n % 10;
    const tensWord = tens === 1 ? "สิบ" : tens === 2 ? "ยี่สิบ" : `${THAI_DIGITS[tens]}สิบ`;
    const unitWord = unit === 0 ? "" : unit === 1 ? "เอ็ด" : THAI_DIGITS[unit]!;
    return tensWord + unitWord;
  }
  return String(n)
    .split("")
    .map((d) => THAI_DIGITS[+d]!)
    .join(" ");
}

// sino-Korean numbers, romanized like uroman would (il, i, sam...)
const KO_DIGITS = ["yeong", "il", "i", "sam", "sa", "o", "yuk", "chil", "pal", "gu"];
function koreanNumber(n: number): string {
  if (n < 10) return KO_DIGITS[n]!;
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const unit = n % 10;
    return `${tens > 1 ? KO_DIGITS[tens] : ""}sip${unit ? KO_DIGITS[unit] : ""}`;
  }
  return String(n)
    .split("")
    .map((d) => KO_DIGITS[+d]!)
    .join(" ");
}

const MMS_MODELS: Record<string, MmsSpec> = {
  "mms-kor": {
    model: "https://huggingface.co/Xenova/mms-tts-kor/resolve/main/onnx/model_quantized.onnx",
    vocab: { kind: "json", url: "https://huggingface.co/Xenova/mms-tts-kor/resolve/main/vocab.json" },
    hangul: true,
    digits: koreanNumber,
    sampleRate: 16000,
  },
  "mms-tha": {
    model:
      "https://huggingface.co/willwade/mms-tts-multilingual-models-onnx/resolve/main/tha/model.onnx",
    vocab: {
      kind: "tokens",
      url: "https://huggingface.co/willwade/mms-tts-multilingual-models-onnx/resolve/main/tha/tokens.txt",
    },
    digits: thaiNumber,
    sampleRate: 16000,
  },
};

// Revised-Romanization tables — close enough to uroman for the kor model
const RR_INITIAL = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const RR_MEDIAL = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
const RR_FINAL = ["", "g", "kk", "gs", "n", "nj", "nh", "d", "l", "lg", "lm", "lb", "ls", "lt", "lp", "lh", "m", "b", "bs", "s", "ss", "ng", "j", "ch", "k", "t", "p", "h"];

function romanizeHangul(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code >= 0xac00 && code <= 0xd7a3) {
      const idx = code - 0xac00;
      out +=
        RR_INITIAL[Math.floor(idx / 588)]! +
        RR_MEDIAL[Math.floor((idx % 588) / 28)]! +
        RR_FINAL[idx % 28]!;
    } else {
      out += ch;
    }
  }
  return out;
}

/** OPFS cache: huge onnx models download once, then load instantly. */
async function cachedArrayBuffer(name: string, url: string): Promise<ArrayBuffer> {
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle("mms", { create: true });
    try {
      const fh = await dir.getFileHandle(name);
      const f = await fh.getFile();
      if (f.size > 0) return await f.arrayBuffer();
    } catch {
      /* not cached yet */
    }
    const buf = await (await origFetch(url)).arrayBuffer();
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(buf);
    await w.close();
    return buf;
  } catch {
    return await (await origFetch(url)).arrayBuffer();
  }
}

interface MmsEngine {
  session: ort.InferenceSession;
  vocab: Map<string, number>;
  spec: MmsSpec;
}
let mms: MmsEngine | null = null;

async function initMms(voiceId: string, wasmPaths: InitMsg["wasmPaths"]): Promise<void> {
  const spec = MMS_MODELS[voiceId]!;
  ort.env.wasm.wasmPaths = wasmPaths.onnxWasm;
  // threads need crossOriginIsolated (COOP/COEP, set in vercel.json) — a VITS
  // sentence drops from ~12s to ~3-4s with 4 threads; 1 thread otherwise
  ort.env.wasm.numThreads = (self as unknown as { crossOriginIsolated?: boolean })
    .crossOriginIsolated
    ? Math.min(4, navigator.hardwareConcurrency || 2)
    : 1;
  const [modelBuf, vocabText] = await Promise.all([
    cachedArrayBuffer(`${voiceId}.onnx`, spec.model),
    (await origFetch(spec.vocab.url)).text(),
  ]);
  const vocab = new Map<string, number>();
  if (spec.vocab.kind === "json") {
    for (const [k, v] of Object.entries(JSON.parse(vocabText) as Record<string, number>)) {
      vocab.set(k, v);
    }
  } else {
    for (const line of vocabText.split("\n")) {
      if (!line) continue;
      const sp = line.lastIndexOf(" ");
      const tok = line.slice(0, sp);
      vocab.set(tok === "" ? " " : tok, parseInt(line.slice(sp + 1), 10));
    }
  }
  const session = await ort.InferenceSession.create(modelBuf, {
    executionProviders: ["wasm"],
  });
  mms = { session, vocab, spec };
}

function mmsTokenize(engine: MmsEngine, raw: string): BigInt64Array {
  let text = raw.replace(/\d+/g, (m) => ` ${engine.spec.digits(parseInt(m, 10))} `);
  if (engine.spec.hangul) text = romanizeHangul(text).toLowerCase();
  // VitsTokenizer: keep known chars, interleave the blank (id 0) around each
  const ids: number[] = [0];
  for (const ch of text) {
    const id = engine.vocab.get(ch);
    if (id === undefined) continue;
    ids.push(id, 0);
  }
  return BigInt64Array.from(ids.map(BigInt));
}

// A raw <audio> element caps at volume 1.0 and (unlike a WebAudio graph) can't
// be pushed past it — and routing the element through WebAudio for a gain stage
// proved fragile (it silenced the radio outright on some setups). So the ONE
// safe place to make the commentator LOUDER is right here, in the samples: lift
// the PCM before it ever leaves the worker. Piper masters some voices quietly
// (French "tom" especially), which is why the radio sounded too soft. A tanh
// curve limits the peaks so the extra level never crunches into distortion.
const PIPER_BOOST = 1.85; // Piper voices → broadcast loudness
const MMS_BOOST = 2.2; // th/ko VITS voices are quieter still

/** Amplify a 16-bit PCM WAV in place, tanh-limited. Leaves non-PCM/other bit
 *  depths untouched (safe no-op) so an unexpected container is never corrupted. */
function boostWavLoudness(buf: ArrayBuffer, gain: number): ArrayBuffer {
  const dv = new DataView(buf);
  if (dv.byteLength < 44 || dv.getUint32(0, false) !== 0x52494646 /* "RIFF" */) return buf;
  let off = 12;
  let fmtOk = false;
  let dataOff = -1;
  let dataEnd = 0;
  while (off + 8 <= dv.byteLength) {
    const id = dv.getUint32(off, false);
    const sz = dv.getUint32(off + 4, true);
    const body = off + 8;
    if (id === 0x666d7420 /* "fmt " */) {
      const audioFormat = dv.getUint16(body, true);
      const bits = dv.getUint16(body + 14, true);
      fmtOk = audioFormat === 1 && bits === 16; // PCM 16-bit only
    } else if (id === 0x64617461 /* "data" */) {
      dataOff = body;
      dataEnd = Math.min(body + sz, dv.byteLength);
      break;
    }
    off = body + sz + (sz & 1);
  }
  if (!fmtOk || dataOff < 0) return buf;
  for (let i = dataOff; i + 1 < dataEnd; i += 2) {
    const s = dv.getInt16(i, true) / 32768;
    dv.setInt16(i, Math.round(Math.tanh(s * gain) * 32767), true);
  }
  return buf;
}

function pcmToWav(pcm: Float32Array, sampleRate: number): ArrayBuffer {
  const out = new ArrayBuffer(44 + pcm.length * 2);
  const dv = new DataView(out);
  const s = (o: number, t: string): void => {
    for (let i = 0; i < t.length; i++) dv.setUint8(o + i, t.charCodeAt(i));
  };
  s(0, "RIFF");
  dv.setUint32(4, 36 + pcm.length * 2, true);
  s(8, "WAVEfmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  s(36, "data");
  dv.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const v = Math.max(-1, Math.min(1, pcm[i]!));
    dv.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return out;
}

async function mmsPredict(engine: MmsEngine, text: string): Promise<ArrayBuffer> {
  const ids = mmsTokenize(engine, text);
  const names = engine.session.inputNames;
  const feeds: Record<string, ort.Tensor> = {};
  if (names.includes("input_ids")) {
    // transformers.js-style export (Xenova)
    feeds.input_ids = new ort.Tensor("int64", ids, [1, ids.length]);
    if (names.includes("attention_mask")) {
      feeds.attention_mask = new ort.Tensor(
        "int64",
        BigInt64Array.from(ids, () => 1n),
        [1, ids.length],
      );
    }
  } else {
    // sherpa-style export: x / x_length (+ optional scales)
    feeds.x = new ort.Tensor("int64", ids, [1, ids.length]);
    if (names.includes("x_length")) {
      feeds.x_length = new ort.Tensor("int64", BigInt64Array.from([BigInt(ids.length)]), [1]);
    }
    if (names.includes("noise_scale")) feeds.noise_scale = new ort.Tensor("float32", [0.667], [1]);
    if (names.includes("length_scale")) feeds.length_scale = new ort.Tensor("float32", [1.0], [1]);
    if (names.includes("noise_scale_w")) feeds.noise_scale_w = new ort.Tensor("float32", [0.8], [1]);
    if (names.includes("noise_w")) feeds.noise_w = new ort.Tensor("float32", [0.8], [1]);
    if (names.includes("sid")) feeds.sid = new ort.Tensor("int64", BigInt64Array.from([0n]), [1]);
  }
  const result = await engine.session.run(feeds);
  const first = result[engine.session.outputNames[0]!]!;
  return pcmToWav(first.data as Float32Array, engine.spec.sampleRate);
}

// ---------------------------------------------------------------------------

let session: TtsSession | null = null;
let activeEngine: "piper" | "mms" = "piper";

ctx.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type === "init") {
    try {
      if (MMS_MODELS[msg.voiceId]) {
        activeEngine = "mms";
        await initMms(msg.voiceId, msg.wasmPaths);
      } else {
        activeEngine = "piper";
        session = await TtsSession.create({
          voiceId: msg.voiceId as never,
          wasmPaths: msg.wasmPaths,
        });
      }
      ctx.postMessage({ type: "ready" });
    } catch (err) {
      ctx.postMessage({ type: "error", error: String(err) });
    }
    return;
  }
  if (msg.type === "say") {
    try {
      if (activeEngine === "mms") {
        if (!mms) throw new Error("mms not ready");
        const buf = boostWavLoudness(await mmsPredict(mms, msg.text), MMS_BOOST);
        ctx.postMessage({ type: "wav", id: msg.id, buf }, [buf]);
        return;
      }
      if (!session) {
        ctx.postMessage({ type: "sayError", id: msg.id });
        return;
      }
      const wav = await session.predict(msg.text);
      const buf = boostWavLoudness(await wav.arrayBuffer(), PIPER_BOOST);
      ctx.postMessage({ type: "wav", id: msg.id, buf }, [buf]);
    } catch (err) {
      ctx.postMessage({ type: "sayError", id: msg.id, error: String(err) });
    }
  }
};
