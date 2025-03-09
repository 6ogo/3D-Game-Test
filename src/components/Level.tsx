import { useRef } from 'react';
import * as THREE from 'three';
import { RigidBody } from '@react-three/rapier';
import { useGameStore } from '../store/gameStore';

export function Level() {
  const floorRef = useRef<THREE.Mesh>(null);
  const currentLevel = useGameStore((state) => state.currentLevel);

  // Create a larger, more detailed level
  const levelSize = 100;
  const pillarCount = 20;
  const wallHeight = 5;

  return (
    <group>
      {/* Main floor */}
      <RigidBody type="fixed" restitution={0.2} friction={1}>
        <mesh 
          ref={floorRef} 
          rotation={[-Math.PI / 2, 0, 0]} 
          position={[0, 0, 0]} 
          receiveShadow
        >
          <planeGeometry args={[levelSize, levelSize]} />
          <meshStandardMaterial 
            color="#2a2a2a"
            metalness={0.2}
            roughness={0.8}
          />
        </mesh>
      </RigidBody>

      {/* Boundary walls */}
      {[
        [-levelSize/2, wallHeight/2, 0, 1, wallHeight, levelSize], // Left
        [levelSize/2, wallHeight/2, 0, 1, wallHeight, levelSize],  // Right
        [0, wallHeight/2, -levelSize/2, levelSize, wallHeight, 1], // Back
        [0, wallHeight/2, levelSize/2, levelSize, wallHeight, 1],  // Front
      ].map((wall, i) => (
        <RigidBody key={`wall-${i}`} type="fixed" friction={1}>
          <mesh position={[wall[0], wall[1], wall[2]]} castShadow receiveShadow>
            <boxGeometry args={[wall[3], wall[4], wall[5]]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
        </RigidBody>
      ))}

      {/* Pillars and decorative elements */}
      {Array.from({ length: pillarCount }).map((_, i) => {
        const angle = (i / pillarCount) * Math.PI * 2;
        const radius = 20;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        return (
          <RigidBody key={`pillar-${i}`} type="fixed" friction={1}>
            <group position={[x, 0, z]}>
              {/* Pillar base */}
              <mesh position={[0, 2, 0]} castShadow>
                <cylinderGeometry args={[1, 1.2, 4, 8]} />
                <meshStandardMaterial color="#6a1b9a" />
              </mesh>
              {/* Pillar top */}
              <mesh position={[0, 4, 0]} castShadow>
                <boxGeometry args={[2, 0.5, 2]} />
                <meshStandardMaterial color="#4a0072" />
              </mesh>
            </group>
          </RigidBody>
        );
      })}

      {/* Random decorative elements */}
      {Array.from({ length: 30 }).map((_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 30 + 10;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        return (
          <RigidBody key={`decor-${i}`} type="fixed" friction={1}>
            <mesh
              position={[x, 0.5, z]}
              rotation={[0, Math.random() * Math.PI, 0]}
              castShadow
            >
              <boxGeometry args={[2, 1, 2]} />
              <meshStandardMaterial color={`hsl(${Math.random() * 60 + 260}, 70%, 20%)`} />
            </mesh>
          </RigidBody>
        );
      })}
    </group>
  );
}