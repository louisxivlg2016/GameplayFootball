/**
 * TTS worker: Piper synthesis runs here so the multi-second WASM inference
 * never blocks the game's render loop.
 */
import { TtsSession } from "@mintplex-labs/piper-tts-web";

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
};

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
    } catch {
      ctx.postMessage({ type: "sayError", id: msg.id });
    }
  }
};
