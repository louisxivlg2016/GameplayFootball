/*
 * Narrow service worker: the ONLY thing it does is reroute the Piper neural-voice
 * downloads. The radio's TTS worker fetches its ~63 MB voice model straight from
 * huggingface.co, which is slow and rate-limits (429) on mobile — so the radio
 * looked "broken" on the deployed site. We can't touch the TTS worker source
 * (web/), so we intercept its huggingface request here and serve a copy we host
 * on the Vercel CDN instead (fast + reliable). Everything else passes straight
 * through untouched — this worker cannot affect the rest of the site.
 */
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });

// huggingface piper-voices base the TTS lib downloads from
const HF_BASE = "https://huggingface.co/diffusionstudio/piper-voices/resolve/main/";

self.addEventListener("fetch", (event) => {
  const url = event.request.url;
  if (!url.startsWith(HF_BASE)) return; // not a voice download — leave it alone

  const rel = url.slice(HF_BASE.length);            // e.g. fr/fr_FR/tom/medium/fr_FR-tom-medium.onnx
  const local = new URL("/tts/voices/" + rel, self.location.origin).toString();

  event.respondWith((async () => {
    try {
      const res = await fetch(local, { cache: "force-cache" });
      if (res && res.ok) return res;               // served from our CDN copy
    } catch (_) { /* fall through to network */ }
    return fetch(event.request);                    // no local copy → original huggingface
  })());
});
