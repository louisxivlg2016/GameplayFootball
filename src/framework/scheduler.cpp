// written by bastiaan konings schuiling 2008 - 2014
// this work is public domain. the code is undocumented, scruffy, untested, and should generally not be used for anything important.
// i do not offer support, so don't ask. to be used for inspiration :)

#include "scheduler.hpp"

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include "types/thread.hpp"  // CoopPumpAll
// Yield until the browser's next paint (requestAnimationFrame) instead of a bare
// setTimeout. This aligns each rendered frame with the compositor so it only
// presents complete frames — kills the flicker. Needs ASYNCIFY (enabled).
EM_ASYNC_JS(void, gpf_raf_yield, (), {
  await new Promise(function(resolve){ requestAnimationFrame(resolve); });
});
#endif

#include "managers/resourcemanagerpool.hpp"
#include "managers/environmentmanager.hpp"
#include "managers/taskmanager.hpp"
#include "base/log.hpp"

namespace blunted {

#ifdef __EMSCRIPTEN__
  // set by OpenGLRenderer3D::SwapBuffers() — a full frame was just submitted
  extern bool gpf_frameSwapped;
#endif

  Scheduler::Scheduler(TaskManager *taskManager) : taskManager(taskManager) {
    cleanUpTimeOffset = 0;
    previousTime_ms = 0;
  }

  Scheduler::~Scheduler() {
  }

  void Scheduler::Exit() {

    if (GetSequenceCount() != 0) { // shouldn't happen
      sequences.Lock();
      for (unsigned int i = 0; i < sequences.data.size(); i++) {
        printf("sequence '%s' is stuck on entry #%i!\n", sequences.data.at(i)->taskSequence->GetName().c_str(), sequences.data.at(i)->programCounter);
      }
      sequences.Unlock();
    }
    assert(GetSequenceCount() == 0);
  }

  int Scheduler::GetSequenceCount() {
    sequences.Lock();
    int size = sequences.data.size();
    sequences.Unlock();
    return size;
  }

  void Scheduler::RegisterTaskSequence(boost::shared_ptr<TaskSequence> sequence) {
    if (sequence->GetEntryCount() == 0) Log(e_FatalError, "Scheduler", "RegisterTaskSequence", "Trying to add a sequence without entries");
    sequence->AddTerminator();
    boost::shared_ptr<TaskSequenceProgram> program(new TaskSequenceProgram());
    unsigned long time_ms = EnvironmentManager::GetInstance().GetTime_ms();
    program->taskSequence = sequence;
    program->programCounter = 0;
    program->previousProgramCounter = -1;
    program->sequenceStartTime = time_ms;
    program->lastSequenceTime = 0;
    program->startTime = time_ms;
    program->timesRan = 0;
    program->paused = false;
    program->dueQuit = false;
    program->readyToQuit = false;
    sequences.Lock();
    sequences.data.push_back(program);
    sequences.Unlock();
  }

  void Scheduler::UnregisterTaskSequence(boost::shared_ptr<TaskSequence> sequence) {
    // todo
  }

  void Scheduler::UnregisterTaskSequence(const std::string &name) {
    sequences.Lock();
    for (unsigned int i = 0; i < sequences.data.size(); i++) {
      boost::shared_ptr<TaskSequenceProgram> program = sequences.data.at(i);
      if (program->taskSequence->GetName() == name) {
        program->dueQuit = true;
        break;
      }
    }
    sequences.Unlock();
  }

  void Scheduler::PauseTaskSequence(const std::string &name) {
    sequences.Lock();
    for (unsigned int i = 0; i < sequences.data.size(); i++) {
      boost::shared_ptr<TaskSequenceProgram> program = sequences.data.at(i);
      if (program->taskSequence->GetName() == name) {
        program->paused = true;
        break;
      }
    }
    sequences.Unlock();
  }

  void Scheduler::UnpauseTaskSequence(const std::string &name) {
    sequences.Lock();
    for (unsigned int i = 0; i < sequences.data.size(); i++) {
      boost::shared_ptr<TaskSequenceProgram> program = sequences.data.at(i);
      if (program->taskSequence->GetName() == name) {
        program->paused = false;
        break;
      }
    }
    sequences.Unlock();
  }

  void Scheduler::ResetTaskSequenceTime(const std::string &name) {
    sequences.Lock();
    for (unsigned int i = 0; i < sequences.data.size(); i++) {
      boost::shared_ptr<TaskSequenceProgram> program = sequences.data.at(i);
      if (program->taskSequence->GetName() == name) {
        program->startTime = EnvironmentManager::GetInstance().GetTime_ms();// - startTime_ms;
        program->timesRan = 0;
        break;
      }
    }
    sequences.Unlock();
  }

  unsigned long Scheduler::GetTaskSequenceTime_ms(const std::string &name) {
    unsigned int resultTime_ms = 0;
    sequences.Lock();
    for (unsigned int i = 0; i < sequences.data.size(); i++) {
      boost::shared_ptr<TaskSequenceProgram> program = sequences.data.at(i);
      if (program->taskSequence->GetName() == name) {

        if (program->taskSequence->GetSkippable()) {
          resultTime_ms = program->sequenceStartTime + program->taskSequence->GetSequenceTime();
        } else {
          resultTime_ms = program->startTime + program->taskSequence->GetSequenceTime() * program->timesRan;
        }

        break;
      }
    }
    sequences.Unlock();
    return resultTime_ms;
  }

  TaskSequenceInfo Scheduler::GetTaskSequenceInfo(const std::string &name) {
    TaskSequenceInfo info;
    sequences.Lock(); // todo: cache this to overcome threading traffic slowdowns?
    for (unsigned int i = 0; i < sequences.data.size(); i++) {
      boost::shared_ptr<TaskSequenceProgram> program = sequences.data.at(i);
      if (program->taskSequence->GetName() == name) {

        info.sequenceStartTime_ms = program->sequenceStartTime;
        info.lastSequenceTime_ms = program->lastSequenceTime;
        info.startTime_ms = program->startTime;
        info.sequenceTime_ms = program->taskSequence->GetSequenceTime();
        info.timesRan = program->timesRan;

        break;
      }
    }
    sequences.Unlock();
    return info;
  }

  bool Scheduler::Run() {

    bool verbose = false;

    // sequenced version, the best yet!
    // thought up by Jurian Broertjes & Bastiaan Konings Schuiling

    boost::mutex::scoped_lock lock(somethingIsDoneMutex);

    unsigned int firstSequence = 0;
    int quiterations = 0;
    bool sequencesQuitMessageDone = false;

    while (EnvironmentManager::GetInstance().GetQuit() == false || GetSequenceCount() > 0) {

      if (EnvironmentManager::GetInstance().GetQuit()) {

        // let sequences finish
        if (!sequencesQuitMessageDone) {
          sequences.Lock();
          for (unsigned int i = 0; i < sequences.data.size(); i++) {
            sequences.data.at(i)->dueQuit = true;
          }
          sequences.Unlock();
          sequencesQuitMessageDone = true;
        }

        // check if we're stuck
        if (sequencesQuitMessageDone && GetSequenceCount() > 0) {
          quiterations++;
          if (quiterations > 1000) {
            // something won't shut up!
            sequences.Lock();
            for (unsigned int i = 0; i < sequences.data.size(); i++) {
              printf("sequence '%s' is stuck on entry #%i!\n", sequences.data.at(i)->taskSequence->GetName().c_str(), sequences.data.at(i)->programCounter);
            }
            sequences.Unlock();
            quiterations = 0;
          }
        }
      }

      unsigned long time_ms = EnvironmentManager::GetInstance().GetTime_ms();
      unsigned long timeDiff_ms = time_ms - previousTime_ms;
      previousTime_ms = time_ms;

      cleanUpTimeOffset += timeDiff_ms;


      // find first sequence entry that needs to be started

      TaskSequenceQueueEntry dueEntry;

      sequences.Lock();

#ifdef __EMSCRIPTEN__
      // How far behind is the fixed-step simulation (max debt over non-skippable,
      // not-in-progress sequences)? Used below to defer STARTING a render while the
      // sim needs to catch up — the single biggest lever against slow motion on a
      // CPU-saturated browser (the sim is the priority; a render can wait, bounded
      // by the sequence's maxDeferTime so visuals never freeze).
      long gpfSimDebt_ms = 0;
      for (unsigned int i = 0; i < sequences.data.size(); i++) {
        boost::shared_ptr<TaskSequenceProgram> p = sequences.data.at(i);
        if (p->taskSequence->GetSkippable() || p->paused || p->dueQuit) continue;
        if (p->programCounter != 0) { gpfSimDebt_ms = 0x7fffffff; break; } // already running the sim
        long debt = (long)time_ms - (long)(p->startTime + p->taskSequence->GetSequenceTime() * p->timesRan);
        if (debt > gpfSimDebt_ms) gpfSimDebt_ms = debt;
      }
      const long kSimDebtThreshold_ms = 20;
#endif

      bool someSequenceNeedsDeleting = false;

      for (unsigned int i = 0; i < sequences.data.size(); i++) {
        int programIndex = (i + firstSequence) % sequences.data.size();
        boost::shared_ptr<TaskSequenceProgram> program = sequences.data.at(programIndex);

        if (verbose) printf("sequence %i, previous program counter %i, program counter %i\n", i, program->previousProgramCounter, program->programCounter);

        // check if previous entry is ready
        bool previousEntryIsReady = true;
        if (program->previousProgramCounter != -1) {

          previousEntryIsReady = program->taskSequence->GetEntry(program->previousProgramCounter)->IsReady();

          if (previousEntryIsReady && program->programCounter == program->taskSequence->GetEntryCount()) {
            program->programCounter = 0;
            program->timesRan++;
            program->lastSequenceTime = time_ms - program->sequenceStartTime;
          }

        }

        if (verbose) {
          if (previousEntryIsReady) {
            printf("sequence %i counter %i is ready\n", programIndex, program->previousProgramCounter);
          } else {
            printf("sequence %i counter %i is not ready\n", programIndex, program->previousProgramCounter);
          }
        }

        if (previousEntryIsReady) {

          long timeUntilDueEntry_ms = 0; // if programCounter != 0, we just want to start the next entry ASAP
          bool gpfDeferStart = false;    // (emscripten) hold off STARTING this render so the sim can catch up

          if (program->programCounter == 0) { // else, (re)starting sequence; find out when it's due

            if (program->dueQuit == true) {

              program->readyToQuit = true;
              someSequenceNeedsDeleting = true;

            } else if (program->paused == true) {

              if (!program->taskSequence->GetSkippable()) program->startTime += timeDiff_ms;

            } else { // not quitting or paused

              if (program->taskSequence->GetSkippable()) {
                // use relative time: don't mind if last frame lasted too long
                timeUntilDueEntry_ms = (program->sequenceStartTime + program->taskSequence->GetSequenceTime()) - time_ms;
                //printf("wiieee: %i .. %li .. %li\n", program->taskSequence->GetFrameTime(), time_ms, startTimeRel_ms);
#ifdef __EMSCRIPTEN__
                // Sim-first admission: if the fixed-step sim is behind, don't START a
                // new (expensive) render yet — let the sim catch up. But never defer a
                // render longer than maxDeferTime since it last started, so a machine
                // that can't keep up still shows progress (floor against a frozen canvas).
                const int maxDefer = program->taskSequence->GetMaxDeferTime();
                if (maxDefer > 0 && gpfSimDebt_ms >= kSimDebtThreshold_ms &&
                    (long)(time_ms - program->sequenceStartTime) < (long)maxDefer) {
                  gpfDeferStart = true;
                }
#endif
              } else {
                // use absolute time: if not enough iterations have been done to get to frametime * timesran, start immediately
                timeUntilDueEntry_ms = (program->startTime + program->taskSequence->GetSequenceTime() * program->timesRan) - time_ms;
                //printf("wiieee: %i .. %li .. %li\n", program->taskSequence->GetSequenceTime(), time_ms, timeUntilDueEntry_ms);
              }

            }

          }

          if (!program->readyToQuit && !program->paused && !gpfDeferStart && (timeUntilDueEntry_ms < dueEntry.timeUntilDueEntry_ms || dueEntry.program == boost::shared_ptr<TaskSequenceProgram>())) {
            dueEntry.program = program;
            dueEntry.timeUntilDueEntry_ms = timeUntilDueEntry_ms;
          }

        }

      } // checked all sequences and (hopefully) found an entry that is due next


      // delete sequences that are ready to pussy out

      if (someSequenceNeedsDeleting) {

        std::vector < boost::shared_ptr<TaskSequenceProgram> >::iterator quiterator = sequences.data.begin();
        while (quiterator != sequences.data.end()) {
          boost::shared_ptr<TaskSequenceProgram> program = *quiterator;
          if (program->readyToQuit == true) {
            quiterator = sequences.data.erase(quiterator);
          } else {
            quiterator++;
          }
        }

        // sequences.Unlock();
        // continue;

      } else { // (no deletes)

        // switch first sequence to handle next time (so they all get a turn)
        // todo: this way, longer sequences get relatively less time in total. is this desirable?
        firstSequence++;
        if (firstSequence >= sequences.data.size()) firstSequence = 0;

        long timeout_ms = 0;
        if (dueEntry.program != boost::shared_ptr<TaskSequenceProgram>()) {
          // wait until time for due sequence entry (even if that is <= 0, because we need to unlock the condition and sequences locks anyway)
          timeout_ms = dueEntry.timeUntilDueEntry_ms;
          timeout_ms = std::max(timeout_ms, (long)0);
        } else {
          timeout_ms = 100; // wait for wakeup signal
        }

        sequences.Unlock();
#ifdef __EMSCRIPTEN__
        // single-threaded browser: no worker will signal us, and we must NOT
        // block the main thread. Pump the cooperative threads (renderer, etc.).
        (void)lock;
        gpf_frameSwapped = false;
        CoopPumpAll();  // may run a full render (sets gpf_frameSwapped) + expensive work
        // Hand control to the browser paint at the RIGHT moment. The old code used
        // `timeout_ms` (computed BEFORE the pump, so stale after a long render) and
        // an arbitrary 400-pass fallback — which, once the fixed-step sim fell behind,
        // starved presentation to once per dozens of ticks (the harsh "fast then very
        // slow" drop) AND wasted a whole paint of CPU on a stale idle guess. Instead:
        //  - yield right after a real frame SWAP (present a COMPLETE frame, no flicker);
        //  - during long catch-up/loading with no swap, yield at least every
        //    kBrowserBudgetMs so the tab never freezes;
        //  - otherwise keep running passes so overdue fixed sim steps catch up
        //    (recovering the capacity the stale-timeout yield used to throw away).
        static unsigned long lastYield_ms = 0;
        const unsigned long kBrowserBudgetMs = 100;
        unsigned long nowYield_ms = EnvironmentManager::GetInstance().GetTime_ms();
        if (gpf_frameSwapped || (nowYield_ms - lastYield_ms) >= kBrowserBudgetMs) {
          gpf_frameSwapped = false;
          lastYield_ms = nowYield_ms;
          gpf_raf_yield();  // present at the next browser paint
        }
        bool isMessage = true;
#else
        boost::system_time tAbsoluteTime = boost::get_system_time() + boost::posix_time::milliseconds(timeout_ms);
        bool isMessage = somethingIsDone.timed_wait(lock, tAbsoluteTime);
#endif
        sequences.Lock();

        if (dueEntry.program != boost::shared_ptr<TaskSequenceProgram>()) {

          if (verbose) printf("time until due entry: %li\n", dueEntry.timeUntilDueEntry_ms);

          if (dueEntry.timeUntilDueEntry_ms <= 0) { // the first and/or other entries are due

            // run!
            if (dueEntry.program->programCounter == 0) {
              dueEntry.program->sequenceStartTime = time_ms;
            }

            if (verbose) printf("executing program counter %i\n", dueEntry.program->programCounter);
            dueEntry.program->taskSequence->GetEntry(dueEntry.program->programCounter)->Reset();
            dueEntry.program->taskSequence->GetEntry(dueEntry.program->programCounter)->Execute();

            dueEntry.program->previousProgramCounter = dueEntry.program->programCounter;
            dueEntry.program->programCounter++;

          }

        }

      }

      sequences.Unlock();


      // cleanup unused resources

      if (cleanUpTimeOffset > 5000) { // every 5 seconds
        //printf("cleanup..\n");
        ResourceManagerPool::GetInstance().CleanUp();
        cleanUpTimeOffset = 0;
      }

    }

    return true;
  }


}
