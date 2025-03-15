// Game.tsx - Fixed version with safe initialization
import { useEffect, useState, useCallback, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Sky, Stars } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import * as THREE from 'three';

// Import custom systems
import { Player } from './Player';
import { Level } from './Level';
import { EnhancedLevelGenerator } from '../systems/EnhancedLevelGeneration';
import { useGameStore } from '../store/gameStore';
import { CameraController } from './CameraController';
import { useGameSessionStore } from '../store/gameSessionStore';

// Safe initialization of potentially problematic systems
// We'll create a custom hook for this
function useSafeInitialization() {
  const [initialized, setInitialized] = useState(false);
  const [isLevelLoaded, setIsLevelLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { setCurrentLevel, setCurrentRoomId } = useGameStore();
  
  // Get session tracking functions
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
  }, [startSession, setCurrentLevel, setCurrentRoomId]);
  
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

// Player-centered lighting that follows the player
const PlayerLight = () => {
  const { player } = useGameStore();
  const lightRef = useRef<THREE.PointLight>(null);
  const secondaryLightRef = useRef<THREE.SpotLight>(null);

  useFrame(() => {
    if (player && player.position) {
      // Update point light position
      if (lightRef.current) {
        lightRef.current.position.x = player.position.x;
        lightRef.current.position.y = player.position.y + 3;
        lightRef.current.position.z = player.position.z;
      }
      
      // Update spotlight position and target
      if (secondaryLightRef.current) {
        secondaryLightRef.current.position.x = player.position.x;
        secondaryLightRef.current.position.y = player.position.y + 8;
        secondaryLightRef.current.position.z = player.position.z;
        
        // Update spotlight target to point at player's feet
        if (secondaryLightRef.current.target) {
          secondaryLightRef.current.target.position.x = player.position.x;
          secondaryLightRef.current.target.position.y = player.position.y;
          secondaryLightRef.current.target.position.z = player.position.z;
        }
      }
    }
  });

  return (
    <>
      {/* Main point light that follows player */}
      <pointLight
        ref={lightRef}
        position={[0, 3, 0]}
        intensity={1.2}
        distance={15}
        decay={2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={25}
        color="#f9efd4" // Warm light color
      />
      
      {/* Spotlight for dramatic lighting */}
      <spotLight
        ref={secondaryLightRef}
        position={[0, 8, 0]}
        intensity={1.5}
        angle={0.5}
        penumbra={0.5}
        distance={20}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        color="#ffffff"
      />
      <primitive object={new THREE.Object3D()} position={[0, 0, 0]} />
    </>
  );
};

// HUD Component for player information
const HUD = () => {
  const { player } = useGameStore();
  const [showHUD, setShowHUD] = useState(true);

  // Toggle HUD visibility with H key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        setShowHUD(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!showHUD) return null;

  // Default values if player data isn't available
  const health = player?.health || 100;
  const maxHealth = player?.maxHealth || 100;
  const level = player?.level || 1;
  const experience = player?.experience || 0;
  
  // Calculate next level XP (100 * current level)
  const nextLevelExp = 100 * level;
  
  // Get player stats
  const strength = player?.stats?.strength || 10;
  const agility = player?.stats?.agility || 10;
  const vitality = player?.stats?.vitality || 10;

  return (
    <div className="hud">
      {/* Health bar */}
      <div className="stat-container">
        <div className="stat-label">HP</div>
        <div className="stat-bar health-bar">
          <div className="stat-fill" style={{ width: `${(health / maxHealth) * 100}%` }}></div>
          <div className="stat-text">{Math.floor(health)}/{maxHealth}</div>
        </div>
      </div>

      {/* Experience bar */}
      <div className="stat-container">
        <div className="stat-label">LVL {level}</div>
        <div className="stat-bar exp-bar">
          <div 
            className="stat-fill" 
            style={{ width: `${(experience / nextLevelExp) * 100}%` }}
          ></div>
          <div className="stat-text">{experience}/{nextLevelExp}</div>
        </div>
      </div>

      {/* Additional player stats */}
      <div className="player-stats">
        <div className="stat-box">
          <span className="stat-icon">⚔️</span>
          <span className="stat-value">{strength}</span>
        </div>
        <div className="stat-box">
          <span className="stat-icon">🛡️</span>
          <span className="stat-value">{vitality}</span>
        </div>
        <div className="stat-box">
          <span className="stat-icon">⚡</span>
          <span className="stat-value">{agility}</span>
        </div>
      </div>
    </div>
  );
};

// Main Game component
export function Game() {
  const { initialized, isLevelLoaded, error } = useSafeInitialization();

  // Handle WebGL context errors
  const handleContextLost = useCallback((event: Event) => {
    console.error('WebGL context lost!');
    event.preventDefault();
  }, []);

  const handleContextRestored = useCallback(() => {
    console.log('WebGL context restored!');
  }, []);

  if (error) {
    return (
      <div className="error-screen">
        <h1>Error</h1>
        <p>{error.message}</p>
        <button onClick={() => window.location.reload()}>Restart Game</button>
      </div>
    );
  }

  if (!initialized) {
    return (
      <div className="loading-screen">
        <h1>Initializing Game...</h1>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="game-container">
      {/* HUD Elements */}
      <HUD />
      
      {/* Game Canvas */}
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
        camera={{ position: [0, 12, 15], fov: 60 }}
        onCreated={({ gl }) => {
          gl.setClearColor('#000000');
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          // Disable context menu on canvas to prevent issues
          gl.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
          
          // Add context handlers
          const canvas = gl.domElement;
          canvas.addEventListener('webglcontextlost', handleContextLost as EventListener);
          canvas.addEventListener('webglcontextrestored', handleContextRestored as EventListener);
        }}
      >
        {/* Enhanced lighting setup */}
        {/* Ambient light for overall scene brightness */}
        <ambientLight intensity={0.25} color="#b9d5ff" />
        
        {/* Main directional light with shadows */}
        <directionalLight
          position={[10, 20, 5]}
          intensity={0.5}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={50}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
          color="#fffaea"
        />
        
        {/* Additional fill light from the opposite side */}
        <directionalLight 
          position={[-10, 15, -5]} 
          intensity={0.25} 
          color="#a0c0ff" 
        />
        
        {/* Ground-reflected light */}
        <hemisphereLight
          args={['#b9d5ff', '#444466', 0.4]}
        />
        
        {/* Sky and stars for visual appeal */}
        <Sky distance={450000} sunPosition={[0, 1, 0]} inclination={0.25} azimuth={0.25} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        
        {/* WebGL context handler */}
        <WebGLContextHandler />
        
        {/* Physics world for gameplay */}
        <Physics>
          {isLevelLoaded && (
            <>
              {/* Camera controller that follows player */}
              <CameraController />
              
              {/* Level geometry and elements */}
              <Level />
              
              {/* Player character */}
              <Player />
              
              {/* Player-following light */}
              <PlayerLight />
            </>
          )}
        </Physics>
      </Canvas>
      
      {/* Game controls help */}
      <div className="controls-help">
        <p>WASD: Move | Mouse1/F: Attack | Space: Dash</p>
        <p>Q/E: Special | R: Cast | H: Toggle HUD</p>
      </div>
    </div>
  );
}