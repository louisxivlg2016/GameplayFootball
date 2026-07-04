// written by bastiaan konings schuiling 2008 - 2014
// this work is public domain. the code is undocumented, scruffy, untested, and should generally not be used for anything important.
// i do not offer support, so don't ask. to be used for inspiration :)

#include "command.hpp"

#ifdef __EMSCRIPTEN__
#include "types/thread.hpp"  // blunted::CoopPumpAll (inline)
#endif

namespace blunted {

  Command::Command(const std::string &name) : handled(false) {
    this->name.SetData(name);
  }

  Command::~Command() {
  }

  bool Command::IsReady() {
    boost::mutex::scoped_lock lock(mutex);
    return handled;
  }

  void Command::Reset() {
    boost::mutex::scoped_lock lock(mutex);
    handled = false;
  }

  bool Command::Handle(void *caller) {
    bool result = Execute(caller);

    boost::mutex::scoped_lock lock(mutex);
    handled = true;
    //lock.unlock(); // http://www.justsoftwaresolutions.co.uk/threading/implementing-a-thread-safe-queue-using-condition-variables.html
    // edit: disabled, just to be sure no obscure bugs occur.
    processed.notify_one();

    return result;
  }

  void Command::Wait() {
#ifdef __EMSCRIPTEN__
    // single-threaded: no other thread will handle us, so pump the cooperative
    // thread queues until this command is handled (or nothing is left to do).
    int idle = 0;
    while (!IsReady()) {
      if (CoopPumpAll()) idle = 0;
      else if (++idle > 4) break;  // nobody produced work — avoid a hang
    }
#else
    boost::mutex::scoped_lock lock(mutex);
    if (!handled) {
      processed.wait(lock);
    }
#endif
  }

}
