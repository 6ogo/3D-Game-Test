// Game.tsx - Fixed version with safe initialization
import { useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Sky, Stars, Html } from '@react-three/drei';
import { Physics } from '@react-three/rapier';

// Import custom systems
import { useGameSessionStore } from '../store/gameSessionStore';
import { Player } from './Player';
import { UI } from './UI';
import { Level } from './Level';
import { EnhancedLevelGenerator } from '../systems/EnhancedLevelGeneration';
import { useGameStore } from '../store/gameStore';
import { GameDebugTools } from '../utils/debug';

// Safe initialization of potentially problematic systems
// We'll create a custom hook for this
function useSafeInitialization() {
  const [initialized, setInitialized] = useState(false);
  const [isLevelLoaded, setIsLevelLoaded] = useState(false);
  const { setCurrentLevel, setCurrentRoomId } = useGameStore();
  const { scene } = useThree();
  
  // Start game session
  const startSession = useGameSessionStore(state => state.startSession);
  
  // Initialize level generation and game state
  useEffect(() => {
    // Start tracking game session
    startSession();
    
    // Generate level with error handling
    try {
      // Create level generator with safe defaults
      const levelGenerator = new EnhancedLevelGenerator({
        difficulty: 1,
        roomCount: 7,
        seed: Date.now().toString(),
        branchingFactor: 0.3
      });
      
      // Generate level
      const level = levelGenerator.generateLevel();
      
      // Set level in store
      setCurrentLevel(level);
      
      // Set first room (entrance room) as current
      const entranceRoom = level.rooms.find(room => room.isEntrance);
      if (entranceRoom) {
        setCurrentRoomId(entranceRoom.id);
      }
      
      console.log("Level generated successfully");
      
      // Mark level as loaded with a delay
      setTimeout(() => {
        setIsLevelLoaded(true);
        setInitialized(true);
        console.log("Level loaded and ready - enabling player physics");
      }, 1000); // Longer delay to ensure everything is ready
    } catch (error) {
      console.error("Error generating level:", error);
      
      // Still mark as initialized so the game can proceed with fallbacks
      setInitialized(true);
      setIsLevelLoaded(true);
    }
    
    // Cleanup on unmount
    return () => {
      // End game session
      useGameSessionStore.getState().endSession();
    };
  }, [scene, startSession, setCurrentLevel, setCurrentRoomId]);
  
  return { initialized, isLevelLoaded };
}

// Game scene setup component
function GameScene() {
  const { initialized, isLevelLoaded } = useSafeInitialization();
  
  // Loading indicator
  const LoadingScreen = () => (
    <Html center>
      <div className="loading-screen">
        <h2>Loading Level...</h2>
        <div className="loading-bar">
          <div className="loading-progress"></div>
        </div>
      </div>
    </Html>
  );
  
  // Show loading screen if level is not loaded
  if (!initialized) {
    return <LoadingScreen />;
  }
  
  return (
    <>
      {/* Ambient light */}
      <ambientLight intensity={0.3} />
      
      {/* Main directional light with shadows */}
      <directionalLight 
        position={[10, 20, 10]} 
        intensity={1.5} 
        castShadow 
        shadow-mapSize-width={2048} 
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      
      {/* Hemisphere light for better ambient lighting */}
      <hemisphereLight intensity={0.4} color="#ffffff" groundColor="#444444" />
      
      {/* Only enable physics when level is loaded */}
      <Physics gravity={[0, isLevelLoaded ? -30 : 0, 0]}>
        {isLevelLoaded && initialized && <Player />}
        {initialized && <Level />}
      </Physics>
    </>
  );
}

// WebGL context loss handler component
function WebGLContextHandler() {
  const { gl } = useThree();
  
  useEffect(() => {
    // Handle context loss
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      console.warn('WebGL context lost. Attempting to restore...');
    };
    
    // Handle context restoration
    const handleContextRestored = () => {
      console.log('WebGL context restored!');
    };
    
    // Add event listeners
    const canvas = gl.domElement;
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    
    // Clean up
    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, [gl]);
  
  return null;
}

// Main Game component
export function Game() {
  return (
    <div className="w-full h-screen">
      <Canvas 
        shadows 
        gl={{ 
          antialias: true,
          alpha: false,
          stencil: false,
          depth: true,
          powerPreference: 'high-performance',
          failIfMajorPerformanceCaveat: false
        }}
        camera={{ position: [0, 20, 20], fov: 50 }}
        onCreated={({ gl }) => {
          gl.setClearColor('#000000');
          // Disable context menu on canvas to prevent issues
          gl.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
        }}
      >
        <WebGLContextHandler />
        <PerspectiveCamera makeDefault position={[0, 20, 20]} rotation={[-Math.PI / 4, 0, 0]} fov={50} />
        <Sky sunPosition={[100, 20, 100]} />
        <Stars radius={200} depth={50} count={5000} factor={4} />
        <GameScene />
        {/* Add debug tools if in development mode */}
        {process.env.NODE_ENV === 'development' && <GameDebugTools />}
      </Canvas>
      <UI />
    </div>
  );
}