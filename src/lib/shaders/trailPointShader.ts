/**
 * trailPointShader.ts
 * --------------------
 * Shader GLSL para renderizar las trayectorias caóticas como nubes de puntos
 * con glow gaussiano suave. Diseñado para AdditiveBlending: donde la
 * trayectoria se superpone, la luminosidad se acumula revelando las regiones
 * densas del atractor extraño.
 *
 * Cada punto tiene:
 *   - position: THREE.BufferAttribute vec3 (posición en espacio 3D)
 *   - color:    THREE.BufferAttribute vec3 (color RGB registrado al generar)
 *   - aSize:    THREE.BufferAttribute float (tamaño base; incluye velocidad + beat)
 *
 * El fragmento dibuja un disco gaussiano suave (no un cuadrado duro) con
 * halo que se desvanece exponencialmente. El resultado es una "pincelada"
 * luminosa que imita el trazo gestual de la pintura expresionista abstracta.
 */

export const trailPointVertexShader = /* glsl */`
  attribute vec3 color;
  attribute float aSize;
  varying vec3  vColor;
  varying float vFade;

  void main() {
    vColor = color;
    vFade  = length(color); // luminancia aproximada: puntos más brillantes son más grandes

    vec4 mvPos    = modelViewMatrix * vec4(position, 1.0);
    // Perspective-correct point size: más cerca → más grande
    // La constante 320.0 calibra el tamaño a ≈ 4px en posición neutra (z≈−6)
    float pxSize  = max(1.0, aSize * 320.0 / -mvPos.z);
    gl_PointSize  = pxSize;
    gl_Position   = projectionMatrix * mvPos;
  }
`;

export const trailPointFragmentShader = /* glsl */`
  varying vec3  vColor;
  varying float vFade;

  void main() {
    // Disco gaussiano: gl_PointCoord ∈ [0,1]², centro = (0.5, 0.5)
    vec2  xy  = gl_PointCoord - 0.5;
    float r2  = dot(xy, xy) * 4.0;   // r2 = 0 en centro, 1 en borde
    if (r2 > 1.0) discard;            // recortar borde duro

    // Halo gaussiano suave: alfa = exp(-r² * k)
    // k=3.5 → halo pronunciado sin corte visible
    float alpha = exp(-r2 * 3.5);

    // Núcleo brillante adicional: zona central 10% del radio más luminosa
    float core  = max(0.0, 1.0 - r2 * 5.0);
    vec3  col   = vColor + core * vColor * 0.6;

    gl_FragColor = vec4(col, alpha);
  }
`;

/**
 * trailLineVertexShader / trailLineFragmentShader
 * ------------------------------------------------
 * Variante de línea fina para el "highlight" del trail reciente (últimos 60 pts).
 * Se usa como superposición sobre los puntos: muestra la dirección del trazo activo.
 */
export const trailHighlightVertexShader = /* glsl */`
  attribute vec3 color;
  varying vec3 vColor;
  void main() {
    vColor = color;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const trailHighlightFragmentShader = /* glsl */`
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor, 1.0);
  }
`;
