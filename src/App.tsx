import { useEffect, useState } from 'react';
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
  const [audioInitialized, setAudioInitialized] = useState(false);
  
  // Initialize audio when app loads
  useEffect(() => {
    // Attempt to preload audio, but make it optional
    try {
      AudioManager.preloadAll();
      
      // Only try to play music on user interaction
      const handleUserInteraction = () => {
        try {
          AudioManager.playMusic('main');
          setAudioInitialized(true);
          
          // Remove event listeners once audio is playing
          document.removeEventListener('click', handleUserInteraction);
          document.removeEventListener('keydown', handleUserInteraction);
        } catch (e) {
          console.warn('Failed to start audio:', e);
        }
      };
      
      // Add event listeners for user interaction
      document.addEventListener('click', handleUserInteraction);
      document.addEventListener('keydown', handleUserInteraction);
      
      // Clean up event listeners on unmount
      return () => {
        document.removeEventListener('click', handleUserInteraction);
        document.removeEventListener('keydown', handleUserInteraction);
        
        // Try to stop music when component unmounts
        try {
          AudioManager.stopMusic();
        } catch (e) {
          console.warn('Error stopping audio:', e);
        }
      };
    } catch (e) {
      console.warn('Error initializing audio:', e);
      return () => {}; // Empty cleanup function if initialization fails
    }
  }, []);
  
  return (
    <div className="w-full h-screen">
      {!audioInitialized && (
        <div 
          className="absolute top-0 left-0 right-0 z-50 bg-black text-white text-center p-2 text-sm"
        >
          Click or press any key to enable audio
        </div>
      )}
      <GameKeyboardControls>
        <SceneRouter scene={currentScene} />
      </GameKeyboardControls>
    </div>
  );
}

export default App;
