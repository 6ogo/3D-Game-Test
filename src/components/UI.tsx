import { useGameStore } from '../store/gameStore';

export function UI() {
  const { player, isGameOver, resetGame, isUpgradeAvailable, availableBoons, selectBoon, currentRoomId, currentLevel } = useGameStore();
  const currentRoom = currentLevel?.rooms.find(room => room.id === currentRoomId);

  if (isUpgradeAvailable) {
    return (
      <div className="absolute inset-0 bg-black/80 flex items-center justify-center pointer-events-auto">
        <div className="bg-gray-800 p-8 rounded-lg">
          <h2 className="text-2xl text-white mb-4">Choose a Boon</h2>
          <div className="grid grid-cols-2 gap-4">
            {availableBoons.map(boon => (
              <button
                key={boon.id}
                className="bg-blue-600 text-white p-4 rounded hover:bg-blue-700"
                onClick={() => selectBoon(boon.id)}
              >
                <h3>{boon.name}</h3>
                <p>{boon.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Narrative Text */}
      {currentRoom && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-black/50 p-4 rounded-lg text-white text-center">
          {currentRoom.type === 'boss' ? 'You face the final guardian!' : `You enter a ${currentRoom.type} room...`}
        </div>
      )}
      <div className="absolute top-4 left-4 bg-black/50 p-4 rounded-lg">
        <div className="w-48 h-4 bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-red-600 transition-all duration-300" style={{ width: `${(player.health / player.maxHealth) * 100}%` }} />
        </div>
        <div className="text-white mt-2">Health: {player.health}/{player.maxHealth}</div>
      </div>
      <div className="absolute bottom-4 left-4 bg-black/50 p-4 rounded-lg text-white">
      <div>Level: {player.level}</div>
      <div>Experience: {player.experience}</div>
      <div>Stats:</div>
      <div>Strength: {player.stats.strength}</div>
      <div>Agility: {player.stats.agility}</div>
      <div>Vitality: {player.stats.vitality}</div>
      <div>Wisdom: {player.stats.wisdom}</div>
    </div>
      {isGameOver && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-4xl text-white mb-4">Game Over</h2>
            <button className="bg-red-600 text-white px-6 py-2 rounded-lg pointer-events-auto hover:bg-red-700" onClick={resetGame}>
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}