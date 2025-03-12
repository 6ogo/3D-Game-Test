import React, { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { Room } from '../types/game';

interface RoomProps {
  room: Room;
  tileSize?: number;
}

interface InstancedObjectsProps {
  count: number;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  positions: THREE.Vector3[];
  rotations?: THREE.Euler[];
  scales?: THREE.Vector3[];
}

/**
 * Level Renderer Component - Optimized with instanced meshes
 * 
 * This component efficiently renders level geometry using instancing for
 * better performance with large levels.
 */
export function OptimizedLevel({ room, tileSize = 1 }: RoomProps) {
  const { scene } = useThree();
  
  // Track instances for cleanup
  const [instances, setInstances] = useState<{
    floors: THREE.InstancedMesh | null;
    walls: THREE.InstancedMesh | null;
  }>({
    floors: null,
    walls: null
  });
  
  // Create geometries and materials only once
  const geometries = useRef({
    floor: new THREE.BoxGeometry(tileSize, 0.1, tileSize),
    wall: new THREE.BoxGeometry(tileSize, 1, tileSize)
  });
  
  const materials = useRef({
    floor: new THREE.MeshStandardMaterial({ color: '#2a2a2a' }),
    wall: new THREE.MeshStandardMaterial({ color: '#1a1a1a' })
  });
  
  // Setup instanced meshes when room changes
  useEffect(() => {
    if (!room) return;
    
    // Count tiles for allocation
    let floorCount = 0;
    let wallCount = 0;
    
    room.layout.forEach((row: number[]) => {
      row.forEach((cell: number) => {
        if (cell === 1) floorCount++;
        else wallCount++;
      });
    });
    
    // Create instanced meshes
    const floorInstances = new THREE.InstancedMesh(
      geometries.current.floor,
      materials.current.floor,
      floorCount
    );
    floorInstances.receiveShadow = true;
    
    const wallInstances = new THREE.InstancedMesh(
      geometries.current.wall,
      materials.current.wall,
      wallCount
    );
    wallInstances.castShadow = true;
    wallInstances.receiveShadow = true;
    
    // Set instance transforms
    const matrix = new THREE.Matrix4();
    let floorIdx = 0;
    let wallIdx = 0;
    
    room.layout.forEach((row: number[], z: number) => {
      row.forEach((cell: number, x: number) => {
        const posX = x * tileSize;
        const posZ = z * tileSize;
        
        if (cell === 1) {
          // Floor
          matrix.setPosition(posX, 0, posZ);
          floorInstances.setMatrixAt(floorIdx, matrix);
          floorIdx++;
        } else {
          // Wall
          matrix.setPosition(posX, 0.5, posZ);
          wallInstances.setMatrixAt(wallIdx, matrix);
          wallIdx++;
        }
      });
    });
    
    // Update matrices
    floorInstances.instanceMatrix.needsUpdate = true;
    wallInstances.instanceMatrix.needsUpdate = true;
    
    // Add to scene
    scene.add(floorInstances);
    scene.add(wallInstances);
    
    // Store for cleanup
    setInstances({
      floors: floorInstances,
      walls: wallInstances
    });
    
    // Cleanup when component unmounts or room changes
    return () => {
      if (instances.floors) scene.remove(instances.floors);
      if (instances.walls) scene.remove(instances.walls);
    };
  }, [room, scene, tileSize, instances]);
  
  return null; // Rendering is handled directly with the Three.js scene
}

/**
 * Performance Monitor Component
 * 
 * Tracks FPS and memory usage
 */
export function PerformanceStats() {
  const [stats, setStats] = useState({
    fps: 0,
    triangles: 0,
    drawCalls: 0
  });
  
  const { gl } = useThree();
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const updateInterval = useRef(1000); // Update stats every second
  
  useFrame(() => {
    frameCount.current++;
    const currentTime = performance.now();
    
    if (currentTime - lastTime.current > updateInterval.current) {
      const fps = Math.round((frameCount.current * 1000) / (currentTime - lastTime.current));
      
      setStats({
        fps,
        triangles: gl.info.render.triangles,
        drawCalls: gl.info.render.calls
      });
      
      frameCount.current = 0;
      lastTime.current = currentTime;
    }
  });
  
  return (
    <group position={[0, 0, -5]}>
      <Html position={[0, 0, 0]} center>
        <div className="bg-black/70 text-white p-2 text-xs rounded">
          <div>FPS: {stats.fps}</div>
          <div>Triangles: {stats.triangles}</div>
          <div>Draw Calls: {stats.drawCalls}</div>
        </div>
      </Html>
    </group>
  );
}

/**
 * Instanced Objects Component
 * 
 * For efficiently rendering many similar objects (props, particles, etc)
 */
export function InstancedObjects({
  count,
  geometry,
  material,
  positions,
  rotations,
  scales
}: InstancedObjectsProps) {
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null);
  
  useEffect(() => {
    if (!instancedMeshRef.current) return;
    
    const mesh = instancedMeshRef.current;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Euler();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    
    // Update all instances
    for (let i = 0; i < count; i++) {
      position.set(
        positions[i].x,
        positions[i].y,
        positions[i].z
      );
      
      if (rotations && rotations[i]) {
        rotation.set(
          rotations[i].x || 0,
          rotations[i].y || 0,
          rotations[i].z || 0
        );
        quaternion.setFromEuler(rotation);
      } else {
        quaternion.identity();
      }
      
      if (scales && scales[i]) {
        scale.set(
          scales[i].x || 1,
          scales[i].y || 1,
          scales[i].z || 1
        );
      } else {
        scale.set(1, 1, 1);
      }
      
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);
    }
    
    mesh.instanceMatrix.needsUpdate = true;
  }, [count, positions, rotations, scales]);
  
  return (
    <instancedMesh
      ref={instancedMeshRef}
      args={[geometry, material, count]}
      frustumCulled={true}
      castShadow
      receiveShadow
    />
  );
}