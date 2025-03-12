import * as THREE from 'three';
import { ParticleSystem, Vector3 } from '../types/game';

export class ParticleEngine {
  private static instance: ParticleEngine;
  private scene: THREE.Scene | null = null;

  public static getInstance(): ParticleEngine {
    if (!ParticleEngine.instance) ParticleEngine.instance = new ParticleEngine();
    return ParticleEngine.instance;
  }

  setScene(scene: THREE.Scene) {
    this.scene = scene;
  }

  createEffect(type: string, position: THREE.Vector3) {
    if (!this.scene) return;
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([position.x, position.y, position.z]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    const material = new THREE.PointsMaterial({ color: 0xff0000, size: 0.1 });
    const points = new THREE.Points(geometry, material);
    this.scene.add(points);
    setTimeout(() => this.scene?.remove(points), 1000); // Remove after 1 second
  }
}