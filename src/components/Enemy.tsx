import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';

export function Enemy({ position }: { position: [number, number, number] }) {
  const rigidBodyRef = useRef(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const [health, setHealth] = useState(100);
  const player = useGameStore((state) => state.player);
  const targetPosition = useRef(new THREE.Vector3());
  const moveDirection = useRef(new THREE.Vector3());
  const currentVelocity = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    if (!meshRef.current || !rigidBodyRef.current) return;

    // Get player position from store
    const playerPos = new THREE.Vector3(
      player.position.x,
      player.position.y,
      player.position.z
    );

    // Calculate direction to player
    const currentPos = meshRef.current.getWorldPosition(new THREE.Vector3());
    targetPosition.current.copy(playerPos).sub(currentPos);
    
    const distance = targetPosition.current.length();
    
    // Only move if player is within range
    if (distance < 15 && distance > 2) {
      moveDirection.current.copy(targetPosition.current).normalize();
      
      // Apply movement with acceleration and damping
      const speed = 3;
      const acceleration = 8;
      const damping = 0.95;

      // Update velocity with acceleration
      currentVelocity.current.x += moveDirection.current.x * acceleration * delta;
      currentVelocity.current.z += moveDirection.current.z * acceleration * delta;

      // Apply damping
      currentVelocity.current.multiplyScalar(damping);

      // Apply speed limit
      if (currentVelocity.current.lengthSq() > speed * speed) {
        currentVelocity.current.normalize().multiplyScalar(speed);
      }

      // Update physics body velocity
      const rigidBody = rigidBodyRef.current;
      const linvel = rigidBody.linvel();
      rigidBody.setLinvel({
        x: currentVelocity.current.x,
        y: linvel.y,
        z: currentVelocity.current.z
      });

      // Rotate towards player
      const angle = Math.atan2(
        moveDirection.current.x,
        moveDirection.current.z
      );
      meshRef.current.rotation.y = angle;
    }
  });

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