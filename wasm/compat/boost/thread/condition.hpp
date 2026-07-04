#pragma once
// wasm shim shadowing <boost/thread/condition.hpp>. Provides boost::condition
// (over std::condition_variable_any, which waits on any BasicLockable — our
// mutex::scoped_lock qualifies) plus the Boost.DateTime bits the message queue
// and environment manager use for timed waits/elapsed time.
#include <condition_variable>
#include <chrono>
#include "boost/thread/mutex.hpp"

namespace boost {

using system_time = std::chrono::system_clock::time_point;
inline system_time get_system_time() { return std::chrono::system_clock::now(); }

namespace posix_time {
  inline std::chrono::milliseconds milliseconds(long long ms) {
    return std::chrono::milliseconds(ms);
  }
  using ptime = std::chrono::system_clock::time_point;
  struct time_duration {
    std::chrono::system_clock::duration d{};
    time_duration() = default;
    time_duration(std::chrono::system_clock::duration dd) : d(dd) {}
    long long total_milliseconds() const {
      return std::chrono::duration_cast<std::chrono::milliseconds>(d).count();
    }
    long long total_microseconds() const {
      return std::chrono::duration_cast<std::chrono::microseconds>(d).count();
    }
  };
  struct microsec_clock {
    static ptime local_time() { return std::chrono::system_clock::now(); }
    static ptime universal_time() { return std::chrono::system_clock::now(); }
  };
}  // namespace posix_time

class condition {
  std::condition_variable_any cv_;
 public:
  template <class Lock> void wait(Lock &l) { cv_.wait(l); }
  template <class Lock> bool timed_wait(Lock &l, const system_time &abs) {
    return cv_.wait_until(l, abs) == std::cv_status::no_timeout;
  }
  void notify_one() { cv_.notify_one(); }
  void notify_all() { cv_.notify_all(); }
};

using condition_variable_any = condition;

}  // namespace boost
