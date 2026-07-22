# Emscripten/WebAssembly build for GameplayFootball.
# Reuses the native source lists from ../sources.cmake (path-prefixed to the
# repo root) but swaps native deps for Emscripten ports/flags. The native
# desktop build (../CMakeLists.txt) is untouched. Configure via ../build.sh
# (emcmake). Single-threaded milestone: no -pthread here.
cmake_minimum_required(VERSION 3.13)
project(GameplayFootballWasm C CXX)  # C too: src/misc/hungarian.c

set(CMAKE_CXX_STANDARD 17)          # std::filesystem shim for boost::filesystem
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(GPF_ROOT ${CMAKE_CURRENT_SOURCE_DIR}/..)
include(${GPF_ROOT}/sources.cmake)

# sources.cmake lists paths relative to the repo root (src/...). Prefix every
# source/header list variable with the root so they resolve from wasm/.
set(GPF_SRC_VARS
    BASE_HEADERS BASE_GEOMETRY_HEADERS BASE_MATH_HEADERS BASE_SOURCES
    SYSTEMS_COMMON_HEADERS SYSTEMS_COMMON_SOURCES
    SYSTEMS_GRAPHICS_HEADERS SYSTEMS_GRAPHICS_OBJECTS_HEADERS
    SYSTEMS_GRAPHICS_RESOURCES_HEADERS SYSTEMS_GRAPHICS_RENDERING_HEADERS
    SYSTEMS_GRAPHICS_SOURCES
    SYSTEMS_AUDIO_OBJECTS_HEADERS SYSTEMS_AUDIO_HEADERS
    SYSTEMS_AUDIO_RESOURCES_HEADERS SYSTEMS_AUDIO_RENDERING_HEADERS
    SYSTEMS_AUDIO_SOURCES
    LOADERS_HEADERS LOADERS_SOURCES TYPES_HEADERS TYPES_SOURCES
    FRAMEWORK_HEADERS FRAMEWORK_SOURCES
    SCENE_HEADERS SCENE2D_HEADERS SCENE_OBJECTS_HEADERS SCENE3D_HEADERS
    SCENE_RESOURCES_HEADERS SCENE_SOURCES
    MANAGERS_HEADERS MANAGERS_SOURCES
    UTILS_HEADERS UTILS_EXT_HEADERS UTILS_SOURCES
    UTILS_GUI2_HEADERS UTILS_GUI2_WIDGETS_HEADERS UTILS_GUI2_SOURCES
    BLUNTED_CORE_HEADERS BLUNTED_CORE_SOURCES
    LEAGUE_HEADERS LEAGUE_SOURCES CORE_HEADERS CORE_SOURCES
    GAME_HEADERS GAME_SOURCES HID_HEADERS HID_SOURCES
    MENU_HEADERS MENU_SOURCES DATA_HEADERS DATA_SOURCES)
foreach(v ${GPF_SRC_VARS})
  list(TRANSFORM ${v} PREPEND "${GPF_ROOT}/")
endforeach()

include_directories(${GPF_ROOT}/src)
include_directories(${CMAKE_CURRENT_SOURCE_DIR}/compat)

# ---- Emscripten ports/flags shared by compile AND link ----
# WebGL2/GLES3, SDL2 stack, SQLite, header-only Boost. NO memory growth (WebGL
# rejects resizable-ArrayBuffer views) — fixed INITIAL_MEMORY at link instead.
set(GPF_EM_COMMON
    "-sUSE_SDL=2 -sUSE_SDL_IMAGE=2 -sUSE_SDL_TTF=2 -sUSE_SDL_GFX=2 \
     -sUSE_SQLITE3=1 -sUSE_BOOST_HEADERS=1 \
     -sMIN_WEBGL_VERSION=2 -sMAX_WEBGL_VERSION=2 -sFULL_ES3=1")
# quiet the mountain of legacy warnings; keep errors visible
set(GPF_EM_WARN "-Wno-deprecated-declarations -Wno-writable-strings \
     -Wno-c++11-narrowing -Wno-register -Wno-invalid-offsetof")
# -DNDEBUG strips the ~224 C++ assert() sites (several in hot sim/render paths):
# this cache has an empty CMAKE_BUILD_TYPE so -O3 was applied but the release
# NDEBUG was not — set it explicitly so asserts don't run every frame.
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${GPF_EM_COMMON} ${GPF_EM_WARN} -O3 -DNDEBUG")
# C sources (e.g. src/misc/hungarian.c — the AI role solver, run ~every 200ms)
# must be optimized too; CMAKE_CXX_FLAGS does not cover C.
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} ${GPF_EM_COMMON} -O3 -DNDEBUG")

# force-include the wasm compatibility header — C++ ONLY (it defines std-backed
# boost namespaces; force-including it into C files like src/misc/hungarian.c
# would break their C compile). hungarian.h already has extern "C".
add_compile_options(
  "$<$<COMPILE_LANGUAGE:CXX>:SHELL:-include ${CMAKE_CURRENT_SOURCE_DIR}/compat/wasm_compat.hpp>")

# ---- library structure (mirrors ../CMakeLists.txt, minus physics) ----
add_library(baselib OBJECT ${BASE_SOURCES})
add_library(systemscommonlib OBJECT ${SYSTEMS_COMMON_SOURCES})
add_library(systemsgraphicslib OBJECT ${SYSTEMS_GRAPHICS_SOURCES})
add_library(systemsaudiolib OBJECT ${SYSTEMS_AUDIO_SOURCES})
add_library(loaderslib OBJECT ${LOADERS_SOURCES})
add_library(typeslib OBJECT ${TYPES_SOURCES})
add_library(frameworklib OBJECT ${FRAMEWORK_SOURCES})
add_library(scenelib OBJECT ${SCENE_SOURCES})
add_library(managerslib OBJECT ${MANAGERS_SOURCES})
add_library(utilslib OBJECT ${UTILS_SOURCES})
add_library(gui2lib OBJECT ${UTILS_GUI2_SOURCES})

set(OWN_LIBRARIES $<TARGET_OBJECTS:baselib> $<TARGET_OBJECTS:systemscommonlib>
    $<TARGET_OBJECTS:systemsgraphicslib> $<TARGET_OBJECTS:systemsaudiolib>
    $<TARGET_OBJECTS:loaderslib> $<TARGET_OBJECTS:typeslib>
    $<TARGET_OBJECTS:frameworklib> $<TARGET_OBJECTS:scenelib>
    $<TARGET_OBJECTS:managerslib> $<TARGET_OBJECTS:utilslib>
    $<TARGET_OBJECTS:gui2lib>)

add_library(blunted2 STATIC ${BLUNTED_CORE_SOURCES} ${OWN_LIBRARIES})
add_library(leaguelib STATIC ${LEAGUE_SOURCES})
add_library(gamelib STATIC ${GAME_SOURCES})
add_library(hidlib STATIC ${HID_SOURCES})
add_library(menulib STATIC ${MENU_SOURCES})
add_library(datalib STATIC ${DATA_SOURCES})

# ---- executable → dist/index.html ----
add_executable(gameplayfootball ${CORE_SOURCES})
target_link_libraries(gameplayfootball
    gamelib hidlib menulib datalib leaguelib blunted2)

# preload the whole data/ at /data; game chdir("/data") under __EMSCRIPTEN__.
set(GPF_EM_LINK
    "${GPF_EM_COMMON} -O3 \
     -sSDL2_IMAGE_FORMATS=[png,jpg] \
     -lopenal \
     -sINITIAL_MEMORY=1073741824 \
     -sEXIT_RUNTIME=0 -sASSERTIONS=0 -sGL_ASSERTIONS=0 \
     -sEXPORTED_RUNTIME_METHODS=ccall,cwrap \
     -sASYNCIFY=1 -sASYNCIFY_STACK_SIZE=262144 \
     -sALLOW_MEMORY_GROWTH=0 \
     --preload-file ${GPF_ROOT}/data@/data \
     --shell-file ${CMAKE_CURRENT_SOURCE_DIR}/shell.html")
set_target_properties(gameplayfootball PROPERTIES
    LINK_FLAGS "${GPF_EM_LINK}"
    SUFFIX ".html"
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/dist"
    OUTPUT_NAME "index")
