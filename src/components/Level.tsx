
import { RigidBody } from '@react-three/rapier';
import { useGameStore } from '../store/gameStore';
import { Enemy } from './Enemy';

export function Level() {
  const { currentLevel, currentRoomId } = useGameStore();
  if (!currentLevel || !currentRoomId) return null;

  const currentRoom = currentLevel.rooms.find(room => room.id === currentRoomId);
  if (!currentRoom) return null;

  const { size, layout, connections, enemies } = currentRoom;
  const tileSize = 1;

  return (
    <group position={[0, 0, 0]}>
      {/* Floor and Walls */}
      {layout.map((row, y) =>
        row.map((cell, x) => {
          const posX = x * tileSize;
          const posZ = y * tileSize;
          return cell === 1 ? (
            <RigidBody key={`floor-${x}-${y}`} type="fixed" position={[posX, 0, posZ]}>
              <mesh receiveShadow>
                <boxGeometry args={[tileSize, 0.1, tileSize]} />
                <meshStandardMaterial color="#2a2a2a" />
              </mesh>
            </RigidBody>
          ) : (
            <RigidBody key={`wall-${x}-${y}`} type="fixed" position={[posX, 0.5, posZ]}>
              <mesh castShadow receiveShadow>
                <boxGeometry args={[tileSize, 1, tileSize]} />
                <meshStandardMaterial color="#1a1a1a" />
              </mesh>
            </RigidBody>
          );
        })
      )}

      {/* Doors */}
      {connections.map((connectedRoomId, index) => {
        const doorPosition = index === 0 
          ? [size.width * tileSize - 0.5, 1, size.height / 2 * tileSize] as [number, number, number]
          : [0.5, 1, size.height / 2 * tileSize] as [number, number, number];
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