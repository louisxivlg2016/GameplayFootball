import { BallCollider, RigidBody } from "@react-three/rapier";
import { useQueryFirst } from "koota/react";
import { BallRef, IsBall } from "../game/traits";
import { PITCH } from "../game/levels";

export function Ball(): React.ReactNode {
  const ball = useQueryFirst(IsBall);
  if (!ball) return null;
  return (
    <RigidBody
      ref={(rb) => {
        const h = ball.isAlive() ? ball.get(BallRef) : undefined;
        if (h) h.value = rb;
      }}
      colliders={false}
      position={[0, PITCH.ballRadius, 0]}
      ccd
      canSleep={false}
      angularDamping={2}
    >
      {/* restitution 0.62 straight from ball.cpp:23 */}
      <BallCollider
        args={[PITCH.ballRadius]}
        restitution={0.62}
        friction={0.3}
      />
      {/* rendered slightly larger than physical so the telephoto cam can see it */}
      <mesh castShadow position={[0, 0.06, 0]}>
        <sphereGeometry args={[0.17, 24, 16]} />
        <meshStandardMaterial color="#fafafa" roughness={0.4} />
      </mesh>
    </RigidBody>
  );
}
