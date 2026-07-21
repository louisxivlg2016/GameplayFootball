// written by bastiaan konings schuiling 2008 - 2014
// this work is public domain. the code is undocumented, scruffy, untested, and should generally not be used for anything important.
// i do not offer support, so don't ask. to be used for inspiration :)

#include "environmentmanager.hpp"

#include <SDL2/SDL.h>
#include <boost/thread.hpp>
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

namespace blunted {

  template<> EnvironmentManager* Singleton<EnvironmentManager>::singleton = 0;

  EnvironmentManager::EnvironmentManager() {
    quit.SetData(false);
#ifdef __EMSCRIPTEN__
    // monotonic high-res browser timer; far cheaper than the civil wall clock in
    // the hot scheduler loop and immune to OS clock adjustments.
    startTime_ms = (unsigned long)emscripten_get_now();
#else
    startTime = boost::posix_time::microsec_clock::local_time();
#endif
  };

  EnvironmentManager::~EnvironmentManager() {
  };

  unsigned long EnvironmentManager::GetTime_ms() {
#ifdef __EMSCRIPTEN__
    return (unsigned long)emscripten_get_now() - startTime_ms;
#else
    boost::posix_time::ptime now = boost::posix_time::microsec_clock::local_time();
    boost::posix_time::time_duration msdiff = now - startTime;
    return msdiff.total_milliseconds();
#endif
  }

  void EnvironmentManager::Pause_ms(int duration) {
    boost::this_thread::sleep(boost::posix_time::milliseconds(duration));
  }

  void EnvironmentManager::SignalQuit() {
    quit.SetData(true);
  }

  bool EnvironmentManager::GetQuit() {
    return quit.GetData();
  }

}
