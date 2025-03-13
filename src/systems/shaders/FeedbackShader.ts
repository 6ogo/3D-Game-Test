export const FeedbackShader = {
  uniforms: {
    tDiffuse: { value: null },
    tOld: { value: null },
    intensity: { value: 0.15 }
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
    uniform sampler2D tOld;
    uniform float intensity;
    varying vec2 vUv;

    void main() {
      vec4 currentFrame = texture2D(tDiffuse, vUv);
      vec4 lastFrame = texture2D(tOld, vUv);
      gl_FragColor = mix(currentFrame, lastFrame, intensity);
    }
  `
};
