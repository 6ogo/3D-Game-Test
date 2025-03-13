export const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    intensity: { value: 0.003 },
    time: { value: 0.0 }
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
    uniform float intensity;
    uniform float time;
    varying vec2 vUv;

    void main() {
      vec2 offset = intensity * vec2(cos(time), sin(time));
      vec4 cr = texture2D(tDiffuse, vUv + offset);
      vec4 cg = texture2D(tDiffuse, vUv);
      vec4 cb = texture2D(tDiffuse, vUv - offset);
      gl_FragColor = vec4(cr.r, cg.g, cb.b, 1.0);
    }
  `
};
