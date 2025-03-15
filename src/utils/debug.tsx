// src/utils/debug.ts
import React from 'react';
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';
import { useState } from 'react';

/**
 * Debug Grid Helper for visualizing the floor plane
 */
export function DebugGrid() {
  const { scene } = useThree();
  
  useEffect(() => {
    // Add grid helper
    const gridHelper = new THREE.GridHelper(100, 100, 0x444444, 0x222222);
    gridHelper.position.y = 0.01; // Slightly above ground to avoid z-fighting
    scene.add(gridHelper);
    
    // Cleanup
    return () => {
      scene.remove(gridHelper);
    };
  }, [scene]);
  
  return null;
}

/**
 * Debug component to visualize room layouts
 */
export function DebugRoomLayout() {
  const { currentLevel, currentRoomId } = useGameStore();
  const { scene } = useThree();
  
  useEffect(() => {
    if (!currentLevel || !currentRoomId) return;
    
    const currentRoom = currentLevel.rooms.find(room => room.id === currentRoomId);
    if (!currentRoom || !currentRoom.layout) return;
    
    // Create visual representation of layout
    const layoutGroup = new THREE.Group();
    layoutGroup.name = 'debug-layout';
    
    // Tile materials
    const floorMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
    const wallMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
    const doorMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff, wireframe: true });
    const specialMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true });
    
    // Geometry
    const tileGeometry = new THREE.BoxGeometry(1, 0.1, 1);
    const wallGeometry = new THREE.BoxGeometry(1, 1, 1);
    
    // Create tiles
    currentRoom.layout.forEach((row, z) => {
      row.forEach((tile, x) => {
        let material;
        let geometry = tileGeometry;
        let yPos = 0;
        
        if (tile === 1) {
          // Floor
          material = floorMaterial;
        } else if (tile === 0) {
          // Wall
          material = wallMaterial;
          geometry = wallGeometry;
          yPos = 0.5; // Center vertically
        } else if (tile === 5) { 
          // Door
          material = doorMaterial;
        } else {
          // Special tiles (like pedestals, platforms, etc.)
          material = specialMaterial;
        }
        
        // Create mesh and add to group
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, yPos, z);
        layoutGroup.add(mesh);
      });
    });
    
    // Add connection visualizers
    currentRoom.connections.forEach((_, index) => {
      const width = currentRoom.layout[0].length;
      const height = currentRoom.layout.length;
      
      let doorPos: [number, number, number];
      
      // Simplified door positions
      switch (index) {
        case 0: // North
          doorPos = [width / 2, 0.5, 0];
          break;
        case 1: // East
          doorPos = [width - 1, 0.5, height / 2];
          break;
        case 2: // South
          doorPos = [width / 2, 0.5, height - 1];
          break;
        case 3: // West
          doorPos = [0, 0.5, height / 2];
          break;
        default:
          doorPos = [width / 2, 0.5, height / 2];
      }
      
      // Create door indicator
      const doorMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true })
      );
      doorMesh.position.set(...doorPos);
      layoutGroup.add(doorMesh);
    });
    
    // Add to scene
    scene.add(layoutGroup);
    
    // Cleanup
    return () => {
      scene.remove(layoutGroup);
      
      // Clean up geometries and materials
      layoutGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
    };
  }, [currentLevel, currentRoomId, scene]);
  
  return null;
}

/**
 * Debug Room Information Panel
 */
export function DebugRoomInfo() {
  const { currentLevel, currentRoomId } = useGameStore();
  
  if (!currentLevel || !currentRoomId) return null;
  
  const currentRoom = currentLevel.rooms.find(room => room.id === currentRoomId);
  if (!currentRoom) return null;
  
  // Formatting helpers
  const formatVector = (v: { x: number, y: number, z: number }) => 
    `(${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)})`;
  
  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    top: '10px',
    right: '10px',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    padding: '10px',
    borderRadius: '5px',
    fontSize: '12px',
    fontFamily: 'monospace',
    maxWidth: '300px',
    maxHeight: '50vh',
    overflow: 'auto',
    zIndex: 1000,
  };
  
  return (
    <div style={containerStyle}>
      <h3 style={{ margin: '0 0 10px 0' }}>Room Debug Info</h3>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          <tr>
            <td style={{ padding: '2px 4px' }}>ID:</td>
            <td style={{ padding: '2px 4px' }}>{currentRoom.id}</td>
          </tr>
          <tr>
            <td style={{ padding: '2px 4px' }}>Type:</td>
            <td style={{ padding: '2px 4px' }}>{currentRoom.type}</td>
          </tr>
          <tr>
            <td style={{ padding: '2px 4px' }}>Size:</td>
            <td style={{ padding: '2px 4px' }}>
              {currentRoom.size.width}×{currentRoom.size.height}
            </td>
          </tr>
          <tr>
            <td style={{ padding: '2px 4px' }}>Layout:</td>
            <td style={{ padding: '2px 4px' }}>
              {currentRoom.layout ? `${currentRoom.layout.length}×${currentRoom.layout[0]?.length || 0}` : 'N/A'}
            </td>
          </tr>
          <tr>
            <td style={{ padding: '2px 4px' }}>Connections:</td>
            <td style={{ padding: '2px 4px' }}>{currentRoom.connections.join(', ')}</td>
          </tr>
          <tr>
            <td style={{ padding: '2px 4px' }}>Enemies:</td>
            <td style={{ padding: '2px 4px' }}>{currentRoom.enemies.length}</td>
          </tr>
        </tbody>
      </table>
      
      <h4 style={{ margin: '10px 0 5px 0' }}>Enemies:</h4>
      <div style={{ maxHeight: '100px', overflow: 'auto' }}>
        {currentRoom.enemies.map((enemy, i) => (
          <div key={i} style={{ marginBottom: '5px', borderBottom: '1px solid #333' }}>
            {enemy.type} - {formatVector(enemy.position)} - HP: {enemy.health}/{enemy.maxHealth}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Debug controls to toggle visual helpers
 */
export function DebugControls() {
  const [showGrid, setShowGrid] = useState(false);
  const [showLayout, setShowLayout] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  
  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '10px',
    left: '10px',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    padding: '10px',
    borderRadius: '5px',
    fontSize: '12px',
    fontFamily: 'monospace',
    zIndex: 1000,
  };
  
  const buttonStyle: React.CSSProperties = {
    backgroundColor: '#444',
    color: 'white',
    border: 'none',
    padding: '5px 10px',
    margin: '0 5px',
    borderRadius: '3px',
    cursor: 'pointer',
  };
  
  const activeButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#0066cc',
  };
  
  return (
    <>
      <div style={containerStyle}>
        <button 
          style={showGrid ? activeButtonStyle : buttonStyle}
          onClick={() => setShowGrid(!showGrid)}
        >
          Grid
        </button>
        <button 
          style={showLayout ? activeButtonStyle : buttonStyle}
          onClick={() => setShowLayout(!showLayout)}
        >
          Layout
        </button>
        <button 
          style={showInfo ? activeButtonStyle : buttonStyle}
          onClick={() => setShowInfo(!showInfo)}
        >
          Info
        </button>
      </div>
      
      {showGrid && <DebugGrid />}
      {showLayout && <DebugRoomLayout />}
      {showInfo && <DebugRoomInfo />}
    </>
  );
}

/**
 * Main debug component to include in your scene
 */
export function GameDebugTools() {
  // Check if in development mode
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (!isDevelopment) return null;
  
  return <DebugControls />;
}