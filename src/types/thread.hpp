// written by bastiaan konings schuiling 2008 - 2014
// this work is public domain. the code is undocumented, scruffy, untested, and should generally not be used for anything important.
// i do not offer support, so don't ask. to be used for inspiration :)

#ifndef _HPP_THREAD
#define _HPP_THREAD

#include "defines.hpp"

#include "types/messagequeue.hpp"
#include "types/lockable.hpp"

#include "boost/thread.hpp"

#ifdef __EMSCRIPTEN__
#include <vector>
#include <algorithm>
namespace blunted {
  class Thread;
  // wasm is single-threaded: engine "threads" register here and are pumped
  // cooperatively from the main loop / blocking Wait()s instead of spawning.
  void CoopRegister(Thread *t);
  void CoopUnregister(Thread *t);
  bool CoopPumpAll();  // returns true if any message was processed this pass
}
#endif

namespace blunted {

  enum e_ThreadState {
    e_ThreadState_Idle,
    e_ThreadState_Sleeping,
    e_ThreadState_Busy,
    e_ThreadState_Exiting
  };

  class Thread {

    public:
      Thread() {
      }

      virtual ~Thread() {
      }

      e_ThreadState GetState() { // ATOMIC
        state.Lock();
        e_ThreadState curstate = state.data;
        state.Unlock();
        return curstate;
      }

      void SetState(e_ThreadState newState) { // ATOMIC
        state.Lock();
        state.data = newState;
        state.Unlock();
      }


      // --- USE WITH CARE: USER LOCKING RESPONSIBILITY

      void LockState() {
        state.Lock();
      }

      e_ThreadState GetState_NoLock() {
        return state.data;
      }

      void SetState_NoLock(e_ThreadState newState) {
        state.data = newState;
      }

      void UnlockState() {
        state.Unlock();
      }

      // --- /CARE


      void Run() {
#ifdef __EMSCRIPTEN__
        // don't spawn: set up once, then run cooperatively from the main loop
        CoopStart();
        CoopRegister(this);
#else
        thread = boost::thread(boost::ref( *this ));
#endif
      }

      void Join() {
#ifdef __EMSCRIPTEN__
        CoopUnregister(this);
#else
        thread.join();
#endif
      }

      // thread main loop
      virtual void operator()() = 0;

#ifdef __EMSCRIPTEN__
      // one-time setup a native thread would do before its loop (e.g. SDL_Init)
      virtual void CoopStart() {}
      // one cooperative step; base = drain pending messages. returns true if it
      // did work. single-inheritance chains root at Thread, so `this` is the
      // same address the derived operator() would pass to Command::Handle.
      virtual bool CoopIterate() { return DrainMessages(); }
      bool DrainMessages() {
        bool did = false, avail = true;
        while (avail) {
          boost::intrusive_ptr<Command> m = messageQueue.GetMessage(avail);
          if (avail && m.get()) {
            SetState(e_ThreadState_Busy);
            m->Handle(this);
            m.reset();
            SetState(e_ThreadState_Idle);
            did = true;
          }
        }
        return did;
      }
#endif

      MessageQueue < boost::intrusive_ptr<Command> > messageQueue;

      boost::thread thread;

    protected:
      Lockable<e_ThreadState> state;

  };

#ifdef __EMSCRIPTEN__
  inline std::vector<Thread *> &CoopThreads() {
    static std::vector<Thread *> v;
    return v;
  }
  inline void CoopRegister(Thread *t) { CoopThreads().push_back(t); }
  inline void CoopUnregister(Thread *t) {
    auto &v = CoopThreads();
    v.erase(std::remove(v.begin(), v.end(), t), v.end());
  }
  inline bool CoopPumpAll() {
    bool did = false;
    // copy: a handler may (un)register cooperative threads while we iterate
    std::vector<Thread *> snapshot = CoopThreads();
    for (Thread *t : snapshot) if (t) did |= t->CoopIterate();
    return did;
  }
#endif


  // messages

  class Message_Shutdown : public Command {

    public:
      Message_Shutdown() : Command("shutdown") {};

    protected:
      virtual bool Execute(void *caller = NULL) {
        return false;
      }

  };

}

#endif
