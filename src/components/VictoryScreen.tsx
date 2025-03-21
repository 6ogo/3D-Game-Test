import { useEffect } from 'react';
import { useGameFlowStore } from '../store/gameFlowStore';

export function VictoryScreen() {
  const { transitionToHome } = useGameFlowStore();
  
  useEffect(() => {
    const timer = setTimeout(() => {
      transitionToHome();
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [transitionToHome]);
  
  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-gradient-to-b from-purple-900 to-black">
      <h1 className="text-6xl font-bold text-white mb-6">Victory!</h1>
      <p className="text-2xl text-gray-300 mb-8">You have conquered the castle!</p>
      <p className="text-gray-400">Returning to the hall of souls...</p>
    </div>
  );
}