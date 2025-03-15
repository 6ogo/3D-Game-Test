import { Player, Equipment, Ability, PlayerStats, Boon } from '../types/game';

// Define the different god categories
export type GodCategory = 'zeus' | 'poseidon' | 'athena' | 'ares' | 'artemis' | 'dionysus' | 'demeter' | 'hermes';

// Extended Boon interface with rarity
export interface EnhancedBoon extends Boon {
  god: GodCategory;
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'duo';
  slot: 'attack' | 'special' | 'cast' | 'dash' | 'passive';
  description: string;
  flavorText?: string;
  requiredBoons?: string[]; // For duo boons
  exclusions?: string[]; // Boons that can't be used with this one
}

// Define god themes and colors
export const GOD_THEMES: Record<GodCategory, { name: string; color: string; domain: string }> = {
  zeus: { name: 'Zeus', color: '#ffff00', domain: 'Lightning' },
  poseidon: { name: 'Poseidon', color: '#00aaff', domain: 'Ocean' },
  athena: { name: 'Athena', color: '#cccccc', domain: 'Protection' },
  ares: { name: 'Ares', color: '#ff0000', domain: 'Doom' },
  artemis: { name: 'Artemis', color: '#99ff99', domain: 'Critical' },
  dionysus: { name: 'Dionysus', color: '#aa66cc', domain: 'Hangover' },
  demeter: { name: 'Demeter', color: '#88ffee', domain: 'Chill' },
  hermes: { name: 'Hermes', color: '#ffaa44', domain: 'Speed' }
};

// All available boons
export const ENHANCED_BOONS: EnhancedBoon[] = [
  // Zeus Boons
  {
    id: 'zeus-attack',
    name: 'Lightning Strike',
    god: 'zeus',
    description: 'Your Attack emits chain lightning that jumps to nearby foes',
    flavorText: 'The power of the sky in your hands.',
    rarity: 'common',
    slot: 'attack',
    apply: (player) => {
      player.abilities.forEach(ability => {
        if (ability.type === 'attack') {
          ability.damage += 10;
          ability.effects.push({
            type: 'damage',
            value: ability.damage * 0.2,
            radius: 5
          });
        }
      });
    }
  },
  {
    id: 'zeus-special',
    name: 'Thunder Flourish',
    god: 'zeus',
    description: 'Your Special causes a lightning bolt to strike nearby foes',
    flavorText: 'Call down heaven\'s wrath.',
    rarity: 'common',
    slot: 'special',
    apply: (player) => {
      // Find the special attack ability
      const specialAbility = player.abilities.find(a => a.id.includes('special'));
      if (specialAbility) {
        specialAbility.damage += 20;
        specialAbility.effects.push({
          type: 'damage',
          value: 30,
          radius: 4
        });
      }
    }
  },
  {
    id: 'zeus-cast',
    name: 'Electric Shot',
    god: 'zeus',
    description: 'Your Cast is a burst of chain lightning that bounces between foes',
    flavorText: 'The lightning seeks its targets.',
    rarity: 'common',
    slot: 'cast',
    apply: (player) => {
      // Find or create cast ability
      let castAbility = player.abilities.find(a => a.id === 'cast');
      if (!castAbility) {
        castAbility = {
          id: 'cast',
          name: 'Electric Shot',
          description: 'A burst of chain lightning',
          damage: 30,
          cooldown: 5,
          isReady: true,
          type: 'attack',
          effects: [{
            type: 'damage',
            value: 30,
            radius: 0
          }],
          animation: 'cast',
          soundEffect: 'ability',
          particleEffect: 'lightning'
        };
        player.abilities.push(castAbility);
      } else {
        // Modify existing cast
        castAbility.name = 'Electric Shot';
        castAbility.damage += 15;
        castAbility.effects = [{
          type: 'damage',
          value: castAbility.damage,
          radius: 0
        }];
        castAbility.particleEffect = 'lightning';
      }
    }
  },

  // Poseidon Boons
  {
    id: 'poseidon-attack',
    name: 'Tempest Strike',
    god: 'poseidon',
    description: 'Your Attack deals more damage and knocks foes away',
    flavorText: 'The force of the tide is yours to command.',
    rarity: 'common',
    slot: 'attack',
    apply: (player) => {
      player.abilities.forEach(ability => {
        if (ability.type === 'attack') {
          ability.damage += 30;
          // Add knockback effect
          ability.effects.push({
            type: 'damage',
            value: 0, // No extra damage, just knockback
            radius: 0  // Directional, not radial
          });
        }
      });
    }
  },
  {
    id: 'poseidon-special',
    name: 'Tidal Dash',
    god: 'poseidon',
    description: 'Your Dash deals damage and knocks away foes',
    flavorText: 'Crash like a wave upon the shore.',
    rarity: 'common',
    slot: 'dash',
    apply: (player) => {
      // This would require modifying the dash logic in Player.tsx
      // For now, add a buff that the player component can check for
      player.activeBuffs.push({
        id: 'tidal-dash',
        name: 'Tidal Dash',
        duration: -1, // Permanent
        stats: {}, // No stat changes
        particleEffect: 'wave'
      });
    }
  },

  // Athena Boons
  {
    id: 'athena-attack',
    name: 'Divine Strike',
    god: 'athena',
    description: 'Your Attack deflects incoming projectiles',
    flavorText: 'The goddess\'s wisdom guides your blade.',
    rarity: 'common',
    slot: 'attack',
    apply: (player) => {
      player.abilities.forEach(ability => {
        if (ability.type === 'attack') {
          ability.damage += 15;
          // Add deflect property (would be checked in combat logic)
          ability.effects.push({
            type: 'buff',
            value: 0,
            duration: 0.5 // Short window after attacking
          });
        }
      });
    }
  },
  {
    id: 'athena-dash',
    name: 'Divine Dash',
    god: 'athena',
    description: 'Your Dash makes you Deflect projectiles',
    flavorText: 'Move with divine purpose.',
    rarity: 'common',
    slot: 'dash',
    apply: (player) => {
      // Add a buff that the player component can check for
      player.activeBuffs.push({
        id: 'divine-dash',
        name: 'Divine Dash',
        duration: -1, // Permanent
        stats: {}, // No stat changes
        particleEffect: 'shield'
      });
    }
  },

  // Artemis Boons
  {
    id: 'artemis-attack',
    name: 'Deadly Strike',
    god: 'artemis',
    description: 'Your Attack has a higher critical chance',
    flavorText: 'Hunt your prey with deadly precision.',
    rarity: 'common',
    slot: 'attack',
    apply: (player) => {
      // Increase critical chance
      player.stats.criticalChance += 0.15;
      
      player.abilities.forEach(ability => {
        if (ability.type === 'attack') {
          ability.damage += 10;
        }
      });
    }
  },
  {
    id: 'artemis-special',
    name: 'Deadly Flourish',
    god: 'artemis',
    description: 'Your Special has a higher critical chance',
    flavorText: 'Strike true with every blow.',
    rarity: 'common',
    slot: 'special',
    apply: (player) => {
      // Increase critical damage multiplier
      player.stats.criticalDamage += 0.3;
      
      // Find the special attack ability
      const specialAbility = player.abilities.find(a => a.id.includes('special'));
      if (specialAbility) {
        specialAbility.damage += 15;
      }
    }
  },

  // Ares Boons
  {
    id: 'ares-attack',
    name: 'Curse of Agony',
    god: 'ares',
    description: 'Your Attack inflicts Doom, dealing damage after a delay',
    flavorText: 'The curse of war follows your blade.',
    rarity: 'common',
    slot: 'attack',
    apply: (player) => {
      player.abilities.forEach(ability => {
        if (ability.type === 'attack') {
          ability.damage += 5;
          // Add doom effect
          ability.effects.push({
            type: 'damage',
            value: 40, // Doom damage
            duration: 1.2 // Delay before doom triggers
          });
        }
      });
    }
  },
  {
    id: 'ares-special',
    name: 'Curse of Pain',
    god: 'ares',
    description: 'Your Special inflicts Doom, dealing damage after a delay',
    flavorText: 'The god of war smiles upon your violence.',
    rarity: 'common',
    slot: 'special',
    apply: (player) => {
      // Find the special attack ability
      const specialAbility = player.abilities.find(a => a.id.includes('special'));
      if (specialAbility) {
        specialAbility.damage += 5;
        // Add doom effect
        specialAbility.effects.push({
          type: 'damage',
          value: 60, // Doom damage
          duration: 1.2 // Delay before doom triggers
        });
      }
    }
  },

  // Dionysus Boons
  {
    id: 'dionysus-attack',
    name: 'Drunken Strike',
    god: 'dionysus',
    description: 'Your Attack inflicts Hangover, dealing damage over time',
    flavorText: 'A taste of Dionysus\'s finest vintage.',
    rarity: 'common',
    slot: 'attack',
    apply: (player) => {
      player.abilities.forEach(ability => {
        if (ability.type === 'attack') {
          // Add hangover effect (damage over time)
          ability.effects.push({
            type: 'damage',
            value: 5, // Damage per tick
            duration: 4 // Duration of effect
          });
        }
      });
    }
  },
  {
    id: 'dionysus-cast',
    name: 'Trippy Shot',
    god: 'dionysus',
    description: 'Your Cast lobs a festive fog that damages foes',
    flavorText: 'The fog of revelry clouds all judgment.',
    rarity: 'common',
    slot: 'cast',
    apply: (player) => {
      // Find or create cast ability
      let castAbility = player.abilities.find(a => a.id === 'cast');
      if (!castAbility) {
        castAbility = {
          id: 'cast',
          name: 'Trippy Shot',
          description: 'A festive fog that damages foes',
          damage: 10,
          cooldown: 5,
          isReady: true,
          type: 'attack',
          effects: [{
            type: 'damage',
            value: 10,
            radius: 3,
            duration: 4
          }],
          animation: 'cast',
          soundEffect: 'ability',
          particleEffect: 'fog'
        };
        player.abilities.push(castAbility);
      } else {
        // Modify existing cast
        castAbility.name = 'Trippy Shot';
        castAbility.effects = [{
          type: 'damage',
          value: 10,
          radius: 3,
          duration: 4
        }];
        castAbility.particleEffect = 'fog';
      }
    }
  },

  // Demeter Boons
  {
    id: 'demeter-attack',
    name: 'Frost Strike',
    god: 'demeter',
    description: 'Your Attack inflicts Chill, reducing enemy speed',
    flavorText: 'Winter\'s touch on your weapon.',
    rarity: 'common',
    slot: 'attack',
    apply: (player) => {
      player.abilities.forEach(ability => {
        if (ability.type === 'attack') {
          ability.damage += 10;
          // Add chill effect
          ability.effects.push({
            type: 'debuff',
            value: 30, // % slow
            duration: 5 // Duration of slow
          });
        }
      });
    }
  },
  {
    id: 'demeter-special',
    name: 'Frost Flourish',
    god: 'demeter',
    description: 'Your Special inflicts Chill, reducing enemy speed',
    flavorText: 'The bitter cold follows your every strike.',
    rarity: 'common',
    slot: 'special',
    apply: (player) => {
      // Find the special attack ability
      const specialAbility = player.abilities.find(a => a.id.includes('special'));
      if (specialAbility) {
        specialAbility.damage += 15;
        // Add chill effect
        specialAbility.effects.push({
          type: 'debuff',
          value: 40, // % slow
          duration: 7 // Duration of slow
        });
      }
    }
  },

  // Hermes Boons
  {
    id: 'hermes-speed',
    name: 'Swift Strike',
    god: 'hermes',
    description: 'Increase your Attack speed',
    flavorText: 'Strike with the swiftness of the messenger god.',
    rarity: 'common',
    slot: 'passive',
    apply: (player) => {
      // This would require modifying attack cooldowns in the Player component
      player.activeBuffs.push({
        id: 'swift-strike',
        name: 'Swift Strike',
        duration: -1, // Permanent
        stats: {
          // Represents attack speed increase
          agility: player.stats.agility + 5
        }
      });
    }
  },
  {
    id: 'hermes-dodge',
    name: 'Greater Evasion',
    god: 'hermes',
    description: 'Gain a chance to dodge attacks',
    flavorText: 'Move like the wind itself.',
    rarity: 'common',
    slot: 'passive',
    apply: (player) => {
      // Add dodge chance as a buff
      player.activeBuffs.push({
        id: 'greater-evasion',
        name: 'Greater Evasion',
        duration: -1, // Permanent
        stats: {
          // Custom stat for dodge chance, would be checked in combat system
          dodgeChance: 0.15
        }
      });
    }
  },

  // Duo Boons (Advanced combinations)
  {
    id: 'zeus-poseidon-duo',
    name: 'Sea Storm',
    god: 'zeus',
    description: 'Your lightning effects also cause knockback',
    flavorText: 'When lightning strikes the sea, all creatures know fear.',
    rarity: 'duo',
    slot: 'passive',
    requiredBoons: ['zeus-attack', 'poseidon-attack'],
    apply: (player) => {
      // Check if player has the required boons
      const hasZeusAttack = player.abilities.some(a => 
        a.type === 'attack' && a.effects.some(e => e.particleEffect === 'lightning')
      );
      
      const hasPoseidonBoon = player.activeBuffs.some(b => b.id === 'tidal-dash');
      
      if (hasZeusAttack && hasPoseidonBoon) {
        // Enhance the lightning effects to also have knockback
        player.abilities.forEach(ability => {
          ability.effects.forEach(effect => {
            if (effect.particleEffect === 'lightning') {
              // Add knockback property
              effect.knockback = 2.0;
            }
          });
        });
      }
    }
  }
];

// Original boons for compatibility
export const BOONS: Boon[] = [
  {
    id: 'health-boost',
    name: 'Health Boost',
    description: 'Increase max health by 20',
    apply: (player) => {
      player.maxHealth += 20;
      player.health += 20;
    }
  },
  {
    id: 'damage-boost',
    name: 'Damage Boost',
    description: 'Increase attack damage by 5',
    apply: (player) => {
      player.abilities.forEach(ability => { if (ability.type === 'attack') ability.damage += 5; });
    }
  }
];

export class ProgressionSystem {
  private static instance: ProgressionSystem;
  private experienceCurve: number[];
  private activeBoons: Set<string> = new Set();

  private constructor() {
    this.experienceCurve = this.generateExperienceCurve();
  }

  static getInstance(): ProgressionSystem {
    if (!ProgressionSystem.instance) {
      ProgressionSystem.instance = new ProgressionSystem();
    }
    return ProgressionSystem.instance;
  }

  /**
   * Generate experience curve for leveling
   */
  private generateExperienceCurve(): number[] {
    const curve: number[] = [];
    const baseXP = 1000;
    const growthFactor = 1.2;

    for (let i = 1; i <= 100; i++) {
      curve.push(Math.floor(baseXP * Math.pow(growthFactor, i - 1)));
    }

    return curve;
  }

  /**
   * Get gods that have boons available
   */
  getAvailableGods(): GodCategory[] {
    // In a full implementation, this would filter based on story progression
    // and what boons the player already has
    return Object.keys(GOD_THEMES) as GodCategory[];
  }

  /**
   * Get boons available for a specific god
   */
  getGodBoons(god: GodCategory, _player: Player): EnhancedBoon[] {
    return ENHANCED_BOONS.filter(boon => {
      // Filter for the requested god
      if (boon.god !== god) return false;
      
      // Check if player already has this boon
      if (this.activeBoons.has(boon.id)) return false;
      
      // Check if this is a duo boon and if player meets requirements
      if (boon.rarity === 'duo' && boon.requiredBoons) {
        return boon.requiredBoons.every(requiredBoonId => 
          this.activeBoons.has(requiredBoonId)
        );
      }
      
      // Check for slot conflicts (e.g., can't have two different attack boons)
      if (boon.slot !== 'passive') {
        const existingBoonForSlot = ENHANCED_BOONS.find(activeBoon => 
          this.activeBoons.has(activeBoon.id) && 
          activeBoon.slot === boon.slot
        );
        
        if (existingBoonForSlot) return false;
      }
      
      // Check exclusions
      if (boon.exclusions) {
        const hasExcludedBoon = boon.exclusions.some(excludedBoonId => 
          this.activeBoons.has(excludedBoonId)
        );
        
        if (hasExcludedBoon) return false;
      }
      
      return true;
    });
  }

  /**
   * Apply a boon to a player
   */
  applyBoon(player: Player, boonId: string): void {
    // Find the boon
    const boon = ENHANCED_BOONS.find(b => b.id === boonId);
    if (boon) {
      // Apply the boon's effect
      boon.apply(player);
      
      // Record that this boon is active
      this.activeBoons.add(boonId);
      
      // Log for debugging
      console.log(`Applied boon: ${boon.name}`);
    } else {
      // Fall back to original boons if not found
      const originalBoon = BOONS.find(b => b.id === boonId);
      if (originalBoon) {
        originalBoon.apply(player);
      }
    }
  }

  /**
   * Generate random boon options for the player to choose from
   */
  generateBoonOptions(player: Player, count: number = 3): EnhancedBoon[] {
    // Get a list of available gods
    const availableGods = this.getAvailableGods();
    
    // Randomly select gods for this set of options
    const selectedGods: GodCategory[] = [];
    
    // Always prioritize gods that can offer duo boons if requirements are met
    const potentialDuoBoons = ENHANCED_BOONS.filter(boon => 
      boon.rarity === 'duo' && 
      boon.requiredBoons && 
      boon.requiredBoons.every(requiredBoonId => this.activeBoons.has(requiredBoonId))
    );
    
    if (potentialDuoBoons.length > 0) {
      // Add gods that can offer duo boons
      potentialDuoBoons.forEach(duoBoon => {
        if (!selectedGods.includes(duoBoon.god)) {
          selectedGods.push(duoBoon.god);
        }
      });
    }
    
    // Fill remaining slots with random gods
    while (selectedGods.length < Math.min(count, availableGods.length)) {
      const randomGod = availableGods[Math.floor(Math.random() * availableGods.length)];
      if (!selectedGods.includes(randomGod)) {
        selectedGods.push(randomGod);
      }
    }
    
    // Get boon options from each selected god
    const boonOptions: EnhancedBoon[] = [];
    
    selectedGods.forEach(god => {
      const godBoons = this.getGodBoons(god, player);
      
      if (godBoons.length > 0) {
        // Prioritize duo boons if available
        const duoBoon = godBoons.find(boon => boon.rarity === 'duo');
        
        if (duoBoon) {
          boonOptions.push(duoBoon);
        } else {
          // Otherwise pick a random boon from this god
          const randomBoon = godBoons[Math.floor(Math.random() * godBoons.length)];
          boonOptions.push(randomBoon);
        }
      }
    });
    
    // If we don't have enough boons, fill with health/damage boosts
    while (boonOptions.length < count) {
      // Convert original boons to enhanced format
      const originalBoon = BOONS[Math.floor(Math.random() * BOONS.length)];
      
      // Create an enhanced version (simplified)
      const enhancedOriginalBoon: EnhancedBoon = {
        ...originalBoon,
        god: 'zeus', // placeholder
        rarity: 'common',
        slot: 'passive'
      };
      
      boonOptions.push(enhancedOriginalBoon);
    }
    
    return boonOptions;
  }

  /**
   * Calculate player's level based on experience
   */
  calculateLevelProgress(experience: number): { level: number; progress: number } {
    let level = 1;
    let remainingXP = experience;

    while (level < this.experienceCurve.length && remainingXP >= this.experienceCurve[level - 1]) {
      remainingXP -= this.experienceCurve[level - 1];
      level++;
    }

    const progress = level < this.experienceCurve.length ?
      remainingXP / this.experienceCurve[level - 1] :
      1;

    return { level, progress };
  }

  /**
   * Calculate player's final stats with all equipment, buffs, and boons
   */
  calculateStats(player: Player): PlayerStats {
    let stats: PlayerStats = {
      strength: 10 + player.level * 2,
      agility: 10 + player.level * 2,
      vitality: 10 + player.level * 2,
      wisdom: 10 + player.level * 2,
      criticalChance: 0.05,
      criticalDamage: 1.5,
      moveSpeed: 8,
      dodgeChance: 0.05 + (player.level * 0.01) // Base dodge chance increases with level
    };

    // Add equipment bonuses
    player.equipment.forEach(equipment => {
      Object.entries(equipment.stats).forEach(([stat, value]) => {
        stats[stat as keyof PlayerStats] += value;
      });
    });

    // Add buff bonuses
    player.activeBuffs.forEach(buff => {
      Object.entries(buff.stats).forEach(([stat, value]) => {
        stats[stat as keyof PlayerStats] += value;
      });
    });

    return stats;
  }

  /**
   * Calculate health based on vitality
   */
  calculateHealth(vitality: number): number {
    return 100 + vitality * 10;
  }

  /**
   * Calculate damage for an ability
   */
  calculateDamage(ability: Ability, stats: PlayerStats): number {
    let baseDamage = ability.damage;

    // Apply stat scaling
    switch (ability.type) {
      case 'attack':
        baseDamage *= 1 + stats.strength * 0.1;
        break;
      case 'utility':
        baseDamage *= 1 + stats.wisdom * 0.1;
        break;
    }

    // Apply critical hit
    if (Math.random() < stats.criticalChance) {
      baseDamage *= stats.criticalDamage;
    }

    return Math.floor(baseDamage);
  }

  /**
   * Add a new ability to the player
   */
  unlockAbility(player: Player, ability: Ability): void {
    if (!player.abilities.find(a => a.id === ability.id)) {
      player.abilities.push(ability);
    }
  }

  /**
   * Equip an item
   */
  equipItem(player: Player, item: Equipment): void {
    const existingIndex = player.equipment.findIndex(e => e.type === item.type);
    if (existingIndex !== -1) {
      player.equipment[existingIndex] = item;
    } else {
      player.equipment.push(item);
    }
  }
  
  /**
   * Clear active boons (used when starting a new run)
   */
  clearActiveBoons(): void {
    this.activeBoons.clear();
  }
}