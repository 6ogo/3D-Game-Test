import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../store/gameStore';
import * as THREE from 'three';
import { ProgressionSystem } from '../systems/progression';
import { CapsuleCollider, RigidBody } from '@react-three/rapier';
import { useKeyboardControls } from '@react-three/drei';
import { useFrustumCulling } from '../systems/optimizations';

export function Player() {
  const rigidBodyRef = useRef<any>(null);
  const meshRef = useRef<THREE.Group>(null);
  const { player, currentRoomId } = useGameStore();
  const currentLevel = useGameStore((state) => state.currentLevel);
  const setCurrentRoomId = useGameStore((state) => state.setCurrentRoomId);
  const moveDirection = useRef(new THREE.Vector3());
  const currentVelocity = useRef(new THREE.Vector3());
  const [isDashing, setIsDashing] = useState(false);
  const dashCooldown = useRef(0);
  const [, getKeys] = useKeyboardControls();
  
  // Add frustum culling optimization
  useFrustumCulling(meshRef, 2); // 2 is the bounding sphere size in units

  // For LOD, we would need multiple detail levels of the player model
  // For now, focusing on other optimizations first

  useFrame((_state, delta) => {
    if (!meshRef.current || !rigidBodyRef.current || !currentLevel || !currentRoomId || useGameStore.getState().isUpgradeAvailable) return;

    const currentRoom = currentLevel.rooms.find((room: { id: string; }) => room.id === currentRoomId);
    if (!currentRoom) return;

    if (dashCooldown.current > 0) dashCooldown.current -= delta;

    const keys = getKeys();
    
    // Attack
    if (keys.attack) {
      const attackRange = 2;
      const ability = player.abilities[0]; // e.g., 'basic-attack'
      const stats = ProgressionSystem.getInstance().calculateStats(player);
      const damage = ProgressionSystem.getInstance().calculateDamage(ability, stats);
      
      const worldPosition = meshRef.current.getWorldPosition(new THREE.Vector3());
      
      currentRoom?.enemies.forEach((enemy: { position: { x: number | undefined; y: number | undefined; z: number | undefined; }; health: number; id: string; }) => {
        const enemyPos = new THREE.Vector3(enemy.position.x, enemy.position.y, enemy.position.z);
        const distance = worldPosition.distanceTo(enemyPos);
        if (distance < attackRange) {
          enemy.health -= damage;
          if (enemy.health <= 0) {
            useGameStore.getState().removeEnemy(currentRoomId, enemy.id);
          }
        }
      });
    }

    moveDirection.current.set(0, 0, 0);
    if (keys.forward) moveDirection.current.z -= 1;
    if (keys.backward) moveDirection.current.z += 1;
    if (keys.left) moveDirection.current.x -= 1;
    if (keys.right) moveDirection.current.x += 1;
    if (moveDirection.current.lengthSq() > 0) moveDirection.current.normalize();

    // Dashing
    if (keys.jump && dashCooldown.current <= 0 && moveDirection.current.lengthSq() > 0) {
      setIsDashing(true);
      dashCooldown.current = 0.5;
      setTimeout(() => setIsDashing(false), 200);
    }

    // Get move speed from player stats, or use default
    const baseSpeed = player.stats.moveSpeed || 8;
    const speed = isDashing ? baseSpeed * 2.5 : baseSpeed;
    const acceleration = isDashing ? 50 : 15;
    const damping = isDashing ? 0.95 : 0.75;

    currentVelocity.current.x += moveDirection.current.x * acceleration * delta;
    currentVelocity.current.z += moveDirection.current.z * acceleration * delta;
    currentVelocity.current.multiplyScalar(damping);
    
    if (currentVelocity.current.lengthSq() > speed * speed) {
      currentVelocity.current.normalize().multiplyScalar(speed);
    }

    const rigidBody = rigidBodyRef.current;
    const linvel = rigidBody.linvel();
    rigidBody.setLinvel({ x: currentVelocity.current.x, y: linvel.y, z: currentVelocity.current.z });

    if (moveDirection.current.lengthSq() > 0) {
      const angle = Math.atan2(moveDirection.current.x, moveDirection.current.z);
      meshRef.current!.rotation.y = angle;
    }

    const worldPosition = meshRef.current!.getWorldPosition(new THREE.Vector3());
    useGameStore.setState({ player: { ...player, position: { x: worldPosition.x, y: worldPosition.y, z: worldPosition.z } } });

    // Room switching
    currentRoom!.connections.forEach((connectedRoomId, index) => {
      const doorPosition = index === 0 ? [currentRoom!.size.width - 0.5, 1, currentRoom!.size.height / 2] : [0.5, 1, currentRoom!.size.height / 2];
      const distance = worldPosition.distanceTo(new THREE.Vector3(doorPosition[0], doorPosition[1], doorPosition[2]));
      if (distance < 1) {
        setCurrentRoomId(connectedRoomId);
        const newRoom = currentLevel!.rooms.find((room: { id: string; }) => room.id === connectedRoomId);
        if (newRoom) {
          const newPosition = index === 0 ? [1, 1, newRoom.size.height / 2] : [newRoom.size.width - 1, 1, newRoom.size.height / 2];
          rigidBody!.setTranslation({ x: newPosition[0], y: newPosition[1], z: newPosition[2] });
        }
      }
    });
  });

  return (
    <RigidBody
      ref={rigidBodyRef}
      type="dynamic"
      position={[0, 1, 0]}
      mass={1}
      friction={0.7}
      restitution={0.2}
      lockRotations
      enabledRotations={[false, false, false]}
    >
      <CapsuleCollider args={[0.5, 0.5]} friction={1} />
      <group ref={meshRef}>
        <mesh castShadow>
          <capsuleGeometry args={[0.5, 1, 4, 8]} />
          <meshStandardMaterial color={isDashing ? "#6a9eff" : "#4a9eff"} emissive={isDashing ? "#4a9eff" : "#000000"} emissiveIntensity={isDashing ? 0.5 : 0} />
        </mesh>
        <mesh position={[0.7, 0, 0.2]} rotation={[0, 0, Math.PI / 4]} castShadow>
          <boxGeometry args={[0.2, 1.2, 0.2]} />
          <meshStandardMaterial color="#666666" />
        </mesh>
      </group>
    </RigidBody>
  );
}