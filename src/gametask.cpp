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
#include "onthepitch/player/playerofficial.hpp"
#include "onthepitch/officials.hpp"
#include "onthepitch/team.hpp"
#include "onthepitch/humangamer.hpp"

#include <map>
#include <cstdio>
#include <cstring>
#include "onthepitch/ball.hpp"
#include <cmath>
#include "hid/hidnet.hpp"
#include "managers/usereventmanager.hpp"
#include "utils.hpp"
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
  static const float scales[5] = {0.85f, 0.90f, 0.94f, 0.97f, 1.0f};
  blunted::Renderer3D *renderer = GetGraphicsSystem() ? GetGraphicsSystem()->GetRenderer3D() : 0;
  if (renderer) renderer->SetRenderScale(scales[level]);
  // Render-rate cap (ms/frame): the lower the quality, the less often we render,
  // so the scheduler spends far more time on the 10ms sim and the game keeps
  // real-time speed instead of slow motion. This is the MAIN speed lever
  // (sharpness is kept), so even ULTRA now caps the render rate — rendering
  // full-res at 60fps on a modest machine starves the sim, so ultra renders at
  // ~38fps to leave the sim real-time. Drop a level for more speed (still sharp).
  static const int gfxFrame[5] = {150, 95, 60, 38, 26}; // ~7 / 11 / 17 / 26 / 38 fps
  gpf_apply_render_frametime(gfxFrame[level]);
  // Max time a render START may be DEFERRED while the sim catches up (~3 frame
  // periods). This bounds admission latency, not final present time (the render +
  // swap add more), but it guarantees the canvas can't be starved indefinitely on
  // a saturated machine.
  static const int gfxDefer[5] = {450, 285, 180, 114, 78};
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
// Per-team AGGRESSION (1.0 = normal). Some sides are famously cynical: they dive
// into tackles they shouldn't, which means more challenges AND more fouls. Read
// in PlayerController::_SlidingCommand.
float gpf_natAggression[2] = {1.0f, 1.0f};
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_set_team_aggression(int team, float a) {
  if (team < 0 || team > 1) return;
  gpf_natAggression[team] = (a < 1.0f) ? 1.0f : (a > 2.5f ? 2.5f : a);
}

// global player-speed slider (SETTINGS > "Vitesse des joueurs"): multiplies every
// player's max sprint velocity equally (playerbase.cpp GetMaxVelocity). 1.0 =
// normal. Clamped to a sane range so the match stays playable.
float gpf_speedScale = 1.0f;
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_set_speed_scale(float s) {
  gpf_speedScale = (s < 0.5f) ? 0.5f : (s > 1.8f ? 1.8f : s);
}

// same-screen local 2-player: when true, the second keyboard device (created in
// main.cpp for the web build) is auto-assigned to the OPPOSING team at match
// start (controllerselect.cpp reads this flag), so two people play 1-vs-1 on one
// keyboard. Set from the HTML "2 JOUEURS" toggle before launching a match.
bool gpf_twoPlayers = false;
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_set_two_players(int on) {
  gpf_twoPlayers = (on != 0);
}

// ---- online multiplayer (experimental) : determinism plumbing --------------
// Two peers seed the RNG identically, then compare a checksum of the sim state
// keyed by the sim clock. If the checksums stay equal, the wasm sim is
// deterministic in lockstep and real net play is feasible.
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_set_rng_seed(unsigned int seed) {
  blunted::set_random_seeds(seed);
}

// The deterministic step key: the sim clock (advances 10ms per sim step), so the
// state at "frame F" is comparable across peers regardless of their frame rate.
extern "C" EMSCRIPTEN_KEEPALIVE int gpf_sim_frame() {
  boost::shared_ptr<GameTask> gt = GetGameTask();
  Match *m = gt ? gt->GetMatch() : 0;
  return m ? (int)m->GetActualTime_ms() : -1;
}

// FNV-1a hash of the ball + every active player's position (quantised to ~1.5cm
// so identical sims match exactly while a real divergence shows up fast).
extern "C" EMSCRIPTEN_KEEPALIVE unsigned int gpf_state_checksum() {
  boost::shared_ptr<GameTask> gt = GetGameTask();
  Match *m = gt ? gt->GetMatch() : 0;
  if (!m || !m->GetBall()) return 0;
  unsigned int h = 2166136261u;
  Vector3 b = m->GetBall()->Predict(0);
  for (int c = 0; c < 3; c++) { int q = (int)(b.coords[c] * 64.0f); h = (h ^ (unsigned int)q) * 16777619u; }
  for (int t = 0; t < 2; t++) {
    std::vector<Player*> pl;
    m->GetTeam(t)->GetActivePlayers(pl);
    for (unsigned int i = 0; i < pl.size(); i++) {
      if (!pl[i]) continue;
      Vector3 p = pl[i]->GetPosition();
      for (int c = 0; c < 3; c++) { int q = (int)(p.coords[c] * 64.0f); h = (h ^ (unsigned int)q) * 16777619u; }
    }
  }
  return h;
}

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
  gpf_natAggression[0] = gpf_natAggression[1] = 1.0f;
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

// ---- REFEREE MODE (play AS the referee) ------------------------------------
// When on, the match starts AI-vs-AI (no human gamer — controllerselect.cpp reads
// this) and the human only issues decisions from the HTML referee overlay.
// First-person referee steering (camera-relative), set from the keyboard in JS.
// Read by refereecontroller.cpp to walk the ref body; x = right, y = forward.
float gpf_refMoveX = 0.0f;
float gpf_refMoveY = 0.0f;

// Manual first-person LOOK (mouse/touch drag). yaw = world heading the camera faces
// (radians), pitch = camera X-tilt (radians, ~0.47pi = just below level). Until the
// human first drags, gpf_refCamManual stays false and the camera auto-faces the ball.
float gpf_refCamYaw = 0.0f;
float gpf_refCamPitch = 0.47f * pi;
bool gpf_refCamManual = false;
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_ref_look(float yaw, float pitch) {
  gpf_refCamYaw = yaw;
  gpf_refCamPitch = pitch;
  gpf_refCamManual = true;
}

// The player the referee is currently talking to (elizacontroller.cpp makes him
// face the ref and obey). gpf_talkOrder: 0 = stand & face, 1 = recule, 2 = approche.
PlayerBase *gpf_talkPlayer = 0;
int gpf_talkOrder = 0;
// Whistle freeze: when true, every outfield player stands still (elizacontroller.cpp)
// so the match looks stopped — but the REFEREE keeps moving and the player being
// talked to still reacts. Toggled by the whistle. Better than Match::Pause, which
// froze the ref too and stopped talked-player animation.
bool gpf_freezePlayers = false;
// Hold the players still from JS. Used by online multiplayer: the two machines
// finish loading at different times (a PC is ready long before a tablet), so the
// first one in would be playing alone. Both freeze until BOTH report ready.
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_set_freeze(int on) {
  gpf_freezePlayers = (on != 0);
}

bool gpf_refereeMode = false;
// Referee mode: YOU blow the whistle. Every restart (kick-off, penalty, free
// kick, corner…) is held until the human referee whistles, exactly like a real
// match. `awaiting` is true while a restart is waiting for it.
// A player is DOWN INJURED. He drops with a heavy trip animation, stays on the
// deck (re-tripped every couple of seconds so he doesn't just get up), and the
// referee must physically WALK OVER to him before he can decide anything.
PlayerBase *gpf_injuredPlayer = 0;
int gpf_injuredTick = 0;
bool gpf_refAwaitingWhistle = false;
bool gpf_refWhistleGiven = false;
extern "C" EMSCRIPTEN_KEEPALIVE int gpf_ref_awaiting_whistle() {
  return gpf_refAwaitingWhistle ? 1 : 0;
}

// Put a random outfield player of `team` on the ground, injured. Returns his name.
extern "C" EMSCRIPTEN_KEEPALIVE const char* gpf_ref_injure(int team) {
  static std::string name; name.clear();
  boost::shared_ptr<GameTask> gt = GetGameTask();
  Match *m = gt ? gt->GetMatch() : 0;
  if (!m || team < 0 || team > 1) return name.c_str();
  Team *t = m->GetTeam(team);
  if (!t) return name.c_str();
  std::vector<Player*> active, outfield;
  t->GetActivePlayers(active);
  for (unsigned int i = 0; i < active.size(); i++) {
    Player *pl = active[i];
    if (pl && t->GetFormationEntry(pl->GetID()).role != e_PlayerRole_GK) outfield.push_back(pl);
  }
  if (outfield.empty()) return name.c_str();
  Player *victim = outfield[(int)(m->GetActualTime_ms() % outfield.size())];
  gpf_injuredPlayer = victim;
  gpf_injuredTick = 0;
  victim->TripMe(victim->GetDirectionVec(), 3); // 3 = heavy fall
  if (victim->GetPlayerData()) name = victim->GetPlayerData()->GetLastName();
  return name.c_str();
}

// Metres between the referee and the injured player (-1 when nobody is down).
// The page uses it to make you WALK to him before the decision box opens.
extern "C" EMSCRIPTEN_KEEPALIVE float gpf_ref_injured_dist() {
  boost::shared_ptr<GameTask> gt = GetGameTask();
  Match *m = gt ? gt->GetMatch() : 0;
  if (!m || !gpf_injuredPlayer || !m->GetOfficials() || !m->GetOfficials()->GetReferee()) return -1.0f;
  Vector3 refPos = m->GetOfficials()->GetReferee()->GetPosition();
  return (gpf_injuredPlayer->GetPosition() - refPos).GetLength();
}

// Decision taken: 0 = he's fine, gets up and plays on; 1 = carried off.
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_ref_injury_resolve(int sendOff) {
  if (!gpf_injuredPlayer) return;
  Player *p = static_cast<Player*>(gpf_injuredPlayer);
  gpf_injuredPlayer = 0;
  if (sendOff) p->SendOff();
}
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_set_referee_mode(int on) {
  gpf_refereeMode = (on != 0);
  gpf_refMoveX = 0.0f; gpf_refMoveY = 0.0f;
  gpf_refCamManual = false; gpf_refCamPitch = 0.47f * pi;
  gpf_talkPlayer = 0; gpf_talkOrder = 0;
  gpf_freezePlayers = false;
}

extern "C" EMSCRIPTEN_KEEPALIVE void gpf_ref_walk(float x, float y) {
  gpf_refMoveX = (x < -1.f) ? -1.f : (x > 1.f ? 1.f : x);
  gpf_refMoveY = (y < -1.f) ? -1.f : (y > 1.f ? 1.f : y);
}

// Blow the whistle and TOGGLE a hard freeze: first whistle FREEZES the whole match
// (players stop dead — Match::Pause halts Process), the next whistle resumes it.
// (StopPlay only marked the ball out of play, which made players walk to restart
// positions — hence "they moved when stopped". Pause is a true stop.)
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_ref_whistle() {
  boost::shared_ptr<GameTask> gt = GetGameTask();
  Match *m = gt ? gt->GetMatch() : 0;
  if (!m) return;
  if (m->GetReferee()) m->GetReferee()->BlowWhistle();
  // A restart is waiting on you -> this whistle STARTS it (kick-off, penalty…).
  // Otherwise the whistle stops/resumes play as before.
  if (gpf_refAwaitingWhistle) {
    gpf_refWhistleGiven = true;
    gpf_refAwaitingWhistle = false;
    gpf_freezePlayers = false; // play is on
  } else {
    gpf_freezePlayers = !gpf_freezePlayers; // freeze/unfreeze the outfield players
  }
}

// Award a set piece to a team. type = e_SetPiece (1=KickOff,2=GoalKick,3=FreeKick,
// 4=Corner,5=ThrowIn,6=Penalty); team 0/1.
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_ref_setpiece(int type, int team) {
  boost::shared_ptr<GameTask> gt = GetGameTask();
  Match *m = gt ? gt->GetMatch() : 0;
  if (m && m->GetReferee() && team >= 0 && team <= 1) m->GetReferee()->ForceSetPiece((e_SetPiece)type, team);
}

// Show a card to a player. Prefer the player who just committed a foul; otherwise
// the player currently near the ball on `team` (team<0 = whoever holds the ball).
// color 1=yellow, 3=red (a red auto-sends-off once its effective time passes).
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_ref_card(int team, int color) {
  boost::shared_ptr<GameTask> gt = GetGameTask();
  Match *m = gt ? gt->GetMatch() : 0;
  if (!m) return;
  Player *p = 0;
  if (gpf_talkPlayer) p = static_cast<Player*>(gpf_talkPlayer);  // the player you tapped/selected
  else if (m->GetReferee() && m->GetReferee()->GetCurrentFoulPlayer()) p = m->GetReferee()->GetCurrentFoulPlayer();
  else if (team >= 0 && team <= 1) { Team *t = m->GetTeam(team); if (t) p = t->GetDesignatedTeamPossessionPlayer(); }
  else p = m->GetDesignatedPossessionPlayer();
  if (!p) return;
  unsigned long now = m->GetActualTime_ms();
  if (color >= 3) p->GiveRedCard(now + 5000); else p->GiveYellowCard(now + 5000);
}

// Pick the active player nearest to a screen tap (normalized 0..1). Sets it as the
// selected/talk player and returns its name. "" if the tap hit no player. Uses the
// same world→screen projection as the floating name captions.
extern "C" EMSCRIPTEN_KEEPALIVE const char* gpf_ref_pick_player(float nx, float ny) {
  static std::string name; name.clear();
  gpf_talkPlayer = 0;
  boost::shared_ptr<GameTask> gt = GetGameTask();
  Match *m = gt ? gt->GetMatch() : 0;
  if (!m || !m->GetCamera()) return name.c_str();
  std::vector<Player*> players;
  m->GetActiveTeamPlayers(0, players);
  m->GetActiveTeamPlayers(1, players);
  float best = 0.11f; Player *bp = 0; // tap tolerance ~11% of the screen
  for (unsigned int i = 0; i < players.size(); i++) {
    Player *p = players[i];
    if (!p) continue;
    Vector3 sc = GetProjectedCoord(p->GetGeomPosition() + Vector3(0, 0, 1.1f), m->GetCamera());
    float px = sc.coords[0] / 100.0f, py = sc.coords[1] / 100.0f;
    if (px < -0.1f || px > 1.1f || py < -0.1f || py > 1.1f) continue;
    float d = sqrtf((px - nx) * (px - nx) + (py - ny) * (py - ny));
    if (d < best) { best = d; bp = p; }
  }
  if (bp) { gpf_talkPlayer = bp; if (bp->GetPlayerData()) name = bp->GetPlayerData()->GetLastName(); }
  return name.c_str();
}

// Screen position (normalized 0..1, as "nx,ny") of the player the LOCAL human is
// currently controlling, so the UI can float a "Toi" marker over him. Online: the
// gamer whose device is gpf_localNetDev (each machine's own local device drives its
// owner's team, so this shows "Toi" correctly on both screens). Otherwise the first
// human gamer found (solo/keyboard). Returns "" if none, or if he's off-screen.
// forward decls — the online-netcode globals are defined further down the file
extern bool gpf_onlineActive;
extern HIDNet *gpf_localNetDev;
extern "C" EMSCRIPTEN_KEEPALIVE const char* gpf_my_player_screen() {
  static std::string out; out.clear();
  boost::shared_ptr<GameTask> gt = GetGameTask();
  Match *m = gt ? gt->GetMatch() : 0;
  if (!m || !m->GetCamera()) return out.c_str();
  IHIDevice *want = gpf_onlineActive ? (IHIDevice*)gpf_localNetDev : 0;
  Player *me = 0;
  for (int t = 0; t < 2 && !me; t++) {
    Team *tm = m->GetTeam(t);
    if (!tm) continue;
    for (unsigned int i = 0; i < tm->GetHumanGamerCount(); i++) {
      HumanGamer *hg = tm->GetHumanGamer(i);
      if (!hg) continue;
      if (want && hg->GetHIDevice() != want) continue;
      Player *p = hg->GetSelectedPlayer();
      if (p) { me = p; break; }
    }
  }
  if (!me) return out.c_str();
  Vector3 sc = GetProjectedCoord(me->GetGeomPosition() + Vector3(0, 0, 2.3f), m->GetCamera());
  float px = sc.coords[0] / 100.0f, py = sc.coords[1] / 100.0f;
  if (px < -0.05f || px > 1.05f || py < -0.05f || py > 1.05f) return out.c_str();
  char buf[48];
  snprintf(buf, sizeof(buf), "%.4f,%.4f", px, py);
  out = buf;
  return out.c_str();
}

// Injury: force a random active OUTFIELD player on `team` off the pitch (the engine
// has no physio system, so an "injury exit" is modelled as a send-off). The GK is
// never picked so the team keeps a keeper.
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_ref_injury_off(int team) {
  boost::shared_ptr<GameTask> gt = GetGameTask();
  Match *m = gt ? gt->GetMatch() : 0;
  if (!m || team < 0 || team > 1) return;
  Team *t = m->GetTeam(team);
  if (!t) return;
  std::vector<Player*> active;
  t->GetActivePlayers(active);
  std::vector<Player*> outfield;
  for (unsigned int i = 0; i < active.size(); i++) {
    Player *pl = active[i];
    if (pl && t->GetFormationEntry(pl->GetID()).role != e_PlayerRole_GK) outfield.push_back(pl);
  }
  if (outfield.empty()) return;
  int idx = (int)(m->GetActualTime_ms() % outfield.size()); // cheap pseudo-random pick
  outfield[idx]->SendOff();
}

// Referee dialogue: the last name of the active player nearest the referee (the one
// the ref would talk to when play is stopped). Returned as a C string for JS ccall.
extern "C" EMSCRIPTEN_KEEPALIVE const char* gpf_ref_nearest_name() {
  static std::string name;
  name.clear();
  boost::shared_ptr<GameTask> gt = GetGameTask();
  Match *m = gt ? gt->GetMatch() : 0;
  if (!m || !m->GetOfficials() || !m->GetOfficials()->GetReferee()) return name.c_str();
  Vector3 refPos = m->GetOfficials()->GetReferee()->GetPosition();
  std::vector<Player*> players;
  m->GetActiveTeamPlayers(0, players);
  m->GetActiveTeamPlayers(1, players);
  float best = 1e18f; Player *bp = 0;
  for (unsigned int i = 0; i < players.size(); i++) {
    Player *p = players[i];
    if (!p) continue;
    float d = (p->GetPosition() - refPos).GetLength();
    if (d < best) { best = d; bp = p; }
  }
  if (bp && bp->GetPlayerData()) name = bp->GetPlayerData()->GetLastName();
  return name.c_str();
}

// Start talking to the nearest player: he turns to face the ref and stands (the
// override lives in elizacontroller.cpp). Returns his last name for the bubble.
extern "C" EMSCRIPTEN_KEEPALIVE const char* gpf_ref_talk_begin() {
  static std::string name; name.clear();
  gpf_talkPlayer = 0; gpf_talkOrder = 0;
  boost::shared_ptr<GameTask> gt = GetGameTask();
  Match *m = gt ? gt->GetMatch() : 0;
  if (!m || !m->GetOfficials() || !m->GetOfficials()->GetReferee()) return name.c_str();
  Vector3 refPos = m->GetOfficials()->GetReferee()->GetPosition();
  std::vector<Player*> players;
  m->GetActiveTeamPlayers(0, players);
  m->GetActiveTeamPlayers(1, players);
  float best = 1e18f; Player *bp = 0;
  for (unsigned int i = 0; i < players.size(); i++) {
    Player *p = players[i];
    if (!p) continue;
    float d = (p->GetPosition() - refPos).GetLength();
    if (d < best) { best = d; bp = p; }
  }
  if (bp) { gpf_talkPlayer = bp; if (bp->GetPlayerData()) name = bp->GetPlayerData()->GetLastName(); }
  return name.c_str();
}

// Give the talked-to player an order: 0 = stand & face, 1 = recule, 2 = approche.
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_ref_talk_order(int order) { gpf_talkOrder = order; }

// Stop talking: the player returns to normal AI play.
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_ref_talk_end() { gpf_talkPlayer = 0; gpf_talkOrder = 0; }

// Where the ball is right now, in world metres (axis 0=X downfield, 1=Y across,
// 2=Z up). Used by the headless test scripts to check that a traced set piece
// actually sent the ball where it was aimed.
extern "C" EMSCRIPTEN_KEEPALIVE float gpf_ball_pos(int axis) {
  boost::shared_ptr<GameTask> gt = GetGameTask();
  Match *m = gt ? gt->GetMatch() : 0;
  if (!m || !m->GetBall() || axis < 0 || axis > 2) return 0.0f;
  return m->GetBall()->Predict(0).coords[axis];
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
static void gpf_creditTouch(Match *m, int teamID); // defined below
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

  // "Forward" is the line from the BALL to the attacked goal, not the world X
  // axis. From the penalty spot or a free kick that is the same thing, but from
  // the CORNER flag the goal is almost sideways: sending the ball down the X axis
  // there just fires it over the byline, and left/right came out mirrored between the
  // two corners ("the corner drill is backwards"). Same fix as the in-match
  // corner in gpf_freekick_pass.
  Vector3 ballPos = m->GetBall()->Predict(0).Get2D();
  // a corner is a CROSS: aim into the box (around the penalty spot) rather than
  // straight down the byline, which is where the goal line itself points from the
  // corner flag.
  bool isCorner = (ref->GetDrillType() == e_SetPiece_Corner);
  float aimX = isCorner ? (pitchHalfW - 9.0f) : pitchHalfW;
  Vector3 target = Vector3(oppSide * aimX, 0.0f, 0.0f);
  Vector3 fwd = target - ballPos;
  if (fwd.GetLength() < 0.01f) fwd = Vector3((float)oppSide, 0.0f, 0.0f);
  fwd.Normalize();
  Vector3 lat = Vector3(fwd.coords[1], -fwd.coords[0], 0.0f); // perpendicular
  // ...and make that perpendicular point to the RIGHT OF THE SCREEN, whichever
  // corner (and whichever end) we are shooting from.
  float latSign = 1.0f;
  Vector3 camFwd = Vector3(0.0f, 1.0f, 0.0f);
  camFwd.Rotate(m->GetCameraNodeOrientation());
  camFwd.coords[2] = 0.0f;
  if (camFwd.GetLength() > 0.01f) {
    camFwd.Normalize();
    Vector3 camRight = Vector3(camFwd.coords[1], -camFwd.coords[0], 0.0f);
    if (lat.GetDotProduct(camRight) < 0.0f) { lat = lat * -1.0f; latSign = -1.0f; }
  }

  float speed = 20.0f + 15.0f * p;      // pace toward goal (m/s)
  Vector3 vel = (fwd + lat * (r * 0.55f)).GetNormalized() * speed;
  vel.coords[2] = 2.0f + u * 9.0f;      // loft (2..11 m/s)

  if (isCorner) {
    // A CROSS has to still be in the air when it reaches the box — with a flat
    // shot's loft it bounced twice on the way ("il rebondit"). Pick the climb
    // that lands the ball around head height at the target: with time of flight
    // t = dist / speed, z(t) = vz*t - g/2*t^2 = 2m  =>  vz = (2 + g/2*t^2) / t.
    // The trace's up-stroke then makes it flatter (0.75x) or higher (1.25x).
    speed = 17.0f + 8.0f * p;           // a cross, not a rocket
    float dist = (target - ballPos).GetLength();
    float t = dist / std::max(speed, 6.0f);
    float vzIdeal = (2.0f + 4.905f * t * t) / std::max(t, 0.25f);
    vel = (fwd + lat * (r * 0.55f)).GetNormalized() * speed;
    vel.coords[2] = clamp(vzIdeal * (0.75f + 0.5f * u), 4.0f, 16.0f);
  }

  m->GetBall()->Touch(vel);
  // Magnus swerve = momentumDir x (-rotVec); a Z spin bends the ball horizontally.
  // Working it out, swerve = zSpin * perpendicular-CCW(dir), and `lat` above is
  // perpendicular-CW, so zSpin = -curl * M curves the ball toward `lat` — i.e.
  // toward the right of the screen — from any corner and either end.
  // Engine's own shots use zRot up to ~+-420; 350 is a strong-but-sane full curl.
  gpf_creditTouch(m, ref->GetDrillTeam()); // training shots count as OUR touch too
  m->GetBall()->SetRotation(0.0f, 0.0f, -latSign * c * 350.0f, 1.0f);
  ref->NotifyDrillShotTaken();
}

// In-match offside free kick: the human traced a line toward a team-mate. Pass the
// ball in that direction (screen-right -> world lateral, screen-up -> loft, chord
// length -> pace), then end the set piece so play resumes.
// Record WHO played the ball when the page launches it directly (traced penalty,
// free kick, corner, throw-in). Without this the engine sees a ball that nobody
// touched, so a goal from it is judged an OWN GOAL — the user scored a penalty
// and the radio congratulated the other team.
// Which team last struck the ball FROM THE PAGE (traced penalty / free kick /
// corner / throw-in), and when. The own-goal test in Match reads this: a ball we
// launch ourselves has no real "last touch", so without it a scored penalty was
// judged an own goal.
int gpf_lastShotTeam = -1;
unsigned long gpf_lastShotTime_ms = 0;

static void gpf_creditTouch(Match *m, int teamID) {
  if (!m || teamID < 0 || teamID > 1) return;
  Team *t = m->GetTeam(teamID);
  if (!t) return;
  // remember it directly — this is what actually settles the own-goal question
  gpf_lastShotTeam = teamID;
  gpf_lastShotTime_ms = m->GetActualTime_ms();
  Player *taker = t->GetController() ? t->GetController()->GetPieceTaker() : 0;
  if (!taker) taker = t->GetDesignatedTeamPossessionPlayer();
  if (!taker) {
    // last resort: whoever of ours stands closest to the ball is the taker
    Vector3 ball = m->GetBall() ? m->GetBall()->Predict(0).Get2D() : Vector3(0, 0, 0);
    std::vector<Player*> act;
    t->GetActivePlayers(act);
    float best = 1e18f;
    for (unsigned int i = 0; i < act.size(); i++) {
      if (!act[i]) continue;
      float d = (act[i]->GetPosition().Get2D() - ball).GetLength();
      if (d < best) { best = d; taker = act[i]; }
    }
  }
  if (taker) t->SetLastTouchPlayer(taker, e_TouchType_Intentional_Kicked);
}

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
  // Screen-relative aim. The human draws the line ON SCREEN, so "forward" and
  // "right" must come from the LIVE CAMERA, not a fixed world axis. The corner
  // camera looks down the corner->goal diagonal (and mirrors between the two
  // corners), so a fixed axis sent the pass the wrong way there ("it does what I
  // did on the other side"). Camera identity faces +Y, so rotate that.
  Vector3 fwd = Vector3(0.0f, 1.0f, 0.0f);
  fwd.Rotate(m->GetCameraNodeOrientation());
  fwd.coords[2] = 0.0f;
  if (fwd.GetLength() < 0.01f) fwd = Vector3((float)oppSide, 0.0f, 0.0f); // degenerate: fall back downfield
  fwd.Normalize();
  Vector3 lat = Vector3(fwd.coords[1], -fwd.coords[0], 0.0f); // camera-right perpendicular
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

  // A THROW-IN taker HOLDS the ball (retain animation), so the ball is glued to
  // his hands and Touch() gets overwritten every frame — the throw never left.
  // Release the retainer first so the ball actually flies.
  if (m->GetBallRetainer()) m->SetBallRetainer(0);
  gpf_creditTouch(m, kickTeam);
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

  gpf_creditTouch(m, ref->GetPenaltyTeam());
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

// ============================ ONLINE MULTIPLAYER =============================
// Deterministic lockstep. Both peers run the identical seeded sim; each captures
// its local keyboard once per tick, sends it to the peer tagged with a future
// frame (input delay to hide latency), and feeds the peer's input into a synthetic
// device. The sim advances a frame only once the remote input for that frame is in.
HIDNet *gpf_localNetDev = 0;
HIDNet *gpf_remoteNetDev = 0;
bool gpf_onlineActive = false;
int gpf_onlineRole = 0;               // 0 = host (team 0), 1 = joiner (team 1)
static int gpf_netDelay = 10;         // kept only for the tuning bridge (unused now)
static long gpf_netFrame = 0;
struct GpfNetInput { unsigned int mask; float dx; float dy; };
static GpfNetInput gpf_lastRemote = { 0, 0.f, 0.f };  // peer's newest input, held until the next packet

extern "C" EMSCRIPTEN_KEEPALIVE void gpf_net_start(int role) {
  gpf_onlineActive = true; gpf_onlineRole = role;
  gpf_netFrame = 0; gpf_lastRemote.mask = 0; gpf_lastRemote.dx = 0.f; gpf_lastRemote.dy = 0.f;
}
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_net_stop() {
  gpf_onlineActive = false;
}
// Tune the input-delay buffer (frames). Higher = smoother over a laggy link but
// more input lag. BOTH peers must use the same value. Clamped 4..30.
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_net_set_delay(int d) {
  gpf_netDelay = d < 4 ? 4 : (d > 30 ? 30 : d);
}
// Peer's latest input. The frame tag is ignored now — we no longer lockstep on
// exact frames (each machine runs its own sim at its own speed and the host's
// periodic snapshot re-aligns them), so we just hold the newest input.
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_net_feed(int frame, unsigned int mask, float dx, float dy) {
  (void)frame;
  gpf_lastRemote.mask = mask; gpf_lastRemote.dx = dx; gpf_lastRemote.dy = dy;
}
// diagnostics
extern "C" EMSCRIPTEN_KEEPALIVE int gpf_net_frame() { return (int)gpf_netFrame; }
extern "C" EMSCRIPTEN_KEEPALIVE int gpf_net_remote_count() { return (int)gpf_lastRemote.mask; }
long gpf_ppCalls = 0;
extern "C" EMSCRIPTEN_KEEPALIVE int gpf_net_ppcalls() { return (int)gpf_ppCalls; }
extern "C" EMSCRIPTEN_KEEPALIVE int gpf_net_state() {
  int s = 0;
  if (gpf_onlineActive) s |= 1;
  if (gpf_localNetDev && gpf_remoteNetDev) s |= 2;
  boost::shared_ptr<GameTask> gt = GetGameTask();
  if (gt && gt->GetMatch()) s |= 4;
  return s;
}

// Sample the physical keyboard (player-1 mapping) → 16-bit button mask + direction.
static GpfNetInput gpf_sampleLocalInput() {
  GpfNetInput in; in.mask = 0; in.dx = 0; in.dy = 0;
  for (int i = 0; i < 16; i++) {
    if (UserEventManager::GetInstance().GetKeyboardState(defaultKeyIDs[i])) in.mask |= (1u << i);
  }
  float rx = (((in.mask >> e_ButtonFunction_Right) & 1u) ? 1.f : 0.f) - (((in.mask >> e_ButtonFunction_Left) & 1u) ? 1.f : 0.f);
  float ry = (((in.mask >> e_ButtonFunction_Up) & 1u) ? 1.f : 0.f) - (((in.mask >> e_ButtonFunction_Down) & 1u) ? 1.f : 0.f);
  float len = sqrtf(rx * rx + ry * ry);
  if (len > 0.001f) { in.dx = rx / len; in.dy = ry / len; }
  return in;
}

// One online tick. NON-BLOCKING: sample my input, broadcast it to the peer, and
// drive both synthetic devices (mine live + the peer's latest held input). Each
// machine runs its own sim at its own speed — the tablet no longer drags the PC
// down waiting for it. Drift between the two is corrected by the host's periodic
// position snapshot (gpf_net_snapshot / gpf_net_apply_snapshot).
static void gpf_net_tick() {
  if (!gpf_localNetDev || !gpf_remoteNetDev) return;
  GpfNetInput li = gpf_sampleLocalInput();
  EM_ASM({ if (typeof window !== "undefined" && window.gpfNetSend) window.gpfNetSend($0, $1, $2, $3); },
         (int)gpf_netFrame, (int)li.mask, li.dx, li.dy);
  gpf_localNetDev->Feed(li.mask, li.dx, li.dy);
  gpf_remoteNetDev->Feed(gpf_lastRemote.mask, gpf_lastRemote.dx, gpf_lastRemote.dy);
  gpf_netFrame++;
}

// HOST AUTHORITY — serialize the ball + every active player into a compact string
// "bx,by,bz;id,x,y,z,dx,dy;id,...". The joiner applies it to snap its sim back in
// line so the two screens can't drift apart forever. Positions are the logical
// (feet) positions; dx,dy is the facing direction so players keep their heading.
extern "C" EMSCRIPTEN_KEEPALIVE const char* gpf_net_snapshot() {
  static std::string out; out.clear();
  boost::shared_ptr<GameTask> gt = GetGameTask();
  Match *m = gt ? gt->GetMatch() : 0;
  if (!m) return out.c_str();
  char buf[160];
  Vector3 b = m->GetBall() ? m->GetBall()->GetPositionBuffer() : Vector3(0, 0, 0);
  snprintf(buf, sizeof(buf), "%.2f,%.2f,%.2f", b.coords[0], b.coords[1], b.coords[2]);
  out = buf;
  std::vector<Player*> players;
  m->GetActiveTeamPlayers(0, players);
  m->GetActiveTeamPlayers(1, players);
  for (unsigned int i = 0; i < players.size(); i++) {
    Player *p = players[i];
    if (!p) continue;
    Vector3 pos = p->GetPosition();
    Vector3 dir = p->GetDirectionVec();
    snprintf(buf, sizeof(buf), ";%d,%.2f,%.2f,%.2f,%.3f,%.3f",
             p->GetID(), pos.coords[0], pos.coords[1], pos.coords[2], dir.coords[0], dir.coords[1]);
    out += buf;
  }
  return out.c_str();
}

// JOINER — apply a host snapshot: teleport the ball and every named player to the
// host's authoritative position/heading. Called ~every 2s, so the small visual
// jump is rare and the two screens stay showing the same match.
extern "C" EMSCRIPTEN_KEEPALIVE void gpf_net_apply_snapshot(const char *data) {
  boost::shared_ptr<GameTask> gt = GetGameTask();
  Match *m = gt ? gt->GetMatch() : 0;
  if (!m || !data) return;
  float bx, by, bz;
  if (sscanf(data, "%f,%f,%f", &bx, &by, &bz) == 3 && m->GetBall()) {
    // Only correct the ball once it has genuinely drifted (> ~2.5 m). Teleporting
    // it every 0.75s yanked it out from under a player mid-shot.
    Vector3 cb = m->GetBall()->GetPositionBuffer();
    float bdx = cb.coords[0] - bx, bdy = cb.coords[1] - by;
    if (bdx * bdx + bdy * bdy > 6.25f) m->GetBall()->SetPosition(Vector3(bx, by, bz));
  }
  std::vector<Player*> players;
  m->GetActiveTeamPlayers(0, players);
  m->GetActiveTeamPlayers(1, players);
  // The players a HUMAN is steering must be left alone unless they are wildly out
  // of place: ResetPosition restarts the humanoid animation, which CANCELS a shot
  // being charged. Snapping them every 0.75s made shooting impossible online
  // ("quand on voulait tirer on ne pouvait pas, ça passait à autre chose").
  std::vector<Player*> humanControlled;
  for (int t = 0; t < 2; t++) {
    Team *tm = m->GetTeam(t);
    if (!tm) continue;
    for (unsigned int i = 0; i < tm->GetHumanGamerCount(); i++) {
      HumanGamer *hg = tm->GetHumanGamer(i);
      if (hg && hg->GetSelectedPlayer()) humanControlled.push_back(hg->GetSelectedPlayer());
    }
  }
  const char *seg = strchr(data, ';');
  while (seg) {
    seg++; // step past ';'
    int id; float x, y, z, dx, dy;
    if (sscanf(seg, "%d,%f,%f,%f,%f,%f", &id, &x, &y, &z, &dx, &dy) == 6) {
      for (unsigned int i = 0; i < players.size(); i++) {
        if (players[i] && players[i]->GetID() == id) {
          // Only hard-snap a player who has actually DRIFTED (> ~1.5 m). Players
          // still roughly in sync are left alone, so the correction stops making
          // the whole team jump every tick — only the out-of-place ones snap.
          Vector3 cur = players[i]->GetPosition();
          float ddx = cur.coords[0] - x, ddy = cur.coords[1] - y;
          bool human = false;
          for (unsigned int h = 0; h < humanControlled.size(); h++) {
            if (humanControlled[h] == players[i]) { human = true; break; }
          }
          // 1.5 m for the AI, 8 m for a human-steered player — far enough that his
          // shot/dribble is never interrupted, close enough that he can't drift off.
          const float limit = human ? 64.0f : 2.25f;
          if (ddx * ddx + ddy * ddy > limit) {
            players[i]->ResetPosition(Vector3(x, y, z), Vector3(x + dx * 2.f, y + dy * 2.f, z));
          }
          break;
        }
      }
    }
    seg = strchr(seg, ';');
  }
}

void GameTask::ProcessPhase() {

  gpf_ppCalls++;
  // Online: broadcast my input + apply the peer's, then sim NORMALLY (no waiting).
  // The sim never blocks on the network anymore — the host's periodic snapshot
  // (applied on the joiner) is what keeps the two screens from drifting apart.
  // keep an injured player DOWN: the humanoid holds the last frame of the fall once he
  // is actually lying down (see Humanoid::Process), so this only has to keep retrying
  // until a lay_front/lay_back trip anim was picked (TripMe is a no-op while he's down).
  if (gpf_injuredPlayer && match) {
    if (++gpf_injuredTick >= 60) {
      gpf_injuredTick = 0;
      static_cast<Player*>(gpf_injuredPlayer)->TripMe(
          static_cast<Player*>(gpf_injuredPlayer)->GetDirectionVec(), 3);
    }
  }

  if (gpf_onlineActive && match) gpf_net_tick();

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
