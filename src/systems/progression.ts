import { Player, Equipment, Ability, PlayerStats } from '../types/game';

export class ProgressionSystem {
  private static instance: ProgressionSystem;
  private experienceCurve: number[];

  private constructor() {
    this.experienceCurve = this.generateExperienceCurve();
  }

  static getInstance(): ProgressionSystem {
    if (!ProgressionSystem.instance) {
      ProgressionSystem.instance = new ProgressionSystem();
    }
    return ProgressionSystem.instance;
  }

  private generateExperienceCurve(): number[] {
    const curve: number[] = [];
    const baseXP = 1000;
    const growthFactor = 1.2;

    for (let i = 1; i <= 100; i++) {
      curve.push(Math.floor(baseXP * Math.pow(growthFactor, i - 1)));
    }

    return curve;
  }

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

  calculateStats(player: Player): PlayerStats {
    let stats: PlayerStats = {
      strength: 10 + player.level * 2,
      agility: 10 + player.level * 2,
      vitality: 10 + player.level * 2,
      wisdom: 10 + player.level * 2,
      criticalChance: 0.05,
      criticalDamage: 1.5
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

  calculateHealth(vitality: number): number {
    return 100 + vitality * 10;
  }

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

  unlockAbility(player: Player, ability: Ability): void {
    if (!player.abilities.find(a => a.id === ability.id)) {
      player.abilities.push(ability);
    }
  }

  equipItem(player: Player, item: Equipment): void {
    const existingIndex = player.equipment.findIndex(e => e.type === item.type);
    if (existingIndex !== -1) {
      player.equipment[existingIndex] = item;
    } else {
      player.equipment.push(item);
    }
  }
}