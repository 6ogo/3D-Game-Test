import * as THREE from 'three';

// -------------------- VERTEX SHADERS --------------------

// Glow shader vertex
const glowVertexShader = `
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;

void main() {
  vUv = uv;
  vPosition = position;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Outline shader vertex
const outlineVertexShader = `
uniform float thickness;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;
  
  // Extrude vertices in normal direction
  vec3 newPosition = position + normal * thickness;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
`;

// Dissolve effect vertex shader
const dissolveVertexShader = `
varying vec2 vUv;
varying vec3 vPosition;

void main() {
  vUv = uv;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Wave effect for water or energy fields
const waveVertexShader = `
uniform float time;
uniform float amplitude;
uniform float frequency;
varying vec2 vUv;
varying vec3 vPosition;

void main() {
  vUv = uv;
  vPosition = position;
  
  // Calculate wave offset
  float waveX = sin(position.x * frequency + time) * amplitude;
  float waveY = cos(position.z * frequency + time) * amplitude;
  vec3 newPosition = position;
  newPosition.y += waveX + waveY;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
`;

// -------------------- FRAGMENT SHADERS --------------------

// Glow shader fragment
const glowFragmentShader = `
uniform vec3 glowColor;
uniform float intensity;
uniform float power;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;

void main() {
  // Calculate glow factor
  float glow = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), power);
  vec3 finalColor = glowColor * intensity * glow;
  
  gl_FragColor = vec4(finalColor, glow);
}
`;

// Outline shader fragment
const outlineFragmentShader = `
uniform vec3 color;
uniform float alpha;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  gl_FragColor = vec4(color, alpha);
}
`;

// Dissolve effect fragment shader
const dissolveFragmentShader = `
uniform sampler2D dissolveTexture;
uniform float dissolveAmount;
uniform vec3 dissolveColor;
uniform vec3 edgeColor;
uniform float edgeWidth;
varying vec2 vUv;

void main() {
  vec4 baseColor = vec4(dissolveColor, 1.0);
  
  // Sample noise texture for dissolve effect
  float noise = texture2D(dissolveTexture, vUv).r;
  
  // Calculate dissolve edge
  float edge = smoothstep(dissolveAmount, dissolveAmount + edgeWidth, noise);
  float alpha = smoothstep(dissolveAmount - edgeWidth, dissolveAmount, noise);
  
  // Edge coloring
  vec3 finalColor = mix(edgeColor, baseColor.rgb, edge);
  
  gl_FragColor = vec4(finalColor, alpha);
}
`;

// Hit flash effect
const hitFlashFragmentShader = `
uniform vec3 baseColor;
uniform vec3 flashColor;
uniform float flashIntensity;
uniform float time;

void main() {
  // Pulse the flash intensity based on time
  float pulseIntensity = flashIntensity * (1.0 - pow(sin(time * 10.0), 2.0));
  
  // Mix base color with flash color
  vec3 finalColor = mix(baseColor, flashColor, pulseIntensity);
  
  gl_FragColor = vec4(finalColor, 1.0);
}
`;

// Hologram effect
const hologramFragmentShader = `
uniform vec3 hologramColor;
uniform float scanlineIntensity;
uniform float scanlineCount;
uniform float glitchIntensity;
uniform float time;
varying vec2 vUv;

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
  // Scanlines
  float scanlines = abs(sin(vUv.y * scanlineCount - time * 2.0)) * scanlineIntensity;
  
  // Random glitching
  float glitch = 0.0;
  if (random(vec2(time, vUv.y)) < glitchIntensity * 0.1) {
    glitch = random(vUv) * glitchIntensity;
  }
  
  // Edge effect - stronger at edges
  float edge = pow(abs(dot(vec3(0.0, 0.0, 1.0), vec3(0.0, 0.0, 1.0))), 2.0);
  
  // Combine effects
  vec3 finalColor = hologramColor * (1.0 + scanlines + glitch + edge);
  float alpha = 0.7 + scanlines * 0.1;
  
  gl_FragColor = vec4(finalColor, alpha);
}
`;

// Fire effect shader
const fireFragmentShader = `
uniform sampler2D noiseTexture;
uniform vec3 baseFireColor;
uniform vec3 flameTipColor;
uniform float time;
uniform float intensity;
varying vec2 vUv;

void main() {
  // Sample noise texture with scrolling coordinates
  vec2 uv1 = vUv + vec2(0.0, time * 0.05);
  vec2 uv2 = vUv + vec2(0.0, time * 0.08) + vec2(0.1, 0.0);
  
  float noise1 = texture2D(noiseTexture, uv1).r;
  float noise2 = texture2D(noiseTexture, uv2).r;
  
  // Combine noise samples
  float finalNoise = (noise1 * 0.7 + noise2 * 0.3) * intensity;
  
  // Stronger at bottom, fading to top
  finalNoise *= (1.0 - vUv.y);
  
  // Apply threshold for shape
  float threshold = smoothstep(0.1, 0.9, finalNoise);
  
  // Color gradient from base to tip
  vec3 fireColor = mix(baseFireColor, flameTipColor, vUv.y);
  
  gl_FragColor = vec4(fireColor, threshold);
}
`;

// Energy/magic effect shader
const energyFragmentShader = `
uniform vec3 energyColor;
uniform float time;
uniform float pulseSpeed;
uniform float noiseIntensity;
varying vec2 vUv;

// Simple 2D noise function
float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  // Create flowing energy pattern
  float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
  float radius = length(vUv - 0.5) * 2.0;
  
  // Spiraling pattern
  float spiral = sin(radius * 10.0 - time * 2.0 + angle * 3.0);
  
  // Add noise for variation
  float noiseVal = noise(vUv + time * 0.1) * noiseIntensity;
  
  // Pulsing glow
  float pulse = 0.5 + 0.5 * sin(time * pulseSpeed);
  
  // Combine effects
  float energy = smoothstep(0.3, 0.7, spiral + noiseVal) * pulse;
  
  // Apply color
  vec3 finalColor = energyColor * energy;
  
  gl_FragColor = vec4(finalColor, energy * 0.8);
}
`;

// Environment mapping and reflections
const environmentMapFragmentShader = `
uniform samplerCube envMap;
uniform float reflectivity;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;

void main() {
  vec3 viewDirection = normalize(vPosition - cameraPosition);
  vec3 normal = normalize(vNormal);
  
  // Calculate reflection vector
  vec3 reflectionVector = reflect(viewDirection, normal);
  
  // Sample environment map
  vec4 envColor = textureCube(envMap, reflectionVector);
  
  // Base material color (could be from a uniform or texture)
  vec4 baseColor = vec4(0.2, 0.2, 0.2, 1.0);
  
  // Blend based on reflectivity
  vec4 finalColor = mix(baseColor, envColor, reflectivity);
  
  gl_FragColor = finalColor;
}
`;

// -------------------- USAGE EXAMPLES IN THREE.JS --------------------

// Create a glow effect material

// Apply outline to an object

// Create a dissolve effect material

// Create a hit flash effect

// Create hologram material

// Create fire material

// Create energy/magic material

// Create environment mapping material

// -------------------- JAVASCRIPT IMPLEMENTATION --------------------

// ShaderManager class for Three.js
export class ShaderManager {
  shaders: {
    // Vertex shaders
    glowVertex: string; outlineVertex: string; dissolveVertex: string; waveVertex: string;
    // Fragment shaders
    glowFragment: string; outlineFragment: string; dissolveFragment: string; hitFlashFragment: string; hologramFragment: string; fireFragment: string; energyFragment: string; environmentMapFragment: string;
  };
  noiseTextures: { [key: string]: THREE.Texture };
  animatedObjects: Map<any, any>;
  clock: any;
  constructor() {
    this.shaders = {
      // Vertex shaders
      glowVertex: glowVertexShader,
      outlineVertex: outlineVertexShader,
      dissolveVertex: dissolveVertexShader,
      waveVertex: waveVertexShader,
      
      // Fragment shaders
      glowFragment: glowFragmentShader,
      outlineFragment: outlineFragmentShader,
      dissolveFragment: dissolveFragmentShader,
      hitFlashFragment: hitFlashFragmentShader,
      hologramFragment: hologramFragmentShader,
      fireFragment: fireFragmentShader,
      energyFragment: energyFragmentShader,
      environmentMapFragment: environmentMapFragmentShader
    };
    
    // Cache for noise textures
    this.noiseTextures = {};
    
    // Track objects with animated shaders
    this.animatedObjects = new Map();
    
    // Time tracker for animation
    this.clock = new THREE.Clock();
  }
  
  // Create a glow material
  createGlowMaterial(color = 0x00ffff, intensity = 1.5, power = 2.0) {
    return new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color(color) },
        intensity: { value: intensity },
        power: { value: power }
      },
      vertexShader: this.shaders.glowVertex,
      fragmentShader: this.shaders.glowFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending
    });
  }
  
  // Create outline effect
  createOutlineMaterial(color = 0xffffff, thickness = 0.05, alpha = 1.0) {
    return new THREE.ShaderMaterial({
      uniforms: {
        thickness: { value: thickness },
        color: { value: new THREE.Color(color) },
        alpha: { value: alpha }
      },
      vertexShader: this.shaders.outlineVertex,
      fragmentShader: this.shaders.outlineFragment,
      transparent: alpha < 1.0,
      side: THREE.BackSide
    });
  }
  
  // Apply outline to an object
  addOutlineEffect(object: { geometry: any; parent: { add: (arg0: THREE.Mesh<any, THREE.ShaderMaterial, THREE.Object3DEventMap>) => void; }; position: THREE.Vector3Like; rotation: THREE.Euler; }, color = 0xffffff, thickness = 0.05) {
    // Create outline material
    const outlineMaterial = this.createOutlineMaterial(color, thickness);
    
    // Create outline mesh
    const outlineMesh = new THREE.Mesh(object.geometry, outlineMaterial);
    outlineMesh.scale.multiplyScalar(1.05); // Slightly larger
    object.parent.add(outlineMesh);
    
    // Copy transformations
    outlineMesh.position.copy(object.position);
    outlineMesh.rotation.copy(object.rotation);
    outlineMesh.updateMatrix();
    
    // Return for later reference
    return outlineMesh;
  }
  
  // Load or create a noise texture
  getNoiseTexture(resolution = 256) {
    const key = `noise_${resolution}`;
    
    if (this.noiseTextures[key]) {
      return this.noiseTextures[key];
    }
    
    // Create noise texture procedurally
    const size = resolution * resolution;
    const data = new Uint8Array(size * 4);
    
    for (let i = 0; i < size; i++) {
      const stride = i * 4;
      const value = Math.floor(Math.random() * 255);
      data[stride] = value;
      data[stride + 1] = value;
      data[stride + 2] = value;
      data[stride + 3] = 255;
    }
    
    const texture = new THREE.DataTexture(
      data,
      resolution,
      resolution,
      THREE.RGBAFormat
    );
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    
    this.noiseTextures[key] = texture;
    return texture;
  }
  
  // Create dissolve material
  createDissolveMaterial(color = 0xff00ff, edgeColor = 0xffffff, dissolveAmount = 0.0) {
    // Get noise texture
    const noiseTexture = this.getNoiseTexture(256);
    
    return new THREE.ShaderMaterial({
      uniforms: {
        dissolveTexture: { value: noiseTexture },
        dissolveAmount: { value: dissolveAmount },
        dissolveColor: { value: new THREE.Color(color) },
        edgeColor: { value: new THREE.Color(edgeColor) },
        edgeWidth: { value: 0.05 }
      },
      vertexShader: this.shaders.dissolveVertex,
      fragmentShader: this.shaders.dissolveFragment,
      transparent: true
    });
  }
  
  // Apply dissolve effect over time
  applyDissolveEffect(object: { material: THREE.ShaderMaterial; }, duration = 2.0, delay = 0.0, onComplete: (() => void) | null = null) {
    // Store original material
    const originalMaterial = object.material;
    
    // Create dissolve material
    const dissolveMaterial = this.createDissolveMaterial(
      originalMaterial.uniforms.baseColor ? originalMaterial.uniforms.baseColor.value : new THREE.Color(0xffffff)
    );
    
    // Apply material
    object.material = dissolveMaterial;
    
    // Setup animation
    const startTime = this.clock.elapsedTime + delay;
    const endTime = startTime + duration;
    
    const updateFunction = (time: number) => {
      if (time < startTime) return false;
      
      const progress = Math.min(1.0, (time - startTime) / duration);
      dissolveMaterial.uniforms.dissolveAmount.value = progress;
      
      if (time >= endTime) {
        if (onComplete) onComplete();
        return true; // Animation complete
      }
      
      return false; // Animation still running
    };
    
    // Add to animated objects
    this.animatedObjects.set(object, updateFunction);
    
    return dissolveMaterial;
  }
  
  // Create hit flash material
  createHitFlashMaterial(baseColor = 0xffffff, flashColor = 0xff0000) {
    return new THREE.ShaderMaterial({
      uniforms: {
        baseColor: { value: new THREE.Color(baseColor) },
        flashColor: { value: new THREE.Color(flashColor) },
        flashIntensity: { value: 1.0 },
        time: { value: 0.0 }
      },
      vertexShader: this.shaders.glowVertex,
      fragmentShader: this.shaders.hitFlashFragment
    });
  }
  
  // Apply hit flash effect
  applyHitFlash(object: { material: THREE.ShaderMaterial; }, flashColor = 0xff0000, duration = 0.3) {
    // Store original material
    const originalMaterial = object.material;
    const baseColor = originalMaterial.uniforms.baseColor ? originalMaterial.uniforms.baseColor.value.clone() : new THREE.Color(0xffffff);
    
    // Create hit flash material
    const hitFlashMaterial = this.createHitFlashMaterial(baseColor, flashColor);
    
    // Apply material
    object.material = hitFlashMaterial;
    
    // Setup animation
    const startTime = this.clock.elapsedTime;
    const endTime = startTime + duration;
    
    const updateFunction = (time: number) => {
      const elapsed = time - startTime;
      hitFlashMaterial.uniforms.time.value = elapsed;
      hitFlashMaterial.uniforms.flashIntensity.value = 1.0 - (elapsed / duration);
      
      if (time >= endTime) {
        object.material = originalMaterial;
        return true; // Animation complete
      }
      
      return false; // Animation still running
    };
    
    // Add to animated objects
    this.animatedObjects.set(object, updateFunction);
  }
  
  // Create hologram material
  createHologramMaterial(color = 0x00ffff) {
    return new THREE.ShaderMaterial({
      uniforms: {
        hologramColor: { value: new THREE.Color(color) },
        scanlineIntensity: { value: 0.2 },
        scanlineCount: { value: 30.0 },
        glitchIntensity: { value: 0.1 },
        time: { value: 0.0 }
      },
      vertexShader: this.shaders.glowVertex,
      fragmentShader: this.shaders.hologramFragment,
      transparent: true,
      depthWrite: false
    });
  }
  
  // Create fire material
  createFireMaterial(baseColor = 0xff5500, tipColor = 0xffff00) {
    // Get noise texture
    const noiseTexture = this.getNoiseTexture(256);
    
    return new THREE.ShaderMaterial({
      uniforms: {
        noiseTexture: { value: noiseTexture },
        baseFireColor: { value: new THREE.Color(baseColor) },
        flameTipColor: { value: new THREE.Color(tipColor) },
        time: { value: 0.0 },
        intensity: { value: 1.0 }
      },
      vertexShader: this.shaders.glowVertex,
      fragmentShader: this.shaders.fireFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }
  
  // Create energy/magic material
  createEnergyMaterial(color = 0x9900ff) {
    return new THREE.ShaderMaterial({
      uniforms: {
        energyColor: { value: new THREE.Color(color) },
        time: { value: 0.0 },
        pulseSpeed: { value: 3.0 },
        noiseIntensity: { value: 0.2 }
      },
      vertexShader: this.shaders.glowVertex,
      fragmentShader: this.shaders.energyFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }
  
  // Create wave material for water or energy fields
  createWaveMaterial(color = 0x0066ff, amplitude = 0.2, frequency = 0.5) {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 },
        amplitude: { value: amplitude },
        frequency: { value: frequency },
        color: { value: new THREE.Color(color) }
      },
      vertexShader: this.shaders.waveVertex,
      fragmentShader: `
        uniform vec3 color;
        varying vec2 vUv;
        
        void main() {
          gl_FragColor = vec4(color, 1.0);
        }
      `
    });
  }
  
  // Update all animated shaders
  update() {
    const time = this.clock.getElapsedTime();
    
    // Update all animated objects
    for (const [object, updateFn] of this.animatedObjects.entries()) {
      const complete = updateFn(time);
      if (complete) {
        this.animatedObjects.delete(object);
      }
    }
    
    // Update time-based uniforms for common shader types
    this.updateTimeBasedUniforms(time);
  }
  
  // Update time-based uniforms in materials
  updateTimeBasedUniforms(time: any) {
    // Find and update materials in the scene
    // This would typically iterate through scene objects in a full implementation
  }
}

// -------------------- POST-PROCESSING EFFECTS --------------------

// Bloom post-processing effect (enhanced version)

// Chromatic aberration effect

// Vignette effect

// God rays / light shaft effect

// Screen-space ambient occlusion (SSAO)

// Pixelation effect

// -------------------- ADVANCED POST-PROCESSING EFFECTS --------------------

// Depth of field

// Motion blur

// Film grain effect

// Color grading with LUT (Look-Up Table)

// Screen-space reflections
