// written by bastiaan konings schuiling 2008 - 2015
// this work is public domain. the code is undocumented, scruffy, untested, and should generally not be used for anything important.
// i do not offer support, so don't ask. to be used for inspiration :)

#include "referee.hpp"

#include "scene/objectfactory.hpp"
#include "managers/resourcemanagerpool.hpp"

#include "match.hpp"
#include "wasm_radio_bridge.hpp"
#include "AIsupport/AIfunctions.hpp"

#include "../main.hpp"

Referee::Referee(Match *match) : match(match) {
  buffer.desiredSetPiece = e_SetPiece_KickOff;
  buffer.teamID = 0;
  buffer.stopTime = 0;
  buffer.prepareTime = 0;
  buffer.startTime = buffer.prepareTime + 2000;
  buffer.restartPos = Vector3(0);
  buffer.taker = 0;
  buffer.endPhase = true;
  buffer.active = true;

  foul.foulPlayer = 0;
  foul.foulType = 0;
  foul.advantage = false;
  foul.foulTime = 0;
  foul.hasBeenProcessed = true;

  afterSetPieceRelaxTime_ms = 0;

  drillType = e_SetPiece_None;
  drillTeam = 0;
  drillReps = 0;
  drillWaitUntil = 0;
  drillKeeper = false;
  drillShotFireTime = 0;
  humanKeeperTeam = -1;
  humanOffsideKickTeam = -1;
  humanPenaltyTeam = -1;

  shootoutActive = false;
  shootoutKicker = 1;
  shootoutTaken[0] = shootoutTaken[1] = 0;
  shootoutScore[0] = shootoutScore[1] = 0;
  shootoutSnapGoals[0] = shootoutSnapGoals[1] = 0;
  shootoutFireTime = 0;
  shootoutResolveTime = 0;
  shootoutPending = false;


  // whistle

  boost::intrusive_ptr < Resource<SoundBuffer> > soundBufferRes = ResourceManagerPool::GetInstance().GetManager<SoundBuffer>(e_ResourceType_SoundBuffer)->Fetch("media/sounds/whistle2.wav", true, true);
  whistle[1] = boost::static_pointer_cast<Sound>(ObjectFactory::GetInstance().CreateObject("whistle1", e_ObjectType_Sound));
  GetScene3D()->CreateSystemObjects(whistle[1]);
  whistle[1]->SetSoundBuffer(soundBufferRes);
  //whistle[1]->SetGain(0.3 * GetConfiguration()->GetReal("audio_volume", 0.5));
  whistle[1]->SetLoop(false);
  GetScene3D()->AddObject(whistle[1]);

  soundBufferRes = ResourceManagerPool::GetInstance().GetManager<SoundBuffer>(e_ResourceType_SoundBuffer)->Fetch("media/sounds/whistle3.wav", true, true);
  whistle[3] = boost::static_pointer_cast<Sound>(ObjectFactory::GetInstance().CreateObject("whistle3", e_ObjectType_Sound));
  GetScene3D()->CreateSystemObjects(whistle[3]);
  whistle[3]->SetSoundBuffer(soundBufferRes);
  //whistle[3]->SetGain(0.3 * GetConfiguration()->GetReal("audio_volume", 0.5));
  whistle[3]->SetLoop(false);
  GetScene3D()->AddObject(whistle[3]);

  // for usage in destructor
  scene3D = GetScene3D();
}

Referee::~Referee() {
  if (Verbose()) printf("exiting referee.. ");

  scene3D->DeleteObject(whistle[1]);
  scene3D->DeleteObject(whistle[3]);
  whistle[1].reset();
  whistle[3].reset();

  if (Verbose()) printf("done\n");
}

void Referee::Process() {
  //printf("%i", match->GetMatchState());

  // Final whistle (full time, or the shootout just decided it): nothing may
  // restart. Without this the set-piece/kickoff machinery kept running for a
  // moment and the match visibly played on after it was already over.
  if (match->IsGameOver()) return;

  // training drill: once an attempt is over, re-force the same set piece,
  // drillReps times, then end the drill (normal play resumes) and notify the page.
  if (drillType != e_SetPiece_None && drillWaitUntil != 0 &&
      match->GetActualTime_ms() >= drillWaitUntil) {
    drillWaitUntil = 0;
    if (drillReps > 1) {
      drillReps--;
      ForceSetPiece(drillType, drillTeam);
    } else {
      drillType = e_SetPiece_None;
      drillKeeper = false;
#ifdef __EMSCRIPTEN__
      EM_ASM({ try { if (window.gpfDrillDone) window.gpfDrillDone(); } catch (e) {} });
#endif
    }
  }

#ifdef __EMSCRIPTEN__
  // during the pre-match anthem ceremony, hold the kickoff countdown: the buffer
  // times fire on exact equality with actualTime, so push them one tick per tick.
  if (match->IsCeremonyActive() && buffer.active) {
    buffer.stopTime += 10;
    buffer.prepareTime += 10;
    buffer.startTime += 10;
  }
#endif

  // keeper drill: the bot's penalty is SCRIPTED so it can never get stuck waiting
  // on a controller. Fire it toward a random spot in the human's goal, then clear
  // the set piece so the (human) keeper reacts and the next attempt is scheduled.
  if (drillKeeper && drillShotFireTime != 0 && match->GetActualTime_ms() >= drillShotFireTime) {
    drillShotFireTime = 0;
    signed int oppSide = match->GetTeam(1 - drillTeam)->GetSide(); // human / keeper goal side
    Vector3 from = match->GetBall()->Predict(0).Get2D();
    Vector3 aimSpot = Vector3(pitchHalfW * oppSide, random(-3.0f, 3.0f), random(1.0f, 2.4f));
    Vector3 vel = (aimSpot - from).GetNormalized(Vector3(oppSide, 0, 0)) * (22.0f + random(0.0f, 5.0f));
    match->GetBall()->Touch(vel);
    match->GetBall()->SetRotation(0, 0, 0, 1);
    NotifyDrillShotTaken();
  }

  // penalty shootout: drive its own kick sequence (fire AI shots, judge results,
  // alternate, end). The set-piece countdown (below, in the not-in-play branch)
  // still runs so each penalty prepares/whistles and the human take/keep UI arms;
  // only the in-play RESTART logic (kickoff after a goal, throw-ins/corners on a
  // miss that goes out) is suppressed, or it would break the alternation.
  ProcessShootout();

  if (!shootoutActive && match->IsInPlay() && !match->IsInSetPiece()) {

    Vector3 ballPos = match->GetBall()->Predict(0);


    // some phase is over :[

    // a half now runs to regulation time PLUS the stoppage time granted for it,
    // so the announced "3 minutes of added time" is actually played.
    const unsigned long added = match->GetAddedTime_ms();
    if (((match->GetMatchPhase() == e_MatchPhase_1stHalf && match->GetMatchTime_ms() > 2700000 + added) ||
         (match->GetMatchPhase() == e_MatchPhase_2ndHalf && match->GetMatchTime_ms() > 5400000 + added) ||
         (match->GetMatchPhase() == e_MatchPhase_1stExtraTime && match->GetMatchTime_ms() > 6300000 + added) ||
         (match->GetMatchPhase() == e_MatchPhase_2ndExtraTime && match->GetMatchTime_ms() > 7200000 + added)) &&
        ballPos.coords[0] < 10 && ballPos.coords[0] > -10) {

      foul.advantage = false;
      if (!CheckFoul()) {

        match->StopPlay();
        whistle[3]->SetGain(0.3 * GetConfiguration()->GetReal("audio_volume", 0.5));
        whistle[3]->Poke(e_SystemType_Audio);

        buffer.desiredSetPiece = e_SetPiece_KickOff;
        buffer.stopTime = match->GetActualTime_ms();
        buffer.prepareTime = match->GetActualTime_ms() + 3000;
        buffer.startTime = buffer.prepareTime + 2000;
        buffer.restartPos = Vector3(0);
        buffer.active = true;
        buffer.endPhase = true;
        if (match->GetMatchPhase() == e_MatchPhase_1stHalf || match->GetMatchPhase() == e_MatchPhase_1stExtraTime) {
          buffer.teamID = 1;
        } else {
          buffer.teamID = 0;
        }

        e_MatchPhase nextPhase;
        if (match->GetMatchPhase() == e_MatchPhase_1stHalf) nextPhase = e_MatchPhase_2ndHalf;
        if (match->GetMatchPhase() == e_MatchPhase_2ndHalf) nextPhase = e_MatchPhase_1stExtraTime;
        if (match->GetMatchPhase() == e_MatchPhase_1stExtraTime) nextPhase = e_MatchPhase_2ndExtraTime;
        if (match->GetMatchPhase() == e_MatchPhase_2ndExtraTime) nextPhase = e_MatchPhase_Penalties;
        match->SetMatchPhase(nextPhase);
      }
    }


    // goal kick / corner

    if (fabs(ballPos.coords[0]) > pitchHalfW + lineHalfW + 0.11) {

      foul.advantage = false;
      bool isFoul = false;
      if (!match->IsGoalScored()) isFoul = CheckFoul(); else foul.foulType = 0;
      if (isFoul == false) {

        match->StopPlay();

        // corner, goal kick or kick off?
        signed int lastSide = -1;
        Team *lastTouchTeam = match->GetLastTouchTeam();
        if (lastTouchTeam == 0) lastTouchTeam = match->GetTeam(0);
        // A defender who merely GRAZED the ball on its way out concedes a corner —
        // the engine only counts a full geometric collision, so a light deflection
        // was wrongly rewarded with a goal kick.
        {
          extern int gpf_grazeTeam;
          extern unsigned long gpf_grazeTime_ms;
          if (gpf_grazeTeam >= 0 && match->GetActualTime_ms() - gpf_grazeTime_ms < 1500) {
            Team *gt = match->GetTeam(gpf_grazeTeam);
            if (gt && ((ballPos.coords[0] > 0 && gt->GetSide() > 0) ||
                       (ballPos.coords[0] < 0 && gt->GetSide() < 0))) {
              lastTouchTeam = gt; // defending side touched it last -> corner
            }
          }
        }
        lastSide = lastTouchTeam->GetSide();

        if (match->IsGoalScored()) {
          buffer.desiredSetPiece = e_SetPiece_KickOff;
          buffer.stopTime = match->GetActualTime_ms();
          buffer.prepareTime = match->GetActualTime_ms() + 6000;
          buffer.startTime = buffer.prepareTime + 2000;
          buffer.restartPos = Vector3(0, 0, 0);
          buffer.teamID = abs(match->GetLastGoalTeamID() - 1);

        } else if ((ballPos.coords[0] > 0 && lastSide > 0) || (ballPos.coords[0] < 0 && lastSide < 0)) {
          buffer.desiredSetPiece = e_SetPiece_Corner;
          buffer.stopTime = match->GetActualTime_ms();
          buffer.prepareTime = match->GetActualTime_ms() + 2000;
          buffer.startTime = buffer.prepareTime + 2000;
          float y = ballPos.coords[1];
          if (y > 0) y = pitchHalfH; else
                     y = -pitchHalfH;
          buffer.restartPos = Vector3(pitchHalfW * lastSide, y, 0);
          buffer.teamID = abs(lastTouchTeam->GetID() - 1);

        } else {
          buffer.desiredSetPiece = e_SetPiece_GoalKick;
          buffer.stopTime = match->GetActualTime_ms();
          buffer.prepareTime = match->GetActualTime_ms() + 2000;
          buffer.startTime = buffer.prepareTime + 2000;
          buffer.restartPos = Vector3(pitchHalfW * 0.92 * -lastSide, 0, 0);
          buffer.teamID = abs(lastTouchTeam->GetID() - 1);
        }

        buffer.active = true;
#ifdef __EMSCRIPTEN__
        { // new restart -> the referee must whistle for it again
          extern bool gpf_refereeMode, gpf_refWhistleGiven, gpf_refAwaitingWhistle;
          if (gpf_refereeMode) { gpf_refWhistleGiven = false; gpf_refAwaitingWhistle = false; }
        }
#endif
        // browser radio (kickoff-after-goal is covered by the "goal" event)
        if (buffer.desiredSetPiece == e_SetPiece_Corner) {
          gpfRadioEvent("corner", "", buffer.teamID);
#ifdef __EMSCRIPTEN__
          // human's team takes the corner -> same close corner camera + trace as
          // the training corner (the corner camera is chosen in UpdateIngameCamera).
          if (match->GetTeam(buffer.teamID)->GetHumanGamerCount() > 0)
            humanOffsideKickTeam = buffer.teamID;
#endif
        }
        else if (buffer.desiredSetPiece == e_SetPiece_GoalKick) {
          gpfRadioEvent("goalkick");
#ifdef __EMSCRIPTEN__
          // human's team takes the goal kick -> close (penalty-style) camera +
          // trace-to-pass toward a team-mate (reuses the offside-kick machinery).
          if (match->GetTeam(buffer.teamID)->GetHumanGamerCount() > 0)
            humanOffsideKickTeam = buffer.teamID;
#endif
        }
      }
    }


    // over sideline

    if (afterSetPieceRelaxTime_ms == 0) {
      if (fabs(ballPos.coords[1]) > pitchHalfH + lineHalfW + 0.11) {
        foul.advantage = false;
        if (!CheckFoul()) {
          match->StopPlay();
          Team *lastTouchTeam = match->GetLastTouchTeam();
          if (lastTouchTeam == 0) lastTouchTeam = match->GetTeam(0);
          buffer.teamID = abs(lastTouchTeam->GetID() - 1);
          buffer.desiredSetPiece = e_SetPiece_ThrowIn;
          buffer.stopTime = match->GetActualTime_ms();
          buffer.prepareTime = match->GetActualTime_ms() + 2000;
          buffer.startTime = buffer.prepareTime + 2000;
          buffer.restartPos.coords[0] = clamp(ballPos.coords[0], -pitchHalfW + 0.6f, pitchHalfW - 0.6f);
          if (ballPos.coords[1] >  0) buffer.restartPos.coords[1] = pitchHalfH;
          if (ballPos.coords[1] <= 0) buffer.restartPos.coords[1] = -pitchHalfH;
          buffer.restartPos.coords[2] = 0;
          buffer.active = true;
          gpfRadioEvent("throwin", "", buffer.teamID);
#ifdef __EMSCRIPTEN__
          // human's team takes the throw-in -> close (penalty-style) camera +
          // trace-to-pass toward a team-mate.
          if (match->GetTeam(buffer.teamID)->GetHumanGamerCount() > 0)
            humanOffsideKickTeam = buffer.teamID;
#endif
        }
      }
    }

    CheckFoul();

  } else { // not in play, maybe something needs to happen?

    if (!match->IsInPlay() && !match->IsInSetPiece() && buffer.active == true) {

      if (buffer.stopTime + 300 == match->GetActualTime_ms() && buffer.endPhase == false && buffer.desiredSetPiece != e_SetPiece_KickOff) {
        whistle[1]->SetGain(0.3 * GetConfiguration()->GetReal("audio_volume", 0.5));
        whistle[1]->Poke(e_SystemType_Audio);
      }

      if (buffer.prepareTime == match->GetActualTime_ms()) {

        if (buffer.endPhase == true) {
          if (match->GetMatchPhase() == e_MatchPhase_PreMatch) {
            match->SetMatchPhase(e_MatchPhase_1stHalf);
          } else {
            // game over conditions
            if (match->GetMatchPhase() == e_MatchPhase_1stExtraTime) {
              if (match->GetScore(0) != match->GetScore(1)) {
                match->GameOver();
                return;
              }
            }
            if (match->GetMatchPhase() == e_MatchPhase_Penalties) {
              // still level after extra time -> a real penalty shootout instead
              // of ending on a draw. If a late ET goal broke the tie, just end.
              if (match->GetScore(0) == match->GetScore(1)) {
                StartShootout();
              } else {
                match->GameOver();
              }
              return;
            }
            match->sig_OnMatchPhaseChange(match);
          }
          buffer.endPhase = false;
        }

        PrepareSetPiece(buffer.desiredSetPiece);
      }

#ifdef __EMSCRIPTEN__
      // REFEREE MODE: hold the restart until the human referee whistles. We only
      // push back startTime (never prepareTime), so the players still walk to
      // their positions and simply wait for the whistle, like the real thing.
      {
        extern bool gpf_refereeMode, gpf_refAwaitingWhistle, gpf_refWhistleGiven;
        if (gpf_refereeMode && !match->IsCeremonyActive()) {
          if (!gpf_refWhistleGiven && buffer.startTime <= match->GetActualTime_ms()) {
            gpf_refAwaitingWhistle = true;
            buffer.startTime = match->GetActualTime_ms() + 10; // keep waiting
          }
        }
      }
#endif
      if (buffer.startTime == match->GetActualTime_ms()) {
        // blow whistle and wait for set piece taker to touch the ball
        whistle[1]->SetGain(0.3 * GetConfiguration()->GetReal("audio_volume", 0.5));
        whistle[1]->Poke(e_SystemType_Audio);
        match->StartPlay();
        match->StartSetPiece();
#ifdef __EMSCRIPTEN__
        // training drill: the ball is now live. Keeper drill arms the dive arrows;
        // shooter drill arms the aim curve.
        if (drillType != e_SetPiece_None) {
          if (drillKeeper)
            EM_ASM({ try { if (window.gpfKeeperReady) window.gpfKeeperReady(); } catch (e) {} });
          else
            EM_ASM({ try { if (window.gpfDrillReady) window.gpfDrillReady(); } catch (e) {} });
        } else if (buffer.desiredSetPiece == e_SetPiece_Penalty) {
          // In-match penalty: if the OPPONENT is taking it and the human's team is
          // defending, let the player keep — same dive-arrow UI as the keeper drill.
          int shooterTeam = buffer.teamID;
          int keeperTeam = 1 - shooterTeam;
          if (match->GetTeam(keeperTeam)->GetHumanGamerCount() > 0 &&
              match->GetTeam(shooterTeam)->GetHumanGamerCount() == 0) {
            humanKeeperTeam = keeperTeam;
            EM_ASM({ try { if (window.gpfKeeperReady) window.gpfKeeperReady(); } catch (e) {} });
          } else if (match->GetTeam(shooterTeam)->GetHumanGamerCount() > 0) {
            // the human TAKES the penalty: arm the trace-to-shoot overlay (like the
            // penalty drill) — otherwise the taker just waits and it's stuck.
            humanPenaltyTeam = shooterTeam;
            EM_ASM({ try { if (window.gpfPenaltyReady) window.gpfPenaltyReady(); } catch (e) {} });
          }
        } else if (humanOffsideKickTeam >= 0 &&
                   (buffer.desiredSetPiece == e_SetPiece_FreeKick || buffer.desiredSetPiece == e_SetPiece_GoalKick ||
                    buffer.desiredSetPiece == e_SetPiece_ThrowIn || buffer.desiredSetPiece == e_SetPiece_Corner)) {
          // In-match free kick (CPU foul / offside) or goal kick the human takes:
          // arm the trace-to-pass overlay (close camera set in Match::UpdateIngameCamera).
          EM_ASM({ try { if (window.gpfFreekickReady) window.gpfFreekickReady(); } catch (e) {} });
        }
#endif
      }
    }
  }

  if (match->IsInSetPiece()) {
    // check if set piece has been taken
    if (buffer.taker->TouchAnim() && !buffer.taker->TouchPending()) {
      buffer.active = false;
      match->StopSetPiece();
      match->GetTeam(0)->GetController()->PrepareSetPiece(e_SetPiece_None);
      match->GetTeam(1)->GetController()->PrepareSetPiece(e_SetPiece_None);
      afterSetPieceRelaxTime_ms = 400;
      foul.foulPlayer = 0;
      foul.foulType = 0;
#ifdef __EMSCRIPTEN__
      // the penalty has been struck — put the dive arrows away and hand the
      // keeper back to the AI (the dive, if the human committed, is already under way)
      if (humanKeeperTeam >= 0) {
        humanKeeperTeam = -1;
        EM_ASM({ try { if (window.gpfKeeperDone) window.gpfKeeperDone(); } catch (e) {} });
      }
      // offside free kick taken the normal way (no trace) -> drop the trace overlay
      if (humanOffsideKickTeam >= 0) {
        humanOffsideKickTeam = -1;
        EM_ASM({ try { if (window.gpfFreekickDone) window.gpfFreekickDone(); } catch (e) {} });
      }
      // penalty taken (the taker touched the ball) -> drop the shot-trace overlay
      if (humanPenaltyTeam >= 0) {
        humanPenaltyTeam = -1;
        EM_ASM({ try { if (window.gpfPenaltyDone) window.gpfPenaltyDone(); } catch (e) {} });
      }
#endif

      if (match->GetMatchPhase() == e_MatchPhase_PreMatch) {
        match->SetMatchPhase(e_MatchPhase_1stHalf);
      }
    }
  }

  if (afterSetPieceRelaxTime_ms > 0) afterSetPieceRelaxTime_ms -= 10;
}

void Referee::PrepareSetPiece(e_SetPiece setPiece) {
  // position players for set piece situation

  match->ResetSituation(buffer.restartPos);

  match->GetTeam(0)->GetController()->PrepareSetPiece(setPiece, buffer.teamID);
  match->GetTeam(1)->GetController()->PrepareSetPiece(setPiece, buffer.teamID);

  buffer.taker = match->GetTeam(buffer.teamID)->GetController()->GetPieceTaker();
}

void Referee::BlowWhistle() {
  whistle[1]->SetGain(0.3 * GetConfiguration()->GetReal("audio_volume", 0.5));
  whistle[1]->Poke(e_SystemType_Audio);
}

void Referee::ForceSetPiece(e_SetPiece setPiece, int teamID) {
  match->StopPlay();
  // clear any lingering set piece (e.g. a post-goal kickoff whose taker we hold
  // during a drill) so this forced set piece can actually prepare.
  if (match->IsInSetPiece()) match->StopSetPiece();
  buffer.desiredSetPiece = setPiece;
  buffer.teamID = teamID;
  buffer.endPhase = false;
  buffer.stopTime = match->GetActualTime_ms();
  buffer.prepareTime = match->GetActualTime_ms() + 1000;
  buffer.startTime = buffer.prepareTime + 2000;

  // position the ball near the OPPONENT goal (the goal teamID attacks)
  signed int oppSide = match->GetTeam(1 - teamID)->GetSide();
  if (setPiece == e_SetPiece_Penalty) {
    buffer.restartPos = Vector3((pitchHalfW - 11.0) * oppSide, 0, 0);
  } else if (setPiece == e_SetPiece_Corner) {
    buffer.restartPos = Vector3(pitchHalfW * oppSide, pitchHalfH, 0);
  } else if (setPiece == e_SetPiece_FreeKick) {
    buffer.restartPos = Vector3((pitchHalfW - 25.0) * oppSide, 8.0, 0);
  } else {
    buffer.restartPos = Vector3(0, 0, 0);
  }
  buffer.active = true;

  // in a drill: schedule the next attempt a few seconds after this one is taken
  if (drillType != e_SetPiece_None) drillWaitUntil = buffer.startTime + 6000;
  // keeper drill: auto-fire the bot's penalty shortly after the whistle
  if (drillKeeper) drillShotFireTime = buffer.startTime + 2000;
}

void Referee::StartDrill(e_SetPiece setPiece, int teamID, int reps) {
  drillType = setPiece;
  drillTeam = teamID;
  drillReps = reps;
  drillKeeper = false;
  ForceSetPiece(setPiece, teamID);
}

void Referee::StartKeeperDrill(int reps) {
  // The bot takes penalties against the human's goal; the human keeps. Pick the
  // shooter = the team with no human gamers (default team 1) so the keeper is the
  // human's team; the shot itself is scripted (see Process), so it never gets
  // stuck waiting on a controller.
  int botTeam = (match->GetTeam(0)->GetHumanGamerCount() == 0) ? 0 : 1;
  drillType = e_SetPiece_Penalty;
  drillTeam = botTeam;
  drillReps = reps;
  drillKeeper = true;
  ForceSetPiece(e_SetPiece_Penalty, botTeam);
}

// ---- penalty shootout ------------------------------------------------------
// A drawn match after extra time is decided on penalties: 5 kicks each, then
// sudden death. Built on the proven set-piece machinery — the human takes with
// the trace overlay and keeps with the dive arrows; the AI's kick is SCRIPTED
// (like the keeper drill) so it can never hang waiting on a controller. Goals
// are read from the match's own goal detection (the kicking team's score going
// up), so no separate goal geometry is needed.

void Referee::StartShootout() {
  shootoutActive = true;
  shootoutScore[0] = shootoutScore[1] = 0;
  shootoutTaken[0] = shootoutTaken[1] = 0;
  shootoutFireTime = 0;
  shootoutResolveTime = 0;
  shootoutPending = false;
  // the AI side kicks first so the human opens by keeping (dramatic); if both are
  // AI (headless), team 1 first is fine too.
  shootoutKicker = (match->GetTeam(0)->GetHumanGamerCount() > 0) ? 1 : 0;
  gpfRadioEvent("shootout");
#ifdef __EMSCRIPTEN__
  EM_ASM({ try { if (window.gpfShootoutStart) window.gpfShootoutStart(); } catch (e) {} });
#endif
  ShootoutNextKick();
}

void Referee::ShootoutNextKick() {
  // clear any lingering "goal scored" celebration/flag from the previous kick so
  // the next kick's detection starts clean (the score count itself is kept).
  match->SetGoalScored(false);
  shootoutSnapGoals[0] = match->GetScore(0);
  shootoutSnapGoals[1] = match->GetScore(1);
  shootoutPending = true;
  shootoutResolveTime = 0;
  ForceSetPiece(e_SetPiece_Penalty, shootoutKicker);
  // AI taker -> script the shot a beat after the whistle (buffer.startTime was
  // just set by ForceSetPiece); human taker -> the trace UI drives it (fireTime 0).
  bool humanKicks = match->GetTeam(shootoutKicker)->GetHumanGamerCount() > 0;
  shootoutFireTime = humanKicks ? 0 : (buffer.startTime + 2500);
#ifdef __EMSCRIPTEN__
  EM_ASM({ try { if (window.gpfShootoutUpdate) window.gpfShootoutUpdate($0, $1, $2, $3, $4); } catch (e) {} },
         shootoutScore[0], shootoutScore[1], shootoutTaken[0], shootoutTaken[1], shootoutKicker);
#endif
}

bool Referee::ShootoutDecided() {
  int a = shootoutScore[0], b = shootoutScore[1];
  int ta = shootoutTaken[0], tb = shootoutTaken[1];
  // sudden death: both have taken an equal number of kicks (>=5) -> decided the
  // moment they differ.
  if (ta >= 5 && tb >= 5) return (ta == tb) && (a != b);
  // best-of-five: decided once a lead can't be caught with the kicks remaining.
  int ra = (5 - ta > 0) ? 5 - ta : 0; // team 0's remaining kicks in the first five
  int rb = (5 - tb > 0) ? 5 - tb : 0;
  if (a > b + rb) return true;
  if (b > a + ra) return true;
  return false;
}

void Referee::ShootoutHumanKickStruck() {
  // the human traced their kick (gpf_penalty_shoot -> EndPenalty); judge the
  // result once the ball has reached the goal / been saved.
  if (shootoutActive) shootoutResolveTime = match->GetActualTime_ms() + 4500;
}

void Referee::ProcessShootout() {
  if (!shootoutActive) return;
  unsigned long now = match->GetActualTime_ms();

  // AI kick: fire the scripted penalty once (mostly on target, sometimes wide/high
  // so the keeper can save/it can miss), then end the set piece so the keeper reacts.
  if (shootoutFireTime != 0 && now >= shootoutFireTime) {
    shootoutFireTime = 0;
    signed int oppSide = match->GetTeam(1 - shootoutKicker)->GetSide();
    Vector3 from = match->GetBall()->Predict(0).Get2D();
    Vector3 aimSpot = Vector3(pitchHalfW * oppSide, random(-4.2f, 4.2f), random(0.3f, 2.7f));
    Vector3 vel = (aimSpot - from).GetNormalized(Vector3(oppSide, 0, 0)) * (23.0f + random(0.0f, 4.0f));
    match->GetBall()->Touch(vel);
    match->GetBall()->SetRotation(0, 0, 0, 1);
    if (match->IsInSetPiece()) {
      buffer.active = false;
      match->StopSetPiece();
      match->GetTeam(0)->GetController()->PrepareSetPiece(e_SetPiece_None);
      match->GetTeam(1)->GetController()->PrepareSetPiece(e_SetPiece_None);
      afterSetPieceRelaxTime_ms = 400;
    }
    shootoutResolveTime = now + 4500; // judge after the ball settles
  }

  // resolve the current kick: a goal shows up as the kicking team's score rising.
  if (shootoutPending && shootoutResolveTime != 0 && now >= shootoutResolveTime) {
    shootoutResolveTime = 0;
    shootoutPending = false;
    bool scored = match->GetScore(shootoutKicker) > shootoutSnapGoals[shootoutKicker];
    if (scored) shootoutScore[shootoutKicker]++;
    shootoutTaken[shootoutKicker]++;
    gpfRadioEvent(scored ? "penGoal" : "penMiss");
#ifdef __EMSCRIPTEN__
    if (humanKeeperTeam >= 0) {
      humanKeeperTeam = -1;
      EM_ASM({ try { if (window.gpfKeeperDone) window.gpfKeeperDone(); } catch (e) {} });
    }
    EM_ASM({ try { if (window.gpfShootoutUpdate) window.gpfShootoutUpdate($0, $1, $2, $3, $4); } catch (e) {} },
           shootoutScore[0], shootoutScore[1], shootoutTaken[0], shootoutTaken[1], shootoutKicker);
#else
    if (humanKeeperTeam >= 0) humanKeeperTeam = -1;
#endif
    if (ShootoutDecided()) {
      shootoutActive = false;
      // The shootout is over: kill play RIGHT NOW. Otherwise the in-play restart
      // logic below resumes for a beat and you get a stray second of football
      // after the winning penalty.
      match->StopPlay();
      if (match->IsInSetPiece()) match->StopSetPiece();
#ifdef __EMSCRIPTEN__
      EM_ASM({ try { if (window.gpfShootoutEnd) window.gpfShootoutEnd($0, $1); } catch (e) {} },
             shootoutScore[0], shootoutScore[1]);
#endif
      match->GameOver();
      return;
    }
    shootoutKicker = 1 - shootoutKicker; // the other team is up next
    ShootoutNextKick();
  }
}

void Referee::RestartAfterCeremony() {
  // the initial kickoff's prepareTime already fired before the ceremony, so
  // re-arm the countdown from now: PrepareSetPiece runs again (players reform to
  // the kickoff formation) and the whistle follows ~2.5s later.
  buffer.stopTime = match->GetActualTime_ms();
  buffer.prepareTime = match->GetActualTime_ms() + 100;
  buffer.startTime = buffer.prepareTime + 2500;
  buffer.endPhase = false;
  buffer.active = true;
}

void Referee::NotifyDrillShotTaken() {
  if (drillType == e_SetPiece_None) return;
  // end the set-piece phase so the goalkeeper (and everyone) resume live play,
  // mirroring the normal "taker touched the ball" transition above.
  if (match->IsInSetPiece()) {
    buffer.active = false;
    match->StopSetPiece();
    match->GetTeam(0)->GetController()->PrepareSetPiece(e_SetPiece_None);
    match->GetTeam(1)->GetController()->PrepareSetPiece(e_SetPiece_None);
    afterSetPieceRelaxTime_ms = 400;
    foul.foulPlayer = 0;
    foul.foulType = 0;
  }
  // give the player a few seconds to watch the result, then the next attempt
  drillWaitUntil = match->GetActualTime_ms() + 3500;
}

// The human struck the offside free kick via the trace overlay (gpf_freekick_pass
// already gave the ball its velocity). End the set-piece phase so everyone resumes
// live play, mirroring the normal "taker touched the ball" transition.
void Referee::EndOffsideKick() {
  humanOffsideKickTeam = -1;
  if (match->IsInSetPiece()) {
    buffer.active = false;
    match->StopSetPiece();
    match->GetTeam(0)->GetController()->PrepareSetPiece(e_SetPiece_None);
    match->GetTeam(1)->GetController()->PrepareSetPiece(e_SetPiece_None);
    afterSetPieceRelaxTime_ms = 400;
    foul.foulPlayer = 0;
    foul.foulType = 0;
  }
#ifdef __EMSCRIPTEN__
  EM_ASM({ try { if (window.gpfFreekickDone) window.gpfFreekickDone(); } catch (e) {} });
#endif
}

// The human struck the penalty via the trace overlay (gpf_penalty_shoot already
// gave the ball its velocity). End the set-piece phase so play resumes.
void Referee::EndPenalty() {
  humanPenaltyTeam = -1;
  if (match->IsInSetPiece()) {
    buffer.active = false;
    match->StopSetPiece();
    match->GetTeam(0)->GetController()->PrepareSetPiece(e_SetPiece_None);
    match->GetTeam(1)->GetController()->PrepareSetPiece(e_SetPiece_None);
    afterSetPieceRelaxTime_ms = 400;
    foul.foulPlayer = 0;
    foul.foulType = 0;
  }
#ifdef __EMSCRIPTEN__
  EM_ASM({ try { if (window.gpfPenaltyDone) window.gpfPenaltyDone(); } catch (e) {} });
#endif
  // in a shootout this was the human's kick -> schedule the result judgement
  ShootoutHumanKickStruck();
}

void Referee::AlterSetPiecePrepareTime(unsigned long newTime_ms) {
  if (buffer.active) {
    buffer.prepareTime = newTime_ms;
    buffer.startTime = buffer.prepareTime + 2000;
  }
}

void Referee::BallTouched() {

  // check for offside player receiving the ball

  int lastTouchTeamID = match->GetLastTouchTeamID();
  if (lastTouchTeamID == -1) return; // shouldn't happen really ;)
  if (match->IsInPlay() && !match->IsInSetPiece() && buffer.active == false && match->GetTeam(abs(lastTouchTeamID - 1))->GetActivePlayerCount() > 1) { // disable if only 1 player: that's debug mode with only keeper
    std::map<Player*, Vector3>::iterator playerIter = offsidePlayers.begin();
    while (playerIter != offsidePlayers.end()) {
      if (match->GetTeam(lastTouchTeamID)->GetLastTouchPlayer() == playerIter->first) {
        foul.advantage = false;
        if (!CheckFoul()) {
          // uooooga uooooga offside!
          match->StopPlay();
          buffer.desiredSetPiece = e_SetPiece_FreeKick;
          buffer.stopTime = match->GetActualTime_ms();
          buffer.prepareTime = match->GetActualTime_ms() + 2000;
          buffer.startTime = buffer.prepareTime + 2000;
          buffer.restartPos = playerIter->second;
          buffer.teamID = abs(lastTouchTeamID - 1);
          buffer.active = true;
          match->SpamMessage("offside!");
          gpfRadioEvent("offside");
#ifdef __EMSCRIPTEN__
          // human's team takes this free kick -> close camera + trace-to-pass
          if (match->GetTeam(buffer.teamID)->GetHumanGamerCount() > 0)
            humanOffsideKickTeam = buffer.teamID;
#endif
          break;
        } else break;
      }
      playerIter++;
    }
  }

  offsidePlayers.clear();

  if (match->IsInPlay() &&
      (buffer.active == false ||
       (buffer.active == true && buffer.desiredSetPiece != e_SetPiece_ThrowIn))) {
    // check for offside players at moment of touch
    float offside = AI_GetOffsideLine(match, match->GetMentalImage(0), abs(lastTouchTeamID - 1));
    std::vector<Player*> players;
    Team *team = match->GetTeam(lastTouchTeamID);
    match->GetTeam(lastTouchTeamID)->GetActivePlayers(players);
    for (unsigned int i = 0; i < players.size(); i++) {
      if (players.at(i) != team->GetLastTouchPlayer()) {
        if (players.at(i)->GetPosition().coords[0] * team->GetSide() < offside * team->GetSide() - 0.20/*relax*/) {
          offsidePlayers.insert(std::pair<Player*, Vector3>(players.at(i), players.at(i)->GetPosition()));
        }
      }
    }
  }

}

void Referee::TripNotice(Player *tripee, Player *tripper, int tackleType) {

  if (buffer.active) return;

  if (tackleType == 2) { // standing tackle
    if (tripee->GetTeam()->GetFadingTeamPossessionAmount() > 1.1 &&
        (tripper->GetCurrentFunctionType() == e_FunctionType_Interfere || tripper->GetCurrentFunctionType() == e_FunctionType_Sliding) &&
        (tripee->GetPosition() - match->GetBall()->Predict(0).Get2D()).GetLength() < 2.0 &&
        tripper->GetTeam()->GetID() != tripee->GetTeam()->GetID()) {
      // uooooga uooooga foul!
      foul.foulType = 1;
      foul.advantage = true;
      foul.foulPlayer = tripper;
      foul.foulVictim = tripee;
      foul.foulTime = match->GetActualTime_ms();
      foul.foulPosition = tripee->GetPosition();
      foul.hasBeenProcessed = false;
      if (!IsReleaseVersion()) match->SpamMessage("advantage", 2000);
    }

  } else if (tackleType == 3 && (tripper != foul.foulPlayer || foul.foulType == 0)) { // sliding tackle

    if (match->GetActualTime_ms() - tripper->GetLastTouchTime_ms() > 600 &&
        tripper->GetCurrentFunctionType() == e_FunctionType_Sliding &&
        tripper->GetTeam()->GetID() != tripee->GetTeam()->GetID() && (match->GetBall()->Predict(0) - tripee->GetPosition()).GetLength() < 8.0) {
      float severity = 1.0;
      if (tripper->TouchAnim()) {
        severity = std::pow(clamp(fabs(tripper->GetTouchFrame() -
                                       tripper->GetCurrentFrame()) /
                                      tripper->GetTouchFrame(),
                                  0.0, 1.0),
                            0.7) *
                   0.5;
        severity += NormalizedClamp((match->GetBall()->Predict(0) - tripper->GetTouchPos()).GetLength(), 0.0, 2.0) * 0.5;
      }
      // from behind?
      severity += (tripee->GetPosition() - tripper->GetPosition()).GetNormalized(0).GetDotProduct(tripee->GetDirectionVec()) * 0.5 + 0.5;

      if (severity > 1.0) {
        // uooooga uooooga foul!
        //printf("sliding! %lu ms ago\n", match->GetActualTime_ms() - tripper->GetLastTouchTime_ms());
        foul.foulType = 1;
        foul.advantage = true;
        foul.foulPlayer = tripper;
        foul.foulVictim = tripee;
        foul.foulTime = match->GetActualTime_ms();
        foul.foulPosition = tripee->GetPosition();
        foul.hasBeenProcessed = false;
        if (severity > 1.4) foul.foulType = 2;
        if (severity > 2.0) {
          foul.foulType = 3;
          foul.advantage = false;
        } else {
          if (!IsReleaseVersion()) match->SpamMessage("advantage", 3000);
        }
      }
    }

  }
}

bool Referee::CheckFoul() {

  bool penalty = false;
  if (foul.foulType != 0) {
    if (fabs(foul.foulPosition.coords[1]) < 20.15 - lineHalfW && foul.foulPosition.coords[0] * -foul.foulVictim->GetTeam()->GetSide() > pitchHalfW - 16.5 + lineHalfW) penalty = true;
  }

  if (foul.advantage) {
    if (penalty) {
      foul.advantage = false;
    } else {
      if (match->GetActualTime_ms() - 600 > foul.foulTime) {
        if (match->GetActualTime_ms() - 3000 > foul.foulTime) {
          // cancel foul, advantage took long enough
          // todo: yellow cards need to be remembered though ;)
          foul.foulPlayer = 0;
          foul.foulType = 0;
        } else {
          // calculate if there's advantage still
          if (foul.foulVictim->GetTeam()->GetFadingTeamPossessionAmount() < 1.0) {
            foul.advantage = false;
          }
        }
      }
    }
  }

  if (foul.foulType != 0 && foul.advantage == false && !foul.hasBeenProcessed) {

    match->StopPlay();
    if (!penalty) {
      buffer.desiredSetPiece = e_SetPiece_FreeKick;
      buffer.stopTime = match->GetActualTime_ms();
      buffer.prepareTime = match->GetActualTime_ms() + 2000;
      if (foul.foulType >= 2) buffer.prepareTime += 10000;
      buffer.startTime = buffer.prepareTime + 2000;
      buffer.restartPos = foul.foulPosition;
    } else {
      buffer.desiredSetPiece = e_SetPiece_Penalty;
      buffer.stopTime = match->GetActualTime_ms();
      buffer.prepareTime = match->GetActualTime_ms() + 2000;
      if (foul.foulType >= 2) buffer.prepareTime += 10000;
      buffer.startTime = buffer.prepareTime + 2000;
      buffer.restartPos = Vector3((pitchHalfW - 11.0) * foul.foulPlayer->GetTeam()->GetSide(), 0, 0);
    }
    buffer.teamID = foul.foulVictim->GetTeam()->GetID();
    buffer.active = true;
#ifdef __EMSCRIPTEN__
    // the CPU fouled the human's team -> they take this free kick with the close
    // (penalty-style) camera + trace-to-pass. (A foul in the box is a penalty,
    // handled by its own branch when the ball goes live — so only free kicks here.)
    if (!penalty && match->GetTeam(buffer.teamID)->GetHumanGamerCount() > 0)
      humanOffsideKickTeam = buffer.teamID;
#endif
    // (the foul instant replay is handled in the browser now — see the note in
    //  Match::UpdateIngameCamera / webradio/replay.ts — no native replay here.)
    std::string spamMessage = "foul!";
    if (foul.foulType == 2) {
      spamMessage.append(" yellow card");
      foul.foulPlayer->GiveYellowCard(match->GetActualTime_ms() + 6000); // need to find out proper moment
    }
    if (foul.foulType == 3) {
      spamMessage.append(" red card!!!");
      foul.foulPlayer->GiveRedCard(match->GetActualTime_ms() + 6000); // need to find out proper moment
    }
    match->SpamMessage(spamMessage);

    // browser radio: foul/penalty award + any card
    {
      int benTeam = foul.foulVictim ? foul.foulVictim->GetTeam()->GetID() : -1;
      std::string offender = (foul.foulPlayer && foul.foulPlayer->GetPlayerData())
                                 ? foul.foulPlayer->GetPlayerData()->GetLastName() : std::string();
      gpfRadioEvent(penalty ? "penalty" : "foul", "", benTeam);
      if (foul.foulType == 2) gpfRadioEvent("yellow", offender.c_str());
      else if (foul.foulType == 3) gpfRadioEvent("red", offender.c_str());
    }

    foul.hasBeenProcessed = true;

    return true;
  }

  return false;
}
