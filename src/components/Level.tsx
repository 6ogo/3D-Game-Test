// src/components/Level.tsx
import { RigidBody } from '@react-three/rapier';
import { useGameStore } from '../store/gameStore';
import { Enemy } from './Enemy';
// Import from optimizationComponents.tsx instead of optimizations.ts
import { OptimizedLevel } from '../systems/optimizationComponents';

export function Level() {
  const { currentLevel, currentRoomId } = useGameStore();
  if (!currentLevel || !currentRoomId) return null;

  const currentRoom = currentLevel.rooms.find(room => room.id === currentRoomId);
  if (!currentRoom) return null;

  const { connections, enemies } = currentRoom;
  const tileSize = 1;

  return (
    <group position={[0, 0, 0]}>
      {/* Use the optimized level renderer for floors and walls */}
      <OptimizedLevel room={currentRoom} tileSize={tileSize} />

      {/* Doors - keeping these as regular meshes as there are only a few */}
      {connections.map((connectedRoomId, index) => {
        const doorPosition = index === 0 
          ? [currentRoom.size.width * tileSize - 0.5, 1, currentRoom.size.height / 2 * tileSize] as [number, number, number]
          : [0.5, 1, currentRoom.size.height / 2 * tileSize] as [number, number, number];
        return (
          <RigidBody key={`door-${index}`} type="fixed" position={doorPosition} userData={{ type: 'door', connectedRoomId }}>
            <mesh>
              <boxGeometry args={[1, 2, 1]} />
              <meshStandardMaterial color="#8b4513" />
            </mesh>
          </RigidBody>
        );
      })}

      {/* Enemies */}
      {enemies.map(enemy => (
        <Enemy key={enemy.id} position={[enemy.position.x, enemy.position.y, enemy.position.z]} />
      ))}
    </group>
  );
}