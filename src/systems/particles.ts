import * as THREE from 'three';
import { ParticleSystem, Vector3 } from '../types/game';

export class ParticleEngine {
  private static instance: ParticleEngine;
  private particles: THREE.Points[] = [];
  private scene: THREE.Scene;

  private constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  static getInstance(scene: THREE.Scene): ParticleEngine {
    if (!ParticleEngine.instance) {
      ParticleEngine.instance = new ParticleEngine(scene);
    }
    return ParticleEngine.instance;
  }

  createParticleEffect(config: ParticleSystem): void {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.count * 3);
    const velocities = new Float32Array(config.count * 3);
    const colors = new Float32Array(config.count * 3);

    const color = new THREE.Color(config.color);

    for (let i = 0; i < config.count; i++) {
      const i3 = i * 3;
      
      // Position
      positions[i3] = config.position.x + (Math.random() - 0.5) * config.spread;
      positions[i3 + 1] = config.position.y + (Math.random() - 0.5) * config.spread;
      positions[i3 + 2] = config.position.z + (Math.random() - 0.5) * config.spread;

      // Velocity
      velocities[i3] = (Math.random() - 0.5) * 2;
      velocities[i3 + 1] = Math.random() * 2;
      velocities[i3 + 2] = (Math.random() - 0.5) * 2;

      // Color
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: config.size,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geometry, material);
    this.scene.add(points);
    this.particles.push(points);

    // Remove particles after duration
    setTimeout(() => {
      this.scene.remove(points);
      this.particles = this.particles.filter(p => p !== points);
    }, config.duration);
  }

  update(deltaTime: number): void {
    this.particles.forEach(points => {
      const positions = points.geometry.attributes.position;
      const velocities = points.geometry.attributes.velocity;

      for (let i = 0; i < positions.count; i++) {
        const i3 = i * 3;

        positions.array[i3] += velocities.array[i3] * deltaTime;
        positions.array[i3 + 1] += velocities.array[i3 + 1] * deltaTime;
        positions.array[i3 + 2] += velocities.array[i3 + 2] * deltaTime;

        // Add gravity
        velocities.array[i3 + 1] -= 9.8 * deltaTime;
      }

      positions.needsUpdate = true;
    });
  }
}