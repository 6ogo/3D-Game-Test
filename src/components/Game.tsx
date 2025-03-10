import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera, Sky, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import { Physics } from '@react-three/rapier';
import { Player } from './Player';
import { Level } from './Level';
import { UI } from './UI';
import { ParticleEngine } from '../systems/particles';
import { AudioManager } from '../systems/audio';
import { useEffect, useRef } from 'react';
import { Enemy } from './Enemy';

export function Game() {
  const sceneRef = useRef<THREE.Scene>(null);

  useEffect(() => {
    if (sceneRef.current) {
      ParticleEngine.getInstance(sceneRef.current);
    }
    AudioManager.playMusic('main');
    return () => {
      AudioManager.stopMusic();
    };
  }, []);

  return (
    <div className="w-full h-screen">
      <Canvas shadows>
        <PerspectiveCamera 
          makeDefault 
          position={[0, 20, 20]} 
          rotation={[-Math.PI / 4, 0, 0]}
          fov={50}
        />
        
        <Sky sunPosition={[100, 20, 100]} />
        <Stars radius={200} depth={50} count={5000} factor={4} />
        
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[10, 10, 10]}
          intensity={1}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />

        <Physics gravity={[0, -30, 0]}>
          <Player />
          <Level />
          <Enemy position={[10, 1, 10]} />
          <Enemy position={[-10, 1, -10]} />
          <Enemy position={[15, 1, -15]} />
        </Physics>

        <EffectComposer>
          <Bloom
            intensity={1.5}
            luminanceThreshold={0.9}
            luminanceSmoothing={0.025}
          />
          <ChromaticAberration offset={[0.002, 0.002]} />
        </EffectComposer>
      </Canvas>
      <UI />
    </div>
  );
}