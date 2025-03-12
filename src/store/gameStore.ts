import { create } from "zustand";
import { GameState, Player, Level, Boon } from "../types/game";
import { BOONS } from "../systems/progression";
import {
  getMetaProgressionBonuses,
} from "./metaProgressionStore";
import { useGameFlowStore, completeRun } from "./gameFlowStore";

const createInitialPlayer = (): Player => {
  // Get meta-progression bonuses
  const {
    maxHealthBonus = 0,
    damageBonus = 0,
    critChanceBonus = 0,
    moveSpeedMultiplier = 1,
  } = getMetaProgressionBonuses();

  // Apply bonuses to initial player
  return {
    health: 100 + maxHealthBonus,
    maxHealth: 100 + maxHealthBonus,
    position: { x: 0, y: 0, z: 0 },
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
    },
    equipment: [],
    activeBuffs: [],
  };
};

interface GameStore extends GameState {
  currentLevel: Level | null;
  currentRoomId: string | null;
  takeDamage: (amount: number) => void;
  heal: (amount: number) => void;
  gainExperience: (amount: number) => void;
  resetGame: (customPlayer?: Partial<Player>) => void;
  setCurrentLevel: (level: Level) => void;
  setCurrentRoomId: (roomId: string) => void;
  isUpgradeAvailable: boolean;
  availableBoons: Boon[];
  showUpgradeUI: () => void;
  selectBoon: (boonId: string) => void;
  removeEnemy: (roomId: string, enemyId: string) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
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

  setCurrentLevel: (level) => set({ currentLevel: level }),

  setCurrentRoomId: (roomId) => {
    // Register room cleared in game flow store when changing rooms
    if (roomId !== get().currentRoomId && get().currentRoomId) {
      const currentRoomId = get().currentRoomId;
      if (currentRoomId) {
        useGameFlowStore.getState().registerRoomCleared(currentRoomId);
      }
    }

    set({ currentRoomId: roomId });
  },

  isUpgradeAvailable: false,
  availableBoons: [],

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

      // Register the boon in the game session
      useGameFlowStore.getState().registerBoonCollected(boonId);

      set({ player, isUpgradeAvailable: false, availableBoons: [] });
    }
  },

  removeEnemy: (roomId, enemyId) => {
    set((state) => {
      if (!state.currentLevel || !roomId) return state;

      const room = state.currentLevel.rooms.find((r) => r.id === roomId);
      if (!room) return state;

      const enemy = room.enemies.find((e) => e.id === enemyId);
      if (!enemy) return state;

      // Remove enemy from room
      room.enemies = room.enemies.filter((e) => e.id !== enemyId);

      // Award experience
      state.gainExperience(enemy.experience);

      // Register the enemy defeat in game flow
      useGameFlowStore
        .getState()
        .registerEnemyDefeated(enemyId, enemy.experience);

      // Register damage dealt equal to enemy max health
      useGameFlowStore.getState().registerDamageDealt(enemy.maxHealth);

      // Check if this was a boss
      if (enemy.type === "Boss") {
        useGameFlowStore.getState().registerBossDefeated();

        // Complete the run with victory
        completeRun(true);

        return {
          currentLevel: { ...state.currentLevel },
          isGameOver: true,
        };
      }

      // Check if room is cleared
      if (room.enemies.length === 0) {
        // If not a boss room, show upgrades
        if (room.type !== "boss") {
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
        currentLevel: { ...state.currentLevel },
      };
    });
  },

  takeDamage: (amount) => {
    // Register damage taken in game flow
    useGameFlowStore.getState().registerDamageTaken(amount);

    set((state) => {
      const newHealth = Math.max(0, state.player.health - amount);
      const isGameOver = newHealth <= 0;

      // If player died, complete run with defeat
      if (isGameOver) {
        completeRun(false);
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

  resetGame: (customPlayer = {}) => {
    // Create fresh player with meta-progression bonuses
    const basePlayer = createInitialPlayer();

    // Start a new game session
    useGameFlowStore.getState().startNewSession();

    // Apply any custom overrides (useful for testing)
    set({
      player: { ...basePlayer, ...customPlayer },
      currentLevel: null,
      currentRoomId: null,
      isPaused: false,
      isGameOver: false,
    });
  },
}));
