// written by bastiaan konings schuiling 2008 - 2015
// this work is public domain. the code is undocumented, scruffy, untested, and should generally not be used for anything important.
// i do not offer support, so don't ask. to be used for inspiration :)

#include "gametask.hpp"

#include "main.hpp"

#include "framework/scheduler.hpp"
#include "managers/taskmanager.hpp"
#include "managers/resourcemanagerpool.hpp"

#include "blunted.hpp"

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include "onthepitch/player/controller/icontroller.hpp"
#include "systems/graphics/rendering/interface_renderer3d.hpp"

// Graphics quality level, 0 (potato) .. 4 (ultra / the old default). Read by the
// renderer paths (shadow map size, sun shadow at match start); the render scale
// itself is applied through Renderer3D::SetRenderScale below.
int gpf_quality_level = 4;

// Native SETTINGS > GRAPHICS quality row + boot-apply from JS. Maps the level to
// an offscreen render scale (the big low-end win: potato renders 16% of the
// pixels and upscales) and toggles the sun's shadow pass on the live match.
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_set_quality(int level) {
  if (level < 0) level = 0;
  if (level > 4) level = 4;
  gpf_quality_level = level;
  static const float scales[5] = {0.5f, 0.62f, 0.75f, 0.87f, 1.0f};
  blunted::Renderer3D *renderer = GetGraphicsSystem() ? GetGraphicsSystem()->GetRenderer3D() : 0;
  if (renderer) renderer->SetRenderScale(scales[level]);
  boost::shared_ptr<GameTask> gt = GetGameTask();
  Match *m = gt ? gt->GetMatch() : 0;
  if (m) m->SetSunShadow(level >= 2);
}

// Training drills from the HTML menu: force the live match into a specific set
// piece (1=KickOff,3=FreeKick,4=Corner,6=Penalty — e_SetPiece values) for team 0.
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_start_drill(int setPiece) {
  boost::shared_ptr<GameTask> gt = GetGameTask();
  Match *m = gt ? gt->GetMatch() : 0;
  if (m && m->GetReferee()) m->GetReferee()->StartDrill((e_SetPiece)setPiece, 0, 10);
}

// Training aim curve: the user traced a shot trajectory on screen. Inputs are
// normalized from the drawing: aimRight in [-1,1] (screen right = +), aimUp in
// [0,1] (screen up = loft), power in [0,1] (chord length), curl in [-1,1] (how
// much the path bowed sideways, screen-right = +). We convert to a world-space
// velocity (m/s, z = up) aimed at the goal the drill team attacks, launch the
// ball with Ball::Touch, and spin it about Z so the Magnus effect bends it the
// way it was drawn.
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_drill_shoot(float aimRight, float aimUp, float power, float curl) {
  boost::shared_ptr<GameTask> gt = GetGameTask();
  Match *m = gt ? gt->GetMatch() : 0;
  if (!m || !m->GetReferee() || !m->GetBall()) return;
  Referee *ref = m->GetReferee();
  if (!ref->IsDrillActive()) return;

  signed int oppSide = m->GetTeam(1 - ref->GetDrillTeam())->GetSide(); // goal attacked
  float p = clamp(power, 0.0f, 1.0f);
  float r = clamp(aimRight, -1.0f, 1.0f);
  float u = clamp(aimUp, 0.0f, 1.0f);
  float c = clamp(curl, -1.0f, 1.0f);

  float speed = 20.0f + 15.0f * p;      // forward pace toward goal (m/s)
  float vx = oppSide * speed;           // toward the attacked goal
  float vy = -oppSide * r * 9.0f;       // lateral: screen-right -> correct world side
  float vz = 2.0f + u * 9.0f;           // loft (2..11 m/s)

  m->GetBall()->Touch(Vector3(vx, vy, vz));
  // Magnus swerve = momentumDir x (-rotVec); a Z spin bends the ball horizontally.
  // swerve_Y = oppSide * zSpin, and screen-right is world -oppSide*Y, so zSpin =
  // -curl * M gives a screen-right curve regardless of which goal we attack.
  // Engine's own shots use zRot up to ~+-420; 350 is a strong-but-sane full curl.
  m->GetBall()->SetRotation(0.0f, 0.0f, -c * 350.0f, 1.0f);
  ref->NotifyDrillShotTaken();
}

// ---- Goalkeeper drill -----------------------------------------------------
// The AI (team 1) takes penalties; the human is team 0's keeper. When the user
// taps a left/right arrow we bind this external controller to the keeper: it
// commits the keeper to that side (Movement lunge) AND requests the real diving
// save (Deflect, auto-aimed at the ball when it is in reach). A wrong guess
// lunges the wrong way and the Deflect can't reach -> goal.
class KeeperDiveController : public IController {
  int diveDir; // world-Y sign to lunge toward
 public:
  KeeperDiveController(Match *m, int dir) : IController(m), diveDir(dir) {}
  void RequestCommand(PlayerCommandQueue &q) {
    // A real diving save toward the chosen side. desiredDirection tells SelectAnim
    // to pick the sided dive anim for that direction (see humanoid.cpp) instead of
    // auto-aiming at the ball — so the keeper DIVES (not walks) and a wrong guess
    // misses. The dive only fires once the ball is in reach (engine guard).
    PlayerCommand deflect;
    deflect.desiredFunctionType = e_FunctionType_Deflect;
    deflect.useDesiredMovement = false;
    deflect.useDesiredLookAt = false;
    deflect.desiredDirection = Vector3(0, (float)diveDir, 0);
    q.push_back(deflect);
  }
  Vector3 GetDirection() { return Vector3(0, (float)diveDir, 0); }
  float GetFloatVelocity() { return sprintVelocity; }
  void Reset() {}
};

static KeeperDiveController *g_keeperDive = 0;
static PlayerBase *g_keeperGK = 0;

extern "C" EMSCRIPTEN_KEEPALIVE void gpf_start_keeper_drill() {
  boost::shared_ptr<GameTask> gt = GetGameTask();
  Match *m = gt ? gt->GetMatch() : 0;
  if (m && m->GetReferee()) m->GetReferee()->StartKeeperDrill(10);
}

// dir: -1 = dive screen-left, +1 = screen-right, 0 = restore the AI keeper.
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_keeper_dive(int dir) {
  boost::shared_ptr<GameTask> gt = GetGameTask();
  Match *m = gt ? gt->GetMatch() : 0;
  if (!m || !m->GetReferee()) return;
  Referee *ref = m->GetReferee();

  // always clear any previous dive controller first
  if (g_keeperGK) { g_keeperGK->SetExternalController(0); g_keeperGK = 0; }
  if (g_keeperDive) { delete g_keeperDive; g_keeperDive = 0; }
  if (dir == 0) return; // restore AI keeper

  int keeperTeam = 1 - ref->GetDrillTeam();
  Player *gk = m->GetTeam(keeperTeam)->GetGoalie();
  if (!gk) return;
  // map screen dir to a world-Y side via the keeper's team side (see camera)
  signed int keeperSide = m->GetTeam(keeperTeam)->GetSide();
  g_keeperDive = new KeeperDiveController(m, (dir > 0 ? 1 : -1) * keeperSide);
  g_keeperGK = gk;
  gk->SetExternalController(g_keeperDive);
}
#endif

void UploadFullbodyModel::Update() {
  for (unsigned int i = 0; i < geometryToUpload.size(); i++) {
    geometryToUpload.at(i)->OnUpdateGeometryData(false);
  }
}

GameTask::GameTask() {

  match = 0;
  menuScene = 0;

  // prohibits deletion of the scene before this object is dead
  scene3D = GetScene3D();
}

GameTask::~GameTask() {
  if (Verbose()) printf("exiting gametask.. ");
  Exit();
  if (Verbose()) printf("done\n");
}

void GameTask::Exit() {

  Action(e_GameTaskMessage_StopMatch);
  Action(e_GameTaskMessage_StopMenuScene);

  ResourceManagerPool::GetInstance().CleanUp();

  scene3D.reset();
}

void GameTask::Action(e_GameTaskMessage message) {

  switch (message) {

    case e_GameTaskMessage_StartMatch:
      {
        if (Verbose()) printf("*gametaskmessage: starting match\n");

        GetGraphicsSystem()->getPhaseMutex.lock();
        MatchData *matchData = GetMenuTask()->GetMatchData();
        assert(matchData);
        Match *tmpMatch = new Match(matchData, GetControllers());

        matchLifetimeMutex.lock();
        matchPutBufferMutex.lock();
        assert(!match);
        match = tmpMatch;
        GetScheduler()->ResetTaskSequenceTime("game");
        matchPutBufferMutex.unlock();
        matchLifetimeMutex.unlock();
        GetGraphicsSystem()->getPhaseMutex.unlock();
      }
      break;

    case e_GameTaskMessage_StopMatch:
      if (Verbose()) printf("*gametaskmessage: stopping match\n");

      GetGraphicsSystem()->getPhaseMutex.lock();
      matchLifetimeMutex.lock();
      matchPutBufferMutex.lock();
      //assert(match);
      if (match) {
        match->Exit();
        delete match;
        match = 0;
      }
      matchPutBufferMutex.unlock();
      matchLifetimeMutex.unlock();
      GetGraphicsSystem()->getPhaseMutex.unlock();
      break;

    case e_GameTaskMessage_StartMenuScene:
      if (Verbose()) printf("*gametaskmessage: starting menu scene\n");

      GetGraphicsSystem()->getPhaseMutex.lock();
      menuSceneLifetimeMutex.lock();
      assert(!menuScene);
      menuScene = new MenuScene();
      GetScheduler()->ResetTaskSequenceTime("game");
      menuSceneLifetimeMutex.unlock();
      GetGraphicsSystem()->getPhaseMutex.unlock();
      break;

    case e_GameTaskMessage_StopMenuScene:
      if (Verbose()) printf("*gametaskmessage: stopping menu scene\n");

      GetGraphicsSystem()->getPhaseMutex.lock();
      menuSceneLifetimeMutex.lock();
      //assert(menuScene);
      if (menuScene) {
        delete menuScene;
        menuScene = 0;
      }
      menuSceneLifetimeMutex.unlock();
      GetGraphicsSystem()->getPhaseMutex.unlock();
      break;

    default:
      break;

  }
}

void GameTask::GetPhase() {

  // process messageQueue
  if (match) match->Get();
  if (menuScene) menuScene->Get();
}

void GameTask::ProcessPhase() {

  for (unsigned int i = 0; i < GetControllers().size(); i++) {
    GetControllers().at(i)->Process();
  }

  if (match) {
    match->Process();

    matchPutBufferMutex.lock();
    match->PreparePutBuffers();
    matchPutBufferMutex.unlock();
  }

  if (menuScene) {
    menuScene->Process();
  }

}

void GameTask::PutPhase() {

  std::vector < boost::intrusive_ptr<UpdateFullbodyModel> > updateFullbodyModels;
  std::vector < boost::intrusive_ptr<UploadFullbodyModel> > uploadFullbodyModels;
  std::vector<PlayerBase*> playersToProcess;

  matchLifetimeMutex.lock();

  if (match) {

    matchPutBufferMutex.lock();
    match->FetchPutBuffers();
    matchPutBufferMutex.unlock();

    match->Put();

    std::vector<Player*> players;
    match->GetActiveTeamPlayers(0, players);
    match->GetActiveTeamPlayers(1, players);
    std::vector<PlayerBase*> officials;
    match->GetOfficialPlayers(officials);

    for (unsigned int i = 0; i < players.size(); i++) {
      if (match->GetPause() || players.at(i)->NeedsModelUpdate()) playersToProcess.push_back(players.at(i));
    }
    for (unsigned int i = 0; i < officials.size(); i++) {
      playersToProcess.push_back(officials.at(i));
    }

    //printf("%i players, %i threads.\n", playersToProcess.size(), threadCount);
    unsigned int playersPerThread = 7;
    unsigned int playerStartIndex = 0;
    while (playerStartIndex < playersToProcess.size()) {
      std::vector<PlayerBase*> playersToProcessInThread;
      for (unsigned int p = 0; p < playersPerThread; p++) {
        if (playerStartIndex + p >= playersToProcess.size()) break;
        playersToProcessInThread.push_back(playersToProcess.at(playerStartIndex + p));
        //printf("adding player %i\n", playerStartIndex + p);
        // unthreaded version: playersToProcess.at(playerStartIndex + p)->UpdateFullbodyModel();
      }
      playerStartIndex += playersPerThread;

      boost::intrusive_ptr<UpdateFullbodyModel> updateFullbodyModel(new UpdateFullbodyModel(playersToProcessInThread));
      updateFullbodyModels.push_back(updateFullbodyModel);
      TaskManager::GetInstance().EnqueueWork(updateFullbodyModel, true);
    }

    match->UploadGoalNetting(); // won't this block the whole process thing too? (opengl busy == wait, while mutex locked == no process)

  }


  for (unsigned int t = 0; t < updateFullbodyModels.size(); t++) {
    updateFullbodyModels.at(t)->Wait();
  }

  if (match) {

    unsigned int playersPerThread = 7;
    unsigned int playerStartIndex = 0;
    while (playerStartIndex < playersToProcess.size()) {
      std::vector < boost::intrusive_ptr<Geometry> > geometryToUploadInThread;
      for (unsigned int p = 0; p < playersPerThread; p++) {
        if (playerStartIndex + p >= playersToProcess.size()) break;
        geometryToUploadInThread.push_back(boost::static_pointer_cast<Geometry>(playersToProcess.at(playerStartIndex + p)->GetFullbodyNode()->GetObject("fullbody")));
      }
      playerStartIndex += playersPerThread;

      boost::intrusive_ptr<UploadFullbodyModel> uploadFullbodyModel(new UploadFullbodyModel(geometryToUploadInThread));
      uploadFullbodyModels.push_back(uploadFullbodyModel);
      TaskManager::GetInstance().EnqueueWork(uploadFullbodyModel, true);

      //working on: maybe we need to use the gfx system get pointer somewhere here? too tired to analyse this now :p
    }

  } // !match

  matchLifetimeMutex.unlock();

  menuSceneLifetimeMutex.lock();
  if (menuScene) menuScene->Put();
  menuSceneLifetimeMutex.unlock();

}
