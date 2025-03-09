import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../store/gameStore';
import * as THREE from 'three';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';

export function Player() {
  const rigidBodyRef = useRef(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const player = useGameStore((state) => state.player);
  const moveDirection = useRef(new THREE.Vector3());
  const currentVelocity = useRef(new THREE.Vector3());
  const [isDashing, setIsDashing] = useState(false);
  const dashCooldown = useRef(0);
  const dashDirection = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    if (!meshRef.current || !rigidBodyRef.current) return;

    // Update dash cooldown
    if (dashCooldown.current > 0) {
      dashCooldown.current -= delta;
    }

    // Get keyboard input
    const keys = {
      KeyW: !!state.events.current?.keysPressed['KeyW'],
      KeyS: !!state.events.current?.keysPressed['KeyS'],
      KeyA: !!state.events.current?.keysPressed['KeyA'],
      KeyD: !!state.events.current?.keysPressed['KeyD'],
      Space: !!state.events.current?.keysPressed[' ']
    };

    // Reset movement direction
    moveDirection.current.set(0, 0, 0);

    // Calculate movement based on camera angle
    if (keys.KeyW) moveDirection.current.z -= 1;
    if (keys.KeyS) moveDirection.current.z += 1;
    if (keys.KeyA) moveDirection.current.x -= 1;
    if (keys.KeyD) moveDirection.current.x += 1;

    // Normalize movement direction
    if (moveDirection.current.lengthSq() > 0) {
      moveDirection.current.normalize();
    }

    // Handle dashing
    if (keys.Space && dashCooldown.current <= 0 && moveDirection.current.lengthSq() > 0) {
      setIsDashing(true);
      dashCooldown.current = 0.5; // 500ms cooldown
      dashDirection.current.copy(moveDirection.current);
      setTimeout(() => setIsDashing(false), 200); // Dash duration
    }

    // Apply movement
    const speed = isDashing ? 20 : 8;
    const acceleration = isDashing ? 50 : 15;
    const damping = isDashing ? 0.95 : 0.85;

    // Update velocity with acceleration
    currentVelocity.current.x += moveDirection.current.x * acceleration * delta;
    currentVelocity.current.z += moveDirection.current.z * acceleration * delta;

    // Apply damping
    currentVelocity.current.multiplyScalar(damping);

    // Apply speed limit
    if (currentVelocity.current.lengthSq() > speed * speed) {
      currentVelocity.current.normalize().multiplyScalar(speed);
    }

    // Update physics body
    const rigidBody = rigidBodyRef.current;
    const linvel = rigidBody.linvel();
    rigidBody.setLinvel({
      x: currentVelocity.current.x,
      y: linvel.y,
      z: currentVelocity.current.z
    });

    // Update rotation to face movement direction
    if (moveDirection.current.lengthSq() > 0) {
      const angle = Math.atan2(moveDirection.current.x, moveDirection.current.z);
      meshRef.current.rotation.y = angle;
    }

    // Update player position in store
    const worldPosition = meshRef.current.getWorldPosition(new THREE.Vector3());
    useGameStore.setState({
      player: {
        ...player,
        position: { x: worldPosition.x, y: worldPosition.y, z: worldPosition.z }
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
        {/* Player body */}
        <mesh castShadow>
          <capsuleGeometry args={[0.5, 1, 4, 8]} />
          <meshStandardMaterial 
            color={isDashing ? "#6a9eff" : "#4a9eff"}
            emissive={isDashing ? "#4a9eff" : "#000000"}
            emissiveIntensity={isDashing ? 0.5 : 0}
          />
        </mesh>
        {/* Player weapon */}
        <mesh
          position={[0.7, 0, 0.2]}
          rotation={[0, 0, Math.PI / 4]}
          castShadow
        >
          <boxGeometry args={[0.2, 1.2, 0.2]} />
          <meshStandardMaterial color="#666666" />
        </mesh>
      </group>
    </RigidBody>
  );
}