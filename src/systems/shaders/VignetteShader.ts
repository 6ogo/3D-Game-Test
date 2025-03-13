export const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    darkness: { value: 0.6 },
    offset: { value: 0.9 }
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
    uniform float darkness;
    uniform float offset;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      vec2 center = vec2(0.5);
      float dist = distance(vUv, center);
      color.rgb *= smoothstep(offset, offset - darkness, dist);
      gl_FragColor = color;
    }
  `
};
