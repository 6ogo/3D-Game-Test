import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useGameStore } from '../store/gameStore';
import * as THREE from 'three';

// Camera settings
const CAMERA_HEIGHT = 12;          // Height above player
const CAMERA_DISTANCE = 15;        // Distance behind player
const CAMERA_SMOOTHING = 0.1;      // Lower = smoother camera (0.1 is very smooth, 0.5 is responsive)
const CAMERA_BOUNDS_PADDING = 5;   // Padding from room edges

export function CameraController() {
  // Get the Three.js camera
  const { camera } = useThree();
  
  // Reference to the target position
  const targetPosition = useRef(new THREE.Vector3());
  
  // Get player position from store
  const { player, currentRoomId, currentLevel } = useGameStore();
  
  // Set initial camera position
  useEffect(() => {
    if (player && player.position) {
      // Set initial camera position above and behind player
      camera.position.set(
        player.position.x, 
        player.position.y + CAMERA_HEIGHT, 
        player.position.z + CAMERA_DISTANCE
      );
      
      // Look at player
      camera.lookAt(
        player.position.x,
        player.position.y,
        player.position.z
      );
    }
  }, []);
  
  // Update camera position every frame to follow player
  useFrame(() => {
    if (!player || !player.position) return;
    
    // Get current room bounds for camera constraints
    let minX = -Infinity, maxX = Infinity, minZ = -Infinity, maxZ = Infinity;
    
    if (currentLevel && currentRoomId) {
      const currentRoom = currentLevel.rooms.find(room => room.id === currentRoomId);
      if (currentRoom) {
        // Calculate room bounds with padding
        const roomX = currentRoom.size ? currentRoom.size.width : 0;
        const roomZ = currentRoom.size ? currentRoom.size.height : 0;
        
        // Assuming rooms have a position property or are positioned at origin
        minX = CAMERA_BOUNDS_PADDING;
        maxX = roomX - CAMERA_BOUNDS_PADDING;
        minZ = CAMERA_BOUNDS_PADDING;
        maxZ = roomZ - CAMERA_BOUNDS_PADDING;
      }
    }
    
    // Calculate target position for camera (directly above player)
    targetPosition.current.set(
      player.position.x,
      player.position.y + CAMERA_HEIGHT,
      player.position.z + CAMERA_DISTANCE
    );
    
    // Apply constraints to keep camera within room bounds
    targetPosition.current.x = Math.max(minX, Math.min(maxX, targetPosition.current.x));
    targetPosition.current.z = Math.max(minZ, Math.min(maxZ, targetPosition.current.z));
    
    // Smoothly move camera to target position
    camera.position.lerp(targetPosition.current, CAMERA_SMOOTHING);
    
    // Always look at the player's position
    camera.lookAt(
      player.position.x,
      player.position.y,
      player.position.z
    );
  });
  
  return null;
}
