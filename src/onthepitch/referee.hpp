// written by bastiaan konings schuiling 2008 - 2015
// this work is public domain. the code is undocumented, scruffy, untested, and should generally not be used for anything important.
// i do not offer support, so don't ask. to be used for inspiration :)

#ifndef _HPP_REFEREE
#define _HPP_REFEREE

#include "defines.hpp"
#include "../gamedefines.hpp"

#include "scene/scene3d/scene3d.hpp"
#include "scene/objects/sound.hpp"

using namespace blunted;

class Match;

struct RefereeBuffer {
  bool active;
  e_SetPiece desiredSetPiece;
  signed int teamID;
  unsigned long stopTime;
  unsigned long prepareTime;
  unsigned long startTime;
  Vector3 restartPos;
  Player *taker;
  bool endPhase;
};

struct Foul {
  Player *foulPlayer;
  Player *foulVictim;
  int foulType; // 0: nothing, 1: foul, 2: yellow, 3: red
  bool advantage;
  unsigned long foulTime;
  Vector3 foulPosition;
  bool hasBeenProcessed;
};

class Referee {

  public:
    Referee(Match *match);
    virtual ~Referee();

    void Process();

    void PrepareSetPiece(e_SetPiece setPiece);

    // Training drills: force a specific set piece (penalty/corner/free kick) for
    // teamID near the opponent goal, instead of normal play. (wasm menu drills)
    void ForceSetPiece(e_SetPiece setPiece, int teamID);
  // Referee mode: blow the whistle on demand (the sound is otherwise private).
  void BlowWhistle();
    // Start a drill session: force the set piece and re-force it `reps` times
    // (one per attempt), then end. Used by the wasm training menu.
    void StartDrill(e_SetPiece setPiece, int teamID, int reps);
    // Goalkeeper drill: the AI (team 1) takes penalties and the human keeps
    // goal (team 0). Same repeat mechanism, but the taker is NOT suppressed.
    void StartKeeperDrill(int reps);

    const RefereeBuffer &GetBuffer() { return buffer; };

    void AlterSetPiecePrepareTime(unsigned long newTime_ms);

    void BallTouched();
    void TripNotice(Player *tripee, Player *tripper, int tackleType); // 1 == standing tackle resulting in little trip, 2 == standing tackle resulting in fall, 3 == sliding tackle
    bool CheckFoul();

    Player *GetCurrentFoulPlayer() { return foul.foulPlayer; }
    int GetCurrentFoulType() { return foul.foulType; }

    // drill state, for the training cameras
    bool IsDrillActive() { return drillType != e_SetPiece_None; }
    int GetDrillTeam() { return drillTeam; }
    e_SetPiece GetDrillType() { return drillType; }
    // keeper drill: bot shoots, human keeps -> don't suppress the taker, and use
    // the behind-the-keeper camera.
    bool IsKeeperDrill() { return drillKeeper; }
    // In-match penalty the HUMAN keeps (opponent shoots): the team whose goalie
    // the player dives with, or -1 when no such penalty is live. Lets the same
    // dive-arrow UI as the keeper drill drive a real match penalty.
    int GetHumanKeeperTeam() { return humanKeeperTeam; }
    // In-match set piece the human takes with the close (penalty-style) camera +
    // trace-to-pass: an offside free kick, a free kick from a CPU foul, or a goal
    // kick. GetOffsideKickTeam() is the taking team, or -1 = none.
    bool IsHumanOffsideKick() { return humanOffsideKickTeam >= 0; }
    int GetOffsideKickTeam() { return humanOffsideKickTeam; }
    void EndOffsideKick(); // called when the trace pass is struck: end the set piece
    // A penalty set piece is live in a real match (for the close training-style
    // camera). GetSetPieceTeam() is the team taking it.
    bool IsPenaltySetPiece() { return buffer.active && buffer.desiredSetPiece == e_SetPiece_Penalty; }
    int GetSetPieceTeam() { return buffer.teamID; }
    e_SetPiece GetDesiredSetPiece() { return buffer.desiredSetPiece; } // for the in-match set-piece camera
    // A "major" stoppage the commentator should go quiet for (free kick / corner /
    // penalty) — NOT throw-ins, goal kicks or kickoffs, which keep the radio going.
    bool IsMajorSetPiece() {
      return buffer.active && (buffer.desiredSetPiece == e_SetPiece_FreeKick ||
                               buffer.desiredSetPiece == e_SetPiece_Corner ||
                               buffer.desiredSetPiece == e_SetPiece_Penalty);
    }
    // In-match penalty the HUMAN takes: the human traces the shot (like the penalty
    // drill). GetPenaltyTeam() is the taking (human) team, or -1 = none.
    bool IsHumanPenalty() { return humanPenaltyTeam >= 0; }
    int GetPenaltyTeam() { return humanPenaltyTeam; }
    void EndPenalty(); // called when the traced shot is struck: end the set piece
    // The user drew an aim line and the ball was launched directly (gpf_drill_shoot):
    // end the set-piece phase so the keeper reacts, then schedule the next attempt.
    void NotifyDrillShotTaken();
    // Anthem ceremony finished: re-run the kickoff countdown so the players
    // reform into their natural positions, then the whistle blows a beat later.
    void RestartAfterCeremony();

    // ---- penalty shootout (drawn match after extra time) --------------------
    // A real alternating shootout: 5 kicks each then sudden death. The human
    // takes with the trace UI and keeps with the dive arrows; AI kicks are
    // scripted (like the keeper drill) so nothing can hang. Started from the
    // referee when the Penalties phase is reached still level.
    bool IsShootoutActive() { return shootoutActive; }
    int GetShootoutScore(int team) { return (team >= 0 && team < 2) ? shootoutScore[team] : 0; }
    int GetShootoutTaken(int team) { return (team >= 0 && team < 2) ? shootoutTaken[team] : 0; }
    // called by EndPenalty when the HUMAN has struck their shootout kick
    void ShootoutHumanKickStruck();

  protected:
    Match *match;

    boost::shared_ptr<Scene3D> scene3D;

    RefereeBuffer buffer;

    int afterSetPieceRelaxTime_ms; // throw-ins cause immediate new throw-ins, because ball is still outside the lines at the moment of throwing ;)

    std::map<Player*, Vector3> offsidePlayers; // player, position at time of touch

    Foul foul;

    boost::intrusive_ptr<Sound> whistle[4]; // 0: short, 1: long, 2: half time, 3: full time

    // training drill session state (0 = not in a drill)
    e_SetPiece drillType;
    int drillTeam;
    int drillReps;
    unsigned long drillWaitUntil; // re-force the drill at this match time (0 = idle)
    bool drillKeeper;             // true = keeper drill (bot shoots, human keeps)
    unsigned long drillShotFireTime; // keeper drill: auto-fire the bot's shot at this time (0 = idle)

    int humanKeeperTeam; // in-match penalty the human keeps (opponent shoots); -1 = none
    int humanOffsideKickTeam; // in-match offside free kick the human takes; -1 = none
    int humanPenaltyTeam;     // in-match penalty the human takes (trace-to-shoot); -1 = none

    // ---- penalty shootout state (0/false = not shooting out) ----
    bool shootoutActive;
    int shootoutKicker;                // team about to take the current kick (0 or 1)
    int shootoutTaken[2];              // kicks taken so far by each team
    int shootoutScore[2];              // shootout goals per team
    int shootoutSnapGoals[2];          // match GoalCount snapshot before the live kick
    unsigned long shootoutFireTime;    // AI kick: fire the scripted shot at this time (0 = idle)
    unsigned long shootoutResolveTime; // judge the live kick's result at this time (0 = idle)
    bool shootoutPending;              // a kick is set up / in flight, result not yet counted
    void StartShootout();       // enter the shootout (called from Process when level at Penalties)
    void ShootoutNextKick();    // set up the next penalty (alternating team)
    void ProcessShootout();     // per-tick shootout driver (fire AI shots, judge results, end)
    bool ShootoutDecided();     // true once one team can no longer be caught
};

#endif
