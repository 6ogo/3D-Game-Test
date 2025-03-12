import { Vector3, Ability, Enemy, Player, ParticleSystem, AbilityEffect } from '../types/game';
import { ParticleEngine } from './particles';
import { AudioManager } from './audio';
import { calculateDamage } from './stats';
import { useGameStore } from '../store/gameStore';
import { VisualEffectsManager } from './visualEffects';

export class CombatSystem {
  [x: string]: any;
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
      const particleSystem = ParticleEngine.getInstance().createEffect({
        id: `${ability.id}-${Date.now()}`,
        type: 'ability',
        position,
        color: this.getEffectColor(ability),
        size: ability.effects[0]?.radius || 1,
        duration: 1000,
        spread: ability.effects[0]?.radius || 2,
        count: 50
      });
      this.particles.push(particleSystem);
    }

    // Play sound effects
    if (ability.soundEffect) {
      AudioManager.playSound(ability.soundEffect as 'hit' | 'heal' | 'ability');
    }
  }

  private applyDamage(target: Player | Enemy, damage: number): void {
    target.health = Math.max(0, target.health - damage);
    
    // Create hit particles
    const hitParticles = ParticleEngine.getInstance().createEffect({
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
    
    AudioManager.playSound('hit');
  }

  private applyHealing(target: Player | Enemy, amount: number): void {
    target.health = Math.min(target.maxHealth, target.health + amount);
    
    const healParticles = ParticleEngine.getInstance().createEffect({
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
    
    AudioManager.playSound('heal');
  }
/**
 * Register a hit on an enemy or player
 */
registerHit(source: Player | Enemy, target: Player | Enemy, damage: number, isCritical: boolean = false): void {
  // Apply damage
  this.applyDamage(target, damage);
  
  // Get position for visual effect
  const position = target.position;
  
  // Create hit particles
  const color = isCritical ? '#ffff00' : '#ff0000';
  const size = isCritical ? 0.3 : 0.2;
  const count = isCritical ? 30 : 20;
  
  ParticleEngine.getInstance().createEffect({
    id: `hit-${Date.now()}`,
    type: 'hit',
    position,
    color,
    size,
    duration: isCritical ? 700 : 500,
    spread: isCritical ? 1.5 : 1,
    count
  });
  
  // Play sound
  AudioManager.playSound(isCritical ? 'ability' : 'hit', {
    rate: isCritical ? 1.2 : 1.0,
    volume: isCritical ? 0.7 : 0.5
  });
  
  // Create floating damage text (would integrate with UI system)
  this.createFloatingText(position, damage, isCritical);
  
  // Register in game store for stats tracking
  if (source.constructor.name === 'Player') {
    useGameStore.getState().updateDamageDealt(damage);
  } else {
    useGameStore.getState().updateDamageTaken(damage);
  }
  
  // Check for defeat
  if (target.health <= 0) {
    this.handleDefeat(target);
  }
}

/**
 * Handle entity defeat (player or enemy)
 */
private handleDefeat(target: Player | Enemy): void {
  if (target.constructor.name === 'Player') {
    // Player defeated
    useGameStore.getState().setGameOver(true);
    AudioManager.playSound('death');
    
    // Create death effect
    ParticleEngine.getInstance().createEffect({
      id: `player-death-${Date.now()}`,
      type: 'death',
      position: target.position,
      color: '#4444ff',
      size: 0.4,
      duration: 2000,
      spread: 2,
      count: 50
    });
  } else {
    // Enemy defeated
    const enemy = target as Enemy;
    const enemyPosition = enemy.position;
    
    // Award experience to player
    useGameStore.getState().gainExperience(enemy.experience);
    
    // Create appropriate death effect based on enemy type
    let color = '#ff4444';
    let size = 0.3;
    let count = 30;
    
    if (enemy.type === 'Elite') {
      color = '#ff00ff';
      size = 0.4;
      count = 40;
    } else if (enemy.type === 'Boss') {
      color = '#ff0000';
      size = 0.5;
      count = 60;
      
      // Boss defeat triggers victory
      setTimeout(() => {
        useGameStore.getState().endGame(true);
      }, 2000);
    }
    
    // Create death effect
    ParticleEngine.getInstance().createEffect({
      id: `enemy-death-${Date.now()}`,
      type: 'death',
      position: enemyPosition,
      color,
      size,
      duration: 1500,
      spread: enemy.type === 'Boss' ? 3 : 1.5,
      count
    });
    
    // Play appropriate sound
    AudioManager.playSound('death', {
      rate: enemy.type === 'Boss' ? 0.8 : 1.0,
      volume: enemy.type === 'Boss' ? 0.8 : 0.6
    });
    
    // For boss death, also flash the screen
    if (enemy.type === 'Boss') {
      VisualEffectsManager.getInstance()?.flashScreen(color, 0.7, 1.0);
    }
  }
}

  private applyBuff(_target: Player | Enemy, _effect: AbilityEffect): void {
    // TODO: Implementation for buff application
  }

  private applyDebuff(_target: Player | Enemy, _effect: AbilityEffect): void {
    // TODO: Implementation for debuff application
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