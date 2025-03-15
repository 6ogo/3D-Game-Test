import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Custom effect shaders
import { GodRayShader } from './shaders/GodRayShader.js';
import { ChromaticAberrationShader } from './shaders/ChromaticAberrationShader.js';
import { VignetteShader } from './shaders/VignetteShader.js';
import { PixelShader } from './shaders/PixelShader.js';
import { ShakeShader } from './shaders/ShakeShader.js';
import { FeedbackShader } from './shaders/FeedbackShader.js';

// Default settings for visual effects
const DEFAULT_SETTINGS = {
  bloom: {
    enabled: true,
    strength: 1.0,
    radius: 0.7,
    threshold: 0.8
  },
  chromatic: {
    enabled: true,
    intensity: 0.003,
    animated: true
  },
  vignette: {
    enabled: true,
    darkness: 0.6,
    offset: 0.9
  },
  godray: {
    enabled: false,
    exposure: 0.3,
    decay: 0.95,
    density: 0.8,
    weight: 0.6
  },
  shake: {
    enabled: false,
    intensity: 0.01,
    decay: 0.95
  },
  feedback: {
    enabled: false,
    intensity: 0.15,
    animated: false
  },
  pixel: {
    enabled: false,
    pixelSize: 4
  }
};

/**
 * Visual effects for different room types
 */
const ROOM_EFFECT_PRESETS: Record<string, Partial<typeof DEFAULT_SETTINGS>> = {
  normal: {
    bloom: { enabled: true, strength: 0.8, radius: 0.6, threshold: 0.85 },
    chromatic: { enabled: true, intensity: 0.002, animated: false },
    vignette: { enabled: true, darkness: 0.5, offset: 0.9 }
  },
  elite: {
    bloom: { enabled: true, strength: 1.2, radius: 0.8, threshold: 0.85 },
    chromatic: { enabled: true, intensity: 0.005, animated: true },
    vignette: { enabled: true, darkness: 0.7, offset: 0.9 },
    feedback: { enabled: true, intensity: 0.1, animated: false }
  },
  treasure: {
    bloom: { enabled: true, strength: 1.5, radius: 0.9, threshold: 0.85 },
    chromatic: { enabled: true, intensity: 0.002, animated: false },
    vignette: { enabled: true, darkness: 0.4, offset: 0.9 },
    godray: { enabled: true, exposure: 0.3, decay: 0.95, density: 0.8, weight: 0.6 }
  },
  boss: {
    bloom: { enabled: true, strength: 1.3, radius: 0.8, threshold: 0.85 },
    chromatic: { enabled: true, intensity: 0.007, animated: true },
    vignette: { enabled: true, darkness: 0.8, offset: 0.9 },
    feedback: { enabled: true, intensity: 0.17, animated: false }
  }
};

/**
 * Represents a particle or effect that will be displayed in the scene
 */
export interface VisualEffect {
  id: string;
  type: 'hit' | 'heal' | 'dash' | 'attack' | 'buff' | 'ability' | 'death' | 'environment';
  position: THREE.Vector3;
  velocity?: THREE.Vector3;
  acceleration?: THREE.Vector3;
  color: THREE.Color | string | number;
  size: number;
  duration: number;
  startTime: number;
  mesh?: THREE.Object3D;
  options?: {
    spread?: number;
    trail?: boolean;
    rotation?: boolean;
    fadeIn?: number;
    fadeOut?: number;
    gravity?: number;
    bounce?: number;
    collision?: boolean;
    emissive?: boolean;
    blending?: THREE.Blending;
  };
}

/**
 * Impact effect options
 */
export interface ImpactEffectOptions {
  size?: number;
  duration?: number;
  particleCount?: number;
  spread?: number;
  speed?: number;
  gravity?: number;
  trail?: boolean;
  rotation?: boolean;
  emissive?: boolean;
}

/**
 * Screen effect options
 */
export interface ScreenEffectOptions {
  duration?: number;
  intensity?: number;
  fadeIn?: number;
  fadeOut?: number;
  color?: THREE.Color | string | number;
}

/**
 * Enhanced visual effects system for improved game feel
 */
export class EnhancedVisualEffects {
  private static instance: EnhancedVisualEffects;

  // Three.js objects
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.Camera;
  private scene: THREE.Scene;
  private composer: EffectComposer;
  
  // Effect passes
  private bloomPass?: UnrealBloomPass;
  private chromaticPass?: ShaderPass;
  private vignettePass?: ShaderPass;
  private godrayPass?: ShaderPass;
  private shakePass?: ShaderPass;
  private feedbackPass?: ShaderPass;
  private pixelPass?: ShaderPass;
  
  // Current settings
  private settings: typeof DEFAULT_SETTINGS;
  
  // Active visual effects
  private activeEffects: Map<string, VisualEffect> = new Map();
  
  // Effect groups for organization
  private effectGroups: Map<string, THREE.Group> = new Map();
  
  // Screen shake state
  private shakeIntensity: number = 0;
  private shakeDamping: number = 0.9;
  
  // Screen flash state
  private flashMaterial?: THREE.ShaderMaterial;
  private flashMesh?: THREE.Mesh;
  private flashIntensity: number = 0;
  private flashDuration: number = 0;
  private flashTimer: number = 0;
  
  // Time tracking
  private clock: THREE.Clock;
  
  // Managers for different effect types
  private particleManager: ParticleManager;
  private trailManager: TrailManager;
  
  // Additional effect resources
  private effectMaterials: Map<string, THREE.Material> = new Map();
  private effectGeometries: Map<string, THREE.BufferGeometry> = new Map();
  
  // Debug mode
  // private readonly debug: boolean = false; // Unused variable, commenting out

  /**
   * Create the visual effects system
   */
  private constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.settings = {...DEFAULT_SETTINGS};
    this.clock = new THREE.Clock();
    
    // Initialize effect composer
    this.composer = new EffectComposer(this.renderer);
    
    // Initialize particle and trail managers
    this.particleManager = new ParticleManager(this.scene);
    this.trailManager = new TrailManager(this.scene);
    
    // Set up post-processing
    this.setupPostProcessing();
    
    // Create effect groups
    this.setupEffectGroups();
    
    // Create effect resources
    this.createEffectResources();
    
    // Create screen flash overlay
    this.createScreenFlash();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(renderer?: THREE.WebGLRenderer, scene?: THREE.Scene, camera?: THREE.Camera): EnhancedVisualEffects {
    if (!EnhancedVisualEffects.instance) {
      if (!renderer || !scene || !camera) {
        throw new Error('Must provide renderer, scene, and camera when first creating VisualEffects');
      }
      EnhancedVisualEffects.instance = new EnhancedVisualEffects(renderer, scene, camera);
    }
    return EnhancedVisualEffects.instance;
  }

  /**
   * Set up post-processing passes
   */
  private setupPostProcessing(): void {
    // Basic render pass
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);
    
    // Bloom pass
    if (this.settings.bloom.enabled) {
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        this.settings.bloom.strength,
        this.settings.bloom.radius,
        this.settings.bloom.threshold
      );
      this.composer.addPass(this.bloomPass);
    }
    
    // Chromatic aberration pass
    if (this.settings.chromatic.enabled) {
      this.chromaticPass = new ShaderPass(ChromaticAberrationShader);
      this.chromaticPass.uniforms.resolution.value = new THREE.Vector2(
        window.innerWidth * this.renderer.getPixelRatio(),
        window.innerHeight * this.renderer.getPixelRatio()
      );
      this.chromaticPass.uniforms.intensity.value = this.settings.chromatic.intensity;
      this.composer.addPass(this.chromaticPass);
    }
    
    // Vignette pass
    if (this.settings.vignette.enabled) {
      this.vignettePass = new ShaderPass(VignetteShader);
      this.vignettePass.uniforms.darkness.value = this.settings.vignette.darkness;
      this.vignettePass.uniforms.offset.value = this.settings.vignette.offset;
      this.composer.addPass(this.vignettePass);
    }
    
    // God ray pass (disabled by default, activated for certain room types)
    if (this.settings.godray.enabled) {
      this.godrayPass = new ShaderPass(GodRayShader);
      this.godrayPass.uniforms.exposure.value = this.settings.godray.exposure;
      this.godrayPass.uniforms.decay.value = this.settings.godray.decay;
      this.godrayPass.uniforms.density.value = this.settings.godray.density;
      this.godrayPass.uniforms.weight.value = this.settings.godray.weight;
      this.godrayPass.uniforms.lightPositionOnScreen.value = new THREE.Vector2(0.5, 0.5);
      this.composer.addPass(this.godrayPass);
    }
    
    // Screen shake pass
    this.shakePass = new ShaderPass(ShakeShader);
    this.shakePass.uniforms.intensity.value = 0;
    this.composer.addPass(this.shakePass);
    
    // Feedback pass (disabled by default, used for elite/boss rooms)
    if (this.settings.feedback.enabled) {
      this.feedbackPass = new ShaderPass(FeedbackShader);
      this.feedbackPass.uniforms.feedbackAmount.value = this.settings.feedback.intensity;
      this.composer.addPass(this.feedbackPass);
    }
    
    // Pixel pass (disabled by default, optional effect)
    if (this.settings.pixel.enabled) {
      this.pixelPass = new ShaderPass(PixelShader);
      this.pixelPass.uniforms.resolution.value = new THREE.Vector2(
        window.innerWidth * this.renderer.getPixelRatio(),
        window.innerHeight * this.renderer.getPixelRatio()
      );
      this.pixelPass.uniforms.pixelSize.value = this.settings.pixel.pixelSize;
      this.composer.addPass(this.pixelPass);
    }
    
    // SMAA pass (anti-aliasing)
    const smaaPass = new SMAAPass(
      window.innerWidth * this.renderer.getPixelRatio(),
      window.innerHeight * this.renderer.getPixelRatio()
    );
    this.composer.addPass(smaaPass);
  }

  /**
   * Set up effect groups for organization
   */
  private setupEffectGroups(): void {
    // Create groups for different effect types
    const effectTypes = ['hit', 'heal', 'dash', 'attack', 'buff', 'ability', 'death', 'environment'];
    
    effectTypes.forEach(type => {
      const group = new THREE.Group();
      group.name = `${type}-effects`;
      this.scene.add(group);
      this.effectGroups.set(type, group);
    });
  }

  /**
   * Create effect resources (materials, geometries)
   */
  private createEffectResources(): void {
    // Create standard geometries
    this.effectGeometries.set('particle', new THREE.SphereGeometry(1, 8, 8));
    this.effectGeometries.set('trail', new THREE.BoxGeometry(1, 1, 1));
    this.effectGeometries.set('slash', new THREE.PlaneGeometry(1, 1));
    this.effectGeometries.set('impact', new THREE.CircleGeometry(1, 16));
    
    // Create standard materials
    const particleMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    this.effectMaterials.set('particle', particleMaterial);
    
    const trailMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    this.effectMaterials.set('trail', trailMaterial);
    
    const slashMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    this.effectMaterials.set('slash', slashMaterial);
  }

  /**
   * Create screen flash overlay
   */
  private createScreenFlash(): void {
    // Create a full-screen quad for flash effects
    const flashGeometry = new THREE.PlaneGeometry(2, 2);
    
    // Create shader material for flash
    this.flashMaterial = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(1, 1, 1) },
        intensity: { value: 0.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform float intensity;
        varying vec2 vUv;
        void main() {
          gl_FragColor = vec4(color, intensity);
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    
    // Create mesh and add to separate scene for the composer
    this.flashMesh = new THREE.Mesh(flashGeometry, this.flashMaterial);
    this.flashMesh.visible = false;
    
    // Create a camera positioned in front of the flash quad
    const flashCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    // Create a scene just for the flash effect
    const flashScene = new THREE.Scene();
    flashScene.add(this.flashMesh);
    
    // Add render pass to composer
    const flashPass = new RenderPass(flashScene, flashCamera);
    flashPass.clear = false; // Don't clear the previous render
    this.composer.addPass(flashPass);
  }

  /**
   * Create hit effects at position
   */
  createHitEffect(position: THREE.Vector3, options: ImpactEffectOptions = {}): void {
    const defaultOptions: ImpactEffectOptions = {
      size: 0.5,
      duration: 400,
      particleCount: 15,
      spread: 0.5,
      speed: 5,
      gravity: 10,
      trail: false,
      rotation: true,
      emissive: true
    };
    
    const config = { ...defaultOptions, ...options };
    
    // Create particles in a burst pattern
    this.particleManager.createParticleBurst({
      position,
      color: new THREE.Color(0xff5500),
      count: config.particleCount!,
      size: config.size!,
      duration: config.duration!,
      spread: config.spread!,
      speed: config.speed!,
      gravity: config.gravity!,
      trail: config.trail!,
      rotation: config.rotation!,
      emissive: config.emissive!
    });
    
    // Add impact flash
    this.createImpactFlash(position, config.size! * 2, config.duration! * 0.5);
    
    // Add screen shake
    this.addScreenShake(0.03, 0.85);
  }

  /**
   * Create heal effects at position
   */
  createHealEffect(position: THREE.Vector3, options: ImpactEffectOptions = {}): void {
    const defaultOptions: ImpactEffectOptions = {
      size: 0.4,
      duration: 800,
      particleCount: 20,
      spread: 0.7,
      speed: 3,
      gravity: -5, // Float upward
      trail: true,
      rotation: true,
      emissive: true
    };
    
    const config = { ...defaultOptions, ...options };
    
    // Create particles that float upward
    this.particleManager.createParticleBurst({
      position,
      color: new THREE.Color(0x00ff88),
      count: config.particleCount!,
      size: config.size!,
      duration: config.duration!,
      spread: config.spread!,
      speed: config.speed!,
      gravity: config.gravity!,
      trail: config.trail!,
      rotation: config.rotation!,
      emissive: config.emissive!
    });
    
    // Add a subtle glow
    this.createImpactFlash(position, config.size! * 3, config.duration! * 0.3, new THREE.Color(0x00ff88));
  }

  /**
   * Create dash effects along a path
   */
  createDashEffect(position: THREE.Vector3, direction: THREE.Vector3, length: number = 3, color: THREE.Color | string = new THREE.Color(0x4488ff)): void {
    // Create a trail effect
    this.trailManager.createTrail({
      startPosition: position,
      direction: direction.clone().normalize(),
      length,
      width: 0.5,
      color: color instanceof THREE.Color ? color : new THREE.Color(color),
      duration: 500,
      segments: 10,
      fade: true
    });
    
    // Create particles along the path
    const particleCount = Math.ceil(length * 5); // 5 particles per unit length
    // const step = length / particleCount; // Unused variable, commenting out
    
    for (let i = 0; i < particleCount; i++) {
      const t = i / particleCount;
      const pos = position.clone().add(direction.clone().multiplyScalar(t * length));
      
      this.particleManager.createParticle({
        position: pos,
        color: color instanceof THREE.Color ? color : new THREE.Color(color),
        size: 0.2 + Math.random() * 0.2,
        duration: 300 + Math.random() * 200,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2
        ).multiplyScalar(0.5)
      });
    }
  }

  /**
   * Create attack trail effect
   */
  createAttackTrail(startPoint: THREE.Vector3, endPoint: THREE.Vector3, color: THREE.Color | string = new THREE.Color(0xffffff), width: number = 1.0): void {
    // Calculate direction and length
    const direction = new THREE.Vector3().subVectors(endPoint, startPoint).normalize();
    const length = startPoint.distanceTo(endPoint);
    
    // Create a trail effect
    this.trailManager.createTrail({
      startPosition: startPoint,
      direction,
      length,
      width,
      color: color instanceof THREE.Color ? color : new THREE.Color(color),
      duration: 300,
      segments: Math.ceil(length * 3), // 3 segments per unit length
      fade: true
    });
    
    // Create particles at the endpoint
    this.particleManager.createParticleBurst({
      position: endPoint,
      color: color instanceof THREE.Color ? color : new THREE.Color(color),
      count: 5,
      size: width * 0.3,
      duration: 300,
      spread: width * 0.5,
      speed: 2,
      gravity: 0,
      trail: false,
      rotation: true,
      emissive: true
    });
  }

  /**
   * Create slash arc effect
   */
  createSlashArc(position: THREE.Vector3, direction: THREE.Vector3, angle: number, radius: number, color: THREE.Color | string = new THREE.Color(0xffffff)): void {
    const arcSegments = 12;
    const angleRad = (angle * Math.PI) / 180;
    const colorObj = color instanceof THREE.Color ? color : new THREE.Color(color);
    
    // Create points along the arc
    const points: THREE.Vector3[] = [];
    const startAngle = -angleRad / 2;
    const endAngle = angleRad / 2;
    
    for (let i = 0; i <= arcSegments; i++) {
      const t = i / arcSegments;
      const currentAngle = startAngle + (endAngle - startAngle) * t;
      
      // Rotate direction around Y axis
      const rotatedDir = direction.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), currentAngle);
      
      // Calculate point position
      const point = position.clone().add(rotatedDir.multiplyScalar(radius));
      points.push(point);
    }
    
    // Create trail segments between points
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      const segDirection = new THREE.Vector3().subVectors(end, start).normalize();
      const segLength = start.distanceTo(end);
      
      this.trailManager.createTrail({
        startPosition: start,
        direction: segDirection,
        length: segLength,
        width: 0.5,
        color: colorObj,
        duration: 300,
        segments: 3,
        fade: true
      });
    }
    
    // Add particles along the arc
    for (let i = 0; i < points.length; i += 2) { // Every other point for performance
      this.particleManager.createParticle({
        position: points[i],
        color: colorObj,
        size: 0.3,
        duration: 300,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          (Math.random() * 2), // Upward bias
          (Math.random() - 0.5) * 2
        ).multiplyScalar(1.5)
      });
    }
  }

  /**
   * Create impact flash at position
   */
  createImpactFlash(position: THREE.Vector3, size: number = 1, duration: number = 300, color: THREE.Color | string = new THREE.Color(0xffffff)): void {
    const colorObj = color instanceof THREE.Color ? color : new THREE.Color(color);
    
    // Create a flash sprite
    const flashGeometry = this.effectGeometries.get('impact')!.clone();
    flashGeometry.scale(size, size, size);
    
    const flashMaterial = new THREE.MeshBasicMaterial({
      color: colorObj,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    
    const flashMesh = new THREE.Mesh(flashGeometry, flashMaterial);
    flashMesh.position.copy(position);
    
    // Orient toward camera
    flashMesh.lookAt(this.camera.position);
    
    // Add to scene
    const group = this.effectGroups.get('hit')!;
    group.add(flashMesh);
    
    // Animate and remove
    const startTime = this.clock.getElapsedTime();
    const effect: VisualEffect = {
      id: `flash-${Date.now()}-${Math.random()}`,
      type: 'hit',
      position,
      color: colorObj,
      size,
      duration,
      startTime,
      mesh: flashMesh
    };
    
    this.activeEffects.set(effect.id, effect);
  }

  /**
   * Create buff aura effect around object
   */
  createBuffAura(object: THREE.Object3D, color: THREE.Color | string = new THREE.Color(0x00ffff), duration: number = -1): void {
    const colorObj = color instanceof THREE.Color ? color : new THREE.Color(color);
    
    // Create aura particles that orbit the object
    const particleCount = 20;
    const radius = 1.5;
    const period = 2000; // ms per orbit
    
    // Create emitter
    const createParticles = () => {
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const height = (Math.random() - 0.5) * 2;
        
        const pos = new THREE.Vector3(
          Math.cos(angle) * radius,
          height,
          Math.sin(angle) * radius
        );
        
        // Transform to object space
        object.updateMatrixWorld();
        pos.applyMatrix4(object.matrixWorld);
        
        this.particleManager.createParticle({
          position: pos,
          color: colorObj,
          size: 0.2 + Math.random() * 0.1,
          duration: period,
          velocity: new THREE.Vector3(0, 0.5, 0),
          options: {
            fadeIn: 0.2,
            fadeOut: 0.2,
            emissive: true
          }
        });
      }
      
      // Schedule next batch if duration is negative (infinite) or still active
      if (duration < 0 || this.clock.getElapsedTime() < duration) {
        setTimeout(createParticles, period / 2);
      }
    };
    
    // Start emitting
    createParticles();
  }

  /**
   * Create a big explosion effect
   */
  createExplosionEffect(position: THREE.Vector3, size: number = 3, particleCount: number = 50): void {
    // Create a central flash
    this.createImpactFlash(position, size, 500, new THREE.Color(0xff8800));
    
    // Create particles in a burst pattern
    this.particleManager.createParticleBurst({
      position,
      color: new THREE.Color(0xff4400),
      count: particleCount,
      size: size * 0.2,
      duration: 1000,
      spread: size,
      speed: 8,
      gravity: 5,
      trail: true,
      rotation: true,
      emissive: true
    });
    
    // Create secondary particles
    this.particleManager.createParticleBurst({
      position,
      color: new THREE.Color(0xffaa00),
      count: Math.floor(particleCount / 2),
      size: size * 0.15,
      duration: 1500,
      spread: size * 1.2,
      speed: 4,
      gravity: -2, // Float upward
      trail: true,
      rotation: true,
      emissive: true
    });
    
    // Add screen effects
    this.addScreenShake(0.1, 0.8);
    this.flashScreen(new THREE.Color(0xff8800), 0.3, 0.5);
  }

  /**
   * Create impact effect at position
   */
  createImpactEffect(position: THREE.Vector3, color: THREE.Color | string = new THREE.Color(0xffffff), size: number = 1): void {
    // Combine flash, particles, and screen effects
    this.createImpactFlash(position, size, 300, color);
    
    // Create particles
    this.particleManager.createParticleBurst({
      position,
      color: color instanceof THREE.Color ? color : new THREE.Color(color),
      count: Math.floor(size * 10),
      size: size * 0.2,
      duration: 500,
      spread: size,
      speed: 3,
      gravity: 2,
      trail: false,
      rotation: true,
      emissive: true
    });
    
    // Add screen shake proportional to size
    this.addScreenShake(Math.min(0.05, size * 0.02), 0.9);
  }

  /**
   * Add screen shake effect
   */
  addScreenShake(intensity: number = 0.05, damping: number = 0.9): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDamping = damping;
    
    // Update shader pass
    if (this.shakePass) {
      this.shakePass.uniforms.intensity.value = this.shakeIntensity;
    }
  }

  /**
   * Flash the screen with a color
   */
  flashScreen(color: THREE.Color | string = new THREE.Color(0xffffff), intensity: number = 0.5, duration: number = 0.3): void {
    if (!this.flashMesh || !this.flashMaterial) return;
    
    // Set color
    const colorObj = color instanceof THREE.Color ? color : new THREE.Color(color);
    this.flashMaterial.uniforms.color.value = colorObj;
    
    // Set flash parameters
    this.flashIntensity = intensity;
    this.flashDuration = duration * 1000; // convert to ms
    this.flashTimer = 0;
    
    // Make visible
    this.flashMesh.visible = true;
    this.flashMaterial.uniforms.intensity.value = intensity;
  }

  /**
   * Apply visual settings for a room type
   */
  setupEnvironmentLighting(roomType: string): void {
    const presetKey = roomType as keyof typeof ROOM_EFFECT_PRESETS;
    const preset = ROOM_EFFECT_PRESETS[presetKey] || ROOM_EFFECT_PRESETS.normal;
    
    // Apply preset settings
    this.applySettings(preset);
  }

  /**
   * Apply visual effect settings
   */
  applySettings(settings: Partial<typeof DEFAULT_SETTINGS>): void {
    // Merge with current settings
    this.settings = {
      ...this.settings,
      ...settings,
      bloom: { ...this.settings.bloom, ...settings.bloom },
      chromatic: { ...this.settings.chromatic, ...settings.chromatic },
      vignette: { ...this.settings.vignette, ...settings.vignette },
      godray: { ...this.settings.godray, ...settings.godray },
      shake: { ...this.settings.shake, ...settings.shake },
      feedback: { ...this.settings.feedback, ...settings.feedback },
      pixel: { ...this.settings.pixel, ...settings.pixel }
    };
    
    // Update passes
    if (this.bloomPass) {
      this.bloomPass.strength = this.settings.bloom.strength;
      this.bloomPass.radius = this.settings.bloom.radius;
      this.bloomPass.threshold = this.settings.bloom.threshold;
    }
    
    if (this.chromaticPass) {
      this.chromaticPass.uniforms.intensity.value = this.settings.chromatic.intensity;
    }
    
    if (this.vignettePass) {
      this.vignettePass.uniforms.darkness.value = this.settings.vignette.darkness;
      this.vignettePass.uniforms.offset.value = this.settings.vignette.offset;
    }
    
    if (this.godrayPass) {
      this.godrayPass.uniforms.exposure.value = this.settings.godray.exposure;
      this.godrayPass.uniforms.decay.value = this.settings.godray.decay;
      this.godrayPass.uniforms.density.value = this.settings.godray.density;
      this.godrayPass.uniforms.weight.value = this.settings.godray.weight;
    }
    
    if (this.feedbackPass) {
      this.feedbackPass.uniforms.feedbackAmount.value = this.settings.feedback.intensity;
    }
    
    if (this.pixelPass) {
      this.pixelPass.uniforms.pixelSize.value = this.settings.pixel.pixelSize;
    }
  }

  /**
   * Update all visual effects
   */
  update(dt: number): void {
    const time = this.clock.getElapsedTime();
    
    // Update each effect
    this.updateActiveEffects(time, dt);
    
    // Update screen effects
    this.updateScreenEffects(dt, time);
    
    // Update managers
    this.particleManager.update(dt);
    this.trailManager.update(dt);
    
    // Render with composer
    this.composer.render();
  }

  /**
   * Update active effects
   */
  private updateActiveEffects(time: number, dt: number): void {
    // Process each effect
    for (const [id, effect] of this.activeEffects.entries()) {
      const age = (time - effect.startTime) * 1000; // convert to ms
      
      if (age >= effect.duration) {
        // Effect is finished, remove it
        if (effect.mesh) {
          const group = this.effectGroups.get(effect.type);
          if (group) {
            group.remove(effect.mesh);
          }
          
          // Clean up resources
          if (effect.mesh instanceof THREE.Mesh) {
            const mesh = effect.mesh as THREE.Mesh;
            if (mesh.geometry && !this.effectGeometries.has(mesh.geometry.uuid)) {
              mesh.geometry.dispose();
            }
            if (mesh.material instanceof THREE.Material && !this.effectMaterials.has((mesh.material as any).uuid)) {
              (mesh.material as THREE.Material).dispose();
            }
          }
        }
        
        this.activeEffects.delete(id);
        continue;
      }
      
      // Update effect
      if (effect.mesh) {
        const progress = age / effect.duration;
        
        // Handle fading
        if (effect.mesh instanceof THREE.Mesh) {
          const mesh = effect.mesh as THREE.Mesh;
          if (mesh.material instanceof THREE.Material) {
            const material = mesh.material as any;
            if (material.opacity !== undefined) {
              // Apply fade curve
              let opacity = 1;
              
              if (effect.options?.fadeIn && progress < effect.options.fadeIn) {
                // Fade in
                opacity = progress / effect.options.fadeIn;
              } else if (effect.options?.fadeOut && progress > (1 - effect.options.fadeOut)) {
                // Fade out
                opacity = (1 - progress) / effect.options.fadeOut;
              }
              
              material.opacity = opacity;
            }
          }
        }
        
        // Apply movement
        if (effect.velocity) {
          effect.mesh.position.add(effect.velocity.clone().multiplyScalar(dt));
          
          // Apply gravity
          if (effect.acceleration) {
            effect.velocity.add(effect.acceleration.clone().multiplyScalar(dt));
          }
          
          // Apply ground collision
          if (effect.options?.collision && effect.mesh.position.y < 0) {
            effect.mesh.position.y = 0;
            
            if (effect.options.bounce && effect.velocity) {
              effect.velocity.y = -effect.velocity.y * effect.options.bounce;
            } else if (effect.velocity) {
              effect.velocity.y = 0;
            }
          }
        }
        
        // Apply rotation
        if (effect.options?.rotation) {
          effect.mesh.rotation.x += dt * 2;
          effect.mesh.rotation.y += dt * 3;
        }
      }
    }
  }

  /**
   * Update screen effects
   */
  private updateScreenEffects(deltaTime: number, time: number): void {
    // Update screen shake
    if (this.shakeIntensity > 0.001) {
      this.shakeIntensity *= this.shakeDamping;
      
      if (this.shakePass) {
        this.shakePass.uniforms.intensity.value = this.shakeIntensity;
        this.shakePass.uniforms.time.value = time;
      }
    }
    
    // Update chromatic aberration animation
    if (this.settings.chromatic.animated && this.chromaticPass) {
      const animAmount = Math.sin(time * 2) * 0.2 + 0.8; // 0.6 to 1.0
      this.chromaticPass.uniforms.intensity.value = 
        this.settings.chromatic.intensity * animAmount;
    }
    
    // Update screen flash
    if (this.flashMesh && this.flashMesh.visible) {
      this.flashTimer += deltaTime * 1000; // convert to ms
      
      if (this.flashTimer >= this.flashDuration) {
        // Flash finished
        this.flashMesh.visible = false;
      } else {
        // Update flash intensity
        const progress = this.flashTimer / this.flashDuration;
        const newIntensity = this.flashIntensity * (1 - progress);
        this.flashMaterial!.uniforms.intensity.value = newIntensity;
      }
    }
  }

  /**
   * Handle window resize
   */
  handleResize(width: number, height: number): void {
    // Update renderer and composer
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
    
    // Update resolution-dependent passes
    const resolution = new THREE.Vector2(
      width * this.renderer.getPixelRatio(),
      height * this.renderer.getPixelRatio()
    );
    
    if (this.chromaticPass) {
      this.chromaticPass.uniforms.resolution.value = resolution;
    }
    
    if (this.pixelPass) {
      this.pixelPass.uniforms.resolution.value = resolution;
    }
  }
}

/**
 * Particle manager for creating and tracking particles
 */
class ParticleManager {
  private scene: THREE.Scene;
  private particles: THREE.Object3D[] = [];
  private particleData: Map<THREE.Object3D, {
    velocity: THREE.Vector3;
    acceleration: THREE.Vector3;
    age: number;
    maxAge: number;
    fadeIn: number;
    fadeOut: number;
    emissive: boolean;
  }> = new Map();
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }
  
  createParticle(options: {
    position: THREE.Vector3;
    color: THREE.Color;
    size: number;
    duration: number;
    velocity?: THREE.Vector3;
    options?: {
      fadeIn?: number;
      fadeOut?: number;
      emissive?: boolean;
    };
  }): void {
    // Create particle geometry
    const geometry = new THREE.SphereGeometry(1, 8, 8);
    
    // Create material
    const material = new THREE.MeshBasicMaterial({
      color: options.color,
      transparent: true,
      opacity: options.options?.fadeIn ? 0 : 1,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide
    });
    
    // Create mesh
    const particle = new THREE.Mesh(geometry, material);
    particle.position.copy(options.position);
    particle.scale.set(options.size, options.size, options.size);
    
    // Add to scene
    this.scene.add(particle);
    this.particles.push(particle);
    
    // Store particle data
    this.particleData.set(particle, {
      velocity: options.velocity || new THREE.Vector3(0, 0, 0),
      acceleration: new THREE.Vector3(0, -1, 0), // Default gravity
      age: 0,
      maxAge: options.duration,
      fadeIn: options.options?.fadeIn || 0,
      fadeOut: options.options?.fadeOut || 0.3,
      emissive: options.options?.emissive || false
    });
  }
  
  createParticleBurst(options: {
    position: THREE.Vector3;
    color: THREE.Color;
    count: number;
    size: number;
    duration: number;
    spread: number;
    speed: number;
    gravity: number;
    trail: boolean;
    rotation: boolean;
    emissive: boolean;
  }): void {
    for (let i = 0; i < options.count; i++) {
      // Calculate random direction
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);
      
      const direction = new THREE.Vector3(x, y, z);
      const speed = options.speed * (0.5 + Math.random() * 0.5); // 50-100% of speed
      
      const position = options.position.clone().add(
        direction.clone().multiplyScalar(Math.random() * options.spread * 0.5)
      );
      
      this.createParticle({
        position,
        color: options.color,
        size: options.size * (0.7 + Math.random() * 0.6), // 70-130% of size
        duration: options.duration * (0.8 + Math.random() * 0.4), // 80-120% of duration
        velocity: direction.multiplyScalar(speed),
        options: {
          fadeIn: 0.1,
          fadeOut: 0.3,
          emissive: options.emissive
        }
      });
    }
  }
  
  update(deltaTime: number): void {
    // Update each particle
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      const data = this.particleData.get(particle);
      
      if (!data) continue;
      
      // Update age
      data.age += deltaTime * 1000; // convert to ms
      
      // Check if particle should be removed
      if (data.age >= data.maxAge) {
        // Remove particle
        this.scene.remove(particle);
        this.particles.splice(i, 1);
        this.particleData.delete(particle);
        
        // Dispose of resources
        if (particle instanceof THREE.Mesh) {
          if (particle.geometry) particle.geometry.dispose();
          if (particle.material instanceof THREE.Material) {
            particle.material.dispose();
          }
        }
        
        continue;
      }
      
      // Update position
      const vel = data.velocity.clone().multiplyScalar(deltaTime);
      particle.position.add(vel);
      
      // Update velocity with acceleration
      const acc = data.acceleration.clone().multiplyScalar(deltaTime);
      data.velocity.add(acc);
      
      // Update opacity based on fade
      if (particle instanceof THREE.Mesh) {
        const material = particle.material as THREE.MeshBasicMaterial;
        
        if (material) {
          const progress = data.age / data.maxAge;
          
          // Calculate opacity
          let opacity = 1;
          
          if (data.fadeIn > 0 && progress < data.fadeIn) {
            // Fade in
            opacity = progress / data.fadeIn;
          } else if (data.fadeOut > 0 && progress > (1 - data.fadeOut)) {
            // Fade out
            opacity = (1 - progress) / data.fadeOut;
          }
          
          material.opacity = opacity;
        }
      }
    }
  }
}

/**
 * Trail manager for creating trail effects
 */
class TrailManager {
  private scene: THREE.Scene;
  private trails: THREE.Object3D[] = [];
  private trailData: Map<THREE.Object3D, {
    age: number;
    maxAge: number;
    fade: boolean;
  }> = new Map();
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }
  
  createTrail(options: {
    startPosition: THREE.Vector3;
    direction: THREE.Vector3;
    length: number;
    width: number;
    color: THREE.Color;
    duration: number;
    segments: number;
    fade: boolean;
  }): void {
    const { startPosition, direction, length, width, color, duration, segments, fade } = options;
    
    // Calculate points along the trail
    const points: THREE.Vector3[] = [];
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const point = startPosition.clone().add(direction.clone().multiplyScalar(t * length));
      points.push(point);
    }
    
    // Create trail geometry from points
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(curve, segments, width / 2, 8, false);
    
    // Create material
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    
    // Create mesh
    const trail = new THREE.Mesh(geometry, material);
    
    // Add to scene
    this.scene.add(trail);
    this.trails.push(trail);
    
    // Store trail data
    this.trailData.set(trail, {
      age: 0,
      maxAge: duration,
      fade
    });
  }
  
  update(deltaTime: number): void {
    // Update each trail
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const trail = this.trails[i];
      const data = this.trailData.get(trail);
      
      if (!data) continue;
      
      // Update age
      data.age += deltaTime * 1000; // convert to ms
      
      // Check if trail should be removed
      if (data.age >= data.maxAge) {
        // Remove trail
        this.scene.remove(trail);
        this.trails.splice(i, 1);
        this.trailData.delete(trail);
        
        // Dispose of resources
        if (trail instanceof THREE.Mesh) {
          if (trail.geometry) trail.geometry.dispose();
          if (trail.material instanceof THREE.Material) {
            trail.material.dispose();
          }
        }
        
        continue;
      }
      
      // Update opacity if fading
      if (data.fade && trail instanceof THREE.Mesh) {
        const material = trail.material as THREE.MeshBasicMaterial;
        
        if (material) {
          const progress = data.age / data.maxAge;
          material.opacity = 1 - progress;
        }
      }
    }
  }
}