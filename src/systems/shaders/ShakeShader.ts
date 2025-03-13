export const ShakeShader = {
  uniforms: {
    tDiffuse: { value: null },
    intensity: { value: 0.01 },
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
      vec2 offset = intensity * vec2(
        sin(time * 100.0 + vUv.y * 10.0),
        cos(time * 90.0 + vUv.x * 10.0)
      );
      gl_FragColor = texture2D(tDiffuse, vUv + offset);
    }
  `
};
