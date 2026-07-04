#!/usr/bin/env bash
# Configure + build the wasm game. Output: wasm/dist/index.{html,js,wasm,data}.
#   ./build.sh            incremental build
#   ./build.sh clean      wipe the build dir first
set -euo pipefail
cd "$(dirname "$0")"
source ~/emsdk/emsdk_env.sh 2>/dev/null

BUILD=build
[ "${1:-}" = "clean" ] && rm -rf "$BUILD" dist

if [ ! -f "$BUILD/CMakeCache.txt" ]; then
  emcmake cmake -S . -B "$BUILD" -DCMAKE_BUILD_TYPE=Release
fi
emmake cmake --build "$BUILD" -j"$(nproc)"
echo "== dist =="
ls -la dist/ 2>/dev/null || echo "(no dist yet)"
