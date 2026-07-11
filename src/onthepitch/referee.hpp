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
    // The user drew an aim line and the ball was launched directly (gpf_drill_shoot):
    // end the set-piece phase so the keeper reacts, then schedule the next attempt.
    void NotifyDrillShotTaken();
    // Anthem ceremony finished: re-run the kickoff countdown so the players
    // reform into their natural positions, then the whistle blows a beat later.
    void RestartAfterCeremony();

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

};

#endif
