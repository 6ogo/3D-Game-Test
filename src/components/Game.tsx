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
      // End game session and save stats
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
    <Html fullscreen>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.8)',
        color: 'white',
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>Loading Level...</div>
        <div style={{ width: '200px', height: '10px', backgroundColor: '#333' }}>
          <div style={{ 
            width: isLevelLoaded ? '100%' : '90%', 
            height: '100%', 
            backgroundColor: isLevelLoaded ? '#4CAF50' : '#9C27B0',
            transition: 'width 0.5s ease-in-out'
          }} />
        </div>
      </div>
    </Html>
  );

  return (
    <>
      <ambientLight intensity={0.3} />
      {!isLevelLoaded && <LoadingScreen />}
      
      {/* Add a safe floor to prevent falling into the void */}
      <mesh position={[0, -10, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      
      {/* Only enable physics when level is loaded */}
      <Physics gravity={[0, isLevelLoaded ? -30 : 0, 0]}>
        {isLevelLoaded && initialized && <Player />}
        {initialized && <Level />}
      </Physics>
    </>
  );
}

// Main Game component
export function Game() {
  return (
    <div className="w-full h-screen">
      <Canvas shadows>
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