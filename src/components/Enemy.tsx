import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';
import { useFrustumCulling } from '../systems/optimizations';

export function Enemy({ position }: { position: [number, number, number] }) {
  const rigidBodyRef = useRef<any>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const [health, setHealth] = useState(100);
  const currentRoomId = useGameStore((state) => state.currentRoomId);
  const targetPosition = useRef(new THREE.Vector3());
  const moveDirection = useRef(new THREE.Vector3());
  const currentVelocity = useRef(new THREE.Vector3());
  const room = useGameStore.getState().currentLevel?.rooms.find(r => r.id === currentRoomId);
  const attackCooldown = useRef(0);

  // Add frustum culling for performance optimization
  useFrustumCulling(meshRef, 1.5); // 1.5 is the bounding sphere size

  useFrame((_state, delta) => {
    if (!meshRef.current || !rigidBodyRef.current || health <= 0) return;

    attackCooldown.current -= delta;
    const playerPos = useGameStore.getState().player.position;
    const distance = new THREE.Vector3(position[0], 0, position[2]).distanceTo(
      new THREE.Vector3(playerPos.x, 0, playerPos.z)
    );

    if (distance < 2 && attackCooldown.current <= 0) {
      attackCooldown.current = 1; // Reset cooldown
      const enemy = room?.enemies.find((e) => e.position.x === position[0] && e.position.z === position[2]);
      if (enemy) {
        let damage = 10; // Normal enemy default
        if (enemy.type === 'Elite') damage = 20;
        else if (enemy.type === 'Boss') damage = 50;
        useGameStore.getState().takeDamage(damage);
      }
    }

    const currentPos = meshRef.current.getWorldPosition(new THREE.Vector3());
    targetPosition.current.copy(playerPos).sub(currentPos);

    // Check if line of sight to player is clear
    const canSeePlayer = checkLineOfSight(currentPos, new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z), room?.layout);

    if (distance < 15 && distance > 2 && canSeePlayer) {
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

// Helper function to check line of sight for enemies
function checkLineOfSight(start: THREE.Vector3, end: THREE.Vector3, layout?: number[][]) {
  if (!layout) return true;
  
  // Simple raycasting through the grid-based level layout
  const distance = start.distanceTo(end);
  const steps = Math.ceil(distance * 2); // 2 samples per unit distance
  
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const point = new THREE.Vector3().lerpVectors(start, end, t);
    
    // Check if this point is inside a wall
    const gridX = Math.floor(point.x);
    const gridZ = Math.floor(point.z);
    
    // Skip if outside layout bounds
    if (gridX < 0 || gridZ < 0 || gridZ >= layout.length || gridX >= layout[0].length) {
      continue;
    }
    
    // If we hit a wall (0), no line of sight
    if (layout[gridZ][gridX] === 0) {
      return false;
    }
  }
  
  return true;
}