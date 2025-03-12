import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';
import { useFrustumCulling } from '../systems/optimizations';
import { AudioManager } from '../systems/audio';
import { ParticleSystem } from '../systems/objectPooling';
import { VisualEffectsManager } from '../systems/visualEffects';

// Enemy types and behaviors
export type EnemyBehaviorType = 'melee' | 'ranged' | 'charger' | 'bomber' | 'summoner' | 'elite' | 'boss';

// Enemy behavior properties interface
interface EnemyBehaviorProps {
  speed: number;
  attackRange: number;
  attackCooldown: number;
  attackDamage: number;
  attackAngle: number;
  detectRange: number;
  patrolRadius?: number;
  specialAbilities?: string[];
  chargeSpeed?: number;
  projectileSpeed?: number;
  summonCooldown?: number;
  summonType?: string;
  phaseThresholds?: number[];
}

// Behavior configurations for different enemy types
const ENEMY_BEHAVIORS: Record<EnemyBehaviorType, EnemyBehaviorProps> = {
  melee: {
    speed: 3,
    attackRange: 2,
    attackCooldown: 1.0,
    attackDamage: 10,
    attackAngle: 60,
    detectRange: 15,
    patrolRadius: 5
  },
  
  ranged: {
    speed: 2,
    attackRange: 10,
    attackCooldown: 2.0,
    attackDamage: 15,
    attackAngle: 45,
    detectRange: 20,
    patrolRadius: 3,
    projectileSpeed: 10
  },
  
  charger: {
    speed: 2,
    attackRange: 8,
    attackCooldown: 3.0,
    attackDamage: 20,
    attackAngle: 30,
    detectRange: 15,
    chargeSpeed: 15
  },
  
  bomber: {
    speed: 2.5,
    attackRange: 1.5,
    attackCooldown: 0.5,
    attackDamage: 5,
    attackAngle: 360,
    detectRange: 12,
    specialAbilities: ['explode']
  },
  
  summoner: {
    speed: 1.5,
    attackRange: 12,
    attackCooldown: 1.5,
    attackDamage: 8,
    attackAngle: 60,
    detectRange: 18,
    summonCooldown: 10,
    summonType: 'melee'
  },
  
  elite: {
    speed: 3.5,
    attackRange: 3,
    attackCooldown: 0.8,
    attackDamage: 20,
    attackAngle: 90,
    detectRange: 20,
    specialAbilities: ['aoe', 'dash']
  },
  
  boss: {
    speed: 2.5,
    attackRange: 4,
    attackCooldown: 1.2,
    attackDamage: 25,
    attackAngle: 120,
    detectRange: 30,
    specialAbilities: ['aoe', 'summon', 'teleport', 'projectile'],
    phaseThresholds: [0.7, 0.4, 0.2]
  }
};

// Enemy visuals for different types
const ENEMY_VISUAL_CONFIGS: Record<EnemyBehaviorType | string, {
  color: string;
  emissive?: string;
  scale: number;
  model: 'capsule' | 'cube' | 'sphere' | 'custom';
}> = {
  melee: {
    color: '#ff4444',
    scale: 1.0,
    model: 'capsule'
  },
  
  ranged: {
    color: '#44aaff',
    emissive: '#225577',
    scale: 0.9,
    model: 'capsule'
  },
  
  charger: {
    color: '#ff8844',
    emissive: '#662200',
    scale: 1.1,
    model: 'capsule'
  },
  
  bomber: {
    color: '#ffaa00',
    emissive: '#aa5500',
    scale: 0.85,
    model: 'sphere'
  },
  
  summoner: {
    color: '#aa44ff',
    emissive: '#550088',
    scale: 0.9,
    model: 'capsule'
  },
  
  elite: {
    color: '#ff00aa',
    emissive: '#aa0066',
    scale: 1.4,
    model: 'capsule'
  },
  
  boss: {
    color: '#ff0000',
    emissive: '#aa0000',
    scale: 2.0,
    model: 'custom'
  },
  
  'normal': {
    color: '#ff4444',
    scale: 1.0,
    model: 'capsule'
  },
  
  'Elite': {
    color: '#ff00aa',
    emissive: '#aa0066',
    scale: 1.4,
    model: 'capsule'
  },
  
  'Boss': {
    color: '#ff0000',
    emissive: '#aa0000',
    scale: 2.0,
    model: 'custom'
  }
};

interface EnemyProps {
  position: [number, number, number];
  enemyType: string;
  enemyId: string;
  initialHealth?: number;
  patrolPath?: THREE.Vector3[];
}

export function Enemy({ 
  position, 
  enemyType = 'normal', 
  enemyId,
  initialHealth,
  patrolPath
}: EnemyProps) {
  // References
  const rigidBodyRef = useRef<any>(null);
  const meshRef = useRef<THREE.Group>(null);
  const healthBarRef = useRef<THREE.Mesh>(null);
  
  // Determine behavior type based on enemyType string
  const behaviorType: EnemyBehaviorType = 
    enemyType === 'Normal' ? 'melee' :
    enemyType === 'Elite' ? 'elite' :
    enemyType === 'Boss' ? 'boss' :
    enemyType as EnemyBehaviorType;
  
  // State
  const [health, setHealth] = useState(initialHealth || 
    (behaviorType === 'boss' ? 1000 : 
     behaviorType === 'elite' ? 200 : 
     100));
  const maxHealth = useRef(health);
  const [isAttacking, setIsAttacking] = useState(false);
  const [isCharging, setIsCharging] = useState(false);
  const [targetPlayer, setTargetPlayer] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(0);
  
  // Animation and timing references
  const lastAttackTime = useRef(0);
  const attackDuration = useRef(0.3);
  const attackAnimationRef = useRef<number | null>(null);
  const patrolIndex = useRef(0);
  const waitTimer = useRef(0);
  const chargeTimer = useRef(0);
  const specialCooldown = useRef(0);
  const summonCooldown = useRef(0);
  
  // Movement vectors
  const moveDirection = useRef(new THREE.Vector3());
  const currentVelocity = useRef(new THREE.Vector3());
  const targetPosition = useRef(new THREE.Vector3());
  
  // Get game state
  const currentRoomId = useGameStore((state) => state.currentRoomId);
  const room = useGameStore(state => {
    if (!state.currentLevel || !state.currentRoomId) return null;
    return state.currentLevel.rooms.find(r => r.id === state.currentRoomId);
  });
  
  // Get behavior properties
  const behavior = ENEMY_BEHAVIORS[behaviorType];
  
  // Get visual configuration
  const visuals = ENEMY_VISUAL_CONFIGS[enemyType] || ENEMY_VISUAL_CONFIGS[behaviorType] || ENEMY_VISUAL_CONFIGS.melee;
  
  // Add frustum culling for performance optimization
  useFrustumCulling(meshRef, visuals.scale * 1.5);
  
  // Initialize enemy in the game store
  useEffect(() => {
    // Make sure enemy exists in the game state
    if (!room) return;
    
    const enemyInRoom = room.enemies.find(e => e.id === enemyId);
    if (!enemyInRoom) {
      // Add enemy to room if not already present
      useGameStore.getState().addEnemyToRoom(currentRoomId!, {
        id: enemyId,
        type: enemyType,
        health: health,
        maxHealth: maxHealth.current,
        position: { x: position[0], y: position[1], z: position[2] },
        damage: behavior.attackDamage,
        experience: 
          behaviorType === 'boss' ? 500 :
          behaviorType === 'elite' ? 100 :
          50,
        abilities: [],
        behavior: {
          type: behaviorType,
          detectionRange: behavior.detectRange,
          attackRange: behavior.attackRange,
          movementSpeed: behavior.speed,
          attackSpeed: 1 / behavior.attackCooldown,
          patterns: []
        },
        dropTable: { equipment: [], resources: [] }
      });
    } else {
      // Sync with existing enemy
      setHealth(enemyInRoom.health);
      maxHealth.current = enemyInRoom.maxHealth || health;
    }
  }, [currentRoomId, enemyId, health, behaviorType, enemyType, position, room, behavior]);
  
  // Main update loop
  useFrame((_state, delta) => {
    if (!meshRef.current || !rigidBodyRef.current || health <= 0) return;
    
    // Update cooldowns
    if (lastAttackTime.current > 0) lastAttackTime.current -= delta;
    if (waitTimer.current > 0) waitTimer.current -= delta;
    if (chargeTimer.current > 0) chargeTimer.current -= delta;
    if (specialCooldown.current > 0) specialCooldown.current -= delta;
    if (summonCooldown.current > 0) summonCooldown.current -= delta;
    
    // Get player position
    const playerPos = useGameStore.getState().player.position;
    const playerPosition = new THREE.Vector3(playerPos.x, 0, playerPos.z);
    
    // Get current position
    const currentPos = new THREE.Vector3();
    meshRef.current.getWorldPosition(currentPos);
    currentPos.y = 0; // Ignore height for distance calculations
    
    // Calculate distance to player
    const distanceToPlayer = currentPos.distanceTo(playerPosition);
    
    // Update health bar
    updateHealthBar();
    
    // Check for phase transitions for boss enemies
    if (behaviorType === 'boss' && behavior.phaseThresholds) {
      const healthPercent = health / maxHealth.current;
      
      // Find current phase based on health
      let newPhase = 0;
      for (let i = 0; i < behavior.phaseThresholds.length; i++) {
        if (healthPercent <= behavior.phaseThresholds[i]) {
          newPhase = i + 1;
        }
      }
      
      // Handle phase transition
      if (newPhase !== currentPhase) {
        handlePhaseTransition(newPhase);
      }
    }
    
    // Behavior state machine
    if (isAttacking) {
      // Currently in attack animation
      const attackProgress = (Date.now() - attackAnimationRef.current!) / (attackDuration.current * 1000);
      
      if (attackProgress >= 1) {
        setIsAttacking(false);
        attackAnimationRef.current = null;
      } else {
        // During attack animation, reduce movement speed
        currentVelocity.current.multiplyScalar(0.8);
      }
    } else if (isCharging) {
      // Handle charge attack behavior
      handleChargeAttack(delta, currentPos, playerPosition);
    } else if (distanceToPlayer <= behavior.detectRange) {
      // Player detected - target and approach
      if (!targetPlayer) setTargetPlayer(true);
      
      // Set target position to player
      targetPosition.current.copy(playerPosition);
      
      // Handle attacking if in range
      if (distanceToPlayer <= behavior.attackRange && lastAttackTime.current <= 0) {
        // Attack based on enemy type
        performAttack(currentPos, playerPosition);
      } else if (behaviorType === 'ranged' && distanceToPlayer <= behavior.attackRange * 0.8) {
        // Ranged enemies try to maintain distance
        moveDirection.current.subVectors(currentPos, playerPosition).normalize();
      } else if (behaviorType === 'charger' && distanceToPlayer <= behavior.attackRange && chargeTimer.current <= 0) {
        // Charge attack preparation
        prepareChargeAttack(currentPos, playerPosition);
      } else if (behaviorType === 'summoner' && summonCooldown.current <= 0) {
        // Summoner trying to summon minions
        performSummon(currentPos);
      } else if (behaviorType === 'boss' && specialCooldown.current <= 0) {
        // Boss special abilities
        performBossSpecial(currentPos, playerPosition, distanceToPlayer);
      } else {
        // Standard approach behavior
        moveDirection.current.subVectors(playerPosition, currentPos).normalize();
      }
      
      // Apply movement
      applyMovement(delta, currentPos);
    } else {
      // Player not detected - patrol or idle
      setTargetPlayer(false);
      
      // Patrolling behavior
      if (patrolPath && patrolPath.length > 0) {
        handlePatrolling(delta, currentPos);
      } else if (behavior.patrolRadius) {
        // Random wandering in an area
        handleWandering(delta, currentPos);
      } else {
        // Idle - small random movements
        handleIdleMovement(delta);
      }
    }
    
    // Sync position with game store
    syncPositionWithStore();
  });
  
  // Handle phase transition for boss enemies
  const handlePhaseTransition = (newPhase: number) => {
    setCurrentPhase(newPhase);
    
    // Create phase transition effect
    if (meshRef.current) {
      const position = new THREE.Vector3();
      meshRef.current.getWorldPosition(position);
      
      // Visual effect
      const effectsManager = VisualEffectsManager.getInstance();
      if (effectsManager) {
        effectsManager.createImpactEffect(position, 0xff0000, 3.0);
        effectsManager.flashScreen(0xff0000, 0.3, 0.5);
      }
      
      // Particles
      const particleSystem = ParticleSystem.getInstance();
      if (particleSystem) {
        particleSystem.emitParticles(
          'ability',
          position,
          50,
          1000,
          2.0,
          0.5,
          new THREE.Color(0xff0000)
        );
      }
      
      // Sound effect
      AudioManager.playSound('ability', { volume: 0.8, rate: 0.7 });
      
      // Reset cooldowns and give brief invulnerability window
      lastAttackTime.current = 0;
      specialCooldown.current = 0;
      
      // Change behavior based on phase
      // In a full implementation, you would have more sophisticated phase behavior
    }
  };
  
  // Handle charge attack behavior
  const handleChargeAttack = (delta: number, currentPos: THREE.Vector3, playerPosition: THREE.Vector3) => {
    if (chargeTimer.current <= 0) {
      // End charge
      setIsCharging(false);
      lastAttackTime.current = behavior.attackCooldown;
      return;
    }
    
    // During charge, move quickly in the charge direction
    const chargeSpeed = behavior.chargeSpeed || behavior.speed * 3;
    
    // Calculate velocity for charge
    const chargeVelocity = moveDirection.current.clone().multiplyScalar(chargeSpeed);
    
    // Apply to rigid body
    const rigidBody = rigidBodyRef.current;
    const linvel = rigidBody.linvel();
    rigidBody.setLinvel({ 
      x: chargeVelocity.x, 
      y: linvel.y, 
      z: chargeVelocity.z 
    });
    
    // Check for collision with player during charge
    const playerDistance = currentPos.distanceTo(playerPosition);
    if (playerDistance < 1.5) {
      // Hit player with charge attack
      useGameStore.getState().takeDamage(behavior.attackDamage * 1.5);
      
      // Create impact effect
      const particleSystem = ParticleSystem.getInstance();
      if (particleSystem) {
        particleSystem.emitParticles(
          'hit',
          playerPosition,
          20,
          500,
          0.5,
          0.2,
          new THREE.Color(0xff8844)
        );
      }
      
      // Play hit sound
      AudioManager.playSound('hit', { volume: 0.7 });
      
      // End charge early
      setIsCharging(false);
      lastAttackTime.current = behavior.attackCooldown;
      chargeTimer.current = 0;
    }
    
    // Create trail effect during charge
    if (meshRef.current) {
      const trailPosition = new THREE.Vector3();
      meshRef.current.getWorldPosition(trailPosition);
      
      const particleSystem = ParticleSystem.getInstance();
      if (particleSystem) {
        particleSystem.emitParticles(
          'dash',
          trailPosition,
          1,
          300,
          0.2,
          0.05,
          new THREE.Color(visuals.color)
        );
      }
    }
  };
  
  // Prepare charge attack
  const prepareChargeAttack = (currentPos: THREE.Vector3, playerPosition: THREE.Vector3) => {
    // Prepare for charge attack
    setIsCharging(true);
    chargeTimer.current = 0.8; // Charge duration
    
    // Set charge direction toward player
    moveDirection.current.subVectors(playerPosition, currentPos).normalize();
    
    // Visual telegraph
    if (meshRef.current) {
      const position = new THREE.Vector3();
      meshRef.current.getWorldPosition(position);
      
      // Create particle effect for telegraph
      const particleSystem = ParticleSystem.getInstance();
      if (particleSystem) {
        particleSystem.emitParticles(
          'dash',
          position,
          10,
          500,
          0.3,
          0.1,
          new THREE.Color(visuals.color)
        );
      }
      
      // Play telegraph sound
      AudioManager.playSound('dash', { volume: 0.5, rate: 0.8 });
    }
  };
  
  // Perform attack based on enemy type
  const performAttack = (currentPos: THREE.Vector3, playerPosition: THREE.Vector3) => {
    setIsAttacking(true);
    lastAttackTime.current = behavior.attackCooldown;
    attackAnimationRef.current = Date.now();
    
    // Direction to player
    const toPlayer = new THREE.Vector3().subVectors(playerPosition, currentPos).normalize();
    
    // Check if player is within attack angle
    const dot = moveDirection.current.dot(toPlayer);
    const angleToPlayer = Math.acos(Math.min(1, Math.max(-1, dot))) * (180 / Math.PI);
    
    if (angleToPlayer <= behavior.attackAngle / 2) {
      // Player is within attack angle
      const distance = currentPos.distanceTo(playerPosition);
      
      if (distance <= behavior.attackRange) {
        // Melee attack hit
        if (behaviorType === 'bomber') {
          // Bomber explodes on attack
          performExplosion(currentPos);
        } else {
          // Standard attack damage
          useGameStore.getState().takeDamage(behavior.attackDamage);
          
          // Create attack effect
          createAttackEffect(currentPos, toPlayer);
          
          // Play attack sound
          AudioManager.playSound('hit', { volume: 0.5 });
        }
      }
    }
    
    // For ranged enemies, also fire a projectile
    if (behaviorType === 'ranged') {
      fireProjectile(currentPos, toPlayer);
    }
  };
  
  // Fire a projectile for ranged enemies
  const fireProjectile = (position: THREE.Vector3, direction: THREE.Vector3) => {
    // Animation start
    setIsAttacking(true);
    attackAnimationRef.current = Date.now();
    
    // Create projectile visual effect
    const effectsManager = VisualEffectsManager.getInstance();
    if (effectsManager) {
      // Calculate end position
      const endPosition = position.clone().add(
        direction.clone().multiplyScalar(behavior.attackRange)
      );
      
      // Create projectile trail
      effectsManager.createAttackTrail(
        position, 
        endPosition, 
        visuals.color, 
        0.5
      );
      
      // Delayed hit check (simulate projectile travel time)
      const projectileSpeed = behavior.projectileSpeed || 10;
      const distance = behavior.attackRange;
      const travelTime = distance / projectileSpeed;
      
      setTimeout(() => {
        // Get current player position for hit check
        const playerPos = useGameStore.getState().player.position;
        const playerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
        
        // Calculate where projectile would be
        const projectilePosition = position.clone().add(
          direction.clone().multiplyScalar(distance)
        );
        
        // Check if player is near the projectile path endpoint
        const hitRange = 1.5; // Slightly generous hit detection
        if (projectilePosition.distanceTo(playerPosition) <= hitRange) {
          // Hit player
          useGameStore.getState().takeDamage(behavior.attackDamage);
          
          // Create hit effect
          const particleSystem = ParticleSystem.getInstance();
          if (particleSystem) {
            particleSystem.emitParticles(
              'hit',
              playerPosition,
              10,
              400,
              0.3,
              0.1,
              new THREE.Color(visuals.color)
            );
          }
          
          // Play hit sound
          AudioManager.playSound('hit');
        }
      }, travelTime * 1000);
    }
    
    // Play projectile sound
    AudioManager.playSound('ability', { volume: 0.4, rate: 1.2 });
  };
  
  // Perform explosion for bomber enemies
  const performExplosion = (position: THREE.Vector3) => {
    // Calculate explosion range
    const explosionRange = behavior.attackRange * 1.5;
    
    // Check if player is in range
    const playerPos = useGameStore.getState().player.position;
    const playerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
    const distanceToPlayer = position.distanceTo(playerPosition);
    
    if (distanceToPlayer <= explosionRange) {
      // Calculate damage based on distance (more damage closer to center)
      const damageMultiplier = 1 - (distanceToPlayer / explosionRange);
      const damage = Math.floor(behavior.attackDamage * 2 * damageMultiplier);
      
      // Apply damage to player
      useGameStore.getState().takeDamage(damage);
    }
    
    // Create explosion effect
    const particleSystem = ParticleSystem.getInstance();
    if (particleSystem) {
      particleSystem.emitParticles(
        'death',
        position,
        30,
        800,
        1.5,
        0.5,
        new THREE.Color(0xffaa00)
      );
    }
    
    // Create screen shake and flash
    const effectsManager = VisualEffectsManager.getInstance();
    if (effectsManager) {
      effectsManager.createImpactEffect(position, 0xffaa00, 2.0);
      effectsManager.flashScreen(0xffaa00, 0.3, 0.3);
    }
    
    // Play explosion sound
    AudioManager.playSound('death', { volume: 0.7 });
    
    // Self-destruct
    setHealth(0);
  };
  
  // Perform summoning for summoner enemies
  const performSummon = (position: THREE.Vector3) => {
    // Reset summon cooldown
    summonCooldown.current = behavior.summonCooldown || 10;
    
    // Create summon effect
    setIsAttacking(true);
    attackAnimationRef.current = Date.now();
    attackDuration.current = 1.0; // Longer animation for summoning
    
    // Summon positions (around the summoner)
    const summonPositions = [];
    const summonCount = 2;
    
    for (let i = 0; i < summonCount; i++) {
      const angle = (i / summonCount) * Math.PI * 2;
      const distance = 2;
      const x = position.x + Math.cos(angle) * distance;
      const z = position.z + Math.sin(angle) * distance;
      
      summonPositions.push([x, position.y, z]);
    }
    
    // Create summon visuals
    summonPositions.forEach(pos => {
      const particleSystem = ParticleSystem.getInstance();
      if (particleSystem) {
        particleSystem.emitParticles(
          'ability',
          new THREE.Vector3(pos[0], pos[1], pos[2]),
          20,
          1000,
          1.0,
          0.3,
          new THREE.Color(visuals.color)
        );
      }
    });
    
    // Play summon sound
    AudioManager.playSound('ability', { volume: 0.6 });
    
    // In a full implementation, this would spawn actual enemy entities
    // For now, we just create the visual effect
    setTimeout(() => {
      // Tell the game to spawn enemies at these positions
      summonPositions.forEach(pos => {
        useGameStore.getState().spawnEnemy(
          currentRoomId!,
          behavior.summonType || 'melee',
          pos as [number, number, number]
        );
      });
    }, 1000);
  };
  
  // Perform boss special attacks
  const performBossSpecial = (currentPos: THREE.Vector3, playerPosition: THREE.Vector3, distance: number) => {
    // Set cooldown for special attacks
    specialCooldown.current = 4 + (Math.random() * 2);
    
    // Different attacks based on phase and distance
    if (currentPhase >= 2) {
      // Later phases have more aggressive abilities
      if (Math.random() < 0.3) {
        // Teleport near player
        performTeleport(playerPosition);
      } else if (distance > behavior.attackRange * 1.5) {
        // Far from player, use ranged attack
        fireProjectileBarrage(currentPos, playerPosition);
      } else {
        // Close to player, use AOE attack
        performAOEAttack(currentPos);
      }
    } else if (currentPhase >= 1) {
      // Mid phases mix abilities
      if (distance > behavior.attackRange * 1.5 && Math.random() < 0.7) {
        fireProjectile(currentPos, new THREE.Vector3().subVectors(playerPosition, currentPos).normalize());
      } else {
        performAOEAttack(currentPos);
      }
    } else {
      // Initial phase, simpler attacks
      if (Math.random() < 0.3) {
        performAOEAttack(currentPos);
      } else if (distance > behavior.attackRange && Math.random() < 0.5) {
        fireProjectile(currentPos, new THREE.Vector3().subVectors(playerPosition, currentPos).normalize());
      }
    }
  };
  
  // Teleport ability for bosses
  const performTeleport = (targetPosition: THREE.Vector3) => {
    if (!meshRef.current || !rigidBodyRef.current) return;
    
    // Current position before teleport
    const currentPos = new THREE.Vector3();
    meshRef.current.getWorldPosition(currentPos);
    
    // Create disappear effect at current position
    const particleSystem = ParticleSystem.getInstance();
    if (particleSystem) {
      particleSystem.emitParticles(
        'ability',
        currentPos,
        30,
        800,
        1.0,
        0.3,
        new THREE.Color(visuals.color)
      );
    }
    
    // Play teleport sound
    AudioManager.playSound('ability', { volume: 0.5, rate: 1.3 });
    
    // Calculate teleport position (near player but not too close)
    const angle = Math.random() * Math.PI * 2;
    const distance = 3 + Math.random() * 2;
    const teleportPos = new THREE.Vector3(
      targetPosition.x + Math.cos(angle) * distance,
      targetPosition.y,
      targetPosition.z + Math.sin(angle) * distance
    );
    
    // Actually teleport after a short delay
    setTimeout(() => {
      if (!rigidBodyRef.current) return;
      
      // Teleport
      rigidBodyRef.current.setTranslation({
        x: teleportPos.x,
        y: teleportPos.y,
        z: teleportPos.z
      });
      
      // Create appear effect at new position
      if (particleSystem) {
        particleSystem.emitParticles(
          'ability',
          teleportPos,
          30,
          800,
          1.0,
          0.3,
          new THREE.Color(visuals.color)
        );
      }
      
      // Play appear sound
      AudioManager.playSound('ability', { volume: 0.5, rate: 1.5 });
    }, 500);
  };
  
  // AOE attack for bosses and elites
  const performAOEAttack = (position: THREE.Vector3) => {
    // Set attacking state
    setIsAttacking(true);
    attackAnimationRef.current = Date.now();
    attackDuration.current = 1.2; // Longer animation for AOE
    
    // Telegraph the attack
    const particleSystem = ParticleSystem.getInstance();
    if (particleSystem) {
      particleSystem.emitParticles(
        'ability',
        position,
        15,
        1000,
        1.5,
        0.3,
        new THREE.Color(visuals.color)
      );
    }
    
    // Play telegraph sound
    AudioManager.playSound('ability', { volume: 0.6, rate: 0.8 });
    
    // After delay, perform the actual attack
    setTimeout(() => {
      // Get current position (may have moved during telegraph)
      const currentPos = new THREE.Vector3();
      if (meshRef.current) {
        meshRef.current.getWorldPosition(currentPos);
      } else {
        currentPos.copy(position);
      }
      
      // Get player position for hit check
      const playerPos = useGameStore.getState().player.position;
      const playerPosition = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
      const distanceToPlayer = currentPos.distanceTo(playerPosition);
      
      // AOE radius
      const aoeRadius = behavior.attackRange * 1.2;
      
      // Check if player is hit
      if (distanceToPlayer <= aoeRadius) {
        // Apply damage
        const damage = behavior.attackDamage * 1.5;
        useGameStore.getState().takeDamage(damage);
      }
      
      // Create visual effects for the AOE
      if (particleSystem) {
        particleSystem.emitParticles(
          'death',
          currentPos,
          40,
          800,
          aoeRadius,
          0.5,
          new THREE.Color(visuals.color)
        );
      }
      
      // Screen effects
      const effectsManager = VisualEffectsManager.getInstance();
      if (effectsManager) {
        effectsManager.createImpactEffect(currentPos, visuals.color, aoeRadius);
      }
      
      // Play impact sound
      AudioManager.playSound('ability', { volume: 0.7 });
    }, 800); // Delay before impact
  };
  
  // Fire multiple projectiles in a pattern
  const fireProjectileBarrage = (position: THREE.Vector3, targetPosition: THREE.Vector3) => {
    // Set attacking state
    setIsAttacking(true);
    attackAnimationRef.current = Date.now();
    attackDuration.current = 1.5; // Longer animation for barrage
    
    // Direction to target
    const toTarget = new THREE.Vector3().subVectors(targetPosition, position).normalize();
    
    // Create multiple projectiles in an arc
    const projectileCount = 3 + currentPhase;
    const spreadAngle = 60; // degrees
    const baseAngle = Math.atan2(toTarget.x, toTarget.z);
    const angleStep = (spreadAngle * Math.PI / 180) / (projectileCount - 1);
    const startAngle = baseAngle - (spreadAngle * Math.PI / 180) / 2;
    
    // Play charge sound
    AudioManager.playSound('ability', { volume: 0.6, rate: 0.9 });
    
    // Fire projectiles with slight delay between them
    for (let i = 0; i < projectileCount; i++) {
      setTimeout(() => {
        const angle = startAngle + (angleStep * i);
        const direction = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
        
        // Fire the projectile
        fireProjectile(position, direction);
      }, i * 150); // 150ms delay between projectiles
    }
  };
  
  // Handle patrolling behavior
  const handlePatrolling = (delta: number, currentPos: THREE.Vector3) => {
    if (!patrolPath || patrolPath.length === 0) return;
    
    // If waiting at a patrol point, continue waiting
    if (waitTimer.current > 0) {
      moveDirection.current.set(0, 0, 0);
      return;
    }
    
    // Current patrol target
    const target = patrolPath[patrolIndex.current];
    const distanceToTarget = currentPos.distanceTo(target);
    
    // Check if reached the patrol point
    if (distanceToTarget < 1) {
      // Reached target, wait before moving to next point
      waitTimer.current = 1 + Math.random() * 2;
      
      // Advance to next patrol point
      patrolIndex.current = (patrolIndex.current + 1) % patrolPath.length;
      
      moveDirection.current.set(0, 0, 0);
    } else {
      // Move toward patrol point
      moveDirection.current.subVectors(target, currentPos).normalize();
      
      // Apply movement at patrol speed (slower than chase)
      applyMovement(delta, currentPos, behavior.speed * 0.7);
    }
  };
  
  // Handle random wandering behavior
  const handleWandering = (delta: number, currentPos: THREE.Vector3) => {
    // If waiting between wandering, continue waiting
    if (waitTimer.current > 0) {
      moveDirection.current.set(0, 0, 0);
      return;
    }
    
    // Check if we have a target position
    if (targetPosition.current.lengthSq() === 0 || 
        currentPos.distanceTo(targetPosition.current) < 1) {
      // No target or reached target, pick a new random point
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * (behavior.patrolRadius || 5);
      
      // Use spawn position as center of wandering
      targetPosition.current.set(
        position[0] + Math.cos(angle) * distance,
        0,
        position[2] + Math.sin(angle) * distance
      );
      
      // Wait at current position before moving
      if (Math.random() < 0.3) {
        waitTimer.current = 1 + Math.random() * 2;
        moveDirection.current.set(0, 0, 0);
        return;
      }
    }
    
    // Move toward target position
    moveDirection.current.subVectors(targetPosition.current, currentPos).normalize();
    
    // Apply movement at wander speed (slower than patrol)
    applyMovement(delta, currentPos, behavior.speed * 0.5);
  };
  
  // Handle idle movement (small random adjustments)
  const handleIdleMovement = (delta: number) => {
    // Occasionally make small moves
    if (Math.random() < 0.02) {
      moveDirection.current.set(
        Math.random() * 2 - 1,
        0,
        Math.random() * 2 - 1
      ).normalize();
      
      // Apply small movement
      applyMovement(delta, new THREE.Vector3(), behavior.speed * 0.3);
    } else {
      // Otherwise, gradually slow down
      currentVelocity.current.multiplyScalar(0.9);
      
      // Apply damped movement
      const rigidBody = rigidBodyRef.current;
      if (rigidBody) {
        const linvel = rigidBody.linvel();
        rigidBody.setLinvel({ 
          x: currentVelocity.current.x, 
          y: linvel.y, 
          z: currentVelocity.current.z 
        });
      }
    }
  };
  
  // Apply movement based on current move direction
  const applyMovement = (delta: number, currentPos: THREE.Vector3, speedOverride?: number) => {
    if (!rigidBodyRef.current) return;
    
    // Use provided speed or behavior default
    const speed = speedOverride !== undefined ? speedOverride : behavior.speed;
    
    // Apply acceleration in move direction
    if (moveDirection.current.lengthSq() > 0) {
      const acceleration = 10 * delta;
      
      currentVelocity.current.x += moveDirection.current.x * acceleration;
      currentVelocity.current.z += moveDirection.current.z * acceleration;
      
      // Limit to max speed
      if (currentVelocity.current.lengthSq() > speed * speed) {
        currentVelocity.current.normalize().multiplyScalar(speed);
      }
      
      // Update rotation to face movement direction
      if (meshRef.current) {
        const angle = Math.atan2(moveDirection.current.x, moveDirection.current.z);
        meshRef.current.rotation.y = angle;
      }
    } else {
      // No movement direction, apply damping
      currentVelocity.current.multiplyScalar(0.9);
    }
    
    // Apply to rigid body
    const rigidBody = rigidBodyRef.current;
    const linvel = rigidBody.linvel();
    rigidBody.setLinvel({ 
      x: currentVelocity.current.x, 
      y: linvel.y, 
      z: currentVelocity.current.z 
    });
  };
  
  // Create visual attack effect
  const createAttackEffect = (position: THREE.Vector3, direction: THREE.Vector3) => {
    // Create swing effect based on enemy type
    const effectsManager = VisualEffectsManager.getInstance();
    if (effectsManager) {
      if (behaviorType === 'elite' || behaviorType === 'boss') {
        // More impressive effect for elites and bosses
        const swingWidth = behaviorType === 'boss' ? 3 : 2;
        
        // Create points for an arc
        const arcPoints: THREE.Vector3[] = [];
        const arcSegments = 8;
        const arcAngle = (behavior.attackAngle * Math.PI) / 180;
        
        // Get perpendicular axis
        const perpAxis = new THREE.Vector3(0, 1, 0);
        
        for (let i = 0; i <= arcSegments; i++) {
          const t = i / arcSegments;
          const angle = (t - 0.5) * arcAngle;
          
          // Rotate direction around perpendicular axis
          const rotatedDir = direction.clone().applyAxisAngle(perpAxis, angle);
          const point = position.clone().add(rotatedDir.multiplyScalar(swingWidth));
          arcPoints.push(point);
        }
        
        // Create particles along the arc
        const particleSystem = ParticleSystem.getInstance();
        if (particleSystem) {
          arcPoints.forEach(point => {
            particleSystem.emitParticles(
              'dash',
              point,
              2,
              300,
              0.2,
              0.1,
              new THREE.Color(visuals.color)
            );
          });
        }
      } else {
        // Simpler effect for regular enemies
        const endPoint = position.clone().add(direction.multiplyScalar(behavior.attackRange));
        effectsManager.createAttackTrail(position, endPoint, visuals.color, 0.5);
      }
    }
  };
  
  // Update the health bar
  const updateHealthBar = () => {
    if (!healthBarRef.current) return;
    
    // Update health bar scale based on current health
    const healthPercent = health / maxHealth.current;
    healthBarRef.current.scale.x = Math.max(0.01, healthPercent);
    
    // Update color based on health
    const healthBarMaterial = healthBarRef.current.material as THREE.MeshBasicMaterial;
    
    if (healthPercent < 0.3) {
      healthBarMaterial.color.set(0xff0000); // Red when low health
    } else if (healthPercent < 0.6) {
      healthBarMaterial.color.set(0xffff00); // Yellow when medium health
    } else {
      healthBarMaterial.color.set(0x00ff00); // Green when high health
    }
  };
  
  // Sync position with game store
  const syncPositionWithStore = () => {
    if (!meshRef.current || !currentRoomId) return;
    
    const worldPosition = meshRef.current.getWorldPosition(new THREE.Vector3());
    
    // Update enemy position in store
    useGameStore.getState().updateEnemyPosition(
      currentRoomId,
      enemyId,
      {
        x: worldPosition.x,
        y: worldPosition.y,
        z: worldPosition.z
      }
    );
  };
  
  // Handle enemy death when health reaches 0
  useEffect(() => {
    if (health <= 0 && currentRoomId) {
      // Create death effect
      if (meshRef.current) {
        const position = meshRef.current.getWorldPosition(new THREE.Vector3());
        
        // Particles
        const particleSystem = ParticleSystem.getInstance();
        if (particleSystem) {
          const particleCount = 
            behaviorType === 'boss' ? 50 : 
            behaviorType === 'elite' ? 30 : 
            20;
            
          const size = 
            behaviorType === 'boss' ? 0.5 : 
            behaviorType === 'elite' ? 0.3 : 
            0.2;
            
          particleSystem.emitParticles(
            'death',
            position,
            particleCount,
            1000,
            size,
            0.3,
            new THREE.Color(visuals.color)
          );
        }
        
        // Visual effect
        const effectsManager = VisualEffectsManager.getInstance();
        if (effectsManager) {
          effectsManager.createImpactEffect(
            position, 
            visuals.color, 
            behaviorType === 'boss' ? 2.0 : 1.0
          );
          
          // Screen flash for boss death
          if (behaviorType === 'boss') {
            effectsManager.flashScreen(visuals.color, 0.5, 0.5);
          }
        }
        
        // Play death sound
        AudioManager.playSound('death', { 
          volume: behaviorType === 'boss' ? 0.8 : 0.6,
          rate: behaviorType === 'boss' ? 0.8 : 1.0
        });
      }
      
      // Remove enemy from room
      useGameStore.getState().removeEnemy(currentRoomId, enemyId);
    }
  }, [health, currentRoomId, enemyId, behaviorType, visuals.color]);
  
  // Sync health with store
  useEffect(() => {
    if (currentRoomId) {
      // Get enemy from store
      const enemy = useGameStore.getState().getEnemyById(currentRoomId, enemyId);
      
      if (enemy && enemy.health !== health) {
        // Update health if different
        setHealth(enemy.health);
      }
    }
  }, [currentRoomId, enemyId, health]);

  // If enemy is dead, don't render
  if (health <= 0) return null;

  return (
    <RigidBody
      ref={rigidBodyRef}
      type="dynamic"
      position={position}
      mass={1}
      friction={0.7}
      restitution={0.2}
      lockRotations
      enabledRotations={[false, false, false]}
    >
      <CapsuleCollider args={[0.5 * visuals.scale, 0.5 * visuals.scale]} friction={1} />
      
      <group ref={meshRef}>
        {/* Main enemy body */}
        {visuals.model === 'capsule' && (
          <mesh castShadow>
            <capsuleGeometry args={[0.5 * visuals.scale, 1 * visuals.scale, 4, 8]} />
            <meshStandardMaterial 
              color={visuals.color}
              emissive={visuals.emissive || '#000000'}
              emissiveIntensity={isAttacking || isCharging ? 0.5 : 0.1}
            />
          </mesh>
        )}
        
        {visuals.model === 'sphere' && (
          <mesh castShadow>
            <sphereGeometry args={[0.7 * visuals.scale, 16, 16]} />
            <meshStandardMaterial
              color={visuals.color}
              emissive={visuals.emissive || '#000000'}
              emissiveIntensity={isAttacking || isCharging ? 0.5 : 0.1}
            />
          </mesh>
        )}
        
        {visuals.model === 'custom' && behaviorType === 'boss' && (
          // Boss custom model
          <group scale={[visuals.scale, visuals.scale, visuals.scale]}>
            {/* Base */}
            <mesh castShadow position={[0, 0, 0]}>
              <capsuleGeometry args={[0.7, 1.2, 8, 16]} />
              <meshStandardMaterial
                color={visuals.color}
                emissive={visuals.emissive || '#330000'}
                emissiveIntensity={isAttacking ? 0.7 : 0.3}
              />
            </mesh>
            
            {/* Shoulder pads */}
            <mesh castShadow position={[0.8, 0.5, 0]}>
              <sphereGeometry args={[0.4, 12, 12]} />
              <meshStandardMaterial
                color="#880000"
                emissive="#330000"
                emissiveIntensity={0.3}
              />
            </mesh>
            <mesh castShadow position={[-0.8, 0.5, 0]}>
              <sphereGeometry args={[0.4, 12, 12]} />
              <meshStandardMaterial
                color="#880000"
                emissive="#330000"
                emissiveIntensity={0.3}
              />
            </mesh>
            
            {/* Head */}
            <mesh castShadow position={[0, 1.3, 0]}>
              <sphereGeometry args={[0.5, 16, 16]} />
              <meshStandardMaterial
                color={visuals.color}
                emissive={visuals.emissive || '#330000'}
                emissiveIntensity={isAttacking ? 0.7 : 0.3}
              />
            </mesh>
            
            {/* Eyes */}
            <mesh position={[0.2, 1.4, 0.4]}>
              <sphereGeometry args={[0.1, 8, 8]} />
              <meshBasicMaterial color="#ff0000" />
            </mesh>
            <mesh position={[-0.2, 1.4, 0.4]}>
              <sphereGeometry args={[0.1, 8, 8]} />
              <meshBasicMaterial color="#ff0000" />
            </mesh>
            
            {/* Horn */}
            <mesh castShadow position={[0, 1.7, 0]} rotation={[0.2, 0, 0]}>
              <coneGeometry args={[0.1, 0.5, 8]} />
              <meshStandardMaterial
                color="#888888"
                metalness={0.7}
                roughness={0.3}
              />
            </mesh>
            
            {/* Weapon */}
            <group position={[0.8, 0.2, 0]} rotation={[0, 0, Math.PI * 0.1]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.05, 0.05, 2, 8]} />
                <meshStandardMaterial
                  color="#555555"
                  metalness={0.7}
                  roughness={0.3}
                />
              </mesh>
              <mesh castShadow position={[0, 1.1, 0]}>
                <boxGeometry args={[0.4, 0.1, 0.05]} />
                <meshStandardMaterial
                  color="#333333"
                  metalness={0.8}
                  roughness={0.2}
                />
              </mesh>
              <mesh castShadow position={[0, 1.4, 0]}>
                <coneGeometry args={[0.2, 0.6, 4]} />
                <meshStandardMaterial
                  color="#777777"
                  metalness={0.8}
                  roughness={0.2}
                  emissive="#ff0000"
                  emissiveIntensity={isAttacking ? 0.7 : 0.1}
                />
              </mesh>
            </group>
          </group>
        )}
        
        {/* Health bar positioned above enemy */}
        <group position={[0, 2 * visuals.scale, 0]}>
          {/* Health bar background */}
          <mesh>
            <boxGeometry args={[1.2, 0.15, 0.05]} />
            <meshBasicMaterial color="#333333" />
          </mesh>
          
          {/* Health bar fill */}
          <mesh
            ref={healthBarRef}
            position={[0, 0, 0.01]}
            scale={[1, 1, 1]}
          >
            <boxGeometry args={[1.2, 0.15, 0.05]} />
            <meshBasicMaterial color="#00ff00" />
          </mesh>
        </group>
        
        {/* Boss phase indicators */}
        {behaviorType === 'boss' && behavior.phaseThresholds && behavior.phaseThresholds.map((threshold, index) => (
          <mesh
            key={`phase-${index}`}
            position={[(threshold - 0.5) * 1.2, 2 * visuals.scale, 0.02]}
            scale={[0.03, 0.2, 0.03]}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial 
              color={index < currentPhase ? '#ff0000' : '#ffffff'}
              transparent={true}
              opacity={0.8}
            />
          </mesh>
        ))}
      </group>
    </RigidBody>
  );
}