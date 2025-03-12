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

/*
// Create a glow effect material
function createGlowMaterial(color, intensity = 1.5, power = 2.0) {
  return new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(color) },
      intensity: { value: intensity },
      power: { value: power }
    },
    vertexShader: glowVertexShader,
    fragmentShader: glowFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending
  });
}

// Apply outline to an object
function addOutlineEffect(object, color = 0xffffff, thickness = 0.05) {
  // Clone the geometry
  const outlineGeometry = object.geometry.clone();
  
  // Create outline material
  const outlineMaterial = new THREE.ShaderMaterial({
    uniforms: {
      thickness: { value: thickness },
      color: { value: new THREE.Color(color) },
      alpha: { value: 1.0 }
    },
    vertexShader: outlineVertexShader,
    fragmentShader: outlineFragmentShader,
    side: THREE.BackSide
  });
  
  // Create outline mesh
  const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
  object.add(outline);
  
  return outline;
}

// Create a dissolve effect material
function createDissolveMaterial(color, edgeColor = 0xffffff, dissolveAmount = 0.0) {
  // Create noise texture for dissolve effect
  const noiseTexture = new THREE.TextureLoader().load('textures/noise.png');
  noiseTexture.wrapS = noiseTexture.wrapT = THREE.RepeatWrapping;
  
  return new THREE.ShaderMaterial({
    uniforms: {
      dissolveTexture: { value: noiseTexture },
      dissolveAmount: { value: dissolveAmount },
      dissolveColor: { value: new THREE.Color(color) },
      edgeColor: { value: new THREE.Color(edgeColor) },
      edgeWidth: { value: 0.05 }
    },
    vertexShader: dissolveVertexShader,
    fragmentShader: dissolveFragmentShader,
    transparent: true
  });
}

// Create a hit flash effect
function applyHitFlash(object, flashColor = 0xff0000, duration = 0.3) {
  // Store original material
  const originalMaterial = object.material;
  const baseColor = originalMaterial.color ? originalMaterial.color.clone() : new THREE.Color(0xffffff);
  
  // Create hit flash material
  const hitFlashMaterial = new THREE.ShaderMaterial({
    uniforms: {
      baseColor: { value: baseColor },
      flashColor: { value: new THREE.Color(flashColor) },
      flashIntensity: { value: 1.0 },
      time: { value: 0.0 }
    },
    vertexShader: glowVertexShader, // Reuse the glow vertex shader
    fragmentShader: hitFlashFragmentShader
  });
  
  // Apply material
  object.material = hitFlashMaterial;
  
  // Animate flash over time
  let elapsedTime = 0;
  const animate = (delta) => {
    elapsedTime += delta;
    hitFlashMaterial.uniforms.time.value = elapsedTime;
    hitFlashMaterial.uniforms.flashIntensity.value = 1.0 - (elapsedTime / duration);
    
    if (elapsedTime < duration) {
      requestAnimationFrame(() => animate(1/60));
    } else {
      // Restore original material
      object.material = originalMaterial;
    }
  };
  
  // Start animation
  animate(0);
}

// Create hologram material
function createHologramMaterial(color = 0x00ffff) {
  return new THREE.ShaderMaterial({
    uniforms: {
      hologramColor: { value: new THREE.Color(color) },
      scanlineIntensity: { value: 0.2 },
      scanlineCount: { value: 30.0 },
      glitchIntensity: { value: 0.1 },
      time: { value: 0.0 }
    },
    vertexShader: glowVertexShader, // Reuse the glow vertex shader
    fragmentShader: hologramFragmentShader,
    transparent: true,
    depthWrite: false
  });
}

// Create fire material
function createFireMaterial(baseColor = 0xff5500, tipColor = 0xffff00) {
  // Create noise texture
  const noiseTexture = new THREE.TextureLoader().load('textures/noise.png');
  noiseTexture.wrapS = noiseTexture.wrapT = THREE.RepeatWrapping;
  
  return new THREE.ShaderMaterial({
    uniforms: {
      noiseTexture: { value: noiseTexture },
      baseFireColor: { value: new THREE.Color(baseColor) },
      flameTipColor: { value: new THREE.Color(tipColor) },
      time: { value: 0.0 },
      intensity: { value: 1.0 }
    },
    vertexShader: glowVertexShader, // Reuse the glow vertex shader
    fragmentShader: fireFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

// Create energy/magic material
function createEnergyMaterial(color = 0x9900ff) {
  return new THREE.ShaderMaterial({
    uniforms: {
      energyColor: { value: new THREE.Color(color) },
      time: { value: 0.0 },
      pulseSpeed: { value: 3.0 },
      noiseIntensity: { value: 0.2 }
    },
    vertexShader: glowVertexShader, // Reuse the glow vertex shader
    fragmentShader: energyFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

// Create environment mapping material
function createEnvironmentMapMaterial(envMap, reflectivity = 0.8) {
  return new THREE.ShaderMaterial({
    uniforms: {
      envMap: { value: envMap },
      reflectivity: { value: reflectivity }
    },
    vertexShader: glowVertexShader, // Reuse the glow vertex shader
    fragmentShader: environmentMapFragmentShader
  });
}
*/

// -------------------- JAVASCRIPT IMPLEMENTATION --------------------

// ShaderManager class for Three.js
class ShaderManager {
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
  addOutlineEffect(object, color = 0xffffff, thickness = 0.05) {
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
  applyDissolveEffect(object, duration = 2.0, delay = 0.0, onComplete = null) {
    // Store original material
    const originalMaterial = object.material;
    
    // Create dissolve material
    const dissolveMaterial = this.createDissolveMaterial(
      originalMaterial.color ? originalMaterial.color : 0xffffff
    );
    
    // Apply material
    object.material = dissolveMaterial;
    
    // Setup animation
    const startTime = this.clock.elapsedTime + delay;
    const endTime = startTime + duration;
    
    const updateFunction = (time) => {
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
  applyHitFlash(object, flashColor = 0xff0000, duration = 0.3) {
    // Store original material
    const originalMaterial = object.material;
    const baseColor = originalMaterial.color ? originalMaterial.color.clone() : new THREE.Color(0xffffff);
    
    // Create hit flash material
    const hitFlashMaterial = this.createHitFlashMaterial(baseColor, flashColor);
    
    // Apply material
    object.material = hitFlashMaterial;
    
    // Setup animation
    const startTime = this.clock.elapsedTime;
    const endTime = startTime + duration;
    
    const updateFunction = (time) => {
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
  updateTimeBasedUniforms(time) {
    // Find and update materials in the scene
    // This would typically iterate through scene objects in a full implementation
  }
}

// -------------------- POST-PROCESSING EFFECTS --------------------

// Bloom post-processing effect (enhanced version)
const bloomFragmentShader = `
uniform sampler2D baseTexture;
uniform sampler2D bloomTexture;
uniform float bloomStrength;
uniform float bloomRadius;
uniform float threshold;

varying vec2 vUv;

void main() {
  vec4 baseColor = texture2D(baseTexture, vUv);
  vec4 bloomColor = texture2D(bloomTexture, vUv);
  
  // Apply threshold for bloom
  vec3 luminance = vec3(0.299, 0.587, 0.114);
  float luma = dot(baseColor.rgb, luminance);
  
  // Apply bloom effect
  bloomColor.rgb = pow(bloomColor.rgb, vec3(bloomRadius));
  vec3 finalColor = baseColor.rgb + bloomColor.rgb * bloomStrength;
  
  gl_FragColor = vec4(finalColor, baseColor.a);
}
`;

// Chromatic aberration effect
const chromaticAberrationFragmentShader = `
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
`;

// Vignette effect
const vignetteFragmentShader = `
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
`;

// God rays / light shaft effect
const godRaysFragmentShader = `
uniform sampler2D tDiffuse;
uniform sampler2D lightPositionTexture;
uniform vec2 lightPosition;
uniform float exposure;
uniform float decay;
uniform float density;
uniform float weight;
uniform float clampValue;
uniform int numSamples;

varying vec2 vUv;

void main() {
  // Ray march from pixel to light position
  vec2 deltaTextCoord = vUv - lightPosition;
  deltaTextCoord *= 1.0 / float(numSamples) * density;
  vec2 textCoord = vUv;
  vec4 color = vec4(0.0);
  
  for (int i = 0; i < numSamples; i++) {
    textCoord -= deltaTextCoord;
    vec4 sample = texture2D(tDiffuse, textCoord);
    sample *= weight * (1.0 - i / float(numSamples)) * decay;
    color += sample;
  }
  
  // Apply exposure and clamp
  color *= exposure;
  color = clamp(color, 0.0, clampValue);
  
  gl_FragColor = color;
}
`;

// Screen-space ambient occlusion (SSAO)
const ssaoFragmentShader = `
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform vec2 resolution;
uniform float cameraNear;
uniform float cameraFar;
uniform float radius;
uniform float bias;
uniform vec3 samples[16]; // Random sampling positions

varying vec2 vUv;

float linearizeDepth(float depth) {
  float z = depth * 2.0 - 1.0;
  return (2.0 * cameraNear * cameraFar) / (cameraFar + cameraNear - z * (cameraFar - cameraNear));
}

void main() {
  // Get base values from textures
  vec4 color = texture2D(tDiffuse, vUv);
  float depth = linearizeDepth(texture2D(tDepth, vUv).r);
  vec3 normal = texture2D(tNormal, vUv).rgb * 2.0 - 1.0;
  
  // Calculate SSAO
  float occlusion = 0.0;
  
  for (int i = 0; i < 16; i++) {
    // Get sample position
    vec3 samplePos = samples[i];
    
    // Orient sample with normal
    samplePos = samplePos * radius + normal * bias;
    
    // Project sample
    vec2 offset = vUv + samplePos.xy;
    float sampleDepth = linearizeDepth(texture2D(tDepth, offset).r);
    
    // Occlusion contribution
    float difference = depth - sampleDepth;
    occlusion += step(0.01, difference) * (1.0 - smoothstep(0.01, radius, difference));
  }
  
  occlusion = 1.0 - (occlusion / 16.0);
  
  // Apply occlusion to color
  gl_FragColor = vec4(color.rgb * occlusion, color.a);
}
`;

// Pixelation effect
const pixelationFragmentShader = `
uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform float pixelSize;

varying vec2 vUv;

void main() {
  vec2 pixels = resolution / pixelSize;
  vec2 pixelUv = floor(vUv * pixels) / pixels;
  
  vec4 texel = texture2D(tDiffuse, pixelUv);
  gl_FragColor = texel;
}
`;

// -------------------- ADVANCED POST-PROCESSING EFFECTS --------------------

// Depth of field
const depthOfFieldFragmentShader = `
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform float focusDistance;
uniform float focusRange;
uniform float bokehStrength;
uniform vec2 resolution;

varying vec2 vUv;

float linearizeDepth(float depth) {
  return depth;  // Assuming depth is already linearized
}

void main() {
  float depth = linearizeDepth(texture2D(tDepth, vUv).r);
  
  // Calculate circle of confusion size
  float coc = clamp((abs(depth - focusDistance) - focusRange) / focusRange, 0.0, 1.0) * bokehStrength;
  
  // Skip blur if in focus
  if (coc < 0.01) {
    gl_FragColor = texture2D(tDiffuse, vUv);
    return;
  }
  
  // Calculate blur based on CoC
  vec4 blurColor = vec4(0.0);
  float totalWeight = 0.0;
  
  // Bokeh blur
  int samples = 16;
  for (int i = 0; i < samples; i++) {
    float angle = float(i) * (3.14159 * 2.0) / float(samples);
    float radius = sqrt(float(i) / float(samples)) * coc;
    
    vec2 offset = vec2(cos(angle), sin(angle)) * radius / resolution;
    vec4 sampleColor = texture2D(tDiffuse, vUv + offset);
    
    // Weight based on sample CoC (consider samples with similar depth)
    float sampleDepth = linearizeDepth(texture2D(tDepth, vUv + offset).r);
    float sampleCoc = clamp((abs(sampleDepth - focusDistance) - focusRange) / focusRange, 0.0, 1.0) * bokehStrength;
    
    float weight = 1.0;
    blurColor += sampleColor * weight;
    totalWeight += weight;
  }
  
  gl_FragColor = blurColor / totalWeight;
}
`;

// Motion blur
const motionBlurFragmentShader = `
uniform sampler2D tDiffuse;
uniform sampler2D tPrevious;
uniform float intensity;

varying vec2 vUv;

void main() {
  vec4 currentColor = texture2D(tDiffuse, vUv);
  vec4 previousColor = texture2D(tPrevious, vUv);
  
  gl_FragColor = mix(currentColor, previousColor, intensity);
}
`;

// Film grain effect
const filmGrainFragmentShader = `
uniform sampler2D tDiffuse;
uniform float time;
uniform float grainIntensity;
uniform float grainSize;

varying vec2 vUv;

float random(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec4 color = texture2D(tDiffuse, vUv);
  
  // Calculate grain
  vec2 grainUv = vUv * grainSize;
  grainUv.y += time;
  float grain = random(grainUv) * grainIntensity;
  
  // Apply grain
  color.rgb += vec3(grain);
  
  gl_FragColor = color;
}
`;

// Color grading with LUT (Look-Up Table)
const colorGradingFragmentShader = `
uniform sampler2D tDiffuse;
uniform sampler2D tLUT;
uniform float intensity;

varying vec2 vUv;

void main() {
  vec4 color = texture2D(tDiffuse, vUv);
  
  // Extract each color component
  // The LUT is typically a 2D texture storing a 3D lookup table
  float blueColor = color.b * 63.0;
  
  vec2 quad1;
  quad1.y = floor(floor(blueColor) / 8.0);
  quad1.x = floor(blueColor) - (quad1.y * 8.0);
  
  vec2 quad2;
  quad2.y = floor(ceil(blueColor) / 8.0);
  quad2.x = ceil(blueColor) - (quad2.y * 8.0);
  
  vec2 texPos1;
  texPos1.x = (quad1.x * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * color.r);
  texPos1.y = (quad1.y * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * color.g);
  
  vec2 texPos2;
  texPos2.x = (quad2.x * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * color.r);
  texPos2.y = (quad2.y * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * color.g);
  
  vec4 lutColor1 = texture2D(tLUT, texPos1);
  vec4 lutColor2 = texture2D(tLUT, texPos2);
  
  vec4 lutColor = mix(lutColor1, lutColor2, fract(blueColor));
  
  gl_FragColor = mix(color, lutColor, intensity);
}
`;

// Screen-space reflections
const screenSpaceReflectionFragmentShader = `
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrixInverse;
uniform mat4 viewMatrixInverse;
uniform vec3 cameraPosition;
uniform float maxDistance;
uniform float resolution;
uniform float thickness;
uniform float stride;

varying vec2 vUv;

void main() {
  vec4 diffuse = texture2D(tDiffuse, vUv);
  vec4 depthSample = texture2D(tDepth, vUv);
  vec3 normal = texture2D(tNormal, vUv).rgb * 2.0 - 1.0;
  
  float depth = depthSample.r;
  
  // Reconstruct position from depth
  vec4 clipPos = vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec4 viewPos = projectionMatrixInverse * clipPos;
  viewPos /= viewPos.w;
  vec3 worldPos = (viewMatrixInverse * viewPos).xyz;
  
  // Calculate view direction and reflection
  vec3 viewDir = normalize(worldPos - cameraPosition);
  vec3 reflectionDir = reflect(viewDir, normal);
  
  // Ray march in reflection direction
  vec3 currentPos = worldPos;
  vec2 currentUv = vUv;
  vec3 currentViewPos = viewPos.xyz;
  vec3 step = reflectionDir * stride;
  
  vec4 reflectionColor = vec4(0.0);
  bool hit = false;
  
  for (int i = 0; i < 100; i++) {
    currentPos += step;
    
    // Project point to screen
    vec4 projectedPos = projectionMatrix * viewMatrix * vec4(currentPos, 1.0);
    projectedPos.xyz /= projectedPos.w;
    
    // Check if still on screen
    if (projectedPos.x < -1.0 || projectedPos.x > 1.0 ||
        projectedPos.y < -1.0 || projectedPos.y > 1.0 ||
        projectedPos.z < -1.0 || projectedPos.z > 1.0) {
      break;
    }
    
    // Convert to UV coordinates
    vec2 projectedUv = projectedPos.xy * 0.5 + 0.5;
    
    // Sample depth at projected position
    float projectedDepth = texture2D(tDepth, projectedUv).r;
    
    // Reconstruct position from sampled depth
    vec4 projectedClipPos = vec4(projectedUv * 2.0 - 1.0, projectedDepth * 2.0 - 1.0, 1.0);
    vec4 projectedViewPos = projectionMatrixInverse * projectedClipPos;
    projectedViewPos.xyz /= projectedViewPos.w;
    
    // Check for intersection
    float currentDepth = projectedPos.z * 0.5 + 0.5;
    
    if (currentDepth > projectedDepth && currentDepth - projectedDepth < thickness) {
      reflectionColor = texture2D(tDiffuse, projectedUv);
      hit = true;
      break;
    }
  }
  
  // Blend reflection with original color
  if (hit) {
    float fresnel = pow(1.0 - max(0.0, dot(-viewDir, normal)), 5.0);
    gl_FragColor = mix(diffuse, reflectionColor, fresnel * 0.5);
  } else {
    gl_FragColor = diffuse;
  }
}
`;