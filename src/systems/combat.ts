import { Vector3, Ability, Enemy, Player, ParticleSystem } from '../types/game';
import { createParticleEffect } from './particles';
import { playSound } from './audio';
import { calculateDamage } from './stats';

export class CombatSystem {
  private static instance: CombatSystem;
  private particles: ParticleSystem[] = [];

  private constructor() {}

  static getInstance(): CombatSystem {
    if (!CombatSystem.instance) {
      CombatSystem.instance = new CombatSystem();
    }
    return CombatSystem.instance;
  }

  executeAbility(
    ability: Ability,
    source: Player | Enemy,
    targets: (Player | Enemy)[],
    position: Vector3
  ): void {
    // Calculate damage with critical hits
    const damage = calculateDamage(ability, source);
    
    // Apply effects to all targets in range
    targets.forEach(target => {
      ability.effects.forEach(effect => {
        switch (effect.type) {
          case 'damage':
            this.applyDamage(target, damage);
            break;
          case 'heal':
            this.applyHealing(target, effect.value);
            break;
          case 'buff':
            this.applyBuff(target, effect);
            break;
          case 'debuff':
            this.applyDebuff(target, effect);
            break;
        }
      });
    });

    // Create particle effects
    if (ability.particleEffect) {
      const particleSystem = createParticleEffect({
        id: `${ability.id}-${Date.now()}`,
        type: 'ability',
        position,
        color: this.getEffectColor(ability),
        size: effect.radius || 1,
        duration: 1000,
        spread: effect.radius || 2,
        count: 50
      });
      this.particles.push(particleSystem);
    }

    // Play sound effects
    if (ability.soundEffect) {
      playSound(ability.soundEffect);
    }
  }

  private applyDamage(target: Player | Enemy, damage: number): void {
    target.health = Math.max(0, target.health - damage);
    
    // Create hit particles
    const hitParticles = createParticleEffect({
      id: `hit-${Date.now()}`,
      type: 'hit',
      position: target.position,
      color: '#ff0000',
      size: 0.2,
      duration: 500,
      spread: 1,
      count: 20
    });
    this.particles.push(hitParticles);
    
    playSound('hit');
  }

  private applyHealing(target: Player | Enemy, amount: number): void {
    target.health = Math.min(target.maxHealth, target.health + amount);
    
    const healParticles = createParticleEffect({
      id: `heal-${Date.now()}`,
      type: 'heal',
      position: target.position,
      color: '#00ff00',
      size: 0.2,
      duration: 500,
      spread: 1,
      count: 20
    });
    this.particles.push(healParticles);
    
    playSound('heal');
  }

  private applyBuff(target: Player | Enemy, effect: AbilityEffect): void {
    // Implementation for buff application
  }

  private applyDebuff(target: Player | Enemy, effect: AbilityEffect): void {
    // Implementation for debuff application
  }

  private getEffectColor(ability: Ability): string {
    switch (ability.type) {
      case 'attack': return '#ff4444';
      case 'defense': return '#44ff44';
      case 'utility': return '#4444ff';
      default: return '#ffffff';
    }
  }

  update(deltaTime: number): void {
    // Update particle systems
    this.particles = this.particles.filter(particle => {
      particle.duration -= deltaTime;
      return particle.duration > 0;
    });
  }
}