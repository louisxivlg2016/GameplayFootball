// Bridge from the C++ match engine to the browser radio (multi-language TTS
// commentary, ported from the web version — see wasm/webradio/). Under
// Emscripten these call the window.gpfRadio* hooks installed by the page; on a
// native build they compile to no-ops so match.cpp / referee.cpp stay portable.
#ifndef WASM_RADIO_BRIDGE_HPP
#define WASM_RADIO_BRIDGE_HPP

#ifdef __EMSCRIPTEN__
#include <emscripten.h>

// Discrete match event. player/team/score are optional (team = -1 / score = -1
// when not applicable). Event names match the web RadioEvent union: "opening",
// "kickoff", "goal", "foul", "yellow", "red", "penalty", "offside", "corner",
// "goalkick", "throwin", "halftime", "fulltime", "extratime", "shootout".
inline void gpfRadioEvent(const char *event, const char *player = "", int team = -1,
                          int score0 = -1, int score1 = -1) {
  // clang-format off
  EM_ASM({
    try { if (window.gpfRadioEvent)
      window.gpfRadioEvent(UTF8ToString($0), UTF8ToString($1), $2, $3, $4); } catch (e) {}
  }, event, player ? player : "", team, score0, score1);
  // clang-format on
}

inline void gpfRadioSetTeams(const char *home, const char *away) {
  // clang-format off
  EM_ASM({
    try { if (window.gpfRadioSetTeams)
      window.gpfRadioSetTeams(UTF8ToString($0), UTF8ToString($1)); } catch (e) {}
  }, home ? home : "", away ? away : "");
  // clang-format on
}

inline void gpfRadioReset() {
  EM_ASM({ try { if (window.gpfRadioReset) window.gpfRadioReset(); } catch (e) {} });
}

// DEFI challenge outcome (win = 1 succeeded, 0 failed).
inline void gpfChallengeResult(int win) {
  EM_ASM({ try { if (window.gpfChallengeResult) window.gpfChallengeResult($0); } catch (e) {} }, win);
}

// One play-by-play snapshot (pushed ~once per game-second from Match::Process).
inline void gpfRadioTick(int loose, const char *carrier, int teamId, int keeper,
                         double depth, double speed, const char *oppName, double oppDist,
                         int score0, int score1, double clock, int gen, int ceremony,
                         int inPlay) {
  // clang-format off
  EM_ASM({
    try { if (window.gpfRadioTick) window.gpfRadioTick({
      loose: !!$0, carrier: UTF8ToString($1), teamId: $2, keeper: !!$3,
      depth: $4, speed: $5, oppName: UTF8ToString($6), oppDist: $7,
      score: [$8, $9], clock: $10, gen: $11, ceremony: !!$12, inPlay: !!$13,
    }); } catch (e) {}
  }, loose, carrier ? carrier : "", teamId, keeper, depth, speed,
     oppName ? oppName : "", oppDist, score0, score1, clock, gen, ceremony, inPlay);
  // clang-format on
}

#else  // native build: no-ops

inline void gpfRadioEvent(const char *, const char * = "", int = -1, int = -1, int = -1) {}
inline void gpfRadioSetTeams(const char *, const char *) {}
inline void gpfRadioReset() {}
inline void gpfChallengeResult(int) {}
inline void gpfRadioTick(int, const char *, int, int, double, double, const char *, double,
                         int, int, double, int, int, int) {}

#endif

#endif  // WASM_RADIO_BRIDGE_HPP
