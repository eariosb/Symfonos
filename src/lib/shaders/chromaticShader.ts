/**
 * chromaticShader.ts
 * ------------------
 * ShaderPass de aberración cromática para EffectComposer.
 *
 * Desplaza los canales R y B en UV opuestos al canal G en beats fuertes.
 * Se puede activar/desactivar con `pass.enabled`.
 *
 * Uniforms:
 *   tDiffuse    sampler2D — framebuffer de entrada (inyectado por ShaderPass)
 *   uIntensity  float     — fuerza del efecto [0, 1]
 *   uTime       float     — tiempo (para animar la dirección del split)
 */

export const chromaticAberrationShader = {
  uniforms: {
    tDiffuse:   { value: null },
    uIntensity: { value: 0.0 },
    uTime:      { value: 0.0 },
  },

  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */`
    precision highp float;

    uniform sampler2D tDiffuse;
    uniform float uIntensity;
    uniform float uTime;

    varying vec2 vUv;

    void main() {
      // Dirección de aberración (rota lentamente)
      vec2 dir = vec2(cos(uTime * 0.8), sin(uTime * 0.8));

      float offset = uIntensity * 0.012;
      vec2 uvR = vUv + dir * offset;
      vec2 uvB = vUv - dir * offset;

      float r = texture2D(tDiffuse, uvR).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, uvB).b;
      float a = texture2D(tDiffuse, vUv).a;

      gl_FragColor = vec4(r, g, b, a);
    }
  `,
};
