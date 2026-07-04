#pragma once
// wasm shim shadowing <boost/thread.hpp>. Pulls in the mutex/condition shims
// and provides boost::thread + boost::this_thread over std. NOTE: std::thread
// compiles fine without -pthread (link/runtime is handled in a later phase; the
// single-threaded milestone forces the worker pool to zero and bypasses the
// renderer/audio threads, so these are constructed rarely if at all).
#include <thread>
#include <chrono>
#include <utility>
#include <type_traits>
#include <boost/core/ref.hpp>  // real (header-only) boost::reference_wrapper
#include "boost/thread/mutex.hpp"
#include "boost/thread/condition.hpp"

namespace boost {

namespace this_thread {
  inline void yield() { std::this_thread::yield(); }
  template <class Rep, class Period>
  inline void sleep(const std::chrono::duration<Rep, Period> &d) {
    std::this_thread::sleep_for(d);
  }
}  // namespace this_thread

class thread {
  std::thread t_;
 public:
  thread() = default;
  // boost::thread(boost::ref(*this)) — boost::reference_wrapper has no call
  // operator here, so unwrap and invoke the referent's operator().
  template <class T>
  explicit thread(boost::reference_wrapper<T> r)
      : t_([p = &r.get()]() { (*p)(); }) {}
  // boost::thread(&fn, args...) — function pointer / callable + bound args
  template <class F, class... Args,
            class = std::enable_if_t<(sizeof...(Args) > 0)>>
  explicit thread(F &&f, Args &&...args)
      : t_(std::forward<F>(f), std::forward<Args>(args)...) {}
  // boost::thread(plain_callable) — a functor/lambda with operator()
  template <class F, class = std::enable_if_t<
                         std::is_invocable_v<std::decay_t<F> &>>>
  explicit thread(F f) : t_([f]() mutable { f(); }) {}
  thread(thread &&) noexcept = default;
  thread &operator=(thread &&) noexcept = default;
  thread(const thread &) = delete;
  thread &operator=(const thread &) = delete;
  ~thread() { if (t_.joinable()) t_.detach(); }

  void join() { if (t_.joinable()) t_.join(); }
  void detach() { if (t_.joinable()) t_.detach(); }
  bool joinable() const { return t_.joinable(); }
  static unsigned hardware_concurrency() { return std::thread::hardware_concurrency(); }
};

}  // namespace boost
