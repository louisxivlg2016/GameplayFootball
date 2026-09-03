// written by bastiaan konings schuiling 2008 - 2015
// this work is public domain. the code is undocumented, scruffy, untested, and should generally not be used for anything important.
// i do not offer support, so don't ask. to be used for inspiration :)

#include "refereecontroller.hpp"

#include <cmath>

#include "../../AIsupport/AIfunctions.hpp"

#include "../../match.hpp"
#include "../playerofficial.hpp"

#include "../../../main.hpp"

// First-person referee mode: the human walks the ref. gpf_refMoveX/Y is the
// camera-relative steering from the keyboard (set via gpf_ref_walk); gpf_refereeMode
// gates it. Defined in gametask.cpp.
extern bool gpf_refereeMode;
extern float gpf_refMoveX;
extern float gpf_refMoveY;
extern float gpf_refCamYaw;   // manual look heading (radians)
extern bool gpf_refCamManual; // true once the human has turned the view

RefereeController::RefereeController(Match *match) : IController(match) {
}

RefereeController::~RefereeController() {
  if (Verbose()) printf("exiting refereecontroller.. ");
  if (Verbose()) printf("done\n");
}

PlayerOfficial *RefereeController::CastPlayer() { return static_cast<PlayerOfficial*>(player); }

void RefereeController::GetForceField(std::vector<ForceSpot> &forceField) {
 {
   ForceSpot forceSpot;
   forceSpot.origin = match->GetBall()->GetAveragePosition(2000).Get2D() * 0.6f;
   forceSpot.magnetType = e_MagnetType_Attract;
   forceSpot.decayType = e_DecayType_Constant;
   forceSpot.power = 0.5f;
   forceField.push_back(forceSpot);
  }

 {
   ForceSpot forceSpot;
   forceSpot.origin = match->GetBall()->Predict(200).Get2D();
   forceSpot.magnetType = e_MagnetType_Repel;
   forceSpot.decayType = e_DecayType_Variable;
   forceSpot.power = 0.5f;
   forceSpot.scale = 10.0f;
   forceField.push_back(forceSpot);
  }

  std::vector<Player*> players;
  match->GetActiveTeamPlayers(0, players); // todo: only closest players will do
  match->GetActiveTeamPlayers(1, players);
  for (unsigned int i = 0; i < players.size(); i++) {
    ForceSpot forceSpot;
    forceSpot.origin = players.at(i)->GetPosition() + players.at(i)->GetMovement() * 0.4f;
    forceSpot.magnetType = e_MagnetType_Repel;
    forceSpot.decayType = e_DecayType_Variable;
    forceSpot.power = 0.5f;
    forceSpot.scale = 10.0f;
    forceField.push_back(forceSpot);
  }
}

void RefereeController::RequestCommand(PlayerCommandQueue &commandQueue) {

  switch (CastPlayer()->GetOfficialType()) {

    case e_OfficialType_Referee:

      if (gpf_refereeMode) {
        // Human-walked first-person referee: steer with the keyboard (camera-relative,
        // where "forward" = toward the ball since the FP camera watches the ball),
        // and always look at the ball.
        Vector3 refPos = CastPlayer()->GetPosition();
        Vector3 ballPos = match->GetBall()->Predict(0).Get2D();
        // "forward" follows where the camera looks: the manual heading once the human
        // has turned the view, otherwise toward the ball (the auto FP camera target).
        Vector3 fwd;
        if (gpf_refCamManual) fwd = Vector3(cos(gpf_refCamYaw), sin(gpf_refCamYaw), 0);
        else { fwd = (ballPos - refPos).Get2D(); if (fwd.GetLength() > 0.01f) fwd = fwd.GetNormalized(); else fwd = Vector3(1, 0, 0); }
        Vector3 right = Vector3(fwd.coords[1], -fwd.coords[0], 0);
        Vector3 moveDir = fwd * gpf_refMoveY + right * gpf_refMoveX;

        PlayerCommand command;
        command.desiredFunctionType = e_FunctionType_Movement;
        command.useDesiredMovement = true;
        command.useDesiredLookAt = true;
        float mag = moveDir.GetLength();
        if (mag > 0.05f) {
          Vector3 dir = moveDir.GetNormalized(CastPlayer()->GetDirectionVec());
          command.desiredDirection = dir;
          command.desiredLookAt = refPos + dir * 5.0f;   // FACE where you run (players can't strafe)
          command.desiredVelocityFloat = clamp(mag * sprintVelocity, walkVelocity, sprintVelocity);
        } else {
          command.desiredDirection = CastPlayer()->GetDirectionVec();
          command.desiredLookAt = ballPos;               // idle: watch the ball
          command.desiredVelocityFloat = idleVelocity;
        }
        commandQueue.push_back(command);
        break;
      }

      if (match->GetReferee()->GetBuffer().active == true &&
          (match->GetReferee()->GetCurrentFoulType() == 2 || match->GetReferee()->GetCurrentFoulType() == 3) &&
          match->GetReferee()->GetBuffer().prepareTime > match->GetActualTime_ms() + 5000) { // FOUL, walk towards offender

        Vector3 desiredPosition = match->GetReferee()->GetCurrentFoulPlayer()->GetPosition() + (CastPlayer()->GetPosition() - match->GetReferee()->GetCurrentFoulPlayer()->GetPosition()).GetNormalized(0) * 2.0;

        if ((CastPlayer()->GetPosition() - desiredPosition).GetLength() > 2.0) {
          PlayerCommand command;
          command.desiredFunctionType = e_FunctionType_Movement;
          command.useDesiredMovement = true;
          command.useDesiredLookAt = true;
          command.desiredDirection = (desiredPosition - CastPlayer()->GetPosition()).GetNormalized(CastPlayer()->GetDirectionVec());
          command.desiredVelocityFloat = RangeVelocity((desiredPosition - CastPlayer()->GetPosition()).GetLength() * 1.0f);
          command.desiredLookAt = match->GetReferee()->GetCurrentFoulPlayer()->GetPosition();
          commandQueue.push_back(command);
        } else {
          {
          PlayerCommand command;
          command.desiredFunctionType = e_FunctionType_Special;
          command.useDesiredMovement = false;
          command.useDesiredLookAt = false;
          command.useSpecialVar1 = true;
          command.specialVar1 = 3;
          commandQueue.push_back(command);
          }

          {
          PlayerCommand command;
          command.desiredFunctionType = e_FunctionType_Movement;
          command.useDesiredMovement = true;
          command.useDesiredLookAt = true;
          command.desiredDirection = (desiredPosition - CastPlayer()->GetPosition()).GetNormalized(CastPlayer()->GetDirectionVec());
          command.desiredVelocityFloat = idleVelocity;
          command.desiredLookAt = match->GetReferee()->GetCurrentFoulPlayer()->GetPosition();
          commandQueue.push_back(command);
          }
        }

      } else { // NORMAL

        PlayerCommand command;
        command.desiredFunctionType = e_FunctionType_Movement;
        command.useDesiredMovement = true;
        command.useDesiredLookAt = true;

        std::vector<ForceSpot> forceField;
        GetForceField(forceField);
        Vector3 desiredPosition = CastPlayer()->GetPosition() + AI_GetForceFieldMovement(forceField, CastPlayer()->GetPosition());

        command.desiredDirection = (desiredPosition - CastPlayer()->GetPosition()).GetNormalized(CastPlayer()->GetDirectionVec());
        command.desiredVelocityFloat = clamp((desiredPosition - CastPlayer()->GetPosition()).GetLength() * distanceToVelocityMultiplier * 0.5f, idleVelocity, sprintVelocity); // take it easy, we are the ref
        command.desiredLookAt = match->GetBall()->Predict(60).Get2D();

        commandQueue.push_back(command);
      }
      break;

    case e_OfficialType_Linesman:
      {
        PlayerCommand command;
        command.desiredFunctionType = e_FunctionType_Movement;
        command.useDesiredMovement = true;
        command.useDesiredLookAt = true;

        float offside;
        Vector3 desiredPosition;
        if (player->GetPosition().coords[1] < 0) {
          offside = AI_GetOffsideLine(match, match->GetMentalImage(0), 1);
          desiredPosition = Vector3(offside, -(pitchHalfH + 0.8f), 0);
        } else {
          offside = AI_GetOffsideLine(match, match->GetMentalImage(0), 0);
          desiredPosition = Vector3(offside, pitchHalfH + 0.8f, 0);
        }

        command.desiredDirection = (desiredPosition - CastPlayer()->GetPosition()).GetNormalized(CastPlayer()->GetDirectionVec());
        command.desiredVelocityFloat = RangeVelocity((desiredPosition - CastPlayer()->GetPosition()).GetLength() * distanceToVelocityMultiplier);
        command.desiredLookAt = Vector3(desiredPosition.coords[0], 0, 0);

        commandQueue.push_back(command);
      }
      break;

  }
}

void RefereeController::Process() {
}

Vector3 RefereeController::GetDirection() {
  return player->GetDirectionVec();
}

float RefereeController::GetFloatVelocity() {
  return player->GetFloatVelocity();
}

int RefereeController::GetReactionTime_ms() {
  return 60;
}

void RefereeController::Reset() {
}
