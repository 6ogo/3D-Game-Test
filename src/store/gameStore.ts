import { create } from "zustand";
import { GameState, Player, Level, Room, Boon } from "../types/game";
import { BOONS } from "../systems/progression";

const initialPlayer: Player = {
  health: 100,
  maxHealth: 100,
  position: { x: 0, y: 0, z: 0 },
  abilities: [
    {
      id: "basic-attack",
      name: "Soul Strike",
      description: "A basic ethereal attack",
      damage: 20,
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
    criticalChance: 0.05,
    criticalDamage: 1.5,
  },
  equipment: [],
  activeBuffs: [],
};

interface GameStore extends GameState {
  currentLevel: Level | null;
  currentRoomId: string | null;
  takeDamage: (amount: number) => void;
  heal: (amount: number) => void;
  gainExperience: (amount: number) => void;
  resetGame: () => void;
  setCurrentLevel: (level: Level) => void;
  setCurrentRoomId: (roomId: string) => void;
  isUpgradeAvailable: boolean;
  availableBoons: Boon[];
  showUpgradeUI: () => void;
  selectBoon: (boonId: string) => void;
  removeEnemy: (roomId: string, enemyId: string) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  player: initialPlayer,
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
  setCurrentRoomId: (roomId) => set({ currentRoomId: roomId }),
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
    const state = useGameStore.getState();
    const boon = state.availableBoons.find((b) => b.id === boonId);
    if (boon) {
      const player = state.player;
      boon.apply(player);
      set({ player, isUpgradeAvailable: false, availableBoons: [] });
    }
  },

  removeEnemy: (roomId, enemyId) =>
    set((state) => {
      if (state.currentLevel) {
        const room = state.currentLevel.rooms.find((r) => r.id === roomId);
        if (room) {
          const enemy = room.enemies.find((e) => e.id === enemyId);
          if (enemy) {
            room.enemies = room.enemies.filter((e) => e.id !== enemyId);
            state.gainExperience(enemy.experience);
            if (room.enemies.length === 0) {
              if (room.type === "boss") {
                alert("You have defeated the boss and won the game!");
                return {
                  currentLevel: { ...state.currentLevel },
                  isGameOver: true,
                };
              } else {
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
          }
        }
      }
      return {
        currentLevel: state.currentLevel
          ? { ...state.currentLevel }
          : state.currentLevel,
      };
    }),

  takeDamage: (amount) =>
    set((state) => ({
      player: {
        ...state.player,
        health: Math.max(0, state.player.health - amount),
      },
      isGameOver: state.player.health - amount <= 0,
    })),
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
  resetGame: () =>
    set({
      player: initialPlayer,
      currentLevel: null,
      currentRoomId: null,
      isPaused: false,
      isGameOver: false,
    }),
}));
