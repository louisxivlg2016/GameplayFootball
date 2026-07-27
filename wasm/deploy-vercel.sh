#!/usr/bin/env bash
# Assemble a static export of the wasm build (+ a serverless /img-proxy function)
# and deploy it to the "gameplay-football" Vercel project.
#
# Prereqs: a fresh `emmake cmake --build build` (wasm/dist up to date), `vercel`
# CLI logged in. Run from the repo (any dir).
#
#   bash wasm/deploy-vercel.sh          # deploy to production
#
# NOTE: the menu-theme background music (web/src/assets/audio, ~178MB) is left
# out to fit Vercel's size limit — everything else (game, anthems via proxy,
# flags, captain photos, TTS voice, loading slideshow) ships.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
D="wasm/.vercel-deploy"

echo ">> assembling $D"
rm -rf "$D"; mkdir -p "$D/api" "$D/tts" "$D/menu-assets" "$D/radio"
cp wasm/dist/index.html wasm/dist/index.js wasm/dist/index.wasm wasm/dist/index.data "$D/"
( cd wasm && bun build webradio/radioMain.ts --target browser --format esm --outfile "../$D/radio.js" )
( cd wasm && bun build ../web/src/game/ttsWorker.ts --target browser --format esm --outfile "../$D/tts/worker.js" )
# TTS runtime assets (piper + onnxruntime) reused from the web deploy output
cp -r web/.vercel/output/static/tts/onnx "$D/tts/onnx"
cp web/.vercel/output/static/tts/piper_phonemize.wasm web/.vercel/output/static/tts/piper_phonemize.data "$D/tts/"
cp -r wasm/captains "$D/captains"
cp -r wasm/uiassets "$D/uiassets"
for f in play-button.png training-button.png worldcup-button.png settings-button.png menu-logo.png; do
  cp "web/src/assets/$f" "$D/menu-assets/" 2>/dev/null || true
done
cp -r web/src/assets/training "$D/menu-assets/training" 2>/dev/null || true
cp web/src/assets/audio/goal-but-but.mp3 "$D/radio/goal-but-but.mp3"

# menu music: the menu-theme-*.mp4 are VIDEO (~11MB each) but only the audio is
# used. Extract audio-only mp3 (~1MB) named by theme key (no extension; served as
# audio/mpeg via vercel.json). menu.ts requests /menu-music/<key>.
echo ">> transcoding menu music (audio-only)"
mkdir -p "$D/menu-music"
ffmpeg -y -v error -i web/src/assets/audio/menu-theme.mp4 -vn -c:a libmp3lame -b:a 56k -f mp3 "$D/menu-music/default"
for f in web/src/assets/audio/menu-theme-*.mp4; do
  k="$(basename "$f" .mp4)"; k="${k#menu-theme-}"
  ffmpeg -y -v error -i "$f" -vn -c:a libmp3lame -b:a 56k -f mp3 "$D/menu-music/$k"
done

# vercel.json + serverless function are kept in git under wasm/vercel-assets/
cp wasm/vercel-assets/vercel.json "$D/vercel.json"
cp wasm/vercel-assets/img-proxy.js "$D/api/img-proxy.js"
mkdir -p "$D/.vercel"; cp .vercel/project.json "$D/.vercel/project.json"

echo ">> deploying ($(du -sh "$D" | cut -f1))"
( cd "$D" && vercel deploy --prod --yes --archive=tgz )
