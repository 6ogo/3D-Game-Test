import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useGameStore } from '../store/gameStore';
import * as THREE from 'three';

// Camera settings
const CAMERA_HEIGHT = 20;          // Height above player
const CAMERA_DISTANCE = 10;        // Distance behind player (for perspective)
const CAMERA_SMOOTHING = 0.1;      // Lower = smoother camera (0.1 is very smooth, 0.5 is responsive)
const CAMERA_LOOK_AHEAD = 5;       // How far ahead of the player to look based on movement
const CAMERA_BOUNDS_PADDING = 5;   // Padding from room edges

export function CameraController() {
  // Get the Three.js camera
  const { camera } = useThree();
  
  // Reference to the target position
  const targetPosition = useRef(new THREE.Vector3());
  const lookAtTarget = useRef(new THREE.Vector3());
  
  // Get player position and movement from store
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
  
  // Update camera position every frame
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
    
    // Get player movement direction for look-ahead
    const moveDirection = new THREE.Vector3();
    if (player.velocity) {
      moveDirection.set(
        player.velocity.x || 0,
        0,
        player.velocity.z || 0
      ).normalize();
    }
    
    // Calculate target position with look-ahead
    targetPosition.current.set(
      player.position.x + moveDirection.x * CAMERA_LOOK_AHEAD,
      player.position.y + CAMERA_HEIGHT,
      player.position.z + moveDirection.z * CAMERA_LOOK_AHEAD + CAMERA_DISTANCE
    );
    
    // Constrain camera to room bounds
    targetPosition.current.x = Math.max(minX, Math.min(maxX, targetPosition.current.x));
    targetPosition.current.z = Math.max(minZ, Math.min(maxZ, targetPosition.current.z));
    
    // Calculate look-at target (slightly ahead of player based on movement)
    lookAtTarget.current.set(
      player.position.x + moveDirection.x * CAMERA_LOOK_AHEAD * 0.5,
      player.position.y,
      player.position.z + moveDirection.z * CAMERA_LOOK_AHEAD * 0.5
    );
    
    // Smoothly interpolate camera position
    camera.position.lerp(targetPosition.current, CAMERA_SMOOTHING);
    
    // Create a temporary vector for the current look-at position
    const currentLookAt = new THREE.Vector3();
    camera.getWorldDirection(currentLookAt);
    currentLookAt.multiplyScalar(10).add(camera.position);
    
    // Smoothly interpolate look-at target
    currentLookAt.lerp(lookAtTarget.current, CAMERA_SMOOTHING * 2);
    camera.lookAt(currentLookAt);
  });
  
  return null; // This component doesn't render anything
}
