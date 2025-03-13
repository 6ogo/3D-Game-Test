// Game.tsx - Main game component
import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Sky, Stars, Html } from '@react-three/drei';
import { Physics } from '@react-three/rapier';

// Import custom systems
import { VisualEffectsManager } from '../systems/visualEffects';
import { ProjectileManager, ParticleSystem, EnemyPool } from '../systems/objectPooling';
import { ShaderManager } from '../systems/shaders';
import { useGameSessionStore } from '../store/gameSessionStore';
import { Player } from './Player';
import { UI } from './UI';
import { Level } from './Level';
import { LevelManager } from '../systems/dynamicLevelLoad';

// Game scene setup component
function GameScene() {
  const { scene, gl, camera } = useThree();
  const [isLevelLoaded, setIsLevelLoaded] = useState(false);
  
  // References to managers
  const levelManagerRef = useRef<LevelManager | null>(null);
  const effectsManagerRef = useRef<VisualEffectsManager | null>(null);
  const projectileManagerRef = useRef<ProjectileManager | null>(null);
  const enemyPoolRef = useRef<EnemyPool | null>(null);
  const shaderManagerRef = useRef<ShaderManager | null>(null);
  
  // Start game session
  const startSession = useGameSessionStore(state => state.startSession);
  
  // Initialize all systems on mount
  useEffect(() => {
    // Start tracking game session
    startSession();
    
    // Initialize level manager
    levelManagerRef.current = LevelManager.getInstance(scene);
    
    // Initialize visual effects
    effectsManagerRef.current = VisualEffectsManager.getInstance(gl, scene, camera);
    
    // Initialize object pools
    projectileManagerRef.current = ProjectileManager.getInstance(scene);
    ParticleSystem.getInstance(scene);
    enemyPoolRef.current = EnemyPool.getInstance(scene);
    
    // Initialize shader manager
    shaderManagerRef.current = new ShaderManager();
    
    // Load first level
    levelManagerRef.current.loadLevel('level-1').then(() => {
      // Set lighting based on entrance room
      if (levelManagerRef.current) {
        const entranceRoom = levelManagerRef.current.getActiveRoom();
        if (entranceRoom) {
          effectsManagerRef.current?.setupEnvironmentLighting(entranceRoom.type);
          
          // Mark level as loaded - this will enable physics and player controls
          setTimeout(() => {
            setIsLevelLoaded(true);
            console.log("Level loaded and ready - enabling player physics");
          }, 500); // Small delay to ensure everything is rendered
        }
      }
    });
    
    // Cleanup on unmount
    return () => {
      // End game session and save stats
      useGameSessionStore.getState().endSession();
    };
  }, [scene, gl, camera, startSession]);
  
  // Update loop
  useFrame((_state, delta) => {
    // Update all managers
    if (effectsManagerRef.current) {
      effectsManagerRef.current.update(delta);
    }
    
    if (projectileManagerRef.current) {
      projectileManagerRef.current.update();
    }
    
    // Update particle system
    ParticleSystem.getInstance().update();
  });
  
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
      <ambientLight intensity={0.1} />
      {!isLevelLoaded && <LoadingScreen />}
      
      {/* Add a safe floor to prevent falling into the void */}
      <mesh position={[0, -10, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      
      {/* Only enable physics when level is loaded */}
      <Physics gravity={[0, isLevelLoaded ? -30 : 0, 0]}>
        {isLevelLoaded && <Player />}
        <Level />
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
      </Canvas>
      <UI />
    </div>
  );
}