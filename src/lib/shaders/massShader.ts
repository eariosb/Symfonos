/**
 * massShader.ts
 * --------------
 * Shader GLSL para las masas (esferas) del péndulo.
 *
 * Vertex shader: desplazamiento de vértices (pulsación en beat).
 * Fragment shader: emisión reactiva + efecto de Fresnel neón.
 *
 * Uniforms:
 *   uTime      float — tiempo
 *   uBeat      float — beat [0,1] decayente
 *   uRms       float — nivel RMS [0,1]
 *   uColor     vec3  — color base sRGB
 *   uEmissive  vec3  — color emissivo
 */

export const massVertexShader = /* glsl */`
  precision highp float;

  uniform float uTime;
  uniform float uBeat;
  uniform float uRms;

  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vNormal = normalize(normalMatrix * normal);

    // Desplazamiento radial pulsante en beat
    float pulse = uBeat * 0.18 * (0.5 + 0.5 * sin(uTime * 30.0));
    // Ondulación suave continua proporcional al RMS
    float wave  = uRms * 0.06 * sin(position.y * 8.0 + uTime * 6.0);

    vec3 displaced = position + normal * (pulse + wave);

    vec4 mvPos = modelViewMatrix * vec4(displaced, 1.0);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

export const massFragmentShader = /* glsl */`
  precision highp float;

  uniform float uTime;
  uniform float uBeat;
  uniform float uRms;
  uniform vec3  uColor;
  uniform vec3  uEmissive;

  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    // Fresnel — borde más brillante
    float fresnel = pow(1.0 - max(0.0, dot(vNormal, vViewDir)), 3.0);

    // Emisión reactiva al audio
    float emissiveIntensity = 0.85 + uRms * 1.8 + uBeat * 2.5;

    vec3 color = uColor * 0.05
               + uEmissive * emissiveIntensity
               + uEmissive * fresnel * (2.2 + uBeat * 2.5);

    // Pulso de brillo en beat
    float beatGlow = uBeat * 0.6 * (0.5 + 0.5 * sin(uTime * 40.0));
    color += uEmissive * beatGlow;

    gl_FragColor = vec4(color, 1.0);
  }
`;
