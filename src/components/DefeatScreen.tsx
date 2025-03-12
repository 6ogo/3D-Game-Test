import { useEffect } from 'react';
import { useGameFlowStore } from '../store/gameFlowStore';

export function DefeatScreen() {
  const { transitionToHome } = useGameFlowStore();
  
  useEffect(() => {
    const timer = setTimeout(() => {
      transitionToHome();
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [transitionToHome]);
  
  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-gradient-to-b from-red-900 to-black">
      <h1 className="text-6xl font-bold text-white mb-6">Defeated</h1>
      <p className="text-2xl text-gray-300 mb-8">Your soul returns to the void...</p>
      <p className="text-gray-400">Returning to the hall of souls...</p>
    </div>
  );
}