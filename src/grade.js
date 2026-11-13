import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Final colour grade, after tone mapping (display-referred): the concept art reads as
// saturated and contrasty, with teal shadows, warm highlights and a soft vignette.
export function createGradePass({ saturation = 1.22, contrast = 1.08, vignette = 0.32 } = {}) {
  return new ShaderPass({
    name: 'GradeShader',
    uniforms: {
      tDiffuse: { value: null },
      saturation: { value: saturation },
      contrast: { value: contrast },
      vignette: { value: vignette },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse;
      uniform float saturation;
      uniform float contrast;
      uniform float vignette;
      varying vec2 vUv;
      void main() {
        vec4 tex = texture2D(tDiffuse, vUv);
        vec3 c = tex.rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, saturation);
        c = (c - 0.5) * contrast + 0.5;
        // Split tone: cool shadows, warm highlights.
        c += vec3(-0.018, 0.006, 0.03) * (1.0 - l) + vec3(0.025, 0.008, -0.02) * l;
        float d = length((vUv - 0.5) * vec2(1.25, 1.0));
        c *= 1.0 - vignette * smoothstep(0.38, 0.95, d);
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), tex.a);
      }`,
  });
}
