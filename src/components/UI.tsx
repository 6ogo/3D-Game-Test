import { useGameStore } from '../store/gameStore';

export function UI() {
  const { player, isGameOver, resetGame } = useGameStore();

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Health Bar */}
      <div className="absolute top-4 left-4 bg-black/50 p-4 rounded-lg">
        <div className="w-48 h-4 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-red-600 transition-all duration-300"
            style={{ width: `${(player.health / player.maxHealth) * 100}%` }}
          />
        </div>
        <div className="text-white mt-2">
          Health: {player.health}/{player.maxHealth}
        </div>
      </div>

      {/* Level Info */}
      <div className="absolute top-4 right-4 bg-black/50 p-4 rounded-lg text-white">
        <div>Level: {player.level}</div>
        <div>XP: {player.experience}/1000</div>
      </div>

      {/* Game Over Screen */}
      {isGameOver && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-4xl text-white mb-4">Game Over</h2>
            <button
              className="bg-red-600 text-white px-6 py-2 rounded-lg pointer-events-auto hover:bg-red-700"
              onClick={resetGame}
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}