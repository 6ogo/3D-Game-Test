import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Permanent upgrades that persist between runs
export interface PermanentUpgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  maxLevel: number;
  currentLevel: number;
  effect: (level: number) => any; // Function to apply the upgrade effect
}

// Run statistics tracking
export interface RunStats {
  id: string;
  timestamp: number; // When the run ended
  victory: boolean;
  roomsCleared: number;
  enemiesDefeated: number;
  bossDefeated: boolean;
  duration: number; // In seconds
  damageDealt: number;
  damageTaken: number;
  soulsCollected: number;
}

export interface MetaProgressionState {
  // Currency and resources
  souls: number;
  
  // Permanent upgrades
  permanentUpgrades: PermanentUpgrade[];
  
  // Run history
  runHistory: RunStats[];
  
  // Unlocked items/abilities
  unlockedBoons: string[]; // IDs of boons unlocked for future runs
  unlockedAbilities: string[]; // IDs of abilities unlocked
  
  // Game stats
  totalRuns: number;
  totalVictories: number;
  totalDefeats: number;
  fastestVictory: number | null; // Time in seconds
  
  // Functions
  addSouls: (amount: number) => void;
  purchaseUpgrade: (upgradeId: string) => boolean;
  addRunStats: (stats: Omit<RunStats, 'id' | 'timestamp'>) => void;
  unlockBoon: (boonId: string) => void;
  unlockAbility: (abilityId: string) => void;
  resetProgress: () => void;
}

// Define the permanent upgrades available in the game
const defaultUpgrades: PermanentUpgrade[] = [
  {
    id: 'max-health',
    name: 'Vitality',
    description: 'Increase your starting maximum health by +10 per level',
    cost: 100,
    maxLevel: 10,
    currentLevel: 0,
    effect: (level) => ({ maxHealthBonus: level * 10 })
  },
  {
    id: 'base-damage',
    name: 'Soul Power',
    description: 'Increase your base attack damage by +2 per level',
    cost: 150,
    maxLevel: 10,
    currentLevel: 0,
    effect: (level) => ({ damageBonus: level * 2 })
  },
  {
    id: 'move-speed',
    name: 'Swift Movement',
    description: 'Increase your movement speed by +5% per level',
    cost: 120,
    maxLevel: 5,
    currentLevel: 0,
    effect: (level) => ({ moveSpeedMultiplier: 1 + (level * 0.05) })
  },
  {
    id: 'crit-chance',
    name: 'Critical Focus',
    description: 'Increase your critical hit chance by +2% per level',
    cost: 200,
    maxLevel: 5,
    currentLevel: 0,
    effect: (level) => ({ critChanceBonus: level * 0.02 })
  },
  {
    id: 'soul-gathering',
    name: 'Soul Harvester',
    description: 'Gain +10% more souls from all sources per level',
    cost: 175,
    maxLevel: 10,
    currentLevel: 0,
    effect: (level) => ({ soulMultiplier: 1 + (level * 0.1) })
  },
];

// Create the persisted store
export const useMetaProgressionStore = create<MetaProgressionState>()(
  persist(
    (set, get) => ({
      // Initial state
      souls: 0,
      permanentUpgrades: [...defaultUpgrades],
      runHistory: [],
      unlockedBoons: [],
      unlockedAbilities: [],
      totalRuns: 0,
      totalVictories: 0,
      totalDefeats: 0,
      fastestVictory: null,
      
      // Methods
      addSouls: (amount) => {
        // Apply soul gathering upgrade multiplier if present
        const soulUpgrade = get().permanentUpgrades.find(u => u.id === 'soul-gathering');
        const multiplier = soulUpgrade ? soulUpgrade.effect(soulUpgrade.currentLevel).soulMultiplier : 1;
        
        set(state => ({
          souls: state.souls + Math.floor(amount * multiplier)
        }));
      },
      
      purchaseUpgrade: (upgradeId) => {
        const state = get();
        const upgradeIndex = state.permanentUpgrades.findIndex(u => u.id === upgradeId);
        
        if (upgradeIndex === -1) return false;
        
        const upgrade = state.permanentUpgrades[upgradeIndex];
        
        // Check if we can purchase this upgrade
        if (
          upgrade.currentLevel >= upgrade.maxLevel || 
          state.souls < upgrade.cost
        ) {
          return false;
        }
        
        // Calculate the new cost (increases with level)
        const newCost = Math.floor(upgrade.cost * (1 + upgrade.currentLevel * 0.5));
        
        // Update the upgrade
        const updatedUpgrades = [...state.permanentUpgrades];
        updatedUpgrades[upgradeIndex] = {
          ...upgrade,
          currentLevel: upgrade.currentLevel + 1,
          cost: newCost
        };
        
        // Deduct souls and update state
        set({
          souls: state.souls - upgrade.cost,
          permanentUpgrades: updatedUpgrades
        });
        
        return true;
      },
      
      addRunStats: (stats) => {
        const runStats: RunStats = {
          ...stats,
          id: `run-${Date.now()}`,
          timestamp: Date.now()
        };
        
        set(state => {
          // Update fastest victory time if applicable
          let fastestVictory = state.fastestVictory;
          if (stats.victory && (fastestVictory === null || stats.duration < fastestVictory)) {
            fastestVictory = stats.duration;
          }
          
          return {
            runHistory: [runStats, ...state.runHistory].slice(0, 20), // Keep only last 20 runs
            totalRuns: state.totalRuns + 1,
            totalVictories: state.totalVictories + (stats.victory ? 1 : 0),
            totalDefeats: state.totalDefeats + (stats.victory ? 0 : 1),
            fastestVictory,
            souls: state.souls + stats.soulsCollected
          };
        });
      },
      
      unlockBoon: (boonId) => {
        set(state => ({
          unlockedBoons: [...new Set([...state.unlockedBoons, boonId])]
        }));
      },
      
      unlockAbility: (abilityId) => {
        set(state => ({
          unlockedAbilities: [...new Set([...state.unlockedAbilities, abilityId])]
        }));
      },
      
      resetProgress: () => {
        set({
          souls: 0,
          permanentUpgrades: [...defaultUpgrades],
          unlockedBoons: [],
          unlockedAbilities: []
          // Keeping run history and stats
        });
      }
    }),
    {
      name: 'ethereal-ascent-progress',
      partialize: (state) => ({
        souls: state.souls,
        permanentUpgrades: state.permanentUpgrades,
        runHistory: state.runHistory,
        unlockedBoons: state.unlockedBoons,
        unlockedAbilities: state.unlockedAbilities,
        totalRuns: state.totalRuns,
        totalVictories: state.totalVictories,
        totalDefeats: state.totalDefeats,
        fastestVictory: state.fastestVictory,
      })
    }
  )
);

// Helper function to get all current meta-progression bonuses
export function getMetaProgressionBonuses() {
  const { permanentUpgrades } = useMetaProgressionStore.getState();
  // Combine all effects from purchased upgrades
  return permanentUpgrades.reduce((bonuses, upgrade) => {
    if (upgrade.currentLevel > 0) {
      const effect = upgrade.effect(upgrade.currentLevel);
      return { ...bonuses, ...effect };
    }
    return bonuses;
  }, {
    maxHealthBonus: 0,
    damageBonus: 0,
    critChanceBonus: 0,
    moveSpeedMultiplier: 1,
  });
}