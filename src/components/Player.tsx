import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../store/gameStore';
import * as THREE from 'three';
import { ProgressionSystem } from '../systems/progression';
import { CapsuleCollider, RigidBody } from '@react-three/rapier';
import { useKeyboardControls } from '@react-three/drei';
import { useFrustumCulling } from '../systems/optimizations';
import { AudioManager } from '../systems/audio';
import { VisualEffectsManager } from '../systems/visualEffects';
import { ParticleSystem } from '../systems/objectPooling';

// Weapon types and their properties
const WEAPONS = {
  'sword': {
    range: 2.5,
    attackSpeed: 0.3,
    combos: [
      { damage: 20, angle: 60, range: 2.5, knockback: 0.5 },
      { damage: 25, angle: 90, range: 2.5, knockback: 1.0 },
      { damage: 35, angle: 120, range: 3.0, knockback: 2.0 }
    ],
    special: {
      damage: 60,
      angle: 360,
      range: 3.0,
      knockback: 3.0,
      cooldown: 3.0
    }
  },
  'spear': {
    range: 3.5,
    attackSpeed: 0.4,
    combos: [
      { damage: 15, angle: 30, range: 3.5, knockback: 1.0 },
      { damage: 20, angle: 30, range: 4.0, knockback: 1.5 },
      { damage: 30, angle: 45, range: 4.0, knockback: 2.0 }
    ],
    special: {
      damage: 50,
      angle: 180,
      range: 4.5,
      knockback: 3.0,
      cooldown: 3.5
    }
  },
  'gauntlets': {
    range: 1.8,
    attackSpeed: 0.2,
    combos: [
      { damage: 10, angle: 45, range: 1.8, knockback: 0.2 },
      { damage: 12, angle: 45, range: 1.8, knockback: 0.3 },
      { damage: 15, angle: 45, range: 1.8, knockback: 0.4 },
      { damage: 25, angle: 90, range: 2.0, knockback: 1.0 }
    ],
    special: {
      damage: 40,
      angle: 120,
      range: 2.5,
      knockback: 2.0,
      cooldown: 2.5
    }
  }
};

// Cast abilities
const CASTS = {
  'standard': {
    damage: 30,
    range: 15,
    speed: 20,
    cooldown: 5.0
  }
};

export function Player() {
  const rigidBodyRef = useRef<any>(null);
  const meshRef = useRef<THREE.Group>(null);
  const { player, currentRoomId } = useGameStore();
  const currentLevel = useGameStore((state) => state.currentLevel);
  const setCurrentRoomId = useGameStore((state) => state.setCurrentRoomId);
  const updateDamageDealt = useGameStore((state) => state.updateDamageDealt);
  
  // Movement state
  const moveDirection = useRef(new THREE.Vector3());
  const currentVelocity = useRef(new THREE.Vector3());
  const [isDashing, setIsDashing] = useState(false);
  const dashCooldown = useRef(0);
  const [, getKeys] = useKeyboardControls();
  
  // Combat state
  const [currentWeapon, setCurrentWeapon] = useState('sword');
  const [comboStep, setComboStep] = useState(0);
  const lastAttackTime = useRef(0);
  const comboResetTime = useRef(1000); // ms
  const specialCooldown = useRef(0);
  const castCooldown = useRef(0);
  const isAttacking = useRef(false);
  const attackStartTime = useRef(0);
  const attackDuration = useRef(0.2);
  const attackDirection = useRef(new THREE.Vector3());
  
  // Visual effects
  const attackTrailRef = useRef<THREE.Line | null>(null);
  
  // Add frustum culling optimization
  useFrustumCulling(meshRef, 2);

  // Effect for weapon switching
  useEffect(() => {
    // Update weapon model based on currentWeapon
    // This would be expanded in a full implementation
    if (player.equipment.length > 0) {
      const weaponEquip = player.equipment.find(e => e.type === 'weapon');
      if (weaponEquip) {
        // This is placeholder - in a full implementation you'd actually
        // change the weapon model/type based on equipment
        setCurrentWeapon(weaponEquip.id.includes('spear') ? 'spear' : 
                          weaponEquip.id.includes('gauntlet') ? 'gauntlets' : 'sword');
      }
    }
  }, [player.equipment]);

  useFrame((_state, delta) => {
    if (!meshRef.current || !rigidBodyRef.current || !currentLevel || !currentRoomId || useGameStore.getState().isUpgradeAvailable) return;

    const currentRoom = currentLevel.rooms.find((room) => room.id === currentRoomId);
    if (!currentRoom) return;

    // Update cooldowns
    if (dashCooldown.current > 0) dashCooldown.current -= delta;
    if (specialCooldown.current > 0) specialCooldown.current -= delta;
    if (castCooldown.current > 0) castCooldown.current -= delta;

    // Check if attack is still in progress
    if (isAttacking.current) {
      const attackElapsed = (Date.now() - attackStartTime.current) / 1000;
      if (attackElapsed >= attackDuration.current) {
        isAttacking.current = false;
        
        // Clean up attack trail if it exists
        if (attackTrailRef.current && meshRef.current.children.includes(attackTrailRef.current)) {
          meshRef.current.remove(attackTrailRef.current);
          attackTrailRef.current = null;
        }
      }
    }

    const keys = getKeys();
    
    // Reset combo if too much time has passed since last attack
    if (Date.now() - lastAttackTime.current > comboResetTime.current) {
      setComboStep(0);
    }
    
    // Basic Attack
    if (keys.attack && !isAttacking.current) {
      const weaponData = WEAPONS[currentWeapon as keyof typeof WEAPONS];
      const comboData = weaponData.combos[comboStep];
      
      // Set attack state
      isAttacking.current = true;
      attackStartTime.current = Date.now();
      attackDuration.current = weaponData.attackSpeed;
      lastAttackTime.current = Date.now();
      
      // Store attack direction (player's forward direction)
      if (meshRef.current) {
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(meshRef.current.quaternion);
        attackDirection.current.copy(forward);
      }
      
      // Play attack sound
      AudioManager.playSound('ability');
      
      // Apply damage to enemies in range and arc
      performAttack(comboData.damage, comboData.range, comboData.angle, comboData.knockback);
      
      // Create visual effect for attack
      createAttackVisual(comboData.angle, comboData.range);
      
      // Advance combo counter for next attack
      setComboStep((prevStep) => (prevStep + 1) % weaponData.combos.length);
    }
    
    // Special Attack
    if (keys.special && specialCooldown.current <= 0 && !isAttacking.current) {
      const weaponData = WEAPONS[currentWeapon as keyof typeof WEAPONS];
      const specialData = weaponData.special;
      
      // Set attack state
      isAttacking.current = true;
      attackStartTime.current = Date.now();
      attackDuration.current = weaponData.attackSpeed * 1.5;
      specialCooldown.current = specialData.cooldown;
      
      // Store attack direction
      if (meshRef.current) {
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(meshRef.current.quaternion);
        attackDirection.current.copy(forward);
      }
      
      // Play special attack sound
      AudioManager.playSound('ability', { volume: 0.8, rate: 0.8 });
      
      // Apply damage to enemies in range and arc
      performAttack(specialData.damage, specialData.range, specialData.angle, specialData.knockback);
      
      // Create visual effect for special attack
      createSpecialAttackVisual(specialData.angle, specialData.range);
      
      // Reset combo
      setComboStep(0);
    }
    
    // Cast Ability
    if (keys.interact && castCooldown.current <= 0 && !isAttacking.current) {
      const castData = CASTS['standard'];
      
      // Set cooldown
      castCooldown.current = castData.cooldown;
      
      // Get direction based on player's facing
      const castDirection = new THREE.Vector3();
      if (meshRef.current) {
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(meshRef.current.quaternion);
        castDirection.copy(forward);
      }
      
      // Get position for projectile spawn
      const castPosition = new THREE.Vector3();
      meshRef.current?.getWorldPosition(castPosition);
      castPosition.y += 1; // Adjust to spawn at weapon height
      
      // Play cast sound
      AudioManager.playSound('ability', { volume: 0.7, rate: 1.2 });
      
      // Launch projectile
      launchCastProjectile(castPosition, castDirection, castData);
    }

    // Movement handling
    moveDirection.current.set(0, 0, 0);
    if (keys.forward) moveDirection.current.z -= 1;
    if (keys.backward) moveDirection.current.z += 1;
    if (keys.left) moveDirection.current.x -= 1;
    if (keys.right) moveDirection.current.x += 1;
    
    if (moveDirection.current.lengthSq() > 0) {
      moveDirection.current.normalize();
    }

    // Dashing
    if (keys.jump && dashCooldown.current <= 0 && moveDirection.current.lengthSq() > 0) {
      setIsDashing(true);
      dashCooldown.current = 0.5;
      
      // Play dash sound
      AudioManager.playSound('dash');
      
      // Create dash visual effect
      createDashVisual();
      
      // If dash-attack feature is enabled (i.e., attacking during dash)
      if (keys.attack && !isAttacking.current) {
        // Execute dash-attack with bonus damage
        const weaponData = WEAPONS[currentWeapon as keyof typeof WEAPONS];
        const comboData = weaponData.combos[0]; // Use first combo for dash-attack
        
        performAttack(comboData.damage * 1.5, comboData.range, comboData.angle, comboData.knockback * 1.5);
        createAttackVisual(comboData.angle, comboData.range);
      }
      
      setTimeout(() => setIsDashing(false), 200);
    }

    // Get move speed from player stats, or use default
    const baseSpeed = player.stats.moveSpeed || 8;
    const speed = isDashing ? baseSpeed * 2.5 : baseSpeed;
    const acceleration = isDashing ? 50 : 15;
    const damping = isDashing ? 0.95 : 0.75;

    // Apply movement
    currentVelocity.current.x += moveDirection.current.x * acceleration * delta;
    currentVelocity.current.z += moveDirection.current.z * acceleration * delta;
    currentVelocity.current.multiplyScalar(damping);
    
    if (currentVelocity.current.lengthSq() > speed * speed) {
      currentVelocity.current.normalize().multiplyScalar(speed);
    }

    // Apply velocity to rigid body
    const rigidBody = rigidBodyRef.current;
    const linvel = rigidBody.linvel();
    rigidBody.setLinvel({ x: currentVelocity.current.x, y: linvel.y, z: currentVelocity.current.z });

    // Update rotation to face movement direction
    if (moveDirection.current.lengthSq() > 0) {
      const angle = Math.atan2(moveDirection.current.x, moveDirection.current.z);
      meshRef.current!.rotation.y = angle;
    }

    // Update player position in store
    const worldPosition = meshRef.current!.getWorldPosition(new THREE.Vector3());
    useGameStore.setState({ 
      player: { 
        ...player, 
        position: { 
          x: worldPosition.x, 
          y: worldPosition.y, 
          z: worldPosition.z 
        }
      }
    });

    // Play footstep sounds when moving
    if (moveDirection.current.lengthSq() > 0 && !isDashing) {
      AudioManager.playFootsteps(true);
    } else {
      AudioManager.playFootsteps(false);
    }

    // Room transition logic
    handleRoomTransitions(currentRoom, worldPosition);
  });

  // Helper function to perform attacks
  const performAttack = (damage: number, range: number, angle: number, knockback: number) => {
    if (!meshRef.current || !currentRoomId) return;
    
    const worldPosition = meshRef.current.getWorldPosition(new THREE.Vector3());
    const forward = attackDirection.current;
    
    const currentRoom = currentLevel?.rooms.find((room) => room.id === currentRoomId);
    if (!currentRoom) return;
    
    // Apply damage to enemies in range and arc
    currentRoom.enemies.forEach((enemy) => {
      const enemyPos = new THREE.Vector3(enemy.position.x, enemy.position.y, enemy.position.z);
      const toEnemy = enemyPos.clone().sub(worldPosition);
      const distance = toEnemy.length();
      
      if (distance <= range) {
        // Check if enemy is within the attack angle
        toEnemy.normalize();
        const dot = forward.dot(toEnemy);
        const angleDeg = Math.acos(dot) * (180 / Math.PI);
        
        if (angleDeg <= angle / 2) {
          // Apply damage with critical chance from player stats
          const stats = ProgressionSystem.getInstance().calculateStats(player);
          const isCritical = Math.random() < stats.criticalChance;
          const finalDamage = isCritical ? 
            Math.floor(damage * stats.criticalDamage) : 
            Math.floor(damage * (1 + stats.strength * 0.1));
          
          // Apply damage to enemy
          enemy.health -= finalDamage;
          
          // Register damage in game store
          updateDamageDealt(finalDamage);
          
          // Apply knockback
          if (knockback > 0) {
            // In a full implementation, you would apply force to the enemy's rigidbody
            // This is a simplified placeholder
            enemy.position.x += toEnemy.x * knockback;
            enemy.position.z += toEnemy.z * knockback;
          }
          
          // Create hit effect
          createHitEffect(enemyPos, finalDamage, isCritical);
          
          // Check if enemy is defeated
          if (enemy.health <= 0) {
            useGameStore.getState().removeEnemy(currentRoomId, enemy.id);
          }
        }
      }
    });
  };
  
  // Helper function to launch cast projectile
  const launchCastProjectile = (position: THREE.Vector3, direction: THREE.Vector3, castData: any) => {
    // In a full implementation, this would create an actual projectile entity
    // For now, we'll use a simple raycasting approach
    
    const raycaster = new THREE.Raycaster(position, direction, 0, castData.range);
    
    // Find enemies in the current room
    const currentRoom = currentLevel?.rooms.find(room => room.id === currentRoomId);
    if (!currentRoom) return;
    
    // Convert enemies to ray-testable objects
    const enemyPositions = currentRoom.enemies.map(enemy => 
      new THREE.Sphere(new THREE.Vector3(enemy.position.x, enemy.position.y, enemy.position.z), 1)
    );
    
    // Check for hit
    let closestHit: { index: number, distance: number } | null = null;
    
    enemyPositions.forEach((sphere, index) => {
      const rayToSphere = new THREE.Vector3().subVectors(sphere.center, position);
      const projection = rayToSphere.dot(direction);
      
      if (projection > 0) { // Only check in front of the ray
        const distanceToCenter = rayToSphere.lengthSq() - projection * projection;
        const radiusSquared = sphere.radius * sphere.radius;
        
        if (distanceToCenter <= radiusSquared) {
          // Calculate actual hit distance
          const hitDistance = projection - Math.sqrt(radiusSquared - distanceToCenter);
          
          if (hitDistance <= castData.range && (!closestHit || hitDistance < closestHit.distance)) {
            closestHit = { index, distance: hitDistance };
          }
        }
      }
    });
    
    // Create visual effect showing projectile travel
    const endPoint = closestHit !== null ? 
      new THREE.Vector3().addVectors(position, direction.clone().multiplyScalar(closestHit.distance)) :
      new THREE.Vector3().addVectors(position, direction.clone().multiplyScalar(castData.range));
    
    createCastVisual(position, endPoint);
    
    // If hit an enemy, apply damage
    if (closestHit !== null) {
      const enemy = currentRoom.enemies[closestHit.index];
      
      // Calculate damage
      const stats = ProgressionSystem.getInstance().calculateStats(player);
      const isCritical = Math.random() < stats.criticalChance;
      const finalDamage = isCritical ? 
        Math.floor(castData.damage * stats.criticalDamage) : 
        Math.floor(castData.damage * (1 + stats.wisdom * 0.1));
      
      // Apply damage
      enemy.health -= finalDamage;
      
      // Register damage in game store
      updateDamageDealt(finalDamage);
      
      // Create hit effect
      createHitEffect(
        new THREE.Vector3(enemy.position.x, enemy.position.y, enemy.position.z),
        finalDamage,
        isCritical
      );
      
      // Check if enemy is defeated
      if (enemy.health <= 0) {
        useGameStore.getState().removeEnemy(currentRoomId, enemy.id);
      }
    }
  };
  
  // Helper function to handle room transitions
  const handleRoomTransitions = (currentRoom: any, worldPosition: THREE.Vector3) => {
    currentRoom.connections.forEach((connectedRoomId: string, index: number) => {
      const doorPosition = index === 0 ? 
        [currentRoom.size.width - 0.5, 1, currentRoom.size.height / 2] : 
        [0.5, 1, currentRoom.size.height / 2];
      
      const distance = worldPosition.distanceTo(
        new THREE.Vector3(doorPosition[0], doorPosition[1], doorPosition[2])
      );
      
      if (distance < 1) {
        setCurrentRoomId(connectedRoomId);
        const newRoom = currentLevel!.rooms.find((room) => room.id === connectedRoomId);
        
        if (newRoom) {
          const newPosition = index === 0 ? 
            [1, 1, newRoom.size.height / 2] : 
            [newRoom.size.width - 1, 1, newRoom.size.height / 2];
          
          rigidBodyRef.current!.setTranslation({ 
            x: newPosition[0], 
            y: newPosition[1], 
            z: newPosition[2] 
          });
        }
      }
    });
  };
  
  // Visual effects for attacks
  const createAttackVisual = (angle: number, range: number) => {
    if (!meshRef.current) return;
    
    // Clear any existing attack trail
    if (attackTrailRef.current && meshRef.current.children.includes(attackTrailRef.current)) {
      meshRef.current.remove(attackTrailRef.current);
    }
    
    // Create a visual arc representing the attack
    const points: THREE.Vector3[] = [];
    const segments = 10;
    const arcAngle = (angle * Math.PI) / 180;
    const startAngle = -arcAngle / 2;
    
    // Create arc of points
    for (let i = 0; i <= segments; i++) {
      const thisAngle = startAngle + (arcAngle * i) / segments;
      const x = Math.sin(thisAngle) * range;
      const z = Math.cos(thisAngle) * range;
      points.push(new THREE.Vector3(x, 0, z));
    }
    
    // Create line geometry
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    
    // Create material based on current weapon
    const color = currentWeapon === 'sword' ? 0x4a9eff : 
                  currentWeapon === 'spear' ? 0x44ff44 : 
                  0xffaa44;
    
    const lineMaterial = new THREE.LineBasicMaterial({ 
      color, 
      linewidth: 3,
      transparent: true,
      opacity: 0.7 
    });
    
    // Create line
    attackTrailRef.current = new THREE.Line(lineGeometry, lineMaterial);
    
    // Add to mesh
    meshRef.current.add(attackTrailRef.current);
    
    // Add particles along the arc
    for (let i = 0; i <= segments; i++) {
      if (i % 2 === 0) { // Only add particles at every other point for performance
        const worldPos = new THREE.Vector3();
        attackTrailRef.current.localToWorld(points[i].clone()).add(worldPos);
        
        // Get particle system
        const particleSystem = ParticleSystem.getInstance(meshRef.current.parent);
        particleSystem.emitParticles('dash', worldPos, 3, 300, 0.2, 0.05);
      }
    }
    
    // Schedule cleanup
    setTimeout(() => {
      if (meshRef.current && attackTrailRef.current) {
        meshRef.current.remove(attackTrailRef.current);
        attackTrailRef.current = null;
      }
    }, attackDuration.current * 1000);
  };
  
  // Visual effects for special attacks
  const createSpecialAttackVisual = (angle: number, range: number) => {
    if (!meshRef.current) return;
    
    // For special attacks, we'll create a more dramatic effect
    
    // Create a full circle for 360-degree attacks, or an arc otherwise
    const isFullCircle = angle >= 360;
    const points: THREE.Vector3[] = [];
    const segments = isFullCircle ? 32 : 16;
    const arcAngle = isFullCircle ? Math.PI * 2 : (angle * Math.PI) / 180;
    const startAngle = isFullCircle ? 0 : -arcAngle / 2;
    
    // Create arc/circle of points
    for (let i = 0; i <= segments; i++) {
      const thisAngle = startAngle + (arcAngle * i) / segments;
      const x = Math.sin(thisAngle) * range;
      const z = Math.cos(thisAngle) * range;
      points.push(new THREE.Vector3(x, 0, z));
    }
    
    // Close the loop for full circles
    if (isFullCircle) {
      points.push(points[0].clone());
    }
    
    // Create line geometry
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    
    // Create material based on current weapon with more intense color
    const color = currentWeapon === 'sword' ? 0x00aaff : 
                  currentWeapon === 'spear' ? 0x00ff00 : 
                  0xff8800;
    
    const lineMaterial = new THREE.LineBasicMaterial({ 
      color, 
      linewidth: 5,
      transparent: true,
      opacity: 0.9 
    });
    
    // Create line
    attackTrailRef.current = new THREE.Line(lineGeometry, lineMaterial);
    
    // Add to mesh
    meshRef.current.add(attackTrailRef.current);
    
    // Add more particles for special attack
    const worldPos = new THREE.Vector3();
    meshRef.current.getWorldPosition(worldPos);
    
    // Get particle system
    const particleSystem = ParticleSystem.getInstance(meshRef.current.parent);
    
    // Emit particles in a circle/arc
    for (let i = 0; i <= segments; i++) {
      const pointPos = points[i].clone();
      const worldPointPos = new THREE.Vector3();
      attackTrailRef.current.localToWorld(pointPos).add(worldPointPos);
      
      particleSystem.emitParticles(
        'hit', 
        worldPointPos, 
        5, 
        500, 
        0.3, 
        0.1, 
        new THREE.Color(color)
      );
    }
    
    // Add a central burst for dramatic effect
    particleSystem.emitParticles(
      'ability', 
      worldPos, 
      20, 
      800, 
      1.0, 
      0.2, 
      new THREE.Color(color)
    );
    
    // Schedule cleanup
    setTimeout(() => {
      if (meshRef.current && attackTrailRef.current) {
        meshRef.current.remove(attackTrailRef.current);
        attackTrailRef.current = null;
      }
    }, attackDuration.current * 1000);
  };
  
  // Visual effect for cast ability
  const createCastVisual = (startPoint: THREE.Vector3, endPoint: THREE.Vector3) => {
    // Create a tracer effect for the cast projectile
    const effectsManager = VisualEffectsManager.getInstance();
    if (effectsManager) {
      effectsManager.createAttackTrail(
        startPoint, 
        endPoint, 
        0x00ffaa, 
        2.0
      );
    }
    
    // Add particle effects along the path
    const particleSystem = ParticleSystem.getInstance();
    if (particleSystem) {
      // Calculate distance and number of particles
      const distance = startPoint.distanceTo(endPoint);
      const steps = Math.max(5, Math.floor(distance * 2));
      
      // Create particles along the path
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const pos = new THREE.Vector3().lerpVectors(startPoint, endPoint, t);
        
        // Add slight random offset for more natural look
        pos.x += (Math.random() - 0.5) * 0.2;
        pos.y += (Math.random() - 0.5) * 0.2;
        pos.z += (Math.random() - 0.5) * 0.2;
        
        particleSystem.emitParticles(
          'ability', 
          pos, 
          1, 
          300, 
          0.2, 
          0.05, 
          new THREE.Color(0x00ffaa)
        );
      }
      
      // Add impact effect at endpoint
      particleSystem.emitParticles(
        'hit', 
        endPoint, 
        15, 
        500, 
        0.5, 
        0.2, 
        new THREE.Color(0x00ffaa)
      );
    }
  };
  
  // Visual effect for hit
  const createHitEffect = (position: THREE.Vector3, damage: number, isCritical: boolean) => {
    // Create particle effect at hit position
    const particleSystem = ParticleSystem.getInstance();
    if (particleSystem) {
      const color = isCritical ? 0xffff00 : 0xff4400;
      const size = isCritical ? 0.3 : 0.2;
      const count = isCritical ? 20 : 10;
      
      particleSystem.emitParticles(
        'hit', 
        position, 
        count, 
        400, 
        size, 
        0.15, 
        new THREE.Color(color)
      );
    }
    
    // Create impact effect using visual effects manager
    const effectsManager = VisualEffectsManager.getInstance();
    if (effectsManager) {
      effectsManager.createImpactEffect(
        position,
        isCritical ? 0xffff00 : 0xff4400,
        isCritical ? 1.5 : 1.0
      );
    }
    
    // Play hit sound with variation based on critical
    AudioManager.playSound('hit', {
      rate: isCritical ? 1.2 : 1.0,
      volume: isCritical ? 0.7 : 0.5
    });
  };
  
  // Visual effect for dash
  const createDashVisual = () => {
    if (!meshRef.current) return;
    
    const worldPos = new THREE.Vector3();
    meshRef.current.getWorldPosition(worldPos);
    
    // Get particle system
    const particleSystem = ParticleSystem.getInstance(meshRef.current.parent);
    
    // Create dash trail
    const dashDirection = moveDirection.current.clone();
    const endPoint = new THREE.Vector3(
      worldPos.x + dashDirection.x * 3,
      worldPos.y,
      worldPos.z + dashDirection.z * 3
    );
    
    // Create particles along the dash path
    for (let i = 0; i < 10; i++) {
      const t = i / 10;
      const pos = new THREE.Vector3().lerpVectors(worldPos, endPoint, t);
      
      particleSystem.emitParticles(
        'dash', 
        pos, 
        3, 
        300, 
        0.2, 
        0.05, 
        new THREE.Color(0x4a9eff)
      );
    }
    
    // Add a flash effect using visual effects manager
    const effectsManager = VisualEffectsManager.getInstance();
    if (effectsManager) {
      effectsManager.createAttackTrail(
        worldPos, 
        endPoint, 
        0x4a9eff, 
        1.0
      );
    }
  };

  return (
    <RigidBody
      ref={rigidBodyRef}
      type="dynamic"
      position={[0, 1, 0]}
      mass={1}
      friction={0.7}
      restitution={0.2}
      lockRotations
      enabledRotations={[false, false, false]}
    >
      <CapsuleCollider args={[0.5, 0.5]} friction={1} />
      <group ref={meshRef}>
        {/* Player model */}
        <mesh castShadow>
          <capsuleGeometry args={[0.5, 1, 4, 8]} />
          <meshStandardMaterial 
            color={isDashing ? "#6a9eff" : "#4a9eff"} 
            emissive={isDashing ? "#4a9eff" : "#000000"} 
            emissiveIntensity={isDashing ? 0.5 : 0} 
          />
        </mesh>
        
        {/* Weapon model - changes based on currently equipped weapon */}
        {currentWeapon === 'sword' && (
          <mesh position={[0.7, 0, 0.2]} rotation={[0, 0, Math.PI / 4]} castShadow>
            <boxGeometry args={[0.2, 1.2, 0.2]} />
            <meshStandardMaterial color="#666666" />
          </mesh>
        )}
        
        {currentWeapon === 'spear' && (
          <mesh position={[0.7, 0, 1.0]} rotation={[Math.PI / 2, 0, Math.PI / 4]} castShadow>
            <cylinderGeometry args={[0.05, 0.05, 2.5, 8]} />
            <meshStandardMaterial color="#888888" />
            <mesh position={[0, 1.1, 0]}>
              <coneGeometry args={[0.15, 0.5, 8]} />
              <meshStandardMaterial color="#aaaaaa" />
            </mesh>
          </mesh>
        )}
        
        {currentWeapon === 'gauntlets' && (
          <group>
            <mesh position={[0.6, 0, 0.2]} castShadow>
              <boxGeometry args={[0.3, 0.3, 0.6]} />
              <meshStandardMaterial color="#aa6633" />
            </mesh>
            <mesh position={[-0.6, 0, 0.2]} castShadow>
              <boxGeometry args={[0.3, 0.3, 0.6]} />
              <meshStandardMaterial color="#aa6633" />
            </mesh>
          </group>
        )}
        
        {/* Attack effect placeholder - this will be dynamically created/removed during attacks */}
      </group>
    </RigidBody>
  );
}