import { create } from 'zustand';
import { GameState, Player } from '../types/game';

const initialPlayer: Player = {
  health: 100,
  maxHealth: 100,
  position: { x: 0, y: 0, z: 0 },
  abilities: [
    {
      id: 'basic-attack',
      name: 'Soul Strike',
      description: 'A basic ethereal attack',
      damage: 20,
      cooldown: 0.5,
      isReady: true,
    }
  ],
  experience: 0,
  level: 1,
};

interface GameStore extends GameState {
  takeDamage: (amount: number) => void;
  heal: (amount: number) => void;
  gainExperience: (amount: number) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  player: initialPlayer,
  currentLevel: 1,
  isPaused: false,
  isGameOver: false,

  takeDamage: (amount) => set((state) => ({
    player: {
      ...state.player,
      health: Math.max(0, state.player.health - amount)
    },
    isGameOver: state.player.health - amount <= 0
  })),

  heal: (amount) => set((state) => ({
    player: {
      ...state.player,
      health: Math.min(state.player.maxHealth, state.player.health + amount)
    }
  })),

  gainExperience: (amount) => set((state) => ({
    player: {
      ...state.player,
      experience: state.player.experience + amount,
      level: Math.floor((state.player.experience + amount) / 1000) + 1
    }
  })),

  resetGame: () => set({
    player: initialPlayer,
    currentLevel: 1,
    isPaused: false,
    isGameOver: false
  })
}));