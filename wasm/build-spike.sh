#!/usr/bin/env bash
# Phase-0 spike build: SDL2 + WebGL2 triangle → dist-spike/. Validates toolchain.
set -euo pipefail
cd "$(dirname "$0")"
source ~/emsdk/emsdk_env.sh 2>/dev/null
mkdir -p dist-spike
emcc spike/webgl2_triangle.c \
  -sUSE_SDL=2 \
  -sMIN_WEBGL_VERSION=2 -sMAX_WEBGL_VERSION=2 -sFULL_ES3=1 \
  -sASSERTIONS=2 -sGL_DEBUG=1 -sGL_ASSERTIONS=1 \
  -sINITIAL_MEMORY=268435456 -sEXIT_RUNTIME=0 \
  --shell-file shell.html \
  -o dist-spike/index.html
echo "spike built → dist-spike/"
