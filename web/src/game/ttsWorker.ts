/**
 * TTS worker: Piper synthesis runs here so the multi-second WASM inference
 * never blocks the game's render loop.
 */
import { PATH_MAP, TtsSession } from "@mintplex-labs/piper-tts-web";

// The lib gates voices on a hard-coded PATH_MAP; the hi/id voices only exist
// upstream. Register their paths — the fetch rewrite below points them at the
// rhasspy repo (same layout, same CORS), and cache keys stay distinct.
(PATH_MAP as Record<string, string>)["hi_IN-pratham-medium"] =
  "hi/hi_IN/pratham/medium/hi_IN-pratham-medium.onnx";
(PATH_MAP as Record<string, string>)["id_ID-news_tts-medium"] =
  "id/id_ID/news_tts/medium/id_ID-news_tts-medium.onnx";

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

let session: TtsSession | null = null;

ctx.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type === "init") {
    try {
      session = await TtsSession.create({
        voiceId: msg.voiceId as never,
        wasmPaths: msg.wasmPaths,
      });
      ctx.postMessage({ type: "ready" });
    } catch (err) {
      ctx.postMessage({ type: "error", error: String(err) });
    }
    return;
  }
  if (msg.type === "say") {
    if (!session) {
      ctx.postMessage({ type: "sayError", id: msg.id });
      return;
    }
    try {
      const wav = await session.predict(msg.text);
      const buf = await wav.arrayBuffer();
      ctx.postMessage({ type: "wav", id: msg.id, buf }, [buf]);
    } catch (err) {
      ctx.postMessage({ type: "sayError", id: msg.id, error: String(err) });
    }
  }
};
