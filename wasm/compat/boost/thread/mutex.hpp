#pragma once
// wasm shim shadowing <boost/thread/mutex.hpp>: boost::mutex has a nested
// scoped_lock and is used with boost::condition. Back it with std::mutex.
// (Emscripten's boost_headers port has no working Boost.Thread without pthread.)
#include <mutex>

namespace boost {

class mutex {
  std::mutex m_;
 public:
  mutex() = default;
  mutex(const mutex &) = delete;
  mutex &operator=(const mutex &) = delete;

  void lock() { m_.lock(); }
  void unlock() { m_.unlock(); }
  bool try_lock() { return m_.try_lock(); }
  std::mutex &native() { return m_; }

  // BasicLockable so std::condition_variable_any can wait on it directly
  class scoped_lock {
    mutex *m_;
    bool owns_;
   public:
    explicit scoped_lock(mutex &m) : m_(&m), owns_(true) { m_->lock(); }
    ~scoped_lock() { if (owns_) m_->unlock(); }
    scoped_lock(const scoped_lock &) = delete;
    scoped_lock &operator=(const scoped_lock &) = delete;
    void lock() { if (!owns_) { m_->lock(); owns_ = true; } }
    void unlock() { if (owns_) { m_->unlock(); owns_ = false; } }
    bool owns_lock() const { return owns_; }
  };
};

// used once (timed_mutex); basic mutex semantics are sufficient here
class timed_mutex : public mutex {};

}  // namespace boost
