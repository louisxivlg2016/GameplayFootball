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
#include "onthepitch/player/player.hpp"
#include "onthepitch/team.hpp"
#include "hid/keyboard.hpp"
#include "systems/graphics/rendering/interface_renderer3d.hpp"

// Graphics quality level, 0 (potato) .. 4 (ultra / the old default). Read by the
// renderer paths (shadow map size, sun shadow at match start); the render scale
// itself is applied through Renderer3D::SetRenderScale below.
int gpf_quality_level = 4;

// Native SETTINGS > GRAPHICS quality row + boot-apply from JS. Maps the level to
// an offscreen render scale (the big low-end win: potato renders 16% of the
// pixels and upscales) and toggles the sun's shadow pass on the live match.
// defined in main.cpp — retunes the render TaskSequence's frametime / max defer
void gpf_apply_render_frametime(int ms);
void gpf_apply_render_defer(int ms);

extern "C" EMSCRIPTEN_KEEPALIVE void gpf_set_quality(int level) {
  if (level < 0) level = 0;
  if (level > 4) level = 4;
  gpf_quality_level = level;
  // Keep the picture SHARP at every quality — the resolution drop (blur) barely
  // helped and looked bad, so all levels render at near-full resolution. Speed is
  // won by the render-RATE cap below (render less often), not by blurring.
  static const float scales[5] = {0.60f, 0.72f, 0.84f, 0.92f, 1.0f};
  blunted::Renderer3D *renderer = GetGraphicsSystem() ? GetGraphicsSystem()->GetRenderer3D() : 0;
  if (renderer) renderer->SetRenderScale(scales[level]);
  // Render-rate cap (ms/frame): the lower the quality, the less often we render,
  // so the scheduler spends far more time on the 10ms sim and the game keeps
  // real-time speed instead of slow motion. This is now the MAIN speed lever
  // (sharpness is kept), so the low modes render notably less often.
  static const int gfxFrame[5] = {120, 75, 45, 26, 16}; // ~8 / 13 / 22 / 38 / 60 fps
  gpf_apply_render_frametime(gfxFrame[level]);
  // Max time a render START may be DEFERRED while the sim catches up (~3 frame
  // periods). This bounds admission latency, not final present time (the render +
  // swap add more), but it guarantees the canvas can't be starved indefinitely on
  // a saturated machine.
  static const int gfxDefer[5] = {360, 225, 135, 78, 48};
  gpf_apply_render_defer(gfxDefer[level]);
  boost::shared_ptr<GameTask> gt = GetGameTask();
  Match *m = gt ? gt->GetMatch() : 0;
  if (m) m->SetSunShadow(level >= 2);
}

// National-team overrides, set from the HTML menu BEFORE the match builds
// (Team::InitPlayers reads them): recolor the kit to the picked nation's colour
// and replace the DB player names with the real squad. Team index 0 = home, 1 =
// away. gpf_natColorSet gates the recolour; gpf_natNames[t] is the shirt-ordered
// last-name list (empty -> keep the DB names).
int gpf_natColorSet[2] = {0, 0};
unsigned char gpf_natColor[2][3] = {{0, 0, 0}, {0, 0, 0}};
std::vector<std::string> gpf_natNames[2];
// per-player skin colour override (shirt-ordered, 1..4 = skin01..skin04; 0/empty
// = keep the DB skin). Lets the web set realistic skin tones per squad.
std::vector<int> gpf_natSkins[2];
// per-team strength multiplier (1.0 = full base stats). "Realistic strength" mode
// scales each side by its nation's OVR so weaker nations genuinely play worse and
// stronger ones play better. Read in Player::GetStat. 1.0 = no effect (mode off).
float gpf_natStrength[2] = {1.0f, 1.0f};

// selected UI language for the in-match native menus (gpf_i18n.hpp / GPF_TR). The
// web pushes it on boot + on every language change; "en" = English (default).
std::string gpf_ui_lang = "en";
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_set_ui_lang(const char *code) {
  gpf_ui_lang = (code && *code) ? code : "en";
}

extern "C" EMSCRIPTEN_KEEPALIVE void gpf_set_team_color(int team, int r, int g, int b) {
  if (team < 0 || team > 1) return;
  gpf_natColorSet[team] = 1;
  gpf_natColor[team][0] = (unsigned char)r;
  gpf_natColor[team][1] = (unsigned char)g;
  gpf_natColor[team][2] = (unsigned char)b;
}

extern "C" EMSCRIPTEN_KEEPALIVE void gpf_set_team_names(int team, const char *names) {
  if (team < 0 || team > 1 || !names) return;
  gpf_natNames[team].clear();
  std::string s(names), cur;
  for (size_t i = 0; i < s.size(); i++) {
    if (s[i] == '|') { if (!cur.empty()) gpf_natNames[team].push_back(cur); cur.clear(); }
    else cur.push_back(s[i]);
  }
  if (!cur.empty()) gpf_natNames[team].push_back(cur);
}

extern "C" EMSCRIPTEN_KEEPALIVE void gpf_set_team_skins(int team, const char *skins) {
  if (team < 0 || team > 1 || !skins) return;
  gpf_natSkins[team].clear();
  std::string s(skins);
  if (s.empty()) return;
  std::string cur;
  for (size_t i = 0; i <= s.size(); i++) {
    if (i == s.size() || s[i] == '|') { gpf_natSkins[team].push_back(cur.empty() ? 0 : atoi(cur.c_str())); cur.clear(); }
    else cur.push_back(s[i]);
  }
}

extern "C" EMSCRIPTEN_KEEPALIVE void gpf_set_team_strength(int team, float strength) {
  if (team < 0 || team > 1) return;
  if (strength < 0.1f) strength = 0.1f;
  if (strength > 1.5f) strength = 1.5f;
  gpf_natStrength[team] = strength;
}

extern "C" EMSCRIPTEN_KEEPALIVE void gpf_clear_team_overrides() {
  gpf_natColorSet[0] = gpf_natColorSet[1] = 0;
  gpf_natNames[0].clear();
  gpf_natNames[1].clear();
  gpf_natSkins[0].clear();
  gpf_natSkins[1].clear();
  gpf_natStrength[0] = gpf_natStrength[1] = 1.0f;
}

// Generic engine-config bridge for the HTML SETTINGS panel: read/write any
// GetConfiguration() key (gameplay assist sliders, audio_volume, …) so the web
// menu can expose the same knobs as the native SETTINGS pages.
extern "C" EMSCRIPTEN_KEEPALIVE float gpf_get_config_float(const char *name, float def) {
  return GetConfiguration() ? GetConfiguration()->GetReal(name, def) : def;
}
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_set_config_float(const char *name, float val) {
  if (GetConfiguration()) GetConfiguration()->Set(name, val);
}
extern "C" EMSCRIPTEN_KEEPALIVE int gpf_get_config_bool(const char *name, int def) {
  return (GetConfiguration() && GetConfiguration()->GetBool(name, def != 0)) ? 1 : 0;
}
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_set_config_bool(const char *name, int val) {
  if (GetConfiguration()) GetConfiguration()->SetBool(name, val != 0);
}

// Keyboard rebinding for the HTML SETTINGS panel. action = e_ButtonFunction
// (0..17), keycode = SDL_Keycode. Write the config key the engine reads AND
// re-apply the whole mapping to the live keyboard device so it takes effect now
// (the keyboard is controllers[0], created at boot).
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_rebind_key(int action, int keycode) {
  if (action < 0 || action >= e_ButtonFunction_Size) return;
  if (GetConfiguration())
    GetConfiguration()->SetInt(("input_keyboard_" + std::to_string(action)).c_str(), keycode);
  const std::vector<IHIDevice *> &ctrls = GetControllers();
  if (!ctrls.empty() && ctrls.at(0)) static_cast<HIDKeyboard *>(ctrls.at(0))->LoadConfig();
}
extern "C" EMSCRIPTEN_KEEPALIVE int gpf_get_key(int action) {
  if (action < 0 || action >= e_ButtonFunction_Size) return 0;
  const std::vector<IHIDevice *> &ctrls = GetControllers();
  if (!ctrls.empty() && ctrls.at(0))
    return (int)static_cast<HIDKeyboard *>(ctrls.at(0))->GetFunctionMapping((e_ButtonFunction)action);
  return 0;
}

// DEFI challenge from the HTML menu: jump the live match to a preset score +
// clock with a win condition. The HTML always makes the player's chosen team the
// home side, so playerSide is 0. Deferred inside Match until the match is live.
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_start_challenge(int homeScore, int awayScore, int clockMin, int objective, int playerSide) {
  boost::shared_ptr<GameTask> gt = GetGameTask();
  Match *m = gt ? gt->GetMatch() : 0;
  if (m) m->StartChallenge(homeScore, awayScore, clockMin, objective, playerSide);
}

// Trigger an instant replay of the last windowMs (also fired automatically on
// goals/fouls). Exposed so a "replay" button / test can request one.
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_replay(int windowMs) {
  boost::shared_ptr<GameTask> gt = GetGameTask();
  Match *m = gt ? gt->GetMatch() : 0;
  if (m) m->StartReplay(windowMs > 0 ? (unsigned long)windowMs : 3000);
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

// In-match offside free kick: the human traced a line toward a team-mate. Pass the
// ball in that direction (screen-right -> world lateral, screen-up -> loft, chord
// length -> pace), then end the set piece so play resumes.
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_freekick_pass(float aimRight, float aimUp, float power) {
  boost::shared_ptr<GameTask> gt = GetGameTask();
  Match *m = gt ? gt->GetMatch() : 0;
  if (!m || !m->GetReferee() || !m->GetBall()) return;
  Referee *ref = m->GetReferee();
  if (!ref->IsHumanOffsideKick()) return;

  int kickTeam = ref->GetOffsideKickTeam();
  signed int oppSide = m->GetTeam(1 - kickTeam)->GetSide(); // attacked-goal side
  float p = clamp(power, 0.0f, 1.0f);
  float r = clamp(aimRight, -1.0f, 1.0f);
  float u = clamp(aimUp, 0.0f, 1.0f);

  Vector3 ballPos = m->GetBall()->Predict(0).Get2D();

  // The user's traced pass used to be launched as a fixed long ball toward the
  // opponent's penalty area — which lands among OPPONENTS (corner/throw-in/free
  // kick all "pass to the other team"). Instead, aim the pass at an actual
  // TEAM-MATE: forward (toward the attacked goal) fanned left/right by the trace
  // (`r`), then pick the best team-mate in that lane and drive the ball to him.
  Vector3 fwd = Vector3((float)oppSide, 0.0f, 0.0f);
  Vector3 lat = Vector3(fwd.coords[1], -fwd.coords[0], 0.0f); // screen-right perpendicular
  Vector3 desired = (fwd + lat * r).GetNormalized();

  std::vector<Player*> mates;
  m->GetTeam(kickTeam)->GetActivePlayers(mates);
  Player *best = 0;
  float bestScore = -1e9f;
  for (unsigned int i = 0; i < mates.size(); i++) {
    Player *pl = mates[i];
    if (!pl) continue;
    if (pl->GetFormationEntry().role == e_PlayerRole_GK) continue; // never pass to our keeper
    Vector3 rel = pl->GetPosition().Get2D() - ballPos;
    float dist = rel.GetLength();
    if (dist < 3.0f) continue;   // the taker standing on the ball / too close
    if (dist > 42.0f) continue;  // beyond a believable pass
    Vector3 dir = rel.GetNormalized();
    float align = dir.GetDotProduct(desired); // -1..1: matches where you aimed
    if (align < 0.10f) continue;              // never pass backwards out of the lane
    float score = align * 2.0f - dist * 0.02f; // well-aimed + reachable wins
    if (score > bestScore) { bestScore = score; best = pl; }
  }

  Vector3 vel;
  if (best) {
    // lead the runner a touch and give the ball just enough pace to arrive;
    // loft from the trace (u), softened on short passes so they stay on the deck.
    Vector3 lead = best->GetPosition().Get2D() + best->GetMovement().Get2D() * 0.35f;
    Vector3 to = lead - ballPos;
    float dist = to.GetLength();
    Vector3 dir = (dist > 0.01f) ? to.GetNormalized() : desired;
    float speed = clamp(9.0f + dist * 0.85f, 11.0f, 30.0f) + p * 5.0f;
    vel = dir * speed;
    vel.coords[2] = (0.6f + u * 6.0f) * clamp(dist / 20.0f, 0.4f, 1.4f);
  } else {
    // nobody in the aimed lane — fall back to a forward ball fanned by r
    float speed = 13.0f + 16.0f * p;
    vel = desired * speed + lat * (r * 8.0f);
    vel.coords[2] = 2.0f + u * 7.0f;
  }

  m->GetBall()->Touch(vel);
  ref->EndOffsideKick();
}

// In-match penalty the human takes: the traced curve becomes the shot (aim +
// power + swerve, toward the attacked goal), then the set piece ends.
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_penalty_shoot(float aimRight, float aimUp, float power, float curl) {
  boost::shared_ptr<GameTask> gt = GetGameTask();
  Match *m = gt ? gt->GetMatch() : 0;
  if (!m || !m->GetReferee() || !m->GetBall()) return;
  Referee *ref = m->GetReferee();
  if (!ref->IsHumanPenalty()) return;

  signed int oppSide = m->GetTeam(1 - ref->GetPenaltyTeam())->GetSide(); // goal attacked
  float p = clamp(power, 0.0f, 1.0f);
  float r = clamp(aimRight, -1.0f, 1.0f);
  float u = clamp(aimUp, 0.0f, 1.0f);
  float c = clamp(curl, -1.0f, 1.0f);

  float speed = 22.0f + 14.0f * p;      // penalty pace
  float vx = oppSide * speed;           // toward the attacked goal
  float vy = -oppSide * r * 8.0f;       // lateral: screen-right -> correct world side
  float vz = 1.5f + u * 6.0f;           // keep it low-ish (2..7.5 m/s)

  m->GetBall()->Touch(Vector3(vx, vy, vz));
  m->GetBall()->SetRotation(0.0f, 0.0f, -c * 300.0f, 1.0f);
  ref->EndPenalty();
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

// Skip the current national anthem (the "Passer" button on the ceremony banner).
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_skip_anthem() {
  boost::shared_ptr<GameTask> gt = GetGameTask();
  Match *m = gt ? gt->GetMatch() : 0;
  if (m) m->SkipAnthem();
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

  // keeper drill -> keeper is the non-shooting drill team; in-match penalty ->
  // the team the referee flagged as the human's (opponent is taking the penalty).
  int keeperTeam = ref->IsKeeperDrill() ? (1 - ref->GetDrillTeam()) : ref->GetHumanKeeperTeam();
  if (keeperTeam < 0) return;
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
#ifdef __EMSCRIPTEN__
      // back on the main menu -> let the web layer re-show its HTML home overlay
      // (else the bare C++ menu shows through after a match).
      EM_ASM({ if (typeof window !== "undefined" && window.gpfReturnedToMenu) window.gpfReturnedToMenu(); });
#endif
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
    // Exactly ONE sim step per scheduled game tick — quality must change render
    // cost only, never the fixed-step count (an extra Process() here stole CPU on
    // weak machines and desynced actualTime_ms from the scheduler's timesRan).
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
