import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera, Sky, Stars } from '@react-three/drei';
import { useMetaProgressionStore } from '../store/metaProgressionStore';
import { useGameStore } from '../store/gameStore';
import { useGameFlowStore } from '../store/gameFlowStore';
import { formatTime, formatNumber } from '../utils/formatters';
import { Shield, Zap, Footprints, Target, Ghost, ArrowUpCircle } from 'lucide-react';

// Main home scene component
export function HomeScene() {
  const [startingGame, setStartingGame] = useState(false);
  const [showUpgrades, setShowUpgrades] = useState(false);
  const resetGame = useGameStore(state => state.resetGame);
  const souls = useMetaProgressionStore(state => state.souls);
  const totalRuns = useMetaProgressionStore(state => state.totalRuns);
  const totalVictories = useMetaProgressionStore(state => state.totalVictories);
  const fastestVictory = useMetaProgressionStore(state => state.fastestVictory);

  // Handle start game button
  const handleStartGame = () => {
    setStartingGame(true);

    try {
      // Apply meta-progression bonuses to starting player
      const playerWithBonuses = applyMetaProgressionBonuses();

      // Reset game with the enhanced player stats
      resetGame(playerWithBonuses);

      // Initialize game state for a new game
      useGameStore.getState().startGame();

      // Transition to the game scene
      useGameFlowStore.getState().transitionToGame();

      // Log start
      console.log("Game starting...");
    } catch (error) {
      console.error("Error starting game:", error);
      setStartingGame(false); // Reset button state in case of error
    }
  };

  // Apply meta-progression bonuses to a new player
  const applyMetaProgressionBonuses = () => {
    try {
      const { permanentUpgrades } = useMetaProgressionStore.getState();
      const basePlayer = useGameStore.getState().player;

      // Start with a fresh player
      const enhancedPlayer = { ...basePlayer };

      // Apply all active upgrades if they exist
      if (permanentUpgrades && Array.isArray(permanentUpgrades)) {
        permanentUpgrades.forEach(upgrade => {
          if (upgrade && upgrade.currentLevel > 0 && typeof upgrade.effect === 'function') {
            try {
              const effect = upgrade.effect(upgrade.currentLevel);

              // Apply specific effects based on upgrade type
              if (effect && 'maxHealthBonus' in effect) {
                enhancedPlayer.maxHealth += effect.maxHealthBonus;
                enhancedPlayer.health += effect.maxHealthBonus;
              }

              if (effect && 'damageBonus' in effect && enhancedPlayer.abilities) {
                enhancedPlayer.abilities.forEach(ability => {
                  if (ability && ability.type === 'attack') {
                    ability.damage += effect.damageBonus;
                  }
                });
              }

              if (effect && 'critChanceBonus' in effect && enhancedPlayer.stats) {
                enhancedPlayer.stats.criticalChance += effect.critChanceBonus;
              }
            } catch (e) {
              console.warn("Error applying upgrade:", e);
            }
          }
        });
      }

      return enhancedPlayer;
    } catch (error) {
      console.error("Error in applyMetaProgressionBonuses:", error);
      return useGameStore.getState().player; // Return the base player as fallback
    }
  };

  return (
    <div className="w-full h-screen flex flex-col">
      {/* 3D Background Scene */}
      <div className="absolute inset-0 z-0">
        <Canvas shadows>
          <PerspectiveCamera makeDefault position={[0, 10, 20]} rotation={[-Math.PI / 6, 0, 0]} fov={50} />
          <Sky sunPosition={[100, 20, 100]} />
          <Stars radius={200} depth={50} count={5000} factor={4} />
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 10]} intensity={1} castShadow />
          <HomeSceneEnvironment />
        </Canvas>
      </div>

      {/* UI Overlay */}
      <div className="relative z-10 w-full h-full flex flex-col">
        {/* Header */}
        <header className="bg-black/70 p-4 text-white">
          <h1 className="text-3xl font-bold text-center mb-2">Ethereal Ascent</h1>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="flex items-center">
                <Zap className="text-yellow-500 mr-2" />
                <span className="text-xl font-semibold">{formatNumber(souls)} Souls</span>
              </div>

              {/* Clickable Boon Upgrade Button */}
              <button
                onClick={() => setShowUpgrades(!showUpgrades)}
                className="flex items-center gap-1 px-3 py-1 bg-purple-700 hover:bg-purple-600 rounded-lg transition-colors"
              >
                <ArrowUpCircle className="w-4 h-4" />
                <span>Boon Upgrades</span>
              </button>
            </div>
            <div className="flex space-x-4">
              <div className="text-sm">
                <span className="opacity-70">Runs: </span>
                <span>{totalRuns}</span>
              </div>
              <div className="text-sm">
                <span className="opacity-70">Victories: </span>
                <span>{totalVictories}</span>
              </div>
              {fastestVictory && (
                <div className="text-sm">
                  <span className="opacity-70">Best Time: </span>
                  <span>{formatTime(fastestVictory)}</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          {/* Boon Upgrades Panel - Conditionally shown */}
          {showUpgrades && (
            <div className="mb-4 max-h-[70vh] overflow-y-auto">
              <UpgradesPanel />
            </div>
          )}

          {/* Main game content */}
          <div className="flex-1 flex justify-center items-center">
            {!showUpgrades && (
              <div className="text-center max-w-2xl mx-auto bg-black/40 p-6 rounded-lg">
                <h2 className="text-2xl font-bold text-white mb-4">Welcome, Ascender</h2>
                <p className="text-gray-300 mb-6">Prepare yourself for the challenges ahead. Upgrade your abilities with souls and begin your journey.</p>

                <div className="flex justify-center space-x-4 mb-6">
                  <button
                    onClick={() => setShowUpgrades(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white transition-colors"
                  >
                    <ArrowUpCircle className="w-5 h-5" />
                    <span>View Boon Upgrades</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Start Game Button - Always visible at bottom */}
          <div className="mt-auto mx-auto w-full max-w-md">
            <button
              onClick={handleStartGame}
              disabled={startingGame}
              className={`w-full py-4 px-8 rounded-lg text-xl font-bold text-white transition-all ${startingGame
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-purple-700 hover:bg-purple-600 shadow-lg hover:shadow-purple-500/30'
                }`}
            >
              {startingGame ? 'Ascending...' : 'Begin Ascent'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 3D environment for the home scene
function HomeSceneEnvironment() {
  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>

      {/* Central altar/shrine */}
      <group position={[0, 0, -5]}>
        <mesh position={[0, 1, 0]} castShadow receiveShadow>
          <boxGeometry args={[4, 0.2, 4]} />
          <meshStandardMaterial color="#3a3a5c" />
        </mesh>
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[2, 2.5, 1, 6]} />
          <meshStandardMaterial color="#2a2a4a" />
        </mesh>

        {/* Ethereal light effect */}
        <pointLight position={[0, 2, 0]} intensity={2} color="#9050ff" distance={10} />
      </group>
    </group>
  );
}

// Upgrades panel component
function UpgradesPanel() {
  const permanentUpgrades = useMetaProgressionStore(state => state.permanentUpgrades);
  const souls = useMetaProgressionStore(state => state.souls);
  const purchaseUpgrade = useMetaProgressionStore(state => state.purchaseUpgrade);

  // Check if permanentUpgrades exists and is an array
  if (!permanentUpgrades || !Array.isArray(permanentUpgrades)) {
    return (
      <div className="bg-black/60 rounded-lg p-4 text-white">
        <h2 className="text-2xl font-bold text-white mb-4">Permanent Upgrades</h2>
        <p>No upgrades available at this time.</p>
      </div>
    );
  }

  // Icons for different upgrade types
  const upgradeIcons: Record<string, React.ReactNode> = {
    'max-health': <Shield className="w-6 h-6 text-red-400" />,
    'base-damage': <Zap className="w-6 h-6 text-yellow-400" />,
    'move-speed': <Footprints className="w-6 h-6 text-blue-400" />,
    'crit-chance': <Target className="w-6 h-6 text-green-400" />,
    'soul-gathering': <Ghost className="w-6 h-6 text-purple-400" />,
  };

  return (
    <div className="bg-black/60 rounded-lg p-4 h-full overflow-y-auto">
      <h2 className="text-2xl font-bold text-white mb-4">Permanent Upgrades</h2>

      <div className="grid grid-cols-1 gap-4">
        {permanentUpgrades.map((upgrade) => {
          const canAfford = souls >= upgrade.cost;
          const isMaxed = upgrade.currentLevel >= upgrade.maxLevel;

          return (
            <div
              key={upgrade.id}
              className={`bg-gray-800/80 rounded-lg p-4 border ${isMaxed
                  ? 'border-yellow-500'
                  : canAfford
                    ? 'border-blue-500'
                    : 'border-gray-700'
                }`}
            >
              <div className="flex items-start">
                <div className="mr-4">
                  {upgradeIcons[upgrade.id] || <div className="w-6 h-6 bg-gray-500 rounded-full" />}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">{upgrade.name}</h3>
                    <div className="text-sm text-white">
                      Level {upgrade.currentLevel}/{upgrade.maxLevel}
                    </div>
                  </div>

                  <p className="text-gray-300 text-sm mt-1">{upgrade.description}</p>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center text-yellow-500">
                      <Zap className="w-4 h-4 mr-1" />
                      <span>{upgrade.cost} Souls</span>
                    </div>

                    <button
                      onClick={() => purchaseUpgrade(upgrade.id)}
                      disabled={isMaxed || !canAfford}
                      className={`px-3 py-1 rounded text-sm font-semibold ${isMaxed
                          ? 'bg-yellow-500/30 text-yellow-300 cursor-not-allowed'
                          : canAfford
                            ? 'bg-blue-600 text-white hover:bg-blue-500'
                            : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                      {isMaxed ? 'Maxed' : 'Upgrade'}
                    </button>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2 w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${isMaxed ? 'bg-yellow-500' : 'bg-blue-500'}`}
                      style={{ width: `${(upgrade.currentLevel / upgrade.maxLevel) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}