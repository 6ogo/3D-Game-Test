import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';

export function Enemy({ position }: { position: [number, number, number] }) {
  const rigidBodyRef = useRef<any>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const [health, setHealth] = useState(100);
  const player = useGameStore((state) => state.player);
  const currentRoomId = useGameStore((state) => state.currentRoomId);
  const targetPosition = useRef(new THREE.Vector3());
  const moveDirection = useRef(new THREE.Vector3());
  const currentVelocity = useRef(new THREE.Vector3());
  const attackCooldown = useRef(0);

  useFrame((state, delta) => {
    if (!meshRef.current || !rigidBodyRef.current || health <= 0) return;

    if (attackCooldown.current > 0) attackCooldown.current -= delta;

    const playerPos = new THREE.Vector3(player.position.x, player.position.y, player.position.z);
    const currentPos = meshRef.current.getWorldPosition(new THREE.Vector3());
    targetPosition.current.copy(playerPos).sub(currentPos);
    const distance = targetPosition.current.length();

    if (distance < 15 && distance > 2) {
      moveDirection.current.copy(targetPosition.current).normalize();
      const speed = 3;
      const acceleration = 8;
      const damping = 0.95;

      currentVelocity.current.x += moveDirection.current.x * acceleration * delta;
      currentVelocity.current.z += moveDirection.current.z * acceleration * delta;
      currentVelocity.current.multiplyScalar(damping);
      if (currentVelocity.current.lengthSq() > speed * speed) currentVelocity.current.normalize().multiplyScalar(speed);

      const rigidBody = rigidBodyRef.current;
      const linvel = rigidBody.linvel();
      rigidBody.setLinvel({ x: currentVelocity.current.x, y: linvel.y, z: currentVelocity.current.z });

      const angle = Math.atan2(moveDirection.current.x, moveDirection.current.z);
      meshRef.current.rotation.y = angle;
    }

    if (distance < 2 && attackCooldown.current <= 0) {
      attackCooldown.current = 1;
      useGameStore.getState().takeDamage(10);
    }

    // Sync health with store (simplified)
    const room = useGameStore.getState().currentLevel?.rooms.find(r => r.id === currentRoomId);
    const enemy = room?.enemies.find(e => e.position.x === position[0] && e.position.z === position[2]);
    if (enemy && enemy.health !== health) setHealth(enemy.health);
    if (health <= 0) useGameStore.getState().removeEnemy(currentRoomId!, enemy!.id);
  });

  if (health <= 0) return null;

  return (
    <RigidBody
      ref={rigidBodyRef}
      type="dynamic"
      position={position}
      mass={1}
      friction={0.7}
      restitution={0.2}
      lockRotations
      enabledRotations={[false, false, false]}
    >
      <CapsuleCollider args={[0.5, 0.5]} friction={1} />
      <mesh ref={meshRef} castShadow>
        <capsuleGeometry args={[0.5, 1, 4, 8]} />
        <meshStandardMaterial color="#ff4444" />
      </mesh>
    </RigidBody>
  );
}