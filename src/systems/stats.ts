import { Ability, Player, Enemy, PlayerStats } from '../types/game';

/**
 * Calculate damage for an ability based on the source's stats
 * @param ability The ability being used
 * @param source The player or enemy using the ability
 * @returns The calculated damage amount
 */
export function calculateDamage(ability: Ability, source: Player | Enemy | PlayerStats): number {
  let baseDamage = ability.damage;
  let criticalChance = 'stats' in source ? source.stats.criticalChance : 0.05;
  let criticalDamage = 'stats' in source ? source.stats.criticalDamage : 1.5;
  let strength = 'stats' in source ? source.stats.strength : 10;
  let wisdom = 'stats' in source ? source.stats.wisdom : 10;

  // Apply stat scaling
  switch (ability.type) {
    case 'attack':
      baseDamage *= 1 + strength * 0.1;
      break;
    case 'utility':
      baseDamage *= 1 + wisdom * 0.1;
      break;
  }

  // Apply critical hit
  const isCritical = Math.random() < criticalChance;
  if (isCritical) {
    baseDamage *= criticalDamage;
  }

  return Math.floor(baseDamage);
}

/**
 * Calculate healing amount based on wisdom stat
 * @param baseAmount Base healing amount
 * @param source The player or enemy providing healing
 * @returns The calculated healing amount
 */
export function calculateHealing(baseAmount: number, source: Player | Enemy): number {
  const wisdom = 'stats' in source ? source.stats.wisdom : 10;
  return Math.floor(baseAmount * (1 + wisdom * 0.05));
}

/**
 * Calculate max health based on vitality stat
 * @param baseHealth Base health amount
 * @param vitality Vitality stat value
 * @returns The calculated max health
 */
export function calculateMaxHealth(baseHealth: number, vitality: number): number {
  return Math.floor(baseHealth * (1 + vitality * 0.1));
}

/**
 * Calculate defense reduction for incoming damage
 * @param damage Original damage amount
 * @param defense Defense stat value
 * @returns The reduced damage amount
 */
export function calculateDamageReduction(damage: number, defense: number): number {
  const reduction = defense / (defense + 100); // Diminishing returns formula
  return Math.max(1, Math.floor(damage * (1 - reduction)));
}