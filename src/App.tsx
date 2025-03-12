import { useEffect } from 'react';
import { Game } from './components/Game';
import { HomeScene } from './components/HomeScene';
import { GameKeyboardControls } from './components/KeyboardComponent';
import { VictoryScreen } from './components/VictoryScreen';
import { DefeatScreen } from './components/DefeatScreen';
import { useGameFlowStore, GameScene } from './store/gameFlowStore';
import { AudioManager } from './systems/audio';

// Scene router component
function SceneRouter({ scene }: { scene: GameScene }) {
  switch (scene) {
    case 'home':
      return <HomeScene />;
    case 'game':
      return <Game />;
    case 'victory':
      return <VictoryScreen />;
    case 'defeat':
      return <DefeatScreen />;
    default:
      return <HomeScene />;
  }
}

// Main App component
function App() {
  const currentScene = useGameFlowStore(state => state.currentScene);
  
  // Initialize audio when app loads
  useEffect(() => {
    AudioManager.preloadAll();
    AudioManager.playMusic('main');
    
    return () => {
      AudioManager.stopMusic();
    };
  }, []);
  
  return (
    <div className="w-full h-screen">
      <GameKeyboardControls>
        <SceneRouter scene={currentScene} />
      </GameKeyboardControls>
    </div>
  );
}

export default App;