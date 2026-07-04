# GameplayFootball → WebAssembly port (rev 2, post-Codex review)

Port the native C++/SDL2/OpenGL/OpenAL/Boost/SQLite game to the browser via
**Emscripten**, in a self-contained **`wasm/`** dir. The `web/` React port and
the native desktop build are **untouched**.

> Rev 2 incorporates the Codex plan review (`/tmp/codex-review-output-1783196528661-10014.md`).
> Headline change: **single-threaded first**. Do NOT start with pthreads /
> OffscreenCanvas / PROXY_TO_PTHREAD / Asyncify. Convert the blocking scheduler
> loop to a per-frame `Tick()` driven by `emscripten_set_main_loop`, run
> rendering on the app thread, and get one non-blank frame. Threading is a much
> later, optional spike.

## Ground rules
- New code/build in `wasm/`; shared C++ in `src/` gated by `#ifdef __EMSCRIPTEN__`
  so the **native desktop build keeps compiling** (verify after risky edits).
- Toolchain: Emscripten 6.0.2 (`source ~/emsdk/emsdk_env.sh`). **All needed
  ports exist**: `-sUSE_SDL=2 -sUSE_SDL_IMAGE=2 -sUSE_SDL_TTF=2 -sUSE_SDL_GFX=2
  -sUSE_SQLITE3=1 -sUSE_BOOST_HEADERS=1` (+ OpenAL builtin `-lopenal`).
- After each phase: `/codex-fix` on the diff, then load `wasm/dist` in local
  (headless) Chrome and assert **not blank** (canvas + pixel variance + no fatal
  console/abort).

## Environment facts
- 185 `.cpp`, ~47k LOC, engine `blunted2` (OBJECT libs) + gamelib/hidlib/menulib/
  datalib/leaguelib, via `sources.cmake`. C++14 (bump wasm target to **C++17**
  for the std::filesystem shim).
- Renderer: shader-based GLSL `#version 150`; context + core-shader compile
  happen at boot (`opengl_renderer3d.cpp:337/496`) → **boot gates**.
- GL symbols loaded from `sdl_glfuncs.h` into a `mapping` struct and the renderer
  **exits if any symbol is missing** (`opengl_renderer3d.cpp:391`). The table has
  desktop-only entries (glBegin/glEnd/glMatrixMode/glOrtho/glPolygonMode/
  glPushAttrib/glBindFragDataLocation) → **prune/conditionalize for wasm** =
  earliest blocker, before rendering even starts.
- Threaded natively: `main()`→`blunted.cpp:133 scheduler->Run()`→blocking
  `scheduler.cpp:154 while(!quit...)`; separate GraphicsSystem renderer thread
  creates the GL context and **polls SDL events** (`opengl_renderer3d.cpp:2255`);
  AudioSystem thread; TaskManager worker pool (≥3, else hardware_concurrency).
- Assets: `data/` = 26 MB / 511 files, loaded by relative paths
  (`football.config`, `databases/default/database.sqlite`, `media/shaders/...`).

---

## MILESTONE 1 — single-threaded wasm smoke frame (Phases 0–3)
Load in Chrome from a local COOP/COEP server, init SDL2/WebGL2, load config +
SQLite + shaders + a minimal asset set, present **one non-blank frame/menu**.
No pthreads, OffscreenCanvas, Asyncify, or audio.

### Phase 0 — scaffold + compat spike  *(task #17)*
- `wasm/CMakeLists.txt`: `include(../sources.cmake)`, `list(TRANSFORM <each var>
  PREPEND ../)`, rebuild the OBJECT-lib→`blunted2`→exe structure, **no
  find_package**; deps via emcc flags. `CMAKE_CXX_STANDARD 17` for wasm.
- `wasm/build.sh` (emcmake configure + emmake), `wasm/serve.ts` (Bun static
  server: **COOP same-origin / COEP require-corp**, wasm MIME), `wasm/shell.html`
  (canvas + log overlay), `wasm/chrome-check.ts` (headless load + pixel/console
  assert).
- Assets: `--preload-file ../data@/data` and `chdir("/data")` (easier to reason
  about than mount-at-root).
- Spike: confirm ports link, WebGL2 context + trivial shader compile.

### Phase 1 — compat layer + compile all TUs  *(task #18)*
- **Boost shim** (`wasm/compat/` headers, force-included for wasm): map
  `boost::thread/mutex/condition/lock`→`std::*`, `boost::this_thread::sleep`→
  `std::this_thread::sleep_for`, `boost::thread::hardware_concurrency`, and
  `boost::filesystem`→`std::filesystem` (needs C++17). Touch sites:
  thread.hpp:68, messagequeue.hpp:61/71, command.cpp:38, scheduler.cpp:161/314,
  taskmanager.cpp:21, environmentmanager.cpp:22, proceduralpitch.cpp:454;
  fs: utils.hpp:73, directoryparser.cpp, leaguecode.cpp:23, league.cpp:168,
  teamselect.cpp:33, team.cpp:89.
- **Force single-thread for the milestone**: TaskManager worker pool = 0 →
  `EnqueueWork` direct-execution fallback (`taskmanager.cpp:74`).
- **Stub AudioSystem/OpenALRenderer** under `__EMSCRIPTEN__`.
- **GL layer**: under `__EMSCRIPTEN__` include `<GLES3/gl3.h>` and populate
  `mapping` by calling GLES3 directly (no GetProcAddress); drop desktop-only
  entries; stub live fixed-function wrappers (`glColor4f` :792, `glPushAttrib/
  glPopAttrib` :1786) to no-ops.
- Drop `WIN32`/`dl`/`m`. Keep exceptions/RTTI **off** unless compile demands.
- Validation: `emmake make` reaches 100% object compilation; native build still
  green.

### Phase 2 — main-loop conversion + minimal link  *(task #19)*
- Add `Scheduler::Tick()` (one frame of the current `Run()` body) and, under
  `__EMSCRIPTEN__`, drive it from `emscripten_set_main_loop`; **do not** start
  the renderer as a separate thread — create context + render on the app thread;
  **poll SDL events in the main loop** (moved out of the renderer thread).
- Link minimal: `-sMIN_WEBGL_VERSION=2 -sMAX_WEBGL_VERSION=2 -sFULL_ES3=1
  -sUSE_SDL=2 -sUSE_SDL_IMAGE=2 -sUSE_SDL_TTF=2 -sUSE_SDL_GFX=2 -sUSE_SQLITE3=1
  -sUSE_BOOST_HEADERS=1 -lopenal -sINITIAL_MEMORY=1GB
  -sEXIT_RUNTIME=0 -sASSERTIONS=2 -sGL_DEBUG=1 -sGL_ASSERTIONS=1
  --preload-file ../data@/data` (no `-pthread`).
  - **NO `-sALLOW_MEMORY_GROWTH`** (spike-confirmed): growable wasm memory is a
    *resizable* ArrayBuffer, and current Chrome rejects resizable views in
    `gl.bufferData`/`texImage` → use a fixed large `INITIAL_MEMORY` instead.
- Validation: produces `dist/index.{html,js,wasm,data}`.

### Phase 3 — boot to a non-blank frame  *(task #20)*
- **Shaders 150→300 es** (10 files in `data/media/shaders/`): `#version 300 es`,
  `precision highp float;`, `texture2D`→`texture`, strip `f` float suffixes,
  fragment outputs `layout(location=N) out vec4` and **remove
  `glBindFragDataLocation`** (:1969), check `sampler2DShadow`/`textureProj`
  (lighting.frag:9/125).
- GL fixes: `glUniformMatrix4fv(transpose=true)` (:2215) → transpose on CPU;
  `glClearDepth`→`glClearDepthf` (:520); guard `GL_FRAMEBUFFER_SRGB` (:2085);
  anisotropy behind `EXT_texture_filter_anisotropic` (:481); request WebGL2
  explicitly (:365); G-buffer `RGBA16F` (:560/611) needs `EXT_color_buffer_float`
  — fall back to `RGBA8` if it blocks the first frame.
- Validation: headless Chrome console shows config loaded, DB opened, WebGL2
  context + GL vendor/version, per-shader compile/link OK; canvas non-blank &
  stable; no missing preload; no GL-symbol-missing exit.

## MILESTONE 2 — full render + interactivity (Phases 4–5)

### Phase 4 — full scene rendering  *(task #21)*
- Menu + a match render correctly; resolve remaining format/extension issues,
  framebuffer completeness, draw-buffer limits.
- Validation: screenshot of menu/match with real pixel content, no GL errors.

### Phase 5 — input, audio, persistence, (optional) threads  *(task #22)*
- SDL keyboard/mouse from the canvas → HID. Un-stub OpenAL→Web Audio behind a
  user-gesture unlock. Persist `football.config`/saves via **IDBFS**
  (`FS.syncfs`, load before main loop, flush on write + pagehide).
- Optional threading spike (separate artifact): `-pthread -sPROXY_TO_PTHREAD
  -sOFFSCREENCANVAS_SUPPORT=1` + crossOriginIsolated — only after a minimal
  renderer-pthread WebGL2 spike passes. Cap engine thread count explicitly.
- Validation: interactively drivable match in Chrome.

## Locked-in decisions (from review)
- Single-thread + `emscripten_set_main_loop` first; threads much later.
- Boost → **std shim** (not vendor-build); wasm target is **C++17**.
- Prune the GL symbol table for wasm **before** anything renders.
- Two links: minimal-smoke, then full.
- Preload minimal assets during iteration; MEMFS is fine for smoke, IDBFS for
  real persistence.
- Keep exceptions/RTTI off until compile evidence demands otherwise.
