import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { ParticleSystem } from "./objectPooling";

/**
 * VisualEffectsManager - Handles and coordinates visual effects in the game
 *
 * Manages:
 * - Post-processing effects (bloom, chromatic aberration, vignette)
 * - Environment lighting (ambient occlusion, shadows)
 * - Real-time effects (god rays, screen flashes)
 * - Integration with particle system
 */
export class VisualEffectsManager {
  private static instance: VisualEffectsManager;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private composer: EffectComposer;
  private customPasses: Map<string, ShaderPass> = new Map();
  private particleSystem: ParticleSystem;

  // Effect parameters
  private bloomParams = {
    enabled: true,
    strength: 1.5,
    radius: 0.4,
    threshold: 0.85,
  };

  private vignetteParams = {
    enabled: true,
    offset: 1.0,
    darkness: 1.0,
  };

  private chromaticAberrationParams = {
    enabled: true,
    strength: 0.005,
    animateStrength: true,
  };

  // Environment lighting
  private environmentLighting = {
    ambientLight: null as THREE.AmbientLight | null,
    directionalLight: null as THREE.DirectionalLight | null,
    pointLights: [] as THREE.PointLight[],
  };

  // Screen effects
  private screenFlash = {
    active: false,
    color: new THREE.Color(1, 1, 1),
    intensity: 0,
    maxIntensity: 1,
    duration: 0,
    elapsedTime: 0,
  };

  // Animated shader values
  private shaderTime = 0;

  private constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    // Initialize composer
    this.composer = new EffectComposer(this.renderer);

    // Add initial passes
    this.setupPostProcessing();

    // Initialize particle system
    this.particleSystem = ParticleSystem.getInstance(this.scene);
  }

  static getInstance(
    renderer?: THREE.WebGLRenderer,
    scene?: THREE.Scene,
    camera?: THREE.Camera
  ): VisualEffectsManager {
    if (!VisualEffectsManager.instance && renderer && scene && camera) {
      VisualEffectsManager.instance = new VisualEffectsManager(
        renderer,
        scene,
        camera
      );
    }
    return VisualEffectsManager.instance;
  }

  /**
   * Setup post-processing pipeline
   */
  private setupPostProcessing(): void {
    // Main render pass
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Bloom pass
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      this.bloomParams.strength,
      this.bloomParams.radius,
      this.bloomParams.threshold
    );
    this.composer.addPass(bloomPass);
    this.customPasses.set("bloom", bloomPass as unknown as ShaderPass);

    // Chromatic aberration pass
    const chromaticAberrationPass = this.createChromaticAberrationPass();
    this.composer.addPass(chromaticAberrationPass);
    this.customPasses.set("chromaticAberration", chromaticAberrationPass);

    // Vignette pass
    const vignettePass = this.createVignettePass();
    this.composer.addPass(vignettePass);
    this.customPasses.set("vignette", vignettePass);

    // Anti-aliasing (SMAA for better quality)
    const smaaPass = new SMAAPass(window.innerWidth, window.innerHeight);
    this.composer.addPass(smaaPass);

    // Setup additional custom passes
    this.setupAdditionalPasses();
  }

  /**
   * Create chromatic aberration shader pass
   */
  private createChromaticAberrationPass(): ShaderPass {
    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        resolution: {
          value: new THREE.Vector2(window.innerWidth, window.innerHeight),
        },
        aberrationStrength: { value: this.chromaticAberrationParams.strength },
        time: { value: 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        uniform float aberrationStrength;
        uniform float time;
        varying vec2 vUv;
        
        void main() {
          // Calculate distortion based on distance from center
          vec2 center = vec2(0.5, 0.5);
          vec2 uv = vUv;
          vec2 distVec = uv - center;
          float distSq = dot(distVec, distVec);
          
          // Apply radial distortion with time variation
          float strength = aberrationStrength * (1.0 + 0.1 * sin(time * 2.0)) * distSq;
          
          // Sample each color channel with offset
          float r = texture2D(tDiffuse, uv + distVec * strength).r;
          float g = texture2D(tDiffuse, uv).g;
          float b = texture2D(tDiffuse, uv - distVec * strength).b;
          
          gl_FragColor = vec4(r, g, b, 1.0);
        }
      `,
    };

    return new ShaderPass(shader);
  }

  /**
   * Create vignette shader pass
   */
  private createVignettePass(): ShaderPass {
    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        offset: { value: this.vignetteParams.offset },
        darkness: { value: this.vignetteParams.darkness },
        resolution: {
          value: new THREE.Vector2(window.innerWidth, window.innerHeight),
        },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float offset;
        uniform float darkness;
        uniform vec2 resolution;
        varying vec2 vUv;
        
        void main() {
          // Calculate vignette
          vec2 center = vec2(0.5, 0.5);
          vec2 uv = vUv;
          vec2 coord = (uv - center) * vec2(offset);
          float vignetteValue = 1.0 - dot(coord, coord);
          
          // Apply vignette to color
          vec4 texel = texture2D(tDiffuse, uv);
          vec3 color = texel.rgb * vignetteValue;
          
          gl_FragColor = vec4(color, texel.a);
        }
      `,
    };

    return new ShaderPass(shader);
  }

  /**
   * Setup additional post-processing passes
   */
  private setupAdditionalPasses(): void {
    // Can add more passes like film grain, god rays, etc.
    // Example:
    /*
    const filmGrainPass = this.createFilmGrainPass();
    this.composer.addPass(filmGrainPass);
    this.customPasses.set('filmGrain', filmGrainPass);
    */
  }

  /**
   * Set up environment lighting
   */
  setupEnvironmentLighting(
    type: "normal" | "elite" | "boss" | "treasure" | "shop" | "secret" = "normal"
  ): void {
    // Clear existing lights
    if (this.environmentLighting.ambientLight) {
      this.scene.remove(this.environmentLighting.ambientLight);
    }

    if (this.environmentLighting.directionalLight) {
      this.scene.remove(this.environmentLighting.directionalLight);
    }

    this.environmentLighting.pointLights.forEach((light) => {
      this.scene.remove(light);
    });
    this.environmentLighting.pointLights = [];

    // Add new lights based on room type
    let ambientIntensity = 0.3;
    let ambientColor = 0xffffff;
    let directionalIntensity = 0.7;
    let directionalColor = 0xffffff;

    switch (type) {
      case "elite":
        // Purple/magenta atmosphere for elite rooms
        ambientIntensity = 0.2;
        ambientColor = 0x330066;
        directionalIntensity = 0.8;
        directionalColor = 0xcc33ff;
        break;
      case "boss":
        // Red/orange dramatic lighting for boss rooms
        ambientIntensity = 0.15;
        ambientColor = 0x330000;
        directionalIntensity = 0.9;
        directionalColor = 0xff3300;
        break;
      case "treasure":
        // Golden lighting for treasure rooms
        ambientIntensity = 0.25;
        ambientColor = 0xffd700;
        directionalIntensity = 0.75;
        directionalColor = 0xffd700;
        break;
      case "shop":
        // Yellow lighting for shop rooms
        ambientIntensity = 0.3;
        ambientColor = 0xffff00;
        directionalIntensity = 0.7;
        directionalColor = 0xffff00;
        break;
      case "secret":
        // Dim lighting for secret rooms
        ambientIntensity = 0.1;
        ambientColor = 0x111111;
        directionalIntensity = 0.5;
        directionalColor = 0x222222;
        break;
      default:
        // Blue/green for normal rooms
        ambientIntensity = 0.3;
        ambientColor = 0x002233;
        directionalIntensity = 0.7;
        directionalColor = 0x00ff99;
    }

    // Create ambient light
    this.environmentLighting.ambientLight = new THREE.AmbientLight(
      ambientColor,
      ambientIntensity
    );
    this.scene.add(this.environmentLighting.ambientLight);

    // Create directional light with shadows
    this.environmentLighting.directionalLight = new THREE.DirectionalLight(
      directionalColor,
      directionalIntensity
    );
    this.environmentLighting.directionalLight.position.set(5, 10, 5);
    this.environmentLighting.directionalLight.castShadow = true;

    // Configure shadow properties
    this.environmentLighting.directionalLight.shadow.mapSize.width = 2048;
    this.environmentLighting.directionalLight.shadow.mapSize.height = 2048;
    this.environmentLighting.directionalLight.shadow.camera.near = 0.5;
    this.environmentLighting.directionalLight.shadow.camera.far = 50;
    this.environmentLighting.directionalLight.shadow.bias = -0.0005;

    const shadowCamSize = 15;
    this.environmentLighting.directionalLight.shadow.camera.left =
      -shadowCamSize;
    this.environmentLighting.directionalLight.shadow.camera.right =
      shadowCamSize;
    this.environmentLighting.directionalLight.shadow.camera.top = shadowCamSize;
    this.environmentLighting.directionalLight.shadow.camera.bottom =
      -shadowCamSize;

    this.scene.add(this.environmentLighting.directionalLight);

    // Add atmospheric point lights based on room type
    if (type === "elite") {
      // Add purple accent lights
      this.addAtmosphericLight(0x9900ff, 0.8, 5, -10, 5, 0, 15);
      this.addAtmosphericLight(0x6600ff, 0.6, 10, 5, 3, 0, 20);
    } else if (type === "boss") {
      // Add dramatic red lighting
      this.addAtmosphericLight(0xff3300, 1.2, 0, 5, 0, 0, 25);
      this.addAtmosphericLight(0xff6600, 0.7, -15, 3, -15, 0, 20);
      this.addAtmosphericLight(0xff0000, 0.7, 15, 3, -15, 0, 20);
    } else {
      // Add subtle atmospheric lights for normal rooms
      this.addAtmosphericLight(0x00ffaa, 0.4, 10, 3, 10, 0, 15);
      this.addAtmosphericLight(0x0099ff, 0.3, -10, 4, -10, 0, 20);
    }
  }

  /**
   * Add an atmospheric point light
   */
  private addAtmosphericLight(
    color: number,
    intensity: number,
    x: number,
    y: number,
    z: number,
    decay: number,
    distance: number
  ): void {
    const light = new THREE.PointLight(color, intensity, distance, decay);
    light.position.set(x, y, z);
    this.scene.add(light);
    this.environmentLighting.pointLights.push(light);
  }

  /**
   * Trigger a screen flash effect
   */
  flashScreen(
    color: THREE.Color | number | string = 0xffffff,
    intensity: number = 1.0,
    duration: number = 0.3
  ): void {
    this.screenFlash.active = true;
    this.screenFlash.color = new THREE.Color(color);
    this.screenFlash.maxIntensity = intensity;
    this.screenFlash.intensity = intensity;
    this.screenFlash.duration = duration;
    this.screenFlash.elapsedTime = 0;
  }

  /**
   * Update flash effect
   */
  private updateScreenFlash(deltaTime: number): void {
    if (!this.screenFlash.active) return;

    this.screenFlash.elapsedTime += deltaTime;

    // Calculate flash intensity
    const progress = this.screenFlash.elapsedTime / this.screenFlash.duration;
    this.screenFlash.intensity = this.screenFlash.maxIntensity * (1 - progress);

    // Check if flash is complete
    if (progress >= 1.0) {
      this.screenFlash.active = false;
      this.screenFlash.intensity = 0;
    }

    // Apply flash effect (could be implemented in different ways)
    // For now, simple screen overlay
    const flashPass = this.customPasses.get("vignette");
    if (flashPass) {
      // Temporarily reduce vignette to create flash effect
      const originalOffset = this.vignetteParams.offset;
      flashPass.uniforms.offset.value =
        originalOffset * (1 - this.screenFlash.intensity * 0.5);
    }
  }

  /**
   * Create attack trail effect
   */
  createAttackTrail(
    startPoint: THREE.Vector3,
    endPoint: THREE.Vector3,
    color: THREE.Color | number | string,
    width: number = 1.0
  ): void {
    // Create a curve between points
    const curve = new THREE.LineCurve3(startPoint, endPoint);
    const points = curve.getPoints(10);

    // Create a trail mesh
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      linewidth: width,
      transparent: true,
      opacity: 0.7,
    });

    const trailMesh = new THREE.Line(geometry, material);
    this.scene.add(trailMesh);

    // Remove after a short time
    setTimeout(() => {
      this.scene.remove(trailMesh);
      geometry.dispose();
      material.dispose();
    }, 200);

    // Also add particles along the trail
    const trailLength = startPoint.distanceTo(endPoint);
    const particleCount = Math.ceil(trailLength * 5); // 5 particles per unit

    for (let i = 0; i < particleCount; i++) {
      const t = i / particleCount;
      const pos = new THREE.Vector3().lerpVectors(startPoint, endPoint, t);

      // Add some random variation
      pos.x += (Math.random() - 0.5) * 0.5;
      pos.y += (Math.random() - 0.5) * 0.5;
      pos.z += (Math.random() - 0.5) * 0.5;

      // Emit particles with color matching the trail
      this.particleSystem.emitParticles(
        "dash",
        pos,
        1,
        300,
        0.2,
        0.05,
        new THREE.Color(color)
      );
    }
  }

  /**
   * Create impact effect at position
   */
  createImpactEffect(
    position: THREE.Vector3,
    color: THREE.Color | number | string,
    size: number = 1.0
  ): void {
    // Emit particles in an explosion pattern
    this.particleSystem.emitParticles(
      "hit",
      position,
      15,
      500,
      size,
      0.2,
      new THREE.Color(color)
    );

    // Add a point light flash
    const light = new THREE.PointLight(color, 2.0, size * 5, 2);
    light.position.copy(position);
    this.scene.add(light);

    // Remove light after a short time
    setTimeout(() => {
      this.scene.remove(light);
    }, 200);

    // Add a flash to the screen
    this.flashScreen(color, 0.3, 0.2);
  }

  /**
   * Create death effect for enemies
   */
  createDeathEffect(
    position: THREE.Vector3,
    type: "normal" | "elite" | "boss"
  ): void {
    let color: THREE.Color;
    let size: number;
    let particleCount: number;

    switch (type) {
      case "elite":
        color = new THREE.Color(0xaa00ff);
        size = 2.0;
        particleCount = 30;
        break;
      case "boss":
        color = new THREE.Color(0xff0000);
        size = 4.0;
        particleCount = 50;
        // Also flash the screen for boss death
        this.flashScreen(0xff0000, 0.5, 0.5);
        break;
      default:
        color = new THREE.Color(0xff6600);
        size = 1.0;
        particleCount = 20;
    }

    // Create main explosion particles
    this.particleSystem.emitParticles(
      "death",
      position,
      particleCount,
      1000,
      size,
      0.3,
      color
    );

    // Add some fire particles
    this.particleSystem.emitParticles(
      "fire",
      position,
      Math.floor(particleCount * 0.7),
      800,
      size * 0.8,
      0.2
    );

    // Add a point light flash
    const light = new THREE.PointLight(color, 3.0, size * 10, 2);
    light.position.copy(position);
    this.scene.add(light);

    // Remove light after a short time
    setTimeout(() => {
      this.scene.remove(light);
    }, 500);
  }

  /**
   * Create healing effect
   */
  createHealEffect(position: THREE.Vector3, amount: number): void {
    const color = new THREE.Color(0x00ff66);
    const size = amount / 20; // Scale based on heal amount

    // Create healing particles that float upward
    this.particleSystem.emitParticles(
      "heal",
      position,
      15,
      1000,
      size,
      0.05,
      color
    );

    // Add a gentle green light
    const light = new THREE.PointLight(0x00ff66, 1.0, size * 5, 2);
    light.position.copy(position);
    this.scene.add(light);

    // Remove light after a short time
    setTimeout(() => {
      this.scene.remove(light);
    }, 500);
  }

  /**
   * Create buff effect around a character
   */
  createBuffEffect(
    target: THREE.Object3D,
    color: THREE.Color | number | string,
    duration: number
  ): void {
    const bufColor = new THREE.Color(color);

    // Create a persistent emitter that follows the target
    const emitInterval = 100; // ms
    let elapsedTime = 0;

    const emitBuffParticles = () => {
      if (elapsedTime >= duration) return;

      // Get current position
      const position = new THREE.Vector3();
      target.getWorldPosition(position);

      // Add some height offset
      position.y += 1.0;

      // Emit particles in a circle around the character
      const particleCount = 3;
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const radius = 0.7;
        const offsetX = Math.cos(angle) * radius;
        const offsetZ = Math.sin(angle) * radius;

        const particlePos = position
          .clone()
          .add(new THREE.Vector3(offsetX, 0, offsetZ));
        this.particleSystem.emitParticles(
          "buff",
          particlePos,
          1,
          500,
          0.3,
          0.05,
          bufColor
        );
      }

      // Schedule next emission
      elapsedTime += emitInterval;
      setTimeout(emitBuffParticles, emitInterval);
    };

    // Start emission
    emitBuffParticles();

    // Create glow effect around character
    // This would be better implemented with a custom shader
    // For now, just a simple point light
    const buffLight = new THREE.PointLight(color, 0.5, 3, 1);
    target.add(buffLight);

    // Remove light after duration
    setTimeout(() => {
      target.remove(buffLight);
    }, duration);
  }

  /**
   * Update all visual effects
   */
  update(deltaTime: number): void {
    // Update screen flash
    this.updateScreenFlash(deltaTime);

    // Update animated shader parameters
    this.shaderTime += deltaTime;

    // Update chromatic aberration if animated
    if (this.chromaticAberrationParams.animateStrength) {
      const caPass = this.customPasses.get("chromaticAberration");
      if (caPass) {
        caPass.uniforms.time.value = this.shaderTime;
      }
    }

    // Update environment lights
    this.updateEnvironmentLights(deltaTime);

    // Update particle system
    this.particleSystem.update();

    // Render using the effect composer
    this.composer.render();
  }

  /**
   * Update environment lights (flickering, etc.)
   */
  private updateEnvironmentLights(deltaTime: number): void {
    // Example: subtle flickering for point lights
    this.environmentLighting.pointLights.forEach((light, index) => {
      // Different phase for each light
      const phase = index * 0.5;
      const flickerAmount = 0.1; // 10% intensity variation

      // Calculate flicker using noise functions
      const flicker = Math.sin(this.shaderTime * 2 + phase) * 0.5 + 0.5;
      const originalIntensity = light.userData.originalIntensity;

      // Store original intensity if not already stored
      if (originalIntensity === undefined) {
        light.userData.originalIntensity = light.intensity;
      }

      // Apply flicker
      light.intensity =
        (light.userData.originalIntensity || light.intensity) *
        (1 - flickerAmount + flickerAmount * flicker);
    });
  }

  /**
   * Handle window resize
   */
  handleResize(width: number, height: number): void {
    // Update renderer and composer
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);

    // Update uniforms that depend on resolution
    const resolution = new THREE.Vector2(width, height);

    this.customPasses.forEach((pass) => {
      if (pass.uniforms.resolution) {
        pass.uniforms.resolution.value = resolution;
      }
    });

    // Update bloom pass resolution
    const bloomPass = this.customPasses.get(
      "bloom"
    ) as unknown as UnrealBloomPass;
    if (bloomPass) {
      bloomPass.resolution.set(width, height);
    }
  }

  /**
   * Update effect settings
   */
  updateEffectSettings(settings: any): void {
    // Update bloom settings
    if (settings.bloom) {
      const bloomPass = this.customPasses.get(
        "bloom"
      ) as unknown as UnrealBloomPass;
      if (bloomPass) {
        if (settings.bloom.strength !== undefined)
          bloomPass.strength = settings.bloom.strength;
        if (settings.bloom.radius !== undefined)
          bloomPass.radius = settings.bloom.radius;
        if (settings.bloom.threshold !== undefined)
          bloomPass.threshold = settings.bloom.threshold;
      }

      this.bloomParams = { ...this.bloomParams, ...settings.bloom };
    }

    // Update chromatic aberration
    if (settings.chromaticAberration) {
      const caPass = this.customPasses.get("chromaticAberration");
      if (caPass) {
        if (settings.chromaticAberration.strength !== undefined) {
          caPass.uniforms.aberrationStrength.value =
            settings.chromaticAberration.strength;
        }
      }

      this.chromaticAberrationParams = {
        ...this.chromaticAberrationParams,
        ...settings.chromaticAberration,
      };
    }

    // Update vignette
    if (settings.vignette) {
      const vignettePass = this.customPasses.get("vignette");
      if (vignettePass) {
        if (settings.vignette.offset !== undefined)
          vignettePass.uniforms.offset.value = settings.vignette.offset;
        if (settings.vignette.darkness !== undefined)
          vignettePass.uniforms.darkness.value = settings.vignette.darkness;
      }

      this.vignetteParams = { ...this.vignetteParams, ...settings.vignette };
    }
  }
}
