import { Vector2 } from 'three';

export const GodRayShader = {
  uniforms: {
    tDiffuse: { value: null },
    lightPosition: { value: new Vector2(0.5, 0.5) },
    exposure: { value: 0.3 },
    decay: { value: 0.95 },
    density: { value: 0.8 },
    weight: { value: 0.6 },
    samples: { value: 50 }
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
    uniform vec2 lightPosition;
    uniform float exposure;
    uniform float decay;
    uniform float density;
    uniform float weight;
    uniform int samples;
    varying vec2 vUv;

    void main() {
      vec2 deltaTextCoord = vec2(vUv - lightPosition);
      vec2 texCoord = vUv;
      deltaTextCoord *= 1.0 / float(samples) * density;
      float illuminationDecay = 1.0;
      vec4 color = vec4(0.0);

      for(int i=0; i < 50; i++) {
        texCoord -= deltaTextCoord;
        vec4 sample = texture2D(tDiffuse, texCoord);
        sample *= illuminationDecay * weight;
        color += sample;
        illuminationDecay *= decay;
      }
      gl_FragColor = color * exposure;
    }
  `
};
