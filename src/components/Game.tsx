import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera, Sky, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import { Physics } from '@react-three/rapier';
import { Player } from './Player';
import { Level } from './Level';
import { UI } from './UI';
import { ParticleEngine } from '../systems/particles';
import { AudioManager } from '../systems/audio';
import { LevelGenerator } from '../systems/levelGeneration';
import { useGameStore } from '../store/gameStore';

export function Game() {
  const setCurrentLevel = useGameStore((state) => state.setCurrentLevel);
  const setCurrentRoomId = useGameStore((state) => state.setCurrentRoomId);

  useEffect(() => {
    const levelGenerator = new LevelGenerator(1, 'castle');
    const level = levelGenerator.generateLevel();
    setCurrentLevel(level);
    setCurrentRoomId(level.rooms[0].id);
    ParticleEngine.getInstance(/* scene ref would go here, simplified */);
    AudioManager.playMusic('main');
    return () => AudioManager.stopMusic();
  }, [setCurrentLevel, setCurrentRoomId]);

  return (
    <div className="w-full h-screen">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 20, 20]} rotation={[-Math.PI / 4, 0, 0]} fov={50} />
        <Sky sunPosition={[100, 20, 100]} />
        <Stars radius={200} depth={50} count={5000} factor={4} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={1} castShadow shadow-mapSize={[2048, 2048]} />
        <Physics gravity={[0, -30, 0]}>
          <Player />
          <Level />
        </Physics>
        <EffectComposer>
          <Bloom intensity={1.5} luminanceThreshold={0.9} luminanceSmoothing={0.025} />
          <ChromaticAberration offset={[0.002, 0.002]} />
        </EffectComposer>
      </Canvas>
      <UI />
    </div>
  );
}