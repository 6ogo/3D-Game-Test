// src/components/Level.tsx
import { useEffect } from 'react';
import { RigidBody } from '@react-three/rapier';
import { useGameStore } from '../store/gameStore';
import { Enemy } from './Enemy';
import { useThree } from '@react-three/fiber';

export function Level() {
  const { currentLevel, currentRoomId } = useGameStore();
  const { scene } = useThree();
  
  // Clean up previous room objects when changing rooms
  useEffect(() => {
    return () => {
      // Find and remove any previous room objects
      const previousRooms = scene.children.filter(child => 
        child.userData && child.userData.isRoomObject
      );
      
      previousRooms.forEach(obj => {
        scene.remove(obj);
      });
    };
  }, [currentRoomId, scene]);
  
  // If no level or room, render nothing
  if (!currentLevel || !currentRoomId) return null;

  const currentRoom = currentLevel.rooms.find(room => room.id === currentRoomId);
  if (!currentRoom) return null;

  const { layout, connections, enemies, size } = currentRoom;
  const tileSize = 1;

  // Ensure layout exists and is not empty
  if (!layout || layout.length === 0 || layout[0].length === 0) {
    console.error("Room layout is missing or empty", currentRoom);
    return null;
  }
  
  return (
    <group position={[0, 0, 0]}>
      {/* Floor and walls */}
      {layout.map((row, z) => 
        row.map((cell, x) => {
          // 1 = floor, 0 = wall
          if (cell === 1) {
            return (
              <RigidBody 
                key={`floor-${x}-${z}`} 
                type="fixed" 
                position={[x * tileSize, 0, z * tileSize]}
                colliders="cuboid"
              >
                <mesh receiveShadow userData={{ isRoomObject: true }}>
                  <boxGeometry args={[tileSize, 0.2, tileSize]} />
                  <meshStandardMaterial color="#2a2a2a" />
                </mesh>
              </RigidBody>
            );
          } else if (cell === 0) {
            return (
              <RigidBody 
                key={`wall-${x}-${z}`} 
                type="fixed" 
                position={[x * tileSize, 0.6, z * tileSize]}
                colliders="cuboid"
              >
                <mesh castShadow receiveShadow userData={{ isRoomObject: true }}>
                  <boxGeometry args={[tileSize, 1.2, tileSize]} />
                  <meshStandardMaterial color="#1a1a1a" />
                </mesh>
              </RigidBody>
            );
          }
          return null;
        })
      )}

      {/* Doors - connecting to other rooms */}
      {connections.map((connectedRoomId, index) => {
        // Simplified door positioning logic
        const doorPositions = [
          [size.width / 2 * tileSize, 1, 0], // North door
          [size.width * tileSize - 1, 1, size.height / 2 * tileSize], // East door
          [size.width / 2 * tileSize, 1, size.height * tileSize - 1], // South door
          [0, 1, size.height / 2 * tileSize], // West door
        ];
        
        // Only create enough doors for the connections
        if (index >= doorPositions.length) return null;
        
        return (
          <RigidBody 
            key={`door-${index}`} 
            type="fixed" 
            position={doorPositions[index] as [number, number, number]} 
            userData={{ type: 'door', connectedRoomId }}
          >
            <mesh userData={{ isRoomObject: true }}>
              <boxGeometry args={[1, 2, 1]} />
              <meshStandardMaterial color="#8b4513" />
            </mesh>
          </RigidBody>
        );
      })}

      {/* Enemies */}
      {enemies.map(enemy => (
        <Enemy 
          key={enemy.id} 
          position={[enemy.position.x, enemy.position.y, enemy.position.z]} 
        />
      ))}
    </group>
  );
}