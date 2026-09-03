// written by bastiaan konings schuiling 2008 - 2015
// this work is public domain. the code is undocumented, scruffy, untested, and should generally not be used for anything important.
// i do not offer support, so don't ask. to be used for inspiration :)

#include "team.hpp"

#include "match.hpp"

#include "../gamedefines.hpp"
#include "../utils.hpp"
#include "../main.hpp"

#include "AIsupport/AIfunctions.hpp"

#include "managers/resourcemanagerpool.hpp"

#ifdef __EMSCRIPTEN__
#include <SDL2/SDL.h>
#include <algorithm>
// national-team overrides (defined in gametask.cpp)
extern int gpf_natColorSet[2];
extern unsigned char gpf_natColor[2][3];
extern std::vector<std::string> gpf_natNames[2];
extern std::vector<int> gpf_natSkins[2];
extern float gpf_natStrength[2];

// Recolour a kit texture toward a solid national colour while keeping the
// original shading (folds, seams, shadows) so the shirt still looks like cloth
// instead of a flat fill. Operates in place on a private copy of the surface.
static void gpf_RecolorKit(SDL_Surface *s, const unsigned char col[3]) {
  if (!s) return;
  bool mustLock = SDL_MUSTLOCK(s);
  if (mustLock) SDL_LockSurface(s);
  const int bpp = s->format->BytesPerPixel;
  for (int y = 0; y < s->h; y++) {
    Uint8 *rowp = (Uint8 *)s->pixels + y * s->pitch;
    for (int x = 0; x < s->w; x++) {
      Uint8 *p = rowp + x * bpp;
      Uint32 pix = 0;
      if (bpp == 4) pix = *(Uint32 *)p;
      else if (bpp == 3) pix = p[0] | (p[1] << 8) | (p[2] << 16);
      else if (bpp == 2) pix = *(Uint16 *)p;
      else pix = *p;
      Uint8 r, g, b, a;
      SDL_GetRGBA(pix, s->format, &r, &g, &b, &a);
      float lum = (0.299f * r + 0.587f * g + 0.114f * b) / 255.0f;
      float shade = 0.30f + 1.00f * lum;      // keep highlights & shadows
      if (shade > 1.35f) shade = 1.35f;
      Uint8 nr = (Uint8)std::min(255.0f, col[0] * shade);
      Uint8 ng = (Uint8)std::min(255.0f, col[1] * shade);
      Uint8 nb = (Uint8)std::min(255.0f, col[2] * shade);
      Uint32 np = SDL_MapRGBA(s->format, nr, ng, nb, a);
      if (bpp == 4) *(Uint32 *)p = np;
      else if (bpp == 3) { p[0] = np & 0xff; p[1] = (np >> 8) & 0xff; p[2] = (np >> 16) & 0xff; }
      else if (bpp == 2) *(Uint16 *)p = (Uint16)np;
      else *p = (Uint8)np;
    }
  }
  if (mustLock) SDL_UnlockSurface(s);
}
#endif

Team::Team(int id, Match *match, TeamData *teamData) : id(id), match(match), teamData(teamData) {
  assert(id == 0 || id == 1);
  assert(teamData->GetPlayerNum() >= playerNum); // does team have enough players?

  teamNode = boost::intrusive_ptr<Node>(new Node("team node #" + int_to_str(id)));
  teamNode->SetLocalMode(e_LocalMode_Absolute);
  match->GetDynamicNode()->AddNode(teamNode);

  teamController = new TeamAIController(this);

  timeNeededToGetToBall_ms = 100;
  hasPossession = false;

  teamPossessionAmount = 1.0;
  fadingTeamPossessionAmount = 1.0;

  for (unsigned int i = 0; i < e_TouchType_SIZE; i++) {
    lastTouchPlayers[i] = 0;
  }
  lastTouchPlayer = 0;
  lastTouchType = e_TouchType_None;
}

Team::~Team() {
}

void Team::Exit() {

  Hide2D();

  for (unsigned int i = 0; i < humanGamers.size(); i++) {
    delete humanGamers.at(i);
  }
  for (unsigned int i = 0; i < players.size(); i++) {
    delete players.at(i);
  }

  delete teamController;

  playerNode->Exit();
  playerNode.reset();

  match->GetDynamicNode()->DeleteNode(teamNode);
}

void Team::InitPlayers(boost::intrusive_ptr<Node> fullbodyNode, std::map<Vector3, Vector3> &colorCoords) {

  // first, load 1 instance of a player

  Log(e_Notice, "Team", "InitPlayers", "Loading player template instance");

  ObjectLoader loader;
  playerNode = loader.LoadObject(GetScene3D(), "media/objects/players/player.object");
  playerNode->SetName("player");
  playerNode->SetLocalMode(e_LocalMode_Absolute);

  activePlayerCount = playerNum;

  Log(e_Notice, "Team", "Team", "Creating players");

#ifdef __EMSCRIPTEN__
  // one national-colour-tinted outfield kit for the whole team, built lazily on
  // the first outfield player and reused. Unique resource name per build so a
  // later match doesn't pick up a stale tint from the resource cache.
  boost::intrusive_ptr<Resource<Surface> > natKit;
#endif

#ifdef __EMSCRIPTEN__
  // The squad lists (squads.ts) are written striker-LAST, but the DB formations
  // are NOT consistent: on some teams slot 10 is the centre-forward, on others
  // it is the right midfielder (slot 9 being the CF). Assigning names by slot
  // number therefore parked the star striker out on the wing on half the teams.
  // So we remap: build the order the NAMES should follow, putting the last
  // outfield name on whichever slot actually is the centre-forward.
  std::vector<int> nameSlot; // nameSlot[slot] = index into gpf_natNames
  {
    int n = (signed int)teamData->GetPlayerNum();
    for (int i = 0; i < n; i++) nameSlot.push_back(i);
    if (!gpf_natNames[GetID()].empty() && n > 10) {
      int cf = -1, rm = -1;
      for (int i = 0; i < 11 && i < n; i++) {
        e_PlayerRole r = teamData->GetFormationEntry(i).role;
        if (r == e_PlayerRole_CF && cf < 0) cf = i;
        if ((r == e_PlayerRole_RM || r == e_PlayerRole_LM) && i >= 9 && rm < 0) rm = i;
      }
      // our list's striker is the 11th name (index 10); send it to the real CF
      if (cf >= 0 && cf != 10 && rm >= 0) { nameSlot[cf] = 10; nameSlot[rm] = cf; }
    }
  }
#endif

  // load all players in the team, even the players who sit on the bench. aww.
  for (int i = 0; i < (signed int)teamData->GetPlayerNum(); i++) {
    PlayerData *playerData = teamData->GetPlayerData(i);
#ifdef __EMSCRIPTEN__
    // real-squad names picked in the HTML menu (shirt order); before the player
    // builds its floating name caption from GetLastName().
    const int src = (i < (signed int)nameSlot.size()) ? nameSlot[i] : i;
    if (!gpf_natNames[GetID()].empty() && src < (signed int)gpf_natNames[GetID()].size()) {
      playerData->SetLastName(gpf_natNames[GetID()][src]);
    }
    // real skin tone per player (shirt order); set before the humanoid Activates
    // and fetches skin0<N>.png. 1..4 = skin01..skin04; 0 = keep the DB skin.
    if (!gpf_natSkins[GetID()].empty() && src < (signed int)gpf_natSkins[GetID()].size()) {
      int sc = gpf_natSkins[GetID()][src];
      if (sc >= 1 && sc <= 4) playerData->SetSkinColor(sc);
    }
#endif
    Player *player = new Player(this, playerData);
    players.push_back(player);
#ifdef __EMSCRIPTEN__
    // "Force réaliste": scale this player's felt sprint speed by the team's
    // OVR-based strength (1.0 = neutral). Read in PlayerBase::GetMaxVelocity.
    player->SetGpfStrength(gpf_natStrength[GetID()]);
#endif

    if (i < activePlayerCount) {
      // activate playerCount players (the starting eleven, usually)
      std::string kitFilename;
      bool isGK = GetFormationEntry(player->GetID()).role == e_PlayerRole_GK;
      //printf("%i player id\n", player->GetID());
      if (!isGK) {
        kitFilename = GetTeamData()->GetKitUrl() + "_kit_0" + int_to_str(GetMenuTask()->GetTeamKitNum(GetID())) + ".png";
        if (!boost::filesystem::exists(kitFilename)) kitFilename = (GetID() == 0) ? "media/textures/almost_white.png" : "media/textures/almost_black.png";
      } else {
        kitFilename = "media/objects/players/textures/goalie_kit.png";
      }
      kit = ResourceManagerPool::GetInstance().GetManager<Surface>(e_ResourceType_Surface)->Fetch(kitFilename);
#ifdef __EMSCRIPTEN__
      // tint the outfield kit to the picked nation's colour (goalies keep their
      // own kit). FetchCopy deep-copies the surface so the shared cache stays
      // clean; recolour once, reuse for every outfield player.
      if (gpf_natColorSet[GetID()] && !isGK) {
        if (natKit == boost::intrusive_ptr<Resource<Surface> >()) {
          static int natKitSeq = 0;
          std::string uname = "natkit_" + int_to_str(++natKitSeq);
          natKit = ResourceManagerPool::GetInstance().GetManager<Surface>(e_ResourceType_Surface)
                       ->FetchCopy(kitFilename, uname);
          gpf_RecolorKit(natKit->GetResource()->GetData(), gpf_natColor[GetID()]);
        }
        kit = natKit;
      }
#endif
      player->Activate(playerNode, fullbodyNode, colorCoords, kit, match->GetAnimCollection());
    }
  }

  designatedTeamPossessionPlayer = players.at(0);

}

signed int Team::GetSide() {
  signed int side;
  if (id == 0) side = -1;
  if (id == 1) side = 1;

  // -1 == left, 1 == right
  e_MatchPhase phase = match->GetMatchPhase();
  if (phase == e_MatchPhase_2ndHalf || phase == e_MatchPhase_2ndExtraTime) side *= -1;

  return side;
}

Player *Team::GetPlayer(int player_id) {
  for (int i = 0; i < (signed int)players.size(); i++) {
    if (players.at(i)->GetID() == player_id) {
      return players.at(i);
    }
  }

  // id not found
  return 0;
}

PlayerData *Team::GetPlayerData(int playerID) {
  for (int i = 0; i < (signed int)players.size(); i++) {
    if (players.at(i)->GetID() == playerID) {
      return teamData->GetPlayerData(i);
    }
  }

  assert(1 == 2);
  return 0;
}

FormationEntry Team::GetFormationEntry(int playerID) {
  for (int i = 0; i < (signed int)players.size(); i++) {
    if (players.at(i)->GetID() == playerID) {
      return teamData->GetFormationEntry(i);
    }
  }

  assert(1 == 2);
  FormationEntry fail;
  return fail;
}

void Team::SetFormationEntry(int playerID, FormationEntry entry) {
  for (int i = 0; i < (signed int)players.size(); i++) {
    if (players.at(i)->GetID() == playerID) {
      teamData->SetFormationEntry(i, entry);
    }
  }
}

void Team::GetActivePlayers(std::vector<Player*> &activePlayers) {
  for (auto player : players) {
    if (player->IsActive()) activePlayers.push_back(player);
  }
}

void Team::AddHumanGamer(IHIDevice *hid, e_PlayerColor color) {
  HumanGamer *humanGamer = new HumanGamer(this, hid, color);

  humanGamers.push_back(humanGamer);

  humanGamer->SetSelectedPlayerID(AI_GetClosestPlayer(this, match->GetBall()->Predict(0).Get2D(), true)->GetID());

  switchPriority.push_back(humanGamers.size() - 1);
  designatedTeamPossessionPlayer = AI_GetClosestPlayer(this, match->GetBall()->Predict(0).Get2D(), false);
}

void Team::DeleteHumanGamers() {
  for (unsigned int i = 0; i < humanGamers.size(); i++) {
    delete humanGamers.at(i);
  }
  humanGamers.clear();
  switchPriority.clear();
}

e_PlayerColor Team::GetPlayerColor(int playerID) {
  for (unsigned int h = 0; h < humanGamers.size(); h++) {
    if (humanGamers.at(h)->GetSelectedPlayerID() == playerID) return humanGamers.at(h)->GetPlayerColor();
  }
  return e_PlayerColor_Default;
}

bool Team::IsHumanControlled(int playerID) {
  for (unsigned int h = 0; h < humanGamers.size(); h++) {
    if (humanGamers.at(h)->GetSelectedPlayerID() == playerID) return true;
  }
  return false;
}

bool Team::HasPossession() const {
  return hasPossession;
}

bool Team::HasUniquePossession() const {
  return HasPossession() && !match->GetTeam(abs(id - 1))->HasPossession();
}

int Team::GetTimeNeededToGetToBall_ms() const {
  return timeNeededToGetToBall_ms;
}

signed int Team::GetBestPossessionPlayerID() {
  return GetBestPossessionPlayer()->GetID();
}

Player *Team::GetBestPossessionPlayer() {
  int bestTime_ms = 10000000;
  Player *bestPlayer = 0;
  for (unsigned int i = 0; i < players.size(); i++) {
    if (players.at(i)->IsActive()) {
      int time_ms = players.at(i)->GetTimeNeededToGetToBall_ms();
      if (time_ms < bestTime_ms) {
        bestTime_ms = time_ms;
        bestPlayer = players.at(i);
      }
    }
  }

  assert(bestPlayer);

  return bestPlayer;
}

float Team::GetTeamPossessionAmount() const {
  return teamPossessionAmount;
}

float Team::GetFadingTeamPossessionAmount() const {
  return fadingTeamPossessionAmount;
}

void Team::SetFadingTeamPossessionAmount(float value) {
  fadingTeamPossessionAmount = clamp(value, 0.5, 1.5);
}

void Team::SetLastTouchPlayer(Player *player, e_TouchType touchType) {
  lastTouchPlayers[touchType] = player;
  lastTouchPlayer = player;
  lastTouchType = touchType;
  player->SetLastTouchTime_ms(match->GetActualTime_ms());
  player->SetLastTouchType(lastTouchType);
  match->SetLastTouchTeamID(GetID(), touchType);
}

void Team::ResetSituation(const Vector3 &focusPos) {
  timeNeededToGetToBall_ms = 100;
  hasPossession = false;

  teamPossessionAmount = 1.0f;
  fadingTeamPossessionAmount = 1.0f;

  for (unsigned int i = 0; i < e_TouchType_SIZE; i++) {
    lastTouchPlayers[i] = 0;
  }
  lastTouchPlayer = 0;
  lastTouchType = e_TouchType_None;

  designatedTeamPossessionPlayer = players.at(0);

  for (unsigned int i = 0; i < players.size(); i++) {
    if (players.at(i)->IsActive()) {
      players.at(i)->ResetSituation(focusPos);
    }
  }

  GetController()->Reset();
}

void Team::HumanGamersSelectAnyone() {
  // make sure all human gamers have a player selected

  if (match->IsInPlay()) {
    for (unsigned int i = 0; i < humanGamers.size(); i++) {
      if (humanGamers.at(i)->GetSelectedPlayerID() == -1) {
        int playerID = AI_GetClosestPlayer(this, match->GetBall()->Predict(0).Get2D(), true)->GetID();
        humanGamers.at(i)->SetSelectedPlayerID(playerID);
      }
    }
  }
}

void Team::SelectPlayer(Player *player) {
  //printf("trying to switch to %s\n", player->GetPlayerData()->GetLastName().c_str());
  if (!IsHumanControlled(player->GetID()) && humanGamers.size() != 0) { // already selected
    humanGamers.at(*switchPriority.begin())->SetSelectedPlayerID(player->GetID());
    switchPriority.push_back(*switchPriority.begin());
    switchPriority.pop_front();
    if (Verbose()) printf("switched player to %s\n", player->GetPlayerData()->GetLastName().c_str());
  }
  designatedTeamPossessionPlayer = player;
}

void Team::DeselectPlayer(Player *player) {
  for (unsigned int i = 0; i < humanGamers.size(); i++) {
    int selectedPlayerID = humanGamers.at(i)->GetSelectedPlayerID();
    if (selectedPlayerID == player->GetID()) {
      Player *somePlayer = AI_GetClosestPlayer(this, player->GetPosition(), true, player);
      if (somePlayer) {
        humanGamers.at(i)->SetSelectedPlayerID(somePlayer->GetID());
      } else {
        humanGamers.at(i)->SetSelectedPlayerID(-1);
      }
    }
  }
}

void Team::RelaxFatigue(float howMuch) {
  for (unsigned int i = 0; i < players.size(); i++) {
    if (players.at(i)->IsActive()) {
      players.at(i)->RelaxFatigue(howMuch);
    }
  }
}

void Team::Process() {

  if (!match->GetPause()) {

    teamPossessionAmount = (float)(match->GetTeam(abs(GetID() - 1))->GetTimeNeededToGetToBall_ms() + 1500) / (float)(GetTimeNeededToGetToBall_ms() + 1500);
    float tmpFadingTeamPossessionAmount = fadingTeamPossessionAmount * 0.995f + clamp(teamPossessionAmount, 0.5f, 1.5f) * 0.005f;
    fadingTeamPossessionAmount += clamp(tmpFadingTeamPossessionAmount - fadingTeamPossessionAmount, -0.005f, 0.005f); // maximum change per 10ms

    if (!match->IsInPlay() || match->IsInSetPiece() || match->GetBallRetainer() != 0) {
      if (match->GetBallRetainer() != 0) {
        fadingTeamPossessionAmount = teamPossessionAmount = (match->GetBallRetainer()->GetTeamID() == GetID()) ? 1.5f : 0.5f;
      } else {
        fadingTeamPossessionAmount = teamPossessionAmount = (match->GetBestPossessionTeamID() == GetID()) ? 1.5f : 0.5f;
      }
    }

    HumanGamersSelectAnyone();

    if (match->IsInPlay() && !match->IsInSetPiece()) {
      teamController->Process();

      if ((match->GetActualTime_ms() + 200 * id) % 400 == 0) {
        teamController->CalculateDynamicRoles();
        //printf("dynamic roles calc team %i\n", id);
      }

      if ((match->GetActualTime_ms() + 200 * id + 100) % 400 == 0) {
        teamController->CalculateManMarking();
        //printf("man marking calc team %i\n", id);
      }
    }

    for (unsigned int i = 0; i < players.size(); i++) {
      if (players.at(i)->IsActive()) {
        players.at(i)->Process();
      }
    }

    if (match->IsInPlay()) {

      for (unsigned int i = 0; i < humanGamers.size(); i++) {

        // switch button
        int selectedPlayerID = humanGamers.at(i)->GetSelectedPlayerID();
        Player *selectedPlayer = 0;
        selectedPlayer = GetPlayer(selectedPlayerID);
        assert(selectedPlayer);

        if (humanGamers.at(i)->GetHIDevice()->GetButton(e_ButtonFunction_Switch) &&
            !humanGamers.at(i)->GetHIDevice()->GetPreviousButtonState(e_ButtonFunction_Switch) &&
            // don't switch if we are both best AND designated possession player. unless opponent team has ball.
            (!(selectedPlayerID == GetBestPossessionPlayerID() && selectedPlayerID == designatedTeamPossessionPlayer->GetID()) || GetTeamPossessionAmount() < 1.0f) &&
            !selectedPlayer->HasUniquePossession()) {

          int targetPlayerID = -1;
          Player *targetPlayer = 0;

          if (!IsHumanControlled(designatedTeamPossessionPlayer->GetID()) && match->GetBestPossessionTeamID() == GetID()) {
            targetPlayer = designatedTeamPossessionPlayer;
          } else if (!IsHumanControlled(GetBestPossessionPlayer()->GetID()) && match->GetBestPossessionTeamID() == GetID()) {
            targetPlayer = GetBestPossessionPlayer();
          } else {
            targetPlayer = AI_GetBestSwitchTargetPlayer(match, this, humanGamers.at(i)->GetHIDevice()->GetDirection());
            if (targetPlayer)
              if (IsHumanControlled(targetPlayer->GetID())) targetPlayer = 0;
          }
          if (targetPlayer == GetGoalie()) targetPlayer = 0; // can not be goalie in current version, at least not during play, unless being directly passed to by teammate

          if (targetPlayer) {
            targetPlayerID = targetPlayer->GetID();
          }
          if (targetPlayerID != -1) humanGamers.at(i)->SetSelectedPlayerID(targetPlayerID);
        }

      }

    } else {

      // make sure all human gamers don't have a player selected

      for (unsigned int i = 0; i < humanGamers.size(); i++) {
        if (humanGamers.at(i)->GetSelectedPlayerID() != -1) {
          humanGamers.at(i)->SetSelectedPlayerID(-1);
        }
      }

    }

    int designatedPlayerTime_ms = designatedTeamPossessionPlayer->GetTimeNeededToGetToBall_ms();
    Player *bestPlayer = GetBestPossessionPlayer();
    int oppTime_ms = match->GetTeam(abs(GetID() - 1))->GetTimeNeededToGetToBall_ms();
    if (designatedTeamPossessionPlayer != bestPlayer) {
      // switch only if other player is somewhat better, to overcome possession-chaos
      int bestPlayerTime_ms = bestPlayer->GetTimeNeededToGetToBall_ms();
      float timeRating = (float)(bestPlayerTime_ms + 500) / (float)(designatedPlayerTime_ms + 500);

      if (bestPlayer->HasPossession()) timeRating *= 0.5f;
      if (designatedTeamPossessionPlayer->HasPossession()) timeRating /= 0.5f;

      if (IsHumanControlled(bestPlayer->GetID())) timeRating *= 0.8f;
      if (IsHumanControlled(designatedTeamPossessionPlayer->GetID())) timeRating /= 0.8f;

      // current player can get to the ball before the closest opponent: less need to switch
      //if (GetID() == 0) printf("opptime: %i, designated time: %i\n", oppTime_ms, designatedPlayerTime_ms);
      if (IsHumanControlled(bestPlayer->GetID()) == false && designatedPlayerTime_ms < oppTime_ms - 100) {
        timeRating += 0.2f;
        timeRating *= 1.2f;
      }

      if (timeRating < 0.8f) {
        designatedTeamPossessionPlayer = bestPlayer;
      }
    }

    //printf("team id: %i, time: %i, other team id: %i, time: %i\n", GetID(), GetTimeNeededToGetToBall_ms(), match->GetTeam(abs(GetID() - 1))->GetID(), match->GetTeam(abs(GetID() - 1))->GetTimeNeededToGetToBall_ms());

  /*
    if (id == 0) {
      GetSmallDebugCircle1()->SetPosition(designatedTeamPossessionPlayer->GetPosition());
    } else {
      GetSmallDebugCircle2()->SetPosition(designatedTeamPossessionPlayer->GetPosition());
    }
  */

  }

}

void Team::PreparePutBuffers(unsigned long snapshotTime_ms) {
  for (unsigned int i = 0; i < players.size(); i++) {
    if (players.at(i)->IsActive()) {
      players.at(i)->PreparePutBuffers(snapshotTime_ms);
    }
  }
}

void Team::FetchPutBuffers(unsigned long putTime_ms) {
  for (unsigned int i = 0; i < players.size(); i++) {
    if (players.at(i)->IsActive()) {
      players.at(i)->FetchPutBuffers(putTime_ms);
    }
  }
}

void Team::Put() {
  for (unsigned int i = 0; i < players.size(); i++) {
    if (players.at(i)->IsActive()) {
      players.at(i)->Put();
    }
  }
}

void Team::Put2D() {
  for (unsigned int i = 0; i < players.size(); i++) {
    if (players.at(i)->IsActive()) {
      players.at(i)->Put2D();
    }
  }
}

void Team::Hide2D() {
  for (unsigned int i = 0; i < players.size(); i++) {
    if (players.at(i)->IsActive()) {
      players.at(i)->Hide2D();
    }
  }
}

void Team::UpdatePossessionStats() {
  for (unsigned int i = 0; i < players.size(); i++) {
    if (players.at(i)->IsActive()) {
      players.at(i)->UpdatePossessionStats();
    }
  }


  // possession?

  hasPossession = false;
  timeNeededToGetToBall_ms = 100000;
  for (int i = 0; i < (signed int)players.size(); i++) {
    if (players.at(i)->IsActive()) {
      if (players.at(i)->HasPossession()) hasPossession = true;
      if (players.at(i)->GetTimeNeededToGetToBall_ms() < timeNeededToGetToBall_ms) timeNeededToGetToBall_ms = players.at(i)->GetTimeNeededToGetToBall_ms();
    }
  }
}

void Team::UpdateSwitch() {

  // lose turn on ball possession

  if (match->IsInPlay() && humanGamers.size() > 1) {
    int myTurn = *switchPriority.begin();
    if (humanGamers.at(myTurn)->GetSelectedPlayerID() == match->GetDesignatedPossessionPlayer()->GetID()) {
      switchPriority.pop_front();
      switchPriority.push_back(myTurn);
    }
  }


  // autoswitch on proximity

#ifdef __EMSCRIPTEN__
  // Defending auto-switch: when we DON'T have the ball, keep the human on our
  // player quickest to it (the natural presser) instead of stranding them on
  // someone far from the action. Only switches when the currently controlled
  // player isn't already the closest, so it isn't twitchy, and never onto the
  // goalie. (Attacking selection is handled below when we regain the ball.)
  // NOT during set pieces / training drills: there the player is doing something
  // specific (keeping a penalty, taking a free kick) and auto-switching to an
  // outfielder there is both wrong and, in the keeper drill, was crashing.
  if (match->IsInPlay() && !match->IsInSetPiece() && humanGamers.size() > 0 &&
      !match->GetReferee()->IsDrillActive() && designatedTeamPossessionPlayer) {
    if (match->GetBestPossessionTeamID() != GetID() &&
        !IsHumanControlled(designatedTeamPossessionPlayer->GetID()) &&
        designatedTeamPossessionPlayer != GetGoalie() &&
        !designatedTeamPossessionPlayer->HasUniquePossession()) {
      SelectPlayer(designatedTeamPossessionPlayer);
    }
  }
#endif

  //if (GetID() == 0) printf("teamposs %f\n", GetTeamPossessionAmount());


  // team player in possession is not human selected

  if (match->IsInPlay() && humanGamers.size() > 0) {
    if (!IsHumanControlled(designatedTeamPossessionPlayer->GetID()) && (designatedTeamPossessionPlayer->HasUniquePossession() || match->IsInSetPiece())) {
      if (designatedTeamPossessionPlayer != GetGoalie()) {
        SelectPlayer(designatedTeamPossessionPlayer);
      }
    }
  }

}

Player *Team::GetGoalie() {
  for (unsigned int i = 0; i < players.size(); i++) {
    if (players.at(i)->IsActive()) {
      if (players.at(i)->GetFormationEntry().role == e_PlayerRole_GK) return players.at(i);
    }
  }

  return 0;
}

void Team::SetKitNumber(int num) {
  std::string kitNumberString = int_to_str(num);
  if (kitNumberString.size() < 2) kitNumberString = "0" + kitNumberString;
  std::string kitFilename = GetTeamData()->GetKitUrl() + "_kit_" + kitNumberString + ".png";
  if (!boost::filesystem::exists(kitFilename)) kitFilename = GetID() == 0 ? "media/textures/white.png" : "media/textures/black.png";

  // new kits on the block!
  boost::intrusive_ptr < Resource<Surface> > newKit = ResourceManagerPool::GetInstance().GetManager<Surface>(e_ResourceType_Surface)->Fetch(kitFilename);

  for (unsigned int i = 0; i < players.size(); i++) {
    if (players.at(i)->IsActive()) {
      if (players.at(i)->GetFormationEntry().role != e_PlayerRole_GK) players.at(i)->SetKit(newKit);
    }
  }

  kit = newKit;
}
