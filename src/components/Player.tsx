import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../store/gameStore';
import * as THREE from 'three';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';

export function Player() {
  const rigidBodyRef = useRef<any>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const player = useGameStore((state) => state.player);
  const currentLevel = useGameStore((state) => state.currentLevel);
  const currentRoomId = useGameStore((state) => state.currentRoomId);
  const setCurrentRoomId = useGameStore((state) => state.setCurrentRoomId);
  const moveDirection = useRef(new THREE.Vector3());
  const currentVelocity = useRef(new THREE.Vector3());
  const [isDashing, setIsDashing] = useState(false);
  const dashCooldown = useRef(0);

  useFrame((state, delta) => {
    if (!meshRef.current || !rigidBodyRef.current || !currentLevel || !currentRoomId || useGameStore.getState().isUpgradeAvailable) return;
  
    const currentRoom = currentLevel.rooms.find(room => room.id === currentRoomId);
    if (!currentRoom) return;
  
    if (dashCooldown.current > 0) dashCooldown.current -= delta;
  
    const keys = {
      KeyW: !!state.events.current?.keysPressed['KeyW'],
      KeyS: !!state.events.current?.keysPressed['KeyS'],
      KeyA: !!state.events.current?.keysPressed['KeyA'],
      KeyD: !!state.events.current?.keysPressed['KeyD'],
      Space: !!state.events.current?.keysPressed[' '],
      KeyJ: !!state.events.current?.keysPressed['KeyJ']
    };
  
    // Attack
    if (keys.KeyJ) {
      const attackRange = 2;
      const attackDamage = player.abilities[0].damage; // Use 'basic-attack' damage
      currentRoom.enemies.forEach(enemy => {
        const enemyPos = new THREE.Vector3(enemy.position.x, enemy.position.y, enemy.position.z);
        const distance = worldPosition.distanceTo(enemyPos);
        if (distance < attackRange) {
          enemy.health -= attackDamage;
          if (enemy.health <= 0) useGameStore.getState().removeEnemy(currentRoomId, enemy.id);
        }
      });
    }
  
    moveDirection.current.set(0, 0, 0);
    if (keys.KeyW) moveDirection.current.z -= 1;
    if (keys.KeyS) moveDirection.current.z += 1;
    if (keys.KeyA) moveDirection.current.x -= 1;
    if (keys.KeyD) moveDirection.current.x += 1;
    if (moveDirection.current.lengthSq() > 0) moveDirection.current.normalize();

    // Dashing
    if (keys.Space && dashCooldown.current <= 0 && moveDirection.current.lengthSq() > 0) {
      setIsDashing(true);
      dashCooldown.current = 0.5;
      setTimeout(() => setIsDashing(false), 200);
    }

    const speed = isDashing ? 20 : 8;
    const acceleration = isDashing ? 50 : 15;
    const damping = isDashing ? 0.95 : 0.85;

    currentVelocity.current.x += moveDirection.current.x * acceleration * delta;
    currentVelocity.current.z += moveDirection.current.z * acceleration * delta;
    currentVelocity.current.multiplyScalar(damping);
    if (currentVelocity.current.lengthSq() > speed * speed) currentVelocity.current.normalize().multiplyScalar(speed);

    const rigidBody = rigidBodyRef.current;
    const linvel = rigidBody.linvel();
    rigidBody.setLinvel({ x: currentVelocity.current.x, y: linvel.y, z: currentVelocity.current.z });

    if (moveDirection.current.lengthSq() > 0) {
      const angle = Math.atan2(moveDirection.current.x, moveDirection.current.z);
      meshRef.current.rotation.y = angle;
    }

    const worldPosition = meshRef.current.getWorldPosition(new THREE.Vector3());
    useGameStore.setState({ player: { ...player, position: { x: worldPosition.x, y: worldPosition.y, z: worldPosition.z } } });

    // Room switching
    currentRoom.connections.forEach((connectedRoomId, index) => {
      const doorPosition = index === 0 ? [currentRoom.size.width - 0.5, 1, currentRoom.size.height / 2] : [0.5, 1, currentRoom.size.height / 2];
      const distance = worldPosition.distanceTo(new THREE.Vector3(doorPosition[0], doorPosition[1], doorPosition[2]));
      if (distance < 1) {
        setCurrentRoomId(connectedRoomId);
        const newRoom = currentLevel.rooms.find(room => room.id === connectedRoomId);
        if (newRoom) {
          const newPosition = index === 0 ? [1, 1, newRoom.size.height / 2] : [newRoom.size.width - 1, 1, newRoom.size.height / 2];
          rigidBody.setTranslation({ x: newPosition[0], y: newPosition[1], z: newPosition[2] });
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