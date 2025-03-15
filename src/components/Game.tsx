// Game.tsx - Fixed version with safe initialization
import { useEffect, useState, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Sky, Stars } from '@react-three/drei';
import { Physics } from '@react-three/rapier';

// Import custom systems
import { useGameSessionStore } from '../store/gameSessionStore';
import { Player } from './Player';
import { UI } from './UI';
import { Level } from './Level';
import { EnhancedLevelGenerator } from '../systems/EnhancedLevelGeneration';
import { useGameStore } from '../store/gameStore';
import { GameDebugTools } from '../utils/debug';
import { CameraController } from './CameraController';

// Safe initialization of potentially problematic systems
// We'll create a custom hook for this
function useSafeInitialization() {
  const [initialized, setInitialized] = useState(false);
  const [isLevelLoaded, setIsLevelLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { setCurrentLevel, setCurrentRoomId } = useGameStore();
  const { scene } = useThree();
  
  // Start game session
  const startSession = useGameSessionStore(state => state.startSession);
  
  useEffect(() => {
    // Initialize game systems safely
    try {
      // Start tracking game session
      startSession();
      
      // Generate level with error handling
      try {
        const levelGenerator = new EnhancedLevelGenerator({
          difficulty: 1,
          roomCount: 10,
          seed: Date.now().toString(),
          branchingFactor: 0.3
        });
        
        const level = levelGenerator.generateLevel();
        
        // Set the generated level in the game store
        setCurrentLevel(level);
        
        // Set the starting room ID
        const startingRoom = level.rooms.find(room => room.isEntrance);
        if (startingRoom) {
          setCurrentRoomId(startingRoom.id);
        } else if (level.rooms.length > 0) {
          setCurrentRoomId(level.rooms[0].id);
        }
        
        setIsLevelLoaded(true);
      } catch (levelError) {
        console.error("Error generating level:", levelError);
        setError(levelError instanceof Error ? levelError : new Error("Failed to generate level"));
        return;
      }
      
      // Initialize other systems here
      // ...
      
      setInitialized(true);
    } catch (err) {
      console.error("Error initializing game:", err);
      setError(err instanceof Error ? err : new Error("Failed to initialize game"));
    }
  }, [scene, startSession, setCurrentLevel, setCurrentRoomId]);
  
  return { initialized, isLevelLoaded, error };
}

// WebGL context loss handler component
const WebGLContextHandler = () => {
  const { gl } = useThree();
  
  useEffect(() => {
    const canvas = gl.domElement;
    
    const handleContextLost = (event: Event) => {
      console.warn('WebGL context lost event detected');
      event.preventDefault();
    };
    
    const handleContextRestored = () => {
      console.log('WebGL context restored event detected');
      // Reload textures or other resources here
    };
    
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    
    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, [gl]);
  
  return null;
};

// Main Game component
export function Game() {
  const { isLevelLoaded, initialized, error } = useSafeInitialization();
  
  const handleContextLost = useCallback((event: Event) => {
    console.warn('WebGL context lost:', event);
    // Prevent default behavior to allow for recovery
    event.preventDefault();
  }, []);

  const handleContextRestored = useCallback((event: Event) => {
    console.log('WebGL context restored:', event);
    // You might want to reload textures or reinitialize some components
  }, []);
  
  if (error) {
    return (
      <div className="error-screen">
        <h2>Error Loading Game</h2>
        <p>{error.message}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }
  
  if (!isLevelLoaded || !initialized) {
    return (
      <div className="loading-screen">
        <h2>Loading Game...</h2>
        <div className="loading-bar">
          <div className="loading-progress"></div>
        </div>
      </div>
    );
  }
  
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
          gl.shadowMap.enabled = true;
          // Disable context menu on canvas to prevent issues
          gl.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
          
          // Add context handlers
          const canvas = gl.domElement;
          canvas.addEventListener('webglcontextlost', handleContextLost as EventListener);
          canvas.addEventListener('webglcontextrestored', handleContextRestored as EventListener);
        }}
      >
        {/* Ambient light for overall scene brightness */}
        <ambientLight intensity={0.3} />
        
        {/* Main directional light with shadows */}
        <directionalLight
          position={[10, 20, 5]}
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
        
        {/* Hemisphere light for more natural lighting */}
        <hemisphereLight
          args={['#ffffff', '#004400', 0.6]}
        />
        
        {/* Sky and stars for visual appeal */}
        <Sky sunPosition={[100, 10, 100]} />
        <Stars radius={100} depth={50} count={5000} factor={4} />
        
        {/* Camera controller for following the player */}
        <CameraController />
        
        {/* Physics world */}
        <Physics gravity={[0, isLevelLoaded ? -30 : 0, 0]}>
          {isLevelLoaded && initialized && <Player />}
          {initialized && <Level />}
        </Physics>
        
        {/* WebGL context loss handler */}
        <WebGLContextHandler />
        
        {/* Perspective camera */}
        <PerspectiveCamera makeDefault position={[0, 20, 20]} rotation={[-Math.PI / 4, 0, 0]} fov={50} />
        
        {/* Add debug tools if in development mode */}
        {process.env.NODE_ENV === 'development' && <GameDebugTools />}
      </Canvas>
      <UI />
    </div>
  );
}