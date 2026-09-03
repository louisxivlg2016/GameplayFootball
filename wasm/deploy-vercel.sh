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
cp web/src/assets/audio/goal-shout-v5.mp3 "$D/radio/goal-shout-v5.mp3"
cp web/src/assets/audio/match-intro.mp3 "$D/radio/match-intro.mp3"

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

# self-hosted Piper voice models: the radio's TTS worker otherwise pulls its
# ~60MB-per-language voice straight from huggingface (slow, 429-prone → the pill
# sticks on "loading"). Host a copy on the Vercel CDN; the narrow sw.js reroutes
# the worker's huggingface fetch to it. Cache the downloads in wasm/ttsvoices so
# redeploys and the local serve.ts reuse them. We host every LANGUAGE the UI is
# translated into (radioI18n's PIPER_VOICE_BY_LANGUAGE) so switching language keeps
# the radio fast; other languages still fall back to huggingface via the SW.
echo ">> Piper voice models (cached in wasm/ttsvoices)"
HF="https://huggingface.co/diffusionstudio/piper-voices/resolve/main"
VC="wasm/ttsvoices"
# voice ids for every language whose voice lives on the diffusionstudio mirror
# (fr/en/es/pt/it/nl/de/nb/hr/ro/pl/tr/ru/uk/ar/vi/zh). hi/id (rhasspy mirror) and
# th/ko (Xenova MMS) use other sources and still fall back to huggingface.
VOICES="fr_FR-tom-medium en_GB-northern_english_male-medium es_ES-davefx-medium pt_BR-faber-medium it_IT-paola-medium nl_BE-rdh-medium de_DE-thorsten-high no_NO-talesyntese-medium sr_RS-serbski_institut-medium ro_RO-mihai-medium pl_PL-darkman-medium tr_TR-fahrettin-medium ru_RU-denis-medium uk_UA-ukrainian_tts-medium ar_JO-kareem-medium vi_VN-vais1000-medium zh_CN-huayan-medium"
for vid in $VOICES; do
  region="${vid%%-*}"               # e.g. pt_BR
  lang="${region%%_*}"              # e.g. pt
  rest="${vid#*-}"                  # e.g. faber-medium
  name="${rest%%-*}"                # e.g. faber
  qual="${rest#*-}"                 # e.g. medium
  vdir="$VC/$lang/$region/$name/$qual"
  mkdir -p "$vdir"
  [ -s "$vdir/$vid.onnx" ]      || { echo "   downloading $vid …"; curl -fsSL "$HF/$lang/$region/$name/$qual/$vid.onnx"      -o "$vdir/$vid.onnx"; }
  [ -s "$vdir/$vid.onnx.json" ] ||   curl -fsSL "$HF/$lang/$region/$name/$qual/$vid.onnx.json" -o "$vdir/$vid.onnx.json"
done
[ -s "$VC/voices.json" ] || curl -fsSL "$HF/voices.json" -o "$VC/voices.json" || true
mkdir -p "$D/tts/voices"
cp -r "$VC/." "$D/tts/voices/"
cp wasm/sw.js "$D/sw.js"

# vercel.json + serverless function are kept in git under wasm/vercel-assets/
cp wasm/vercel-assets/vercel.json "$D/vercel.json"
cp wasm/vercel-assets/img-proxy.js "$D/api/img-proxy.js"
cp wasm/vercel-assets/talk.js "$D/api/talk.js"       # "talk to a player" AI relay
mkdir -p "$D/.vercel"; cp .vercel/project.json "$D/.vercel/project.json"

echo ">> deploying ($(du -sh "$D" | cut -f1))"
( cd "$D" && vercel deploy --prod --yes --archive=tgz )
