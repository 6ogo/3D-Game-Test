import { create } from "zustand";
import { GameState, Player, Level, Boon } from "../types/game";
import { BOONS } from "../systems/progression";
import { getMetaProgressionBonuses } from "./metaProgressionStore";
import { completeRun } from "./gameFlowStore";

// Define a game session type to track stats
export interface GameSession {
  seed: string;
  totalTime: number;
  deaths: number;
  enemiesKilled: number;
  upgradesCollected: number;
  roomsCleared: number;
  bossKillTime: number | null;
  damageDealt: number;
  damageTaken: number;
  soulsCollected: number;
  startTime?: number;
}

// Create and return initial player state with progression bonuses
const createInitialPlayer = (): Player => {
  // Get meta-progression bonuses
  const { 
    maxHealthBonus = 0, 
    damageBonus = 0,
    critChanceBonus = 0,
    moveSpeedMultiplier = 1
  } = getMetaProgressionBonuses();
  
  return {
  health: 100 + maxHealthBonus,
  maxHealth: 100 + maxHealthBonus,
  abilities: [
    {
      id: "basic-attack",
      name: "Soul Strike",
      description: "A basic ethereal attack",
      damage: 20 + damageBonus, // Apply damage bonus from meta-progression
      cooldown: 0.5,
      isReady: true,
      type: "attack",
      effects: [],
      animation: "",
      soundEffect: "",
      particleEffect: "",
    },
  ],
  experience: 0,
  level: 1,
  stats: {
    strength: 10,
    agility: 10,
    vitality: 10,
    wisdom: 10,
    criticalChance: 0.05 + critChanceBonus, // Apply crit chance bonus
    criticalDamage: 1.5,
    moveSpeed: 8 * moveSpeedMultiplier, // Apply move speed multiplier
    dodgeChance: 0.05, // Base dodge chance
  },
  equipment: [],
  activeBuffs: [],
  characterClass: undefined,
  position: { x: 0, y: 0, z: 0 }
};
};

// Default empty session
const emptySession: GameSession = {
  seed: 'random',
  totalTime: 0,
  deaths: 0,
  enemiesKilled: 0,
  upgradesCollected: 0,
  roomsCleared: 0,
  bossKillTime: null,
  damageDealt: 0,
  damageTaken: 0,
  soulsCollected: 0
};

// Game scenes type
export type GameScene = 'home' | 'game' | 'upgrade' | 'end';

// Extend the game store interface
interface GameStore extends GameState {
  [x: string]: any;
  // Game flow
  currentScene: GameScene;
  gameSession: GameSession | null;
  
  // Level tracking
  currentLevel: Level | null;
  currentRoomId: string | null;
  
  // UI states
  isUpgradeAvailable: boolean;
  availableBoons: Boon[];
  
  // Methods for game state
  takeDamage: (amount: number) => void;
  heal: (amount: number) => void;
  gainExperience: (amount: number) => void;
  resetGame: (customPlayer?: Partial<Player>) => void;
  setCurrentLevel: (level: Level) => void;
  setCurrentRoomId: (roomId: string) => void;
  
  // Methods for upgrades
  showUpgradeUI: () => void;
  selectBoon: (boonId: string) => void;

  previousRoomId: string | null;
  setPreviousRoomId: (roomId: string | null) => void;
  // Methods for enemies
  removeEnemy: (roomId: string, enemyId: string) => void;
  
  // Methods for game flow
  startGame: () => void;
  endGame: (victory: boolean) => void;
  showEndGameScreen: (stats: GameSession) => void;
  transitionToScene: (scene: GameScene) => void;
  
  // Session tracking
  incrementDeaths: () => void;
  incrementEnemiesKilled: () => void;
  incrementUpgradesCollected: () => void;
  incrementRoomsCleared: () => void;
  updateDamageDealt: (amount: number) => void;
  updateDamageTaken: (amount: number) => void;
  updateSoulsCollected: (amount: number) => void;


}

// Create and export the game store
export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  player: createInitialPlayer(),
  currentLevel: null,
  currentRoomId: null,
  isPaused: false,
  isGameOver: false,
  enemies: [],
  particles: [],
  score: 0,
  achievements: [],
  soundEnabled: true,
  musicVolume: 0.3,
  sfxVolume: 0.5,
  currentScene: 'home',
  gameSession: null,
  isUpgradeAvailable: false,
  availableBoons: [],
  previousRoomId: null,
  setPreviousRoomId: (roomId) => set({ previousRoomId: roomId }),
  
  // Level management
  setCurrentLevel: (level) => set({ currentLevel: level }),
  
  setCurrentRoomId: (roomId) => {
    if (roomId && roomId !== get().currentRoomId) {
      // Store the current room as previous before changing
      set({ previousRoomId: get().currentRoomId });
      
      // Then set the new current room
      set({ currentRoomId: roomId });
      
      // Increment rooms cleared counter when changing rooms
      get().incrementRoomsCleared();
    }
  },
  
  // Upgrade system
  showUpgradeUI: () => {
    const boons = [...BOONS];
    const selectedBoons = [];
    for (let i = 0; i < 2; i++) {
      const index = Math.floor(Math.random() * boons.length);
      selectedBoons.push(boons.splice(index, 1)[0]);
    }
    set({ isUpgradeAvailable: true, availableBoons: selectedBoons });
  },

  selectBoon: (boonId) => {
    const state = get();
    const boon = state.availableBoons.find((b) => b.id === boonId);
    if (boon) {
      const player = state.player;
      
      // Apply the boon
      boon.apply(player);
      
      // Increment upgrades collected
      get().incrementUpgradesCollected();
      
      set({ player, isUpgradeAvailable: false, availableBoons: [] });
    }
  },

  // Enemy management
  removeEnemy: (roomId, enemyId) => {
    set((state) => {
      if (!state.currentLevel) return state;
      
      const room = state.currentLevel.rooms.find((r) => r.id === roomId);
      if (!room) return state;
      
      const enemy = room.enemies.find((e) => e.id === enemyId);
      if (!enemy) return state;
      
      // Remove enemy from room
      room.enemies = room.enemies.filter((e) => e.id !== enemyId);
      
      // Award experience
      state.gainExperience(enemy.experience);
      
      // Increment enemies killed counter
      state.incrementEnemiesKilled();
      
      // Update damage dealt (assuming it took full health to kill)
      state.updateDamageDealt(enemy.maxHealth);
      
      // Check if this was a boss
      if (enemy.type === 'Boss') {
        // End game with victory
        get().endGame(true);
        
        return {
          currentLevel: { ...state.currentLevel },
          isGameOver: true,
        };
      }
      
      // Check if room is cleared
      if (room.enemies.length === 0) {
        // If not a boss room, show upgrades
        if (room.type !== 'boss') {
          const boons = [...BOONS];
          const selectedBoons = [];
          for (let i = 0; i < 2; i++) {
            const index = Math.floor(Math.random() * boons.length);
            selectedBoons.push(boons.splice(index, 1)[0]);
          }
          return {
            currentLevel: { ...state.currentLevel },
            isUpgradeAvailable: true,
            availableBoons: selectedBoons,
          };
        }
      }
      
      return {
        currentLevel: { ...state.currentLevel }
      };
    });
  },

  // Combat system
  takeDamage: (amount) => {
    // Update damage taken in session
    get().updateDamageTaken(amount);
    
    set((state) => {
      const newHealth = Math.max(0, state.player.health - amount);
      const isGameOver = newHealth <= 0;
      
      // If player dies, increment death counter
      if (isGameOver) {
        get().incrementDeaths();
      }
      
      return {
        player: {
          ...state.player,
          health: newHealth,
        },
        isGameOver,
      };
    });
  },
  
  heal: (amount) =>
    set((state) => ({
      player: {
        ...state.player,
        health: Math.min(state.player.maxHealth, state.player.health + amount),
      },
    })),
    
  gainExperience: (amount) =>
    set((state) => {
      const newExperience = state.player.experience + amount;
      const newLevel = Math.floor(newExperience / 1000) + 1;
      if (newLevel > state.player.level) {
        const statsIncrease = {
          strength:
            state.player.stats.strength + 2 * (newLevel - state.player.level),
          agility:
            state.player.stats.agility + 2 * (newLevel - state.player.level),
          vitality:
            state.player.stats.vitality + 2 * (newLevel - state.player.level),
          wisdom:
            state.player.stats.wisdom + 2 * (newLevel - state.player.level),
        };
        return {
          player: {
            ...state.player,
            experience: newExperience,
            level: newLevel,
            stats: { ...state.player.stats, ...statsIncrease },
          },
        };
      }
      return { player: { ...state.player, experience: newExperience } };
    }),
  
  // Game flow
  startGame: () => {
    // Start a new game session
    const gameSession: GameSession = {
      ...emptySession,
      seed: Math.random().toString(36).substring(2, 15),
      totalTime: 0,
      startTime: Date.now(),
    };
    
    set({
      gameSession,
      currentScene: 'game',
      isGameOver: false
    });
  },
  
  endGame: (victory) => {
    const { gameSession } = get();
    
    if (!gameSession) return;
    
    // Complete the run (integrates with meta-progression)
    completeRun(victory);
    
    // Show the end game screen
    get().showEndGameScreen(gameSession);
  },
  
  showEndGameScreen: (stats) => {
    set({
      currentScene: 'end',
      gameSession: stats
    });
  },
  
  transitionToScene: (scene) => {
    set({ currentScene: scene });
  },
  
  // Reset game to initial state
  resetGame: (customPlayer = {}) => {
    // Create fresh player with meta-progression bonuses
    const basePlayer = createInitialPlayer();
    
    // Apply any custom overrides (useful for testing)
    set({
      player: { ...basePlayer, ...customPlayer },
      currentLevel: null,
      currentRoomId: null,
      isPaused: false,
      isGameOver: false,
      gameSession: null,
      currentScene: 'home'
    });
  },
  
  // Session tracking methods
  incrementDeaths: () => {
    set(state => {
      if (!state.gameSession) return state;
      
      return {
        gameSession: {
          ...state.gameSession,
          deaths: state.gameSession.deaths + 1
        }
      };
    });
  },
  
  incrementEnemiesKilled: () => {
    set(state => {
      if (!state.gameSession) return state;
      
      return {
        gameSession: {
          ...state.gameSession,
          enemiesKilled: state.gameSession.enemiesKilled + 1
        }
      };
    });
  },
  
  incrementUpgradesCollected: () => {
    set(state => {
      if (!state.gameSession) return state;
      
      return {
        gameSession: {
          ...state.gameSession,
          upgradesCollected: state.gameSession.upgradesCollected + 1
        }
      };
    });
  },
  
  incrementRoomsCleared: () => {
    set(state => {
      if (!state.gameSession) return state;
      
      return {
        gameSession: {
          ...state.gameSession,
          roomsCleared: state.gameSession.roomsCleared + 1
        }
      };
    });
  },
  
  updateDamageDealt: (amount) => {
    set(state => {
      if (!state.gameSession) return state;
      
      return {
        gameSession: {
          ...state.gameSession,
          damageDealt: state.gameSession.damageDealt + amount
        }
      };
    });
  },
  
  updateDamageTaken: (amount) => {
    set(state => {
      if (!state.gameSession) return state;
      
      return {
        gameSession: {
          ...state.gameSession,
          damageTaken: state.gameSession.damageTaken + amount
        }
      };
    });
  },
  
  updateSoulsCollected: (amount) => {
    set(state => {
      if (!state.gameSession) return state;
      
      return {
        gameSession: {
          ...state.gameSession,
          soulsCollected: state.gameSession.soulsCollected + amount
        }
      };
    });
  }
}));