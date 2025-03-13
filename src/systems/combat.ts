import * as THREE from 'three';
import { AudioManager } from './audio';
import { Vector3, Ability, Enemy, Player, AbilityEffect } from '../types/game';
import { useGameStore } from '../store/gameStore';
import { VisualEffectsManager } from './visualEffects';
import { ParticleSystem } from './objectPooling';

// Attack types for different weapons
export type AttackType = 'slash' | 'thrust' | 'smash' | 'spin' | 'projectile' | 'cast';

// Hit result type for detailed attack feedback
export interface HitResult {
  enemyId: string;
  damage: number;
  isCritical: boolean;
  isKilled: boolean;
  position: Vector3;
  type: AttackType;
}

export class CombatSystem {
  private static instance: CombatSystem;
  private particles: any[] = [];
  private projectiles: Map<string, {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    damage: number;
    lifetime: number;
    timeLeft: number;
    ownerId: string;
    visual: THREE.Object3D | null;
    onHit?: (position: THREE.Vector3) => void;
  }> = new Map();

  private constructor() {}

  static getInstance(): CombatSystem {
    if (!CombatSystem.instance) {
      CombatSystem.instance = new CombatSystem();
    }
    return CombatSystem.instance;
  }

  /**
   * Execute an ability attack
   */
  executeAbility(
    ability: Ability,
    source: Player | Enemy,
    position: Vector3,
    direction: THREE.Vector3,
    arcAngle: number = 60,
    range: number = 2
  ): HitResult[] {
    // Convert position to THREE.Vector3 if it's not already
    const pos = new THREE.Vector3(position.x, position.y, position.z);
    
    // Calculate targets in range and arc
    const targets = this.getTargetsInArc(source, pos, direction, arcAngle, range);
    
    // Track hit results
    const hitResults: HitResult[] = [];
    
    // Apply effects to all targets in range
    targets.forEach(target => {
      ability.effects.forEach(effect => {
        switch (effect.type) {
          case 'damage':
            // Calculate damage with potential critical hit
            const isCritical = this.calculateCriticalHit(source);
            const baseDamage = ability.damage;
            const damageMultiplier = this.calculateDamageMultiplier(source, ability, isCritical);
            const finalDamage = Math.floor(baseDamage * damageMultiplier);
            
            // Apply damage
            const targetPos = new THREE.Vector3(target.position.x, target.position.y, target.position.z);
            const isKilled = this.applyDamage(target, finalDamage);
            
            // Create hit effect
            this.createHitEffect(targetPos, finalDamage, isCritical, ability.particleEffect || 'hit');
            
            // Record hit result
            hitResults.push({
              enemyId: 'isEnemy' in target ? target.id || 'unknown' : 'player',
              damage: finalDamage,
              isCritical,
              isKilled,
              position: target.position,
              type: this.getAttackTypeFromAbility(ability)
            });
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

    // Create visual effects for the attack
    this.createAttackVisuals(pos, direction, arcAngle, range, ability);
    
    // Play sound effects
    if (ability.soundEffect) {
      AudioManager.playSound(ability.soundEffect as 'hit' | 'heal' | 'ability');
    }
    
    return hitResults;
  }

  /**
   * Create a projectile
   */
  createProjectile(
    position: Vector3,
    direction: THREE.Vector3,
    speed: number,
    damage: number,
    lifetime: number,
    ownerId: string,
    color: THREE.Color = new THREE.Color(0x00ffaa),
    onHit?: (position: THREE.Vector3) => void
  ): string {
    // Generate unique ID for projectile
    const projectileId = `projectile-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Store projectile data
    this.projectiles.set(projectileId, {
      position: new THREE.Vector3(position.x, position.y, position.z),
      velocity: direction.normalize().multiplyScalar(speed),
      damage,
      lifetime,
      timeLeft: lifetime,
      ownerId,
      visual: null,
      onHit
    });
    
    // Create visual representation
    const visualEffects = VisualEffectsManager.getInstance();
    if (visualEffects) {
      // We'll create the visual in the scene through the visualEffects system
      // This is simplified - in a full implementation, you'd create an actual 3D object
      
      // For now, create particle effect that follows the projectile
      const particleSystem = ParticleSystem.getInstance();
      if (particleSystem) {
        particleSystem.emitParticles(
          'fire',
          this.projectiles.get(projectileId)!.position,
          10,
          300,
          0.3,
          0.1,
          color
        );
      }
    }
    
    return projectileId;
  }

  /**
   * Apply damage to a target
   */
  private applyDamage(target: Player | Enemy, damage: number): boolean {
    // Update health
    target.health = Math.max(0, target.health - damage);
    
    // Create hit particles
    const position = new THREE.Vector3(target.position.x, target.position.y, target.position.z);
    const particleSystem = ParticleSystem.getInstance();
    if (particleSystem) {
      particleSystem.emitParticles(
        'hit',
        position,
        15,
        400,
        0.2,
        0.1,
        new THREE.Color(0xff0000)
      );
    }
    
    // Play hit sound
    AudioManager.playSound('hit');
    
    // Check if target was killed
    const wasKilled = target.health <= 0;
    
    // Handle death if killed
    if (wasKilled) {
      this.handleEntityDeath(target);
    }
    
    return wasKilled;
  }

  /**
   * Handle entity death
   */
  private handleEntityDeath(entity: Player | Enemy): void {
    // Create death effect
    const position = new THREE.Vector3(entity.position.x, entity.position.y, entity.position.z);
    const particleSystem = ParticleSystem.getInstance();
    
    if (particleSystem) {
      // Determine effect based on entity type
      if ('type' in entity) {
        // Enemy death
        const color = entity.type === 'Boss' ? 0xff0000 : 
                      entity.type === 'Elite' ? 0xaa00ff : 
                      0xff6600;
                      
        const size = entity.type === 'Boss' ? 0.5 : 
                    entity.type === 'Elite' ? 0.3 : 
                    0.2;
                    
        const count = entity.type === 'Boss' ? 60 : 
                      entity.type === 'Elite' ? 30 : 
                      20;
                      
        particleSystem.emitParticles(
          'death',
          position,
          count,
          1000,
          size,
          0.3,
          new THREE.Color(color)
        );
        
        // Add extra effects for bosses
        if (entity.type === 'Boss') {
          const effectsManager = VisualEffectsManager.getInstance();
          if (effectsManager) {
            effectsManager.flashScreen(new THREE.Color(color), 0.5, 0.5);
          }
        }
      } else {
        // Player death
        particleSystem.emitParticles(
          'death',
          position,
          30,
          1000,
          0.3,
          0.2,
          new THREE.Color(0x4a9eff)
        );
      }
    }
    
    // Play death sound
    AudioManager.playSound('death');
    
    // Update game state
    // For enemies, this is handled in the Player component when health reaches 0
    // For player, trigger game over
    if (!('type' in entity)) {
      useGameStore.getState().endGame(false);
    }
  }

  /**
   * Apply healing to a target
   */
  private applyHealing(target: Player | Enemy, amount: number): void {
    // Get max health
    const maxHealth = target.maxHealth;
    
    // Apply healing, capped at max health
    target.health = Math.min(maxHealth, target.health + amount);
    
    // Create heal particles
    const position = new THREE.Vector3(target.position.x, target.position.y, target.position.z);
    const particleSystem = ParticleSystem.getInstance();
    
    if (particleSystem) {
      particleSystem.emitParticles(
        'heal',
        position,
        20,
        800,
        0.2,
        0.15,
        new THREE.Color(0x00ff66)
      );
    }
    
    // Play heal sound
    AudioManager.playSound('heal');
  }

  /**
   * Apply buff effect to a target
   */
  private applyBuff(target: Player | Enemy, effect: AbilityEffect): void {
    // Apply the buff effect to the target
    if ('activeBuffs' in target) {
      target.activeBuffs.push({
        id: `buff_${Date.now()}`,
        name: effect.type,
        duration: effect.duration || 5000,
        stats: {
          [effect.type]: effect.value
        },
        particleEffect: effect.particleEffect
      });
    }
    
    // Create visual effect
    const position = new THREE.Vector3(target.position.x, target.position.y, target.position.z);
    const particleSystem = ParticleSystem.getInstance();
    
    if (particleSystem) {
      particleSystem.emitParticles(
        'buff',
        position,
        30,
        effect.duration || 1000,
        0.3,
        0.2,
        new THREE.Color(0x00aaff)
      );
    }
  }

  /**
   * Apply debuff effect to a target
   */
  private applyDebuff(target: Player | Enemy, effect: AbilityEffect): void {
    // Similar to buff, but with negative effects
    
    // Create visual effect
    const position = new THREE.Vector3(target.position.x, target.position.y, target.position.z);
    const particleSystem = ParticleSystem.getInstance();
    
    if (particleSystem) {
      particleSystem.emitParticles(
        'buff', // Reuse buff type but with different color
        position,
        20,
        800,
        0.2,
        0.15,
        new THREE.Color(0xaa00ff)
      );
    }
  }

  /**
   * Find all valid targets in an arc in front of the attacker
   */
  private getTargetsInArc(
    source: Player | Enemy,
    position: THREE.Vector3,
    direction: THREE.Vector3,
    arcAngle: number,
    range: number
  ): (Player | Enemy)[] {
    const targets: (Player | Enemy)[] = [];
    const halfAngleRadians = (arcAngle / 2) * (Math.PI / 180);
    
    // Determine appropriate target type based on source
    if ('type' in source) {
      // Source is an enemy, target is player
      const player = useGameStore.getState().player;
      const playerPos = new THREE.Vector3(player.position.x, player.position.y, player.position.z);
      
      // Check if player is in range
      const distance = position.distanceTo(playerPos);
      if (distance <= range) {
        // Check if player is within arc angle
        const toTarget = new THREE.Vector3().subVectors(playerPos, position).normalize();
        const dot = direction.dot(toTarget);
        const angle = Math.acos(dot);
        
        if (angle <= halfAngleRadians) {
          targets.push(player);
        }
      }
    } else {
      // Source is player, targets are enemies
      const currentRoomId = useGameStore.getState().currentRoomId;
      const currentLevel = useGameStore.getState().currentLevel;
      
      if (currentLevel && currentRoomId) {
        const room = currentLevel.rooms.find(r => r.id === currentRoomId);
        
        if (room) {
          // Check each enemy
          room.enemies.forEach(enemy => {
            const enemyPos = new THREE.Vector3(enemy.position.x, enemy.position.y, enemy.position.z);
            
            // Check if in range
            const distance = position.distanceTo(enemyPos);
            if (distance <= range) {
              // Check if within arc
              const toTarget = new THREE.Vector3().subVectors(enemyPos, position).normalize();
              const dot = direction.dot(toTarget);
              // Account for floating point errors (dot might be slightly > 1)
              const clampedDot = Math.min(1, Math.max(-1, dot));
              const angle = Math.acos(clampedDot);
              
              if (angle <= halfAngleRadians) {
                targets.push(enemy);
              }
            }
          });
        }
      }
    }
    
    return targets;
  }

  /**
   * Create visual effects for an attack
   */
  private createAttackVisuals(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    arcAngle: number,
    range: number,
    ability: Ability
  ): void {
    // Use VisualEffectsManager to create appropriate effects
    const effectsManager = VisualEffectsManager.getInstance();
    if (!effectsManager) return;
    
    // Determine attack type and effect style
    const attackType = this.getAttackTypeFromAbility(ability);
    
    switch (attackType) {
      case 'slash':
        // Create arc trail effect
        this.createArcTrail(position, direction, arcAngle, range, 0x4a9eff);
        break;
        
      case 'thrust':
        // Create straight line effect
        const endPoint = new THREE.Vector3().copy(position).add(
          direction.clone().multiplyScalar(range)
        );
        effectsManager.createAttackTrail(position, endPoint, 0x00ff00, 1.5);
        break;
        
      case 'smash':
        // Create impact effect
        const impactPoint = new THREE.Vector3().copy(position).add(
          direction.clone().multiplyScalar(range * 0.5)
        );
        effectsManager.createImpactEffect(impactPoint, 0xffaa00, range * 0.5);
        break;
        
      case 'spin':
        // Create circular effect
        this.createCircularTrail(position, range, 0xff00ff);
        break;
        
      case 'projectile':
      case 'cast':
        // Projectile effects are handled separately when projectiles are created
        break;
    }
  }

  /**
   * Create an arc trail effect for slash attacks
   */
  private createArcTrail(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    arcAngle: number,
    range: number,
    color: number | THREE.Color
  ): void {
    // Calculate arc points
    const segments = 10;
    const points: THREE.Vector3[] = [];
    const arcAngleRadians = arcAngle * (Math.PI / 180);
    
    // Calculate perpendicular vector to direction
    const perpDir = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
    
    // Create arc points
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = arcAngleRadians * (t - 0.5);
      
      // Rotate direction around perpendicular axis
      const rotationAxis = perpDir;
      const rotatedDir = direction.clone().applyAxisAngle(rotationAxis, angle);
      
      // Add point at position + rotatedDir * range
      const point = position.clone().add(rotatedDir.multiplyScalar(range));
      points.push(point);
    }
    
    // Create particles along the arc
    const particleSystem = ParticleSystem.getInstance();
    if (particleSystem) {
      for (let i = 0; i < points.length; i++) {
        if (i % 2 === 0) { // Add particles at every other point for performance
          particleSystem.emitParticles(
            'dash',
            points[i],
            3,
            300,
            0.2,
            0.05,
            new THREE.Color(color)
          );
        }
      }
    }
  }

  /**
   * Create a circular trail effect for spin attacks
   */
  private createCircularTrail(
    position: THREE.Vector3,
    radius: number,
    color: number | THREE.Color
  ): void {
    // Create particles in a circle
    const particleSystem = ParticleSystem.getInstance();
    if (particleSystem) {
      const segments = 20;
      
      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        
        const pointPos = position.clone().add(new THREE.Vector3(x, 0, z));
        
        particleSystem.emitParticles(
          'dash',
          pointPos,
          3,
          400,
          0.2,
          0.05,
          new THREE.Color(color)
        );
      }
    }
  }

  /**
   * Create hit effect at target
   */
  private createHitEffect(
    position: THREE.Vector3,
    damage: number,
    isCritical: boolean,
    effectType: string = 'hit'
  ): void {
    // Create particles
    const particleSystem = ParticleSystem.getInstance();
    if (particleSystem) {
      const color = isCritical ? 0xffff00 : 0xff4400;
      const size = isCritical ? 0.3 : 0.2;
      const count = isCritical ? 20 : 10;
      
      particleSystem.emitParticles(
        effectType as any,
        position,
        count,
        400,
        size,
        0.15,
        new THREE.Color(color)
      );
    }
    
    // Create impact effect
    const effectsManager = VisualEffectsManager.getInstance();
    if (effectsManager) {
      effectsManager.createImpactEffect(
        position,
        isCritical ? 0xffff00 : 0xff4400,
        isCritical ? 1.2 : 0.8
      );
    }
  }

  /**
   * Calculate if an attack is a critical hit
   */
  private calculateCriticalHit(source: Player | Enemy): boolean {
    const critChance = 'stats' in source ? source.stats.criticalChance : 0.05;
    return Math.random() < critChance;
  }

  /**
   * Calculate damage multiplier based on stats and critical hit
   */
  private calculateDamageMultiplier(source: Player | Enemy, ability: Ability, isCritical: boolean): number {
    let multiplier = 1.0;
    
    // Add stat-based multiplier
    if ('stats' in source) {
      const stats = source.stats;
      
      switch (ability.type) {
        case 'attack':
          multiplier *= 1 + (stats.strength * 0.1);
          break;
        case 'utility':
          multiplier *= 1 + (stats.wisdom * 0.1);
          break;
      }
      
      // Add critical multiplier
      if (isCritical) {
        multiplier *= stats.criticalDamage;
      }
    } else if (isCritical) {
      // Default critical multiplier for enemies
      multiplier *= 1.5;
    }
    
    return multiplier;
  }

  /**
   * Determine attack type from ability data
   */
  private getAttackTypeFromAbility(ability: Ability): AttackType {
    // Simple determination based on name/description
    const name = ability.name.toLowerCase();
    const desc = ability.description.toLowerCase();
    
    if (name.includes('cast') || desc.includes('cast')) return 'cast';
    if (name.includes('projectile') || desc.includes('projectile')) return 'projectile';
    if (name.includes('slash') || desc.includes('slash')) return 'slash';
    if (name.includes('thrust') || desc.includes('thrust')) return 'thrust';
    if (name.includes('smash') || desc.includes('smash')) return 'smash';
    if (name.includes('spin') || desc.includes('spin')) return 'spin';
    
    // Default to slash
    return 'slash';
  }

  /**
   * Update projectiles and check for collisions
   */
  update(deltaTime: number): void {
    // Update projectiles
    this.updateProjectiles(deltaTime);
    
    // Update particles (managed by ParticleSystem)
  }

  /**
   * Update all active projectiles
   */
  private updateProjectiles(deltaTime: number): void {
    // Get current game state
    const currentRoomId = useGameStore.getState().currentRoomId;
    const currentLevel = useGameStore.getState().currentLevel;
    const player = useGameStore.getState().player;
    
    // Process each projectile
    this.projectiles.forEach((projectile, id) => {
      // Update time left
      projectile.timeLeft -= deltaTime;
      
      // Check if expired
      if (projectile.timeLeft <= 0) {
        this.projectiles.delete(id);
        return;
      }
      
      // Update position
      projectile.position.add(
        projectile.velocity.clone().multiplyScalar(deltaTime)
      );
      
      // Check collisions
      let hitTarget = false;
      
      // Check for collision with appropriate targets
      if (projectile.ownerId === player.id) {
        // Player projectile - check collision with enemies
        if (currentLevel && currentRoomId) {
          const room = currentLevel.rooms.find(r => r.id === currentRoomId);
          
          if (room) {
            for (const enemy of room.enemies) {
              const enemyPos = new THREE.Vector3(enemy.position.x, enemy.position.y, enemy.position.z);
              const distance = projectile.position.distanceTo(enemyPos);
              
              // Collision radius (sum of projectile and target radii)
              const collisionRadius = 1.0; // Simplified
              
              if (distance < collisionRadius) {
                // Hit!
                hitTarget = true;
                
                // Apply damage
                const isCritical = Math.random() < (player.stats.criticalChance || 0.05);
                const damageMultiplier = isCritical ? 
                  (player.stats.criticalDamage || 1.5) : 
                  1.0;
                  
                const finalDamage = Math.floor(projectile.damage * damageMultiplier);
                
                // Apply damage
                enemy.health -= finalDamage;
                
                // Create hit effect
                this.createHitEffect(enemyPos, finalDamage, isCritical, 'ability');
                
                // Check if enemy is defeated
                if (enemy.health <= 0) {
                  useGameStore.getState().removeEnemy(currentRoomId, enemy.id);
                }
                
                // Call onHit callback if provided
                if (projectile.onHit) {
                  projectile.onHit(enemyPos);
                }
                
                break;
              }
            }
          }
        }
      } else {
        // Enemy projectile - check collision with player
        const playerPos = new THREE.Vector3(player.position.x, player.position.y, player.position.z);
        const distance = projectile.position.distanceTo(playerPos);
        
        // Collision radius (sum of projectile and target radii)
        const collisionRadius = 1.0; // Simplified
        
        if (distance < collisionRadius) {
          // Hit!
          hitTarget = true;
          
          // Apply damage
          useGameStore.getState().takeDamage(projectile.damage);
          
          // Create hit effect
          this.createHitEffect(playerPos, projectile.damage, false, 'ability');
          
          // Call onHit callback if provided
          if (projectile.onHit) {
            projectile.onHit(playerPos);
          }
        }
      }
      
      // Remove projectile if it hit something
      if (hitTarget) {
        this.projectiles.delete(id);
      }
    });
  }
}