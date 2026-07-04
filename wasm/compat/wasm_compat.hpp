#pragma once
// Force-included into every wasm translation unit (see wasm/CMakeLists.txt),
// before the TU's own includes. Pulls in the Boost->std shims so that boost
// thread/mutex/condition/filesystem resolve to the std-backed shadow headers
// in wasm/compat/boost/ (which precede Emscripten's boost_headers port on -I).
#ifdef __EMSCRIPTEN__
#include "boost/thread.hpp"      // boost::thread / mutex / condition / posix_time
#include "boost/filesystem.hpp"  // boost::filesystem / boost::system::error_code
#endif
