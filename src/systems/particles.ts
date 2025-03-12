import * as THREE from 'three';
import { ParticleSystem } from '../types/game';

export class ParticleEngine {
  private static instance: ParticleEngine;
  private scene: THREE.Scene | null = null;
  private particleSystems: Map<string, {
    particles: THREE.Points,
    data: ParticleSystem,
    startTime: number
  }> = new Map();

  private constructor() {}

  public static getInstance(): ParticleEngine {
    if (!ParticleEngine.instance) ParticleEngine.instance = new ParticleEngine();
    return ParticleEngine.instance;
  }

  setScene(scene: THREE.Scene) {
    this.scene = scene;
  }

  createEffect(params: ParticleSystem): ParticleSystem {
    if (!this.scene) return params;

    const { id, type, position, color, size, spread, count } = params;
    
    // Create particles geometry
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const colorObj = new THREE.Color(color);
    
    // Initialize particles with random positions within spread
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      
      // Position with random spread around center
      positions[i3] = position.x + (Math.random() - 0.5) * spread;
      positions[i3 + 1] = position.y + (Math.random() - 0.5) * spread;
      positions[i3 + 2] = position.z + (Math.random() - 0.5) * spread;
      
      // Random velocity based on effect type
      velocities[i3] = (Math.random() - 0.5) * 2;
      velocities[i3 + 1] = Math.random() * 2; // Upward bias
      velocities[i3 + 2] = (Math.random() - 0.5) * 2;
      
      // Colors with slight variation
      colors[i3] = colorObj.r;
      colors[i3 + 1] = colorObj.g;
      colors[i3 + 2] = colorObj.b;
      
      // Adjust for effect type
      switch (type) {
        case 'hit':
          // Explode outward
          velocities[i3] *= 3;
          velocities[i3 + 1] *= 3;
          velocities[i3 + 2] *= 3;
          break;
        case 'heal':
          // Float upward
          velocities[i3] *= 0.5;
          velocities[i3 + 1] = Math.random() * 3;
          velocities[i3 + 2] *= 0.5;
          break;
        case 'buff':
          // Spiral around
          const angle = Math.random() * Math.PI * 2;
          velocities[i3] = Math.cos(angle) * 2;
          velocities[i3 + 2] = Math.sin(angle) * 2;
          break;
      }
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    // Create particle material
    const material = new THREE.PointsMaterial({
      size,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    
    // Create particle system
    const particles = new THREE.Points(geometry, material);
    particles.userData.velocities = velocities;
    this.scene.add(particles);
    
    // Store in our system
    this.particleSystems.set(id, {
      particles,
      data: params,
      startTime: Date.now()
    });
    
    return params;
  }
  
  update(deltaTime: number) {
    if (!this.scene) return;
    
    const now = Date.now();
    
    // Process each particle system
    this.particleSystems.forEach((system, id) => {
      const { particles, data, startTime } = system;
      const { duration } = data;
      
      // Calculate age of particle system
      const age = (now - startTime) / 1000;
      
      // Remove if expired
      if (age > duration / 1000) {
        this.scene!.remove(particles);
        this.particleSystems.delete(id);
        return;
      }
      
      // Update particles
      const positions = particles.geometry.attributes.position.array as Float32Array;
      const velocities = particles.userData.velocities;
      const colors = particles.geometry.attributes.color.array as Float32Array;
      
      // Age factor (0 -> 1) where 1 is end of life
      const ageFactor = age / (duration / 1000);
      
      // Update each particle
      for (let i = 0; i < data.count; i++) {
        const i3 = i * 3;
        
        // Update position based on velocity
        positions[i3] += velocities[i3] * deltaTime;
        positions[i3 + 1] += velocities[i3 + 1] * deltaTime;
        positions[i3 + 2] += velocities[i3 + 2] * deltaTime;
        
        // Apply gravity for some effect types
        if (data.type === 'hit' || data.type === 'ability') {
          velocities[i3 + 1] -= 9.8 * deltaTime; // gravity
        }
        
        // Fade out color/opacity as particle ages
        if (ageFactor > 0.7) {
          const fadeout = 1 - ((ageFactor - 0.7) / 0.3);
          colors[i3] *= fadeout;
          colors[i3 + 1] *= fadeout;
          colors[i3 + 2] *= fadeout;
        }
      }
      
      // Mark attributes as needing update
      particles.geometry.attributes.position.needsUpdate = true;
      particles.geometry.attributes.color.needsUpdate = true;
      
      // Update material opacity based on age
      (particles.material as THREE.PointsMaterial).opacity = 1 - ageFactor;
    });
  }
}