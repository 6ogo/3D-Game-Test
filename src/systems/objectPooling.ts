import * as THREE from "three";

/**
 * ObjectPool - Generic object pooling system for performance optimization
 *
 * Efficiently manages the creation, reuse, and cleanup of frequently used objects
 * such as projectiles, particles, enemies, and effects to minimize garbage collection.
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private activeObjects: Set<T> = new Set();
  private createFn: () => T;
  private resetFn: (obj: T) => void;
  private maxSize: number;

  /**
   * Create a new object pool
   * @param createFn Function to create a new object
   * @param resetFn Function to reset an object to its initial state
   * @param initialSize Initial number of objects to create
   * @param maxSize Maximum pool size (0 for unlimited)
   */
  constructor(
    createFn: () => T,
    resetFn: (obj: T) => void,
    initialSize: number = 0,
    maxSize: number = 0
  ) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;

    // Initialize pool with objects
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createFn());
    }
  }

  /**
   * Get an object from the pool or create a new one
   */
  get(): T {
    let object: T;

    if (this.pool.length > 0) {
      // Reuse an existing object
      object = this.pool.pop()!;
    } else {
      // Create a new object
      object = this.createFn();
    }

    // Mark as active
    this.activeObjects.add(object);

    return object;
  }

  /**
   * Return an object to the pool
   */
  release(object: T): void {
    if (!this.activeObjects.has(object)) {
      console.warn("Attempting to release an object not managed by this pool");
      return;
    }

    // Reset the object to its initial state
    this.resetFn(object);

    // Remove from active objects
    this.activeObjects.delete(object);

    // Add back to the pool if not exceeding max size
    if (this.maxSize === 0 || this.pool.length < this.maxSize) {
      this.pool.push(object);
    }
  }

  /**
   * Release all active objects
   */
  releaseAll(): void {
    this.activeObjects.forEach((object) => {
      this.resetFn(object);
      this.pool.push(object);
    });
    this.activeObjects.clear();
  }

  /**
   * Get number of active objects
   */
  getActiveCount(): number {
    return this.activeObjects.size;
  }

  /**
   * Get number of objects in the pool (available for reuse)
   */
  getPoolSize(): number {
    return this.pool.length;
  }

  /**
   * Prewarm the pool by creating additional objects
   */
  prewarm(count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.maxSize === 0 || this.pool.length < this.maxSize) {
        this.pool.push(this.createFn());
      }
    }
  }

  /**
   * Clear the pool and release all resources
   */
  clear(): void {
    this.pool = [];
    this.activeObjects.clear();
  }
}

/**
 * ProjectileManager - Manages projectiles using object pooling
 */
export class ProjectileManager {
  private static instance: ProjectileManager;
  private scene: THREE.Scene;
  private projectilePool: ObjectPool<THREE.Object3D>;
  private projectiles: Map<
    THREE.Object3D,
    {
      velocity: THREE.Vector3;
      lifespan: number;
      damage: number;
      owner: "player" | "enemy";
      spawnTime: number;
    }
  > = new Map();

  /**
   * Create the projectile manager
   */
  private constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Create the projectile pool
    this.projectilePool = new ObjectPool<THREE.Object3D>(
      // Create function
      () => this.createProjectile(),
      // Reset function
      (projectile) => this.resetProjectile(projectile),
      // Initial size
      50,
      // Max size
      200
    );

    // Prewarm the pool
    this.projectilePool.prewarm(50);
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(scene?: THREE.Scene): ProjectileManager {
    if (!ProjectileManager.instance && scene) {
      ProjectileManager.instance = new ProjectileManager(scene);
    }
    return ProjectileManager.instance;
  }

  /**
   * Create a new projectile
   */
  private createProjectile(): THREE.Object3D {
    // Create different projectile types based on owner or effect
    const geometry = new THREE.SphereGeometry(0.3, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const projectile = new THREE.Mesh(geometry, material);

    // Add a point light for glow effect
    const light = new THREE.PointLight(0x00ffff, 1, 5);
    light.position.set(0, 0, 0);
    projectile.add(light);

    projectile.visible = false;
    return projectile;
  }

  /**
   * Reset a projectile to its initial state
   */
  private resetProjectile(projectile: THREE.Object3D): void {
    projectile.visible = false;
    projectile.position.set(0, 0, 0);
    projectile.rotation.set(0, 0, 0);
    projectile.scale.set(1, 1, 1);

    // Remove from scene
    this.scene.remove(projectile);

    // Remove from active projectiles
    this.projectiles.delete(projectile);
  }

  /**
   * Spawn a new projectile
   */
  spawnProjectile(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    speed: number,
    lifespan: number,
    damage: number,
    owner: "player" | "enemy" = "player"
  ): THREE.Object3D {
    // Get a projectile from the pool
    const projectile = this.projectilePool.get();

    // Set position
    projectile.position.copy(position);

    // Set color based on owner
    if (projectile instanceof THREE.Mesh) {
      const material = projectile.material as THREE.MeshBasicMaterial;
      material.color.set(owner === "player" ? 0x00ffff : 0xff4400);

      // Also update the light color
      const light = projectile.children[0] as THREE.PointLight;
      light.color.set(owner === "player" ? 0x00ffff : 0xff4400);
    }

    // Add to scene
    this.scene.add(projectile);

    // Make visible
    projectile.visible = true;

    // Store projectile data
    this.projectiles.set(projectile, {
      velocity: direction.clone().normalize().multiplyScalar(speed),
      lifespan,
      damage,
      owner,
      spawnTime: Date.now(),
    });

    return projectile;
  }

  /**
   * Update all projectiles
   */
  update(): void {
    const now = Date.now();

    // Update each active projectile
    this.projectiles.forEach((data, projectile) => {
      // Check if expired
      if (now - data.spawnTime > data.lifespan) {
        // Release back to pool
        this.projectilePool.release(projectile);
        return;
      }

      // Update position
      projectile.position.add(data.velocity);

      // Check collisions (simplified - would use actual collision system in real game)
      const hit = this.checkCollision(projectile, data.owner);
      if (hit) {
        // Handle hit
        this.handleHit(projectile, hit, data);

        // Release back to pool
        this.projectilePool.release(projectile);
      }
    });
  }

  /**
   * Check for collision
   */
  private checkCollision(
    projectile: THREE.Object3D,
    owner: "player" | "enemy"
  ): THREE.Object3D | null {
    // This is a simplified collision check
    // In a real game, you'd use a proper physics/collision system

    // Simplified: Get all potential targets
    const targets = owner === "player" ? this.getEnemies() : this.getPlayer();

    // Check distance to each target
    for (const target of targets) {
      const distance = projectile.position.distanceTo(target.position);
      if (distance < 1) {
        // 1 unit collision radius
        return target;
      }
    }

    return null;
  }

  /**
   * Handle a hit
   */
  private handleHit(
    projectile: THREE.Object3D,
    hit: THREE.Object3D,
    data: any
  ): void {
    // This would integrate with your game's damage system
    console.log(`Hit ${hit.name} for ${data.damage} damage!`);

    // Spawn hit effect
    this.spawnHitEffect(projectile.position.clone(), data.owner);
  }

  /**
   * Spawn a hit effect
   */
  private spawnHitEffect(
    position: THREE.Vector3,
    owner: "player" | "enemy"
  ): void {
    // This would use the ParticleSystem in a real implementation
    // For now, just log it
    console.log(
      `Spawn hit effect at ${position.x}, ${position.y}, ${position.z}`
    );
  }

  /**
   * Get all enemies (simplified - would integrate with entity system)
   */
  private getEnemies(): THREE.Object3D[] {
    // This would integrate with your game's entity system
    // For now, return an empty array
    return [];
  }

  /**
   * Get player (simplified - would integrate with entity system)
   */
  private getPlayer(): THREE.Object3D[] {
    // This would integrate with your game's entity system
    // For now, return an empty array
    return [];
  }
}

/**
 * ParticleSystem - Manages particle effects using object pooling
 */
export class ParticleSystem {
  private static instance: ParticleSystem;
  private scene: THREE.Scene;

  // Different pools for different particle types
  private hitParticlePool: ObjectPool<THREE.Object3D>;
  private dashParticlePool: ObjectPool<THREE.Object3D>;
  private deathParticlePool: ObjectPool<THREE.Object3D>;
  private fireParticlePool: ObjectPool<THREE.Object3D>;

  // Track active particles
  private activeParticles: Map<
    THREE.Object3D,
    {
      lifespan: number;
      spawnTime: number;
      velocity: THREE.Vector3;
      type: string;
    }
  > = new Map();

  /**
   * Create the particle system
   */
  private constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Create particle pools for different effects
    this.hitParticlePool = new ObjectPool<THREE.Object3D>(
      () => this.createParticle("hit"),
      (particle) => this.resetParticle(particle),
      100,
      500
    );

    this.dashParticlePool = new ObjectPool<THREE.Object3D>(
      () => this.createParticle("dash"),
      (particle) => this.resetParticle(particle),
      50,
      200
    );

    this.deathParticlePool = new ObjectPool<THREE.Object3D>(
      () => this.createParticle("death"),
      (particle) => this.resetParticle(particle),
      20,
      100
    );

    this.fireParticlePool = new ObjectPool<THREE.Object3D>(
      () => this.createParticle("fire"),
      (particle) => this.resetParticle(particle),
      50,
      200
    );

    // Prewarm pools
    this.hitParticlePool.prewarm(50);
    this.dashParticlePool.prewarm(20);
    this.deathParticlePool.prewarm(10);
    this.fireParticlePool.prewarm(20);
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(scene?: THREE.Scene): ParticleSystem {
    if (!ParticleSystem.instance && scene) {
      ParticleSystem.instance = new ParticleSystem(scene);
    }
    return ParticleSystem.instance;
  }

  /**
   * Create a new particle
   */
  private createParticle(type: string): THREE.Object3D {
    let particle: THREE.Object3D;

    switch (type) {
      case "hit":
        // Hit effect - small red spark
        const hitGeometry = new THREE.SphereGeometry(0.1, 4, 4);
        const hitMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        particle = new THREE.Mesh(hitGeometry, hitMaterial);
        break;

      case "dash":
        // Dash effect - blue trail
        const dashGeometry = new THREE.SphereGeometry(0.15, 4, 4);
        const dashMaterial = new THREE.MeshBasicMaterial({ color: 0x00aaff });
        particle = new THREE.Mesh(dashGeometry, dashMaterial);
        break;

      case "death":
        // Death effect - larger explosion
        const deathGeometry = new THREE.SphereGeometry(0.3, 8, 8);
        const deathMaterial = new THREE.MeshBasicMaterial({ color: 0xff6600 });
        particle = new THREE.Mesh(deathGeometry, deathMaterial);

        // Add a point light
        const light = new THREE.PointLight(0xff6600, 1, 5);
        light.position.set(0, 0, 0);
        particle.add(light);
        break;

      case "fire":
        // Fire effect - yellow/orange
        const fireGeometry = new THREE.SphereGeometry(0.2, 6, 6);
        const fireMaterial = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        particle = new THREE.Mesh(fireGeometry, fireMaterial);
        break;

      default:
        // Default fallback
        const defaultGeometry = new THREE.SphereGeometry(0.1, 4, 4);
        const defaultMaterial = new THREE.MeshBasicMaterial({
          color: 0xffffff,
        });
        particle = new THREE.Mesh(defaultGeometry, defaultMaterial);
    }

    particle.visible = false;
    return particle;
  }

  /**
   * Reset a particle to its initial state
   */
  private resetParticle(particle: THREE.Object3D): void {
    particle.visible = false;
    particle.position.set(0, 0, 0);
    particle.rotation.set(0, 0, 0);
    particle.scale.set(1, 1, 1);

    // Remove from scene
    this.scene.remove(particle);

    // Remove from active particles
    this.activeParticles.delete(particle);
  }

  /**
   * Emit particles
   */
  emitParticles(
    type: "hit" | "dash" | "death" | "fire" | "heal" | "buff",
    position: THREE.Vector3,
    count: number,
    lifespan: number,
    spread: number = 1,
    speed: number = 0.1,
    color?: THREE.Color
  ): void {
    // Get the appropriate pool
    let pool: ObjectPool<THREE.Object3D>;
    switch (type) {
      case "hit":
        pool = this.hitParticlePool;
        break;
      case "dash":
        pool = this.dashParticlePool;
        break;
      case "death":
        pool = this.deathParticlePool;
        break;
      case "fire":
        pool = this.fireParticlePool;
        break;
      default:
        pool = this.hitParticlePool;
    }

    // Spawn multiple particles
    for (let i = 0; i < count; i++) {
      // Get a particle from the pool
      const particle = pool.get();

      // Set position with random offset for spread
      const offsetX = (Math.random() - 0.5) * spread;
      const offsetY = (Math.random() - 0.5) * spread;
      const offsetZ = (Math.random() - 0.5) * spread;
      particle.position
        .copy(position)
        .add(new THREE.Vector3(offsetX, offsetY, offsetZ));

      // Set random velocity
      const vx = (Math.random() - 0.5) * speed * 2;
      const vy = Math.random() * speed * 2; // Upward bias
      const vz = (Math.random() - 0.5) * speed * 2;
      const velocity = new THREE.Vector3(vx, vy, vz);

      // Set random size variation
      const scale = 0.8 + Math.random() * 0.4;
      particle.scale.set(scale, scale, scale);

      // Set color if provided
      if (color && particle instanceof THREE.Mesh) {
        const material = particle.material as THREE.MeshBasicMaterial;
        material.color.copy(color);

        // Also update light if it has one
        if (
          particle.children.length > 0 &&
          particle.children[0] instanceof THREE.PointLight
        ) {
          const light = particle.children[0] as THREE.PointLight;
          light.color.copy(color);
        }
      }

      // Add to scene
      this.scene.add(particle);

      // Make visible
      particle.visible = true;

      // Store particle data
      this.activeParticles.set(particle, {
        lifespan,
        spawnTime: Date.now(),
        velocity,
        type,
      });
    }
  }

  /**
   * Update all particles
   */
  update(): void {
    const now = Date.now();

    // Update each active particle
    this.activeParticles.forEach((data, particle) => {
      // Check if expired
      const age = now - data.spawnTime;
      if (age > data.lifespan) {
        // Release back to pool
        this.getPoolForType(data.type).release(particle);
        return;
      }

      // Update position based on velocity
      particle.position.add(data.velocity);

      // Calculate fade factor (0 to 1, where 1 is full opacity)
      const fadeFactor = 1 - age / data.lifespan;

      // Apply fade
      if (particle instanceof THREE.Mesh) {
        const material = particle.material as THREE.MeshBasicMaterial;
        material.opacity = fadeFactor;
        material.transparent = true;

        // Scale down over time
        const scale = fadeFactor * (0.8 + Math.random() * 0.2);
        particle.scale.set(scale, scale, scale);

        // Also update light intensity if it has one
        if (
          particle.children.length > 0 &&
          particle.children[0] instanceof THREE.PointLight
        ) {
          const light = particle.children[0] as THREE.PointLight;
          light.intensity = fadeFactor;
        }
      }
    });
  }

  /**
   * Get the appropriate pool for a particle type
   */
  private getPoolForType(type: string): ObjectPool<THREE.Object3D> {
    switch (type) {
      case "hit":
        return this.hitParticlePool;
      case "dash":
        return this.dashParticlePool;
      case "death":
        return this.deathParticlePool;
      case "fire":
        return this.fireParticlePool;
      default:
        return this.hitParticlePool;
    }
  }

  /**
   * Create a hit effect at the specified position
   */
  createHitEffect(
    position: THREE.Vector3,
    color: THREE.Color = new THREE.Color(0xff0000)
  ): void {
    this.emitParticles("hit", position, 15, 500, 0.5, 0.15, color);
  }

  /**
   * Create a dash effect
   */
  createDashEffect(position: THREE.Vector3, direction: THREE.Vector3): void {
    // Create particles along the dash path
    const dashLength = 5;
    const stepCount = 10;

    for (let i = 0; i < stepCount; i++) {
      const t = i / stepCount;
      const pos = position
        .clone()
        .add(direction.clone().multiplyScalar(t * dashLength));

      // Fewer particles per step as we move away from the player
      const count = Math.floor(5 * (1 - t));
      if (count > 0) {
        this.emitParticles("dash", pos, count, 300 + t * 300, 0.3, 0.05);
      }
    }
  }

  /**
   * Create a death effect
   */
  createDeathEffect(position: THREE.Vector3, size: number = 1): void {
    // Multiple particle bursts for a bigger effect
    this.emitParticles("death", position, 30, 1000, size, 0.2);

    // Add some fire particles
    this.emitParticles("fire", position, 20, 800, size * 0.8, 0.15);
  }

  /**
   * Create a fire effect
   */
  createFireEffect(position: THREE.Vector3, duration: number = 2000): void {
    // Initial burst
    this.emitParticles("fire", position, 10, duration, 0.3, 0.1);

    // Continuous emission
    const emitInterval = 100; // ms
    let elapsedTime = 0;

    const emitFire = () => {
      if (elapsedTime >= duration) return;

      // Emit a few particles
      this.emitParticles("fire", position, 3, 500, 0.3, 0.1);

      // Schedule next emission
      elapsedTime += emitInterval;
      setTimeout(emitFire, emitInterval);
    };

    // Start emission
    emitFire();
  }
}

/**
 * EnemyPool - Manages reusable enemy objects
 */
export class EnemyPool {
  private static instance: EnemyPool;
  private scene: THREE.Scene;

  // Pools for different enemy types
  private minionPool: ObjectPool<THREE.Object3D>;
  private elitePool: ObjectPool<THREE.Object3D>;
  private bossPool: ObjectPool<THREE.Object3D>;

  // Active enemies
  private activeEnemies: Map<
    THREE.Object3D,
    {
      type: string;
      health: number;
      maxHealth: number;
      id: string;
    }
  > = new Map();

  /**
   * Create the enemy pool
   */
  private constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Create pools for different enemy types
    this.minionPool = new ObjectPool<THREE.Object3D>(
      () => this.createEnemy("minion"),
      (enemy) => this.resetEnemy(enemy),
      20,
      100
    );

    this.elitePool = new ObjectPool<THREE.Object3D>(
      () => this.createEnemy("elite"),
      (enemy) => this.resetEnemy(enemy),
      5,
      20
    );

    this.bossPool = new ObjectPool<THREE.Object3D>(
      () => this.createEnemy("boss"),
      (enemy) => this.resetEnemy(enemy),
      1,
      5
    );

    // Prewarm pools
    this.minionPool.prewarm(10);
    this.elitePool.prewarm(3);
    this.bossPool.prewarm(1);
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(scene?: THREE.Scene): EnemyPool {
    if (!EnemyPool.instance && scene) {
      EnemyPool.instance = new EnemyPool(scene);
    }
    return EnemyPool.instance;
  }

  /**
   * Create a new enemy
   */
  private createEnemy(type: string): THREE.Object3D {
    let enemy: THREE.Object3D;

    switch (type) {
      case "minion":
        enemy = new THREE.Group();

        // Body
        const body = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.5, 1, 4, 8),
          new THREE.MeshStandardMaterial({ color: 0xff4400 })
        );
        body.position.y = 0.5;
        body.castShadow = true;

        enemy.add(body);
        break;

      case "elite":
        enemy = new THREE.Group();

        // Larger body
        const eliteBody = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.7, 1.4, 4, 8),
          new THREE.MeshStandardMaterial({ color: 0xaa00ff })
        );
        eliteBody.position.y = 0.7;
        eliteBody.castShadow = true;

        // Add glowing eyes
        const eyesMaterial = new THREE.MeshBasicMaterial({ color: 0xff00ff });
        const leftEye = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, 8, 8),
          eyesMaterial
        );
        const rightEye = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, 8, 8),
          eyesMaterial
        );
        leftEye.position.set(-0.2, 1.2, 0.4);
        rightEye.position.set(0.2, 1.2, 0.4);

        enemy.add(eliteBody, leftEye, rightEye);
        break;

      case "boss":
        enemy = new THREE.Group();

        // Main body
        const bossBody = new THREE.Mesh(
          new THREE.CapsuleGeometry(1.2, 2, 8, 16),
          new THREE.MeshStandardMaterial({ color: 0xff0000 })
        );
        bossBody.position.y = 1;
        bossBody.castShadow = true;

        // Armor pieces
        const armor = new THREE.Mesh(
          new THREE.BoxGeometry(1.8, 0.5, 1.2),
          new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 })
        );
        armor.position.y = 1;

        // Glowing elements
        const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xff2200 });
        const core = new THREE.Mesh(
          new THREE.SphereGeometry(0.3, 16, 16),
          glowMaterial
        );
        core.position.y = 1.2;

        // Add a point light
        const light = new THREE.PointLight(0xff2200, 1, 5);
        light.position.y = 1.2;

        enemy.add(bossBody, armor, core, light);
        break;

      default:
        // Default fallback
        enemy = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshStandardMaterial({ color: 0xff0000 })
        );
        enemy.castShadow = true;
    }

    enemy.visible = false;
    return enemy;
  }

  /**
   * Reset an enemy to its initial state
   */
  private resetEnemy(enemy: THREE.Object3D): void {
    enemy.visible = false;
    enemy.position.set(0, 0, 0);
    enemy.rotation.set(0, 0, 0);
    enemy.scale.set(1, 1, 1);

    // Remove from scene
    this.scene.remove(enemy);

    // Remove from active enemies
    this.activeEnemies.delete(enemy);

    // If it has a health bar or other UI elements, reset those too
    // Would be handled by your game's UI system
  }

  /**
   * Spawn an enemy
   */
  spawnEnemy(
    type: "minion" | "elite" | "boss",
    position: THREE.Vector3,
    id: string
  ): THREE.Object3D {
    // Get the appropriate pool
    let pool: ObjectPool<THREE.Object3D>;
    let health: number;
    let maxHealth: number;

    switch (type) {
      case "minion":
        pool = this.minionPool;
        health = maxHealth = 100;
        break;
      case "elite":
        pool = this.elitePool;
        health = maxHealth = 200;
        break;
      case "boss":
        pool = this.bossPool;
        health = maxHealth = 1000;
        break;
      default:
        pool = this.minionPool;
        health = maxHealth = 100;
    }

    // Get an enemy from the pool
    const enemy = pool.get();

    // Set position
    enemy.position.copy(position);

    // Add to scene
    this.scene.add(enemy);

    // Make visible
    enemy.visible = true;

    // Store enemy data
    this.activeEnemies.set(enemy, {
      type,
      health,
      maxHealth,
      id,
    });

    return enemy;
  }

  /**
   * Apply damage to an enemy
   */
  applyDamage(enemy: THREE.Object3D, damage: number): boolean {
    // Get enemy data
    const data = this.activeEnemies.get(enemy);
    if (!data) {
      console.warn("Attempting to damage an enemy not managed by this pool");
      return false;
    }

    // Apply damage
    data.health -= damage;

    // Check if dead
    if (data.health <= 0) {
      // Release back to pool
      switch (data.type) {
        case "minion":
          this.minionPool.release(enemy);
          break;
        case "elite":
          this.elitePool.release(enemy);
          break;
        case "boss":
          this.bossPool.release(enemy);
          break;
      }
      return true;
    }

    // Update UI (health bar, etc.)
    // Would be handled by your game's UI system

    return false;
  }

  /**
   * Get an enemy by ID
   */
  getEnemyById(id: string): THREE.Object3D | null {
    for (const [enemy, data] of this.activeEnemies.entries()) {
      if (data.id === id) {
        return enemy;
      }
    }
    return null;
  }

  /**
   * Get all active enemies
   */
  getAllActiveEnemies(): THREE.Object3D[] {
    return Array.from(this.activeEnemies.keys());
  }

  /**
   * Get enemy data
   */
  getEnemyData(enemy: THREE.Object3D): any | null {
    return this.activeEnemies.get(enemy) || null;
  }
}
