import { create } from 'zustand';
import { AudioManager } from '../systems/audio';
import { useMetaProgressionStore } from './metaProgressionStore';
import { useGameStore } from './gameStore';

// Game scene types
export type GameScene = 'home' | 'game' | 'victory' | 'defeat';

// Game session tracking for meta-progression
export interface GameSession {
  startTime: number;
  roomsCleared: number;
  enemiesDefeated: number;
  bossDefeated: boolean;
  soulsCollected: number;
  damageDealt: number;
  damageTaken: number;
  seed?: string;
  activeBoons: string[];
  deaths: number;
}

interface GameFlowState {
  // Current scene
  currentScene: GameScene;
  
  // Game session tracking
  session: GameSession;
  
  // Scene transitions
  transitionToHome: () => void;
  transitionToGame: () => void;
  transitionToVictory: () => void;
  transitionToDefeat: () => void;
  
  // Session management
  startNewSession: () => void;
  updateSession: (sessionUpdates: Partial<GameSession>) => void;
  clearSession: () => void;
  
  // Track cleared rooms
  registerRoomCleared: (roomId: string) => void;
  registerEnemyDefeated: (enemyId: string, souls: number) => void;
  registerBossDefeated: () => void;
  registerDamageDealt: (amount: number) => void;
  registerDamageTaken: (amount: number) => void;
  registerBoonCollected: (boonId: string) => void;
}

// Default empty session
const emptySession: GameSession = {
  startTime: 0,
  roomsCleared: 0,
  enemiesDefeated: 0,
  bossDefeated: false,
  soulsCollected: 0,
  seed: 'random',
  activeBoons: [],
  deaths: 0,
  damageTaken: 0,
  damageDealt: 0
};

export const useGameFlowStore = create<GameFlowState>((set) => ({
  currentScene: 'home',
  session: { ...emptySession },
  
  // Scene transitions
  transitionToHome: () => {
    AudioManager.transitionMusic('main');
    set({ currentScene: 'home' });
  },
  
  transitionToGame: () => {
    AudioManager.transitionMusic('main');
    set({ currentScene: 'game' });
  },
  
  transitionToVictory: () => {
    AudioManager.transitionMusic('victory');
    set({ currentScene: 'victory' });
    
    // You could trigger victory effects here
    // Such as particle effects, achievements, etc.
  },
  
  transitionToDefeat: () => {
    AudioManager.transitionMusic('defeat');
    set({ currentScene: 'defeat' });
  },
  
  // Session management
  startNewSession: () => {
    set({
      session: {
        ...emptySession,
        startTime: Date.now(),
      }
    });
  },
  
  updateSession: (sessionUpdates) => {
    set(state => ({
      session: {
        ...state.session,
        ...sessionUpdates
      }
    }));
  },
  
  clearSession: () => {
    set({ session: { ...emptySession } });
  },
  
  // Game tracking helpers
  registerRoomCleared: () => {
    set(state => ({
      session: {
        ...state.session,
        roomsCleared: state.session.roomsCleared + 1
      }
    }));
  },
  
  registerEnemyDefeated: (_, souls) => {
    set(state => ({
      session: {
        ...state.session,
        enemiesDefeated: state.session.enemiesDefeated + 1,
        soulsCollected: state.session.soulsCollected + souls
      }
    }));
  },
  
  registerBossDefeated: () => {
    // Award bonus souls for defeating the boss
    const bonusSouls = 500;
    
    set(state => ({
      session: {
        ...state.session,
        bossDefeated: true,
        soulsCollected: state.session.soulsCollected + bonusSouls
      }
    }));
  },
  
  registerDamageDealt: (amount) => {
    set(state => ({
      session: {
        ...state.session,
        damageDealt: state.session.damageDealt + amount
      }
    }));
  },
  
  registerDamageTaken: (amount) => {
    set(state => ({
      session: {
        ...state.session,
        damageTaken: state.session.damageTaken + amount
      }
    }));
  },
  
  registerBoonCollected: (boonId) => {
    set(state => ({
      session: {
        ...state.session,
        activeBoons: [...state.session.activeBoons, boonId]
      }
    }));
  }
}));

// Helper functions for game flow

// Calculate session duration in seconds
export function getSessionDuration(): number {
  const { startTime } = useGameFlowStore.getState().session;
  return Math.floor((Date.now() - startTime) / 1000);
}

// Complete a run and process meta-progression updates
export function completeRun(victory: boolean) {
  const { session } = useGameFlowStore.getState();
  const duration = getSessionDuration();
  
  // Get addRunStats directly from the store instead of using require()
  const { addRunStats } = useMetaProgressionStore.getState();
  
  // Add run stats to meta-progression
  addRunStats({
    victory,
    roomsCleared: session.roomsCleared,
    enemiesDefeated: session.enemiesDefeated,
    bossDefeated: session.bossDefeated,
    duration,
    damageDealt: session.damageDealt,
    damageTaken: session.damageTaken,
    soulsCollected: session.soulsCollected
  });
  
  // Set the game session in the game store for the end game screen
  useGameStore.getState().setGameSession({
    seed: session.seed || 'random',
    totalTime: duration,
    deaths: session.deaths || 0,
    enemiesKilled: session.enemiesDefeated || 0,
    upgradesCollected: session.activeBoons?.length || 0,
    roomsCleared: session.roomsCleared || 0,
    bossKillTime: session.bossDefeated ? duration : null,
    damageDealt: session.damageDealt || 0,
    damageTaken: session.damageTaken || 0,
    soulsCollected: session.soulsCollected || 0,
    startTime: session.startTime
  });
  
  // Transition to appropriate ending screen
  if (victory) {
    useGameFlowStore.getState().transitionToVictory();
  } else {
    useGameFlowStore.getState().transitionToDefeat();
  }
}
