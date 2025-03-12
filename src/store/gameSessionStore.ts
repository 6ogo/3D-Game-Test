import { create } from 'zustand';

/**
 * GameSessionTracker - Collects stats during gameplay for end-game summary
 * 
 * Tracks:
 * - Total time
 * - Deaths
 * - Enemies killed
 * - Upgrades collected
 * - Boss kill time
 * - Rooms cleared
 * - Damage dealt/taken
 * - Souls collected
 */

export interface GameSessionStats {
  startTime: number;
  totalTime: number;
  deaths: number;
  enemiesKilled: number;
  enemiesByType: Record<string, number>;
  upgradesCollected: number;
  upgradesByType: Record<string, number>;
  roomsCleared: number;
  roomsByType: Record<string, number>;
  bossEnteredTime: number | null;
  bossKillTime: number | null;
  damageDealt: number;
  damageTaken: number;
  soulsCollected: number;
  seed: string;
}

interface GameSessionState {
  stats: GameSessionStats;
  isRunActive: boolean;
  isGamePaused: boolean;
  
  // Session management
  startSession: (seed?: string) => void;
  endSession: () => GameSessionStats;
  pauseSession: () => void;
  resumeSession: () => void;
  
  // Stats tracking
  registerDeath: () => void;
  registerEnemyKill: (enemyType: string) => void;
  registerUpgradeCollected: (upgradeType: string) => void;
  registerRoomCleared: (roomType: string) => void;
  registerDamageDealt: (amount: number) => void;
  registerDamageTaken: (amount: number) => void;
  registerSoulsCollected: (amount: number) => void;
  
  // Boss events
  registerBossEncounter: () => void;
  registerBossDefeated: () => void;
  
  // Helpers
  getFormattedTime: () => string;
  getSessionTime: () => number;
}

// Initialize with default values
const defaultStats: GameSessionStats = {
  startTime: 0,
  totalTime: 0,
  deaths: 0,
  enemiesKilled: 0,
  enemiesByType: {},
  upgradesCollected: 0,
  upgradesByType: {},
  roomsCleared: 0,
  roomsByType: {},
  bossEnteredTime: null,
  bossKillTime: null,
  damageDealt: 0,
  damageTaken: 0,
  soulsCollected: 0,
  seed: 'random'
};

export const useGameSessionStore = create<GameSessionState>((set, get) => ({
  stats: { ...defaultStats },
  isRunActive: false,
  isGamePaused: false,
  
  // Start a new session
  startSession: (seed = 'random') => {
    const now = Date.now();
    set({
      stats: {
        ...defaultStats,
        startTime: now,
        seed
      },
      isRunActive: true,
      isGamePaused: false
    });
    console.log(`Game session started with seed: ${seed}`);
  },
  
  // End the current session and return stats
  endSession: () => {
    const { stats, isRunActive } = get();
    
    if (!isRunActive) {
      console.warn('Attempted to end a session that was not active');
      return stats;
    }
    
    // Calculate total time
    const now = Date.now();
    const totalTime = Math.floor((now - stats.startTime) / 1000);
    
    const finalStats = {
      ...stats,
      totalTime
    };
    
    set({
      stats: finalStats,
      isRunActive: false
    });
    
    console.log(`Game session ended. Total time: ${formatTime(totalTime)}`);
    return finalStats;
  },
  
  // Pause the session (stop time counting)
  pauseSession: () => {
    const { isRunActive, isGamePaused, stats } = get();
    
    if (!isRunActive || isGamePaused) return;
    
    // Store current time when pausing
    const now = Date.now();
    const currentRunTime = now - stats.startTime;
    
    set({
      isGamePaused: true,
      stats: {
        ...stats,
        totalTime: Math.floor(currentRunTime / 1000)
      }
    });
    
    console.log('Game session paused');
  },
  
  // Resume the session
  resumeSession: () => {
    const { isRunActive, isGamePaused, stats } = get();
    
    if (!isRunActive || !isGamePaused) return;
    
    // Adjust start time to account for pause duration
    const now = Date.now();
    const newStartTime = now - (stats.totalTime * 1000);
    
    set({
      isGamePaused: false,
      stats: {
        ...stats,
        startTime: newStartTime
      }
    });
    
    console.log('Game session resumed');
  },
  
  // Register a player death
  registerDeath: () => {
    set(state => ({
      stats: {
        ...state.stats,
        deaths: state.stats.deaths + 1
      }
    }));
  },
  
  // Register an enemy kill
  registerEnemyKill: (enemyType) => {
    set(state => {
      // Update enemy type counter
      const enemiesByType = { ...state.stats.enemiesByType };
      enemiesByType[enemyType] = (enemiesByType[enemyType] || 0) + 1;
      
      return {
        stats: {
          ...state.stats,
          enemiesKilled: state.stats.enemiesKilled + 1,
          enemiesByType
        }
      };
    });
  },
  
  // Register an upgrade/boon collected
  registerUpgradeCollected: (upgradeType) => {
    set(state => {
      // Update upgrade type counter
      const upgradesByType = { ...state.stats.upgradesByType };
      upgradesByType[upgradeType] = (upgradesByType[upgradeType] || 0) + 1;
      
      return {
        stats: {
          ...state.stats,
          upgradesCollected: state.stats.upgradesCollected + 1,
          upgradesByType
        }
      };
    });
  },
  
  // Register a room cleared
  registerRoomCleared: (roomType) => {
    set(state => {
      // Update room type counter
      const roomsByType = { ...state.stats.roomsByType };
      roomsByType[roomType] = (roomsByType[roomType] || 0) + 1;
      
      return {
        stats: {
          ...state.stats,
          roomsCleared: state.stats.roomsCleared + 1,
          roomsByType
        }
      };
    });
  },
  
  // Register damage dealt
  registerDamageDealt: (amount) => {
    set(state => ({
      stats: {
        ...state.stats,
        damageDealt: state.stats.damageDealt + amount
      }
    }));
  },
  
  // Register damage taken
  registerDamageTaken: (amount) => {
    set(state => ({
      stats: {
        ...state.stats,
        damageTaken: state.stats.damageTaken + amount
      }
    }));
  },
  
  // Register souls collected
  registerSoulsCollected: (amount) => {
    set(state => ({
      stats: {
        ...state.stats,
        soulsCollected: state.stats.soulsCollected + amount
      }
    }));
  },
  
  // Register boss encounter (start of boss fight)
  registerBossEncounter: () => {
    const { stats } = get();
    
    // Only set if not already set
    if (stats.bossEnteredTime !== null) return;
    
    const now = Date.now();
    const bossEnteredTime = Math.floor((now - stats.startTime) / 1000);
    
    set({
      stats: {
        ...stats,
        bossEnteredTime
      }
    });
    
    console.log(`Boss encounter started at ${formatTime(bossEnteredTime)}`);
  },
  
  // Register boss defeated
  registerBossDefeated: () => {
    const { stats } = get();
    
    // Only set if not already set
    if (stats.bossKillTime !== null) return;
    
    const now = Date.now();
    const bossKillTime = Math.floor((now - stats.startTime) / 1000);
    
    set({
      stats: {
        ...stats,
        bossKillTime
      }
    });
    
    console.log(`Boss defeated at ${formatTime(bossKillTime)}`);
  },
  
  // Get current session time formatted
  getFormattedTime: () => {
    const sessionTime = get().getSessionTime();
    return formatTime(sessionTime);
  },
  
  // Get current session time in seconds
  getSessionTime: () => {
    const { stats, isRunActive, isGamePaused } = get();
    
    if (!isRunActive) return stats.totalTime;
    
    if (isGamePaused) return stats.totalTime;
    
    const now = Date.now();
    return Math.floor((now - stats.startTime) / 1000);
  }
}));

// Helper for formatting time (MM:SS)
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}