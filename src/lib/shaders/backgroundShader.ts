/**
 * backgroundShader.ts — v3 (Sprint 4 — Zobel Gestural)
 * -------------------------------------------------------
 * Shader GLSL para el plano de fondo de SymFonos.
 *
 * Modos de fondo:
 *   zobelBg()      — Pintura gestural abstracta (Fernando Zobel / Zao Wou-Ki)
 *                    Masa azul-violeta turbulenta + venas de oro-ámbar +
 *                    vacíos luminosos + marcas gestuales oscuras tipo impasto.
 *                    Activado por uZobel > 0.5
 *   lightBg()      — Lienzo claro crema (modo Zobel original, bgLight=true)
 *   organicBg()    — Fluido psicodélico visceral (Pipilotti Rist)
 *   horizontalBg() — Horizonte marino con incidencia solar (Tide)
 *   radialBg()     — Gradiente radial reactivo (modo por defecto)
 *
 * Uniforms:
 *   uTime        float   — tiempo en segundos
 *   uRms         float   — nivel RMS [0,1]
 *   uFreqNorm    float   — frecuencia normalizada [0,1] log scale
 *   uBeat        float   — beat power [0,1] decayente
 *   uVelocity    float   — velocidad cinética normalizada [0,1]
 *   uColorA      vec3    — color base preset
 *   uColorB      vec3    — color acento preset
 *   uBgBaseHue   float   — matiz LCH base del preset (°)
 *   uMonochrome  float   — 0=color, 1=blanco/negro
 *   uHorizontal  float   — 0=radial, 1=horizonte marino
 *   uDriftSpeed  float   — velocidad de deriva lenta de color
 *   uShock       float   — onda de choque en beat [0→1, decae]
 *   uOrganic     float   — 0=normal, 1=modo orgánico (Rist)
 *   uLightMode   float   — 0=oscuro, 1=claro (lienzo Zobel)
 *   uZobel       float   — 0=normal, 1=modo gestural Zobel pictórico
 */

export const backgroundVertexShader = /* glsl */`
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const backgroundFragmentShader = /* glsl */`
  precision highp float;

  uniform float uTime;
  uniform float uRms;
  uniform float uFreqNorm;
  uniform float uBeat;
  uniform float uVelocity;
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform float uBgBaseHue;
  uniform float uMonochrome;
  uniform float uHorizontal;
  uniform float uDriftSpeed;
  uniform float uShock;
  uniform float uOrganic;
  uniform float uLightMode;
  uniform float uZobel;     // 0=normal, 1=pintura gestural Zobel

  varying vec2 vUv;

  // ── LCH → sRGB inline ────────────────────────────────────────────────────

  float labFInv(float t) {
    return t > 0.206897 ? t * t * t : (t - 16.0 / 116.0) / 7.787;
  }

  float gammaEncode(float c) {
    c = max(0.0, c);
    return c <= 0.0031308 ? 12.92 * c : 1.055 * pow(c, 1.0 / 2.4) - 0.055;
  }

  vec3 lchToRgb(float L, float C, float H) {
    float hRad = radians(mod(H, 360.0));
    float a = C * cos(hRad);
    float b = C * sin(hRad);
    float fy = (L + 16.0) / 116.0;
    float fx = a / 500.0 + fy;
    float fz = fy - b / 200.0;
    float x = 0.95047 * labFInv(fx);
    float y = 1.00000 * labFInv(fy);
    float z = 1.08883 * labFInv(fz);
    float rL =  3.2406 * x - 1.5372 * y - 0.4986 * z;
    float gL = -0.9689 * x + 1.8758 * y + 0.0415 * z;
    float bL =  0.0557 * x - 0.2040 * y + 1.0570 * z;
    return clamp(vec3(gammaEncode(rL), gammaEncode(gL), gammaEncode(bL)), 0.0, 1.0);
  }

  // ── Noise 2D ─────────────────────────────────────────────────────────────

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i),             hash(i + vec2(1,0)), u.x),
      mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x),
      u.y
    );
  }

  // FBM — Fractal Brownian Motion (4 octavas)
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p  = rot * p * 2.1;
      a *= 0.5;
    }
    return v;
  }

  // ── Modo Zobel — Pintura gestural abstracta ───────────────────────────────
  //
  // Inspirado en la obra conjunta de Fernando Zobel y Zao Wou-Ki:
  //   • Masa azul-violeta turbulenta (noreste): cobalto profundo, índigo, violeta
  //   • Venas de oro-ámbar (sureste): oro cálido, ocre, ámbar explosivo
  //   • Vacíos luminosos (centro-inferior): blanco-crema, el "silencio" de Zobel
  //   • Marcas gestuales oscuras: trazos de tinta que cruzan la composición
  //   • Impasto: textura de óleo sobre lienzo, visible en las capas de noise fino
  //
  // Filosofía cromática:
  //   • El azul es frío, espiritual, intelectual → responde a frecuencias altas
  //   • El oro es cálido, vital, terrenal → explota con los beats
  //   • Donde se encuentran: zona de teal-verde turbio (tensión)
  //   • El vacío blanco es la "gracia" — aparece en los silencios y en el beat

  vec3 zobelBg(vec2 p, float time) {
    // p ∈ [-0.5, 0.5]
    float t = time * 0.10; // ritmo contemplativo — Zobel no tiene prisa

    // ── 0. Base: noir profundo (el vacío del lienzo preparado) ────────────
    float baseL = 7.0 + uRms * 5.0;
    vec3 bg = lchToRgb(clamp(baseL, 5.0, 14.0), 20.0 + uRms * 8.0, 238.0);

    // ── 1. Masa azul-violeta turbulenta (noroeste → centro) ───────────────
    //
    // Domain warping en 3 capas: simula el impasto y la turbulencia del óleo.
    // Capa 1: warp lento y amplio — estructura general de la masa
    float bw1x = fbm(p * 2.2 + vec2(t * 0.14,  t * 0.09));
    float bw1y = fbm(p * 2.2 + vec2(t * 0.11, -t * 0.13) + vec2(4.0, 0.0));
    vec2  bwarp1 = vec2(bw1x, bw1y) * 0.28;

    // Capa 2: warp fino — textura de pincelada
    float bw2x = fbm((p + bwarp1) * 4.5 + vec2(-t * 0.12, t * 0.16));
    float bw2y = fbm((p + bwarp1) * 4.5 + vec2(t * 0.15,  t * 0.10) + vec2(7.0, 3.0));
    vec2  bwarp2 = vec2(bw2x, bw2y) * 0.15;

    vec2  bwp = p + bwarp1 + bwarp2;

    // Centro de la masa azul: noroeste, deriva lentamente
    vec2  blueC = vec2(-0.20 + sin(t * 0.42) * 0.06,  0.20 + cos(t * 0.32) * 0.05);
    float blueDist = length(bwp - blueC);

    // Forma principal + extensiones tentaculares
    float blueShape = 1.0 - smoothstep(0.04, 0.70, blueDist);
    // Extensión diagonal hacia el centro — como un brazo de la tormenta
    float blueArm = fbm(bwp * 2.0 + vec2(t * 0.08, -t * 0.11)) * 0.45;
    blueShape = clamp(blueShape + blueArm * (1.0 - smoothstep(0.25, 0.85, blueDist)), 0.0, 1.0);

    // Modulación por audio: RMS expande, beat da un pulso adicional
    float blueIntensity = 0.58 + uRms * 0.48 + uBeat * 0.12;
    blueShape *= blueIntensity;
    blueShape  = clamp(blueShape, 0.0, 1.0);

    // Color de la masa azul — cobalto profundo a índigo-violeta según freq
    // frecuencias altas → violeta (hue mayor); graves → azul puro
    float blueHue  = 238.0 + uFreqNorm * 42.0;
    float blueL    = 16.0 + uRms * 22.0 + fbm(bwp * 3.5 + vec2(t*0.1)) * 16.0;
    float blueChroma = 52.0 + uRms * 30.0 + uBeat * 10.0;

    // Dos tonos internos: zona densa (profunda) y zona difusa (más clara)
    vec3 blueDense = lchToRgb(
      clamp(blueL, 8.0, 48.0),
      clamp(blueChroma, 30.0, 88.0),
      blueHue
    );
    vec3 blueDiff = lchToRgb(
      clamp(blueL + 14.0, 22.0, 64.0),
      clamp(blueChroma * 0.7, 22.0, 62.0),
      blueHue - 18.0 // más purpúreo en la periferia
    );
    float internalMix = fbm(bwp * 5.0 + vec2(t * 0.09, t * 0.12)) * 0.7;
    vec3 blueCol = mix(blueDense, blueDiff, internalMix);

    bg = mix(bg, blueCol, blueShape * 0.90);

    // ── 2. Masa dorada (sureste → centro) ─────────────────────────────────
    //
    // La masa dorada es más "sólida" y directa que la azul: menos warp,
    // pero más reactiva al beat (como una explosión solar contenida).
    float gw1x = fbm(p * 2.8 + vec2(t * 0.16 + 3.7, -t * 0.12));
    float gw1y = fbm(p * 2.8 + vec2(-t * 0.13,  t * 0.18 + 5.1));
    vec2  gwarp1 = vec2(gw1x, gw1y) * 0.22;

    float gw2x = fbm((p + gwarp1) * 5.5 + vec2(t * 0.11, -t * 0.09 + 2.0));
    float gw2y = fbm((p + gwarp1) * 5.5 + vec2(-t * 0.10, t * 0.14 + 4.5));
    vec2  gwarp2 = vec2(gw2x, gw2y) * 0.12;

    vec2  gwp = p + gwarp1 + gwarp2;

    vec2  goldC = vec2(0.24 + cos(t * 0.38) * 0.06, -0.14 + sin(t * 0.30) * 0.05);
    float goldDist = length(gwp - goldC);

    float goldShape = 1.0 - smoothstep(0.03, 0.68, goldDist);
    float goldArm   = fbm(gwp * 2.2 + vec2(-t * 0.10, t * 0.13)) * 0.40;
    goldShape = clamp(goldShape + goldArm * (1.0 - smoothstep(0.22, 0.82, goldDist)), 0.0, 1.0);

    // Beat: la masa dorada EXPLOTA — el momento de intensidad
    float goldIntensity = 0.48 + uRms * 0.42 + uBeat * 0.55;
    goldShape *= goldIntensity;
    goldShape  = clamp(goldShape, 0.0, 1.0);

    // Color: oro cálido → ámbar naranja según freq
    // graves (uFreqNorm bajo) → más naranja-rojizo; agudos → amarillo saturado
    float goldHue   = 52.0 - uFreqNorm * 16.0; // 52°(oro) a 36°(ámbar)
    float goldL     = 28.0 + uRms * 28.0 + uBeat * 24.0 + fbm(gwp * 4.0 + vec2(t*0.08)) * 18.0;
    float goldChroma = 70.0 + uRms * 28.0 + uBeat * 22.0;

    vec3 goldBright = lchToRgb(
      clamp(goldL, 18.0, 72.0),
      clamp(goldChroma, 48.0, 98.0),
      goldHue
    );
    vec3 goldAmber = lchToRgb(
      clamp(goldL * 0.62, 12.0, 40.0),
      clamp(goldChroma * 0.75, 35.0, 70.0),
      goldHue - 10.0
    );
    float goldInternalMix = fbm(gwp * 5.5 + vec2(t * 0.10)) * 0.65;
    vec3 goldCol = mix(goldAmber, goldBright, goldInternalMix + 0.3);

    bg = mix(bg, goldCol, goldShape * 0.86);

    // ── 3. Zona de encuentro (tensión azul × oro) ──────────────────────────
    // Donde las dos masas se superponen: teal-oliva turbio.
    // Es la zona más densa y visualmente compleja de la composición.
    float convZone = clamp(blueShape * goldShape * 4.0, 0.0, 1.0);
    float convHue  = 148.0 + uFreqNorm * 35.0; // teal a verde-oliva según freq
    vec3  convCol  = lchToRgb(
      clamp(24.0 + uRms * 16.0, 12.0, 44.0),
      clamp(30.0 + uRms * 18.0, 18.0, 52.0),
      convHue
    );
    bg = mix(bg, convCol, convZone * 0.52);

    // ── 4. Vacíos luminosos (el "silencio" de Zobel) ──────────────────────
    //
    // Zonas de luz blanca-crema que emergen entre las masas pesadas.
    // En Zobel, el blanco no es ausencia — es presencia de luz.
    // Se iluminan fuertemente en el beat: el "destello de gracia".
    vec2 voidC1 = vec2(-0.08, -0.18 + sin(t * 0.25) * 0.04);
    vec2 voidC2 = vec2(-0.22, 0.02  + cos(t * 0.20) * 0.03);

    // Los vacíos aparecen donde NO hay masas (azul ni oro)
    float notBlue = 1.0 - clamp(blueShape * 1.4, 0.0, 1.0);
    float notGold = 1.0 - clamp(goldShape * 1.2, 0.0, 1.0);

    float void1 = exp(-length(p - voidC1) * 5.8) * notBlue * notGold;
    float void2 = exp(-length(p - voidC2) * 7.2) * notBlue;
    float voidTotal = clamp(void1 * 0.65 + void2 * 0.42, 0.0, 1.0);

    float voidBeat = uBeat * (1.0 + uRms * 0.9);
    float voidL    = 20.0 + voidBeat * 45.0 + uRms * 18.0;
    vec3  voidCol  = lchToRgb(
      clamp(voidL, 14.0, 68.0),
      clamp(6.0 + uRms * 10.0, 0.0, 18.0), // casi sin color: luz pura
      228.0
    );
    bg = mix(bg, voidCol, voidTotal * (0.28 + voidBeat * 0.58));

    // ── 5. Marcas gestuales oscuras (caligrafía de Zobel) ──────────────────
    //
    // Trazos negros decisivos que cruzan la composición en diagonal.
    // Inspirados en la técnica de Zobel: "saetas" oscuras sobre el color.
    // La velocidad del péndulo los intensifica — el movimiento deja marca.

    // Marcas diagonales: noise estirado en dirección del trazo
    float mk1 = fbm(vec2(p.x * 9.0 + p.y * 13.0 + t * 0.20, p.y * 7.0 - p.x * 5.0 - t * 0.14));
    float mk2 = noise(p * 18.0 + vec2(-t * 0.16, t * 0.22));
    float mk3 = noise(vec2(p.x * 6.0 - p.y * 11.0 + t * 0.12, p.x * 8.0 + p.y * 4.0));

    float gestural  = pow(mk1, 2.8) * 0.6 + pow(mk2 * mk3, 1.8) * 0.4;
    float gesturalI = 0.10 + uVelocity * 0.18 + uRms * 0.08;
    // Las marcas no invaden el vacío luminoso
    gestural *= (1.0 - voidTotal * 0.8);
    bg *= (1.0 - gestural * gesturalI);

    // ── 6. Textura de impasto y grano de lienzo ────────────────────────────
    // El óleo tiene textura física. Dos capas: grueso (pincelada) y fino (lienzo).
    float impasto = noise(p * 42.0 + vec2(t * 0.04, -t * 0.03)) * 0.038;
    float grain   = noise(p * 110.0 + vec2(-t * 0.02, t * 0.025)) * 0.022;
    bg += (impasto + grain) * (0.5 + uRms * 0.6);

    // ── 7. Halo de beat expansivo desde el dorado (explosión solar) ────────
    // En cada beat, la masa dorada emite un pulso de luz cálida que se expande.
    float beatHalo = uBeat * exp(-goldDist * 3.8) * 0.42;
    bg += vec3(beatHalo * 0.88, beatHalo * 0.66, beatHalo * 0.02);

    // ── 8. Velo de respiración lenta (la obra "respira" entre beats) ───────
    float breathe = 0.5 + 0.5 * sin(t * 1.1 * uDriftSpeed);
    bg += bg * breathe * 0.04; // modulación suave del brillo global

    return clamp(bg, 0.0, 1.0);
  }

  // ── Gradiente radial (modo estándar) ─────────────────────────────────────

  vec3 radialBg(vec2 uv, float hue, float time) {
    float dist    = length(uv);
    float radialT = smoothstep(0.0, 0.65, dist);
    float tide    = 0.5 + 0.5 * sin(time * 0.18 * uDriftSpeed);
    float tide2   = 0.5 + 0.5 * sin(time * 0.11 * uDriftSpeed + 1.2);
    float Lcenter = 22.0 + tide * 8.0 + uRms * 22.0 + uBeat * 10.0;
    float Ledge   = 10.0 + tide2 * 5.0 + uRms * 12.0;
    float Ccenter = 38.0 + uRms * 45.0 + uVelocity * 15.0 + uBeat * 18.0;
    float Cedge   = 18.0 + uRms * 22.0 + uVelocity * 8.0;
    vec3 colCenter = lchToRgb(clamp(Lcenter,0.0,52.0), clamp(Ccenter,0.0,105.0), hue + time * 2.5 * uDriftSpeed);
    vec3 colEdge   = lchToRgb(clamp(Ledge,0.0,28.0),   clamp(Cedge,0.0,55.0),    hue + 105.0 + time * 1.5 * uDriftSpeed);
    vec3 bg = mix(colCenter, colEdge, radialT);
    bg = mix(bg, uColorA * 0.08 + uColorB * 0.04, 0.18);
    float beatRing = uBeat * exp(-pow(dist * 3.5 - 0.5, 2.0) * 5.0) * 0.14;
    bg += vec3(beatRing * 0.45, beatRing * 0.7, beatRing);
    float luma = dot(bg, vec3(0.2126, 0.7152, 0.0722));
    bg *= min(1.0, 0.88 / max(luma, 0.001));
    return bg;
  }

  // ── Gradiente horizontal (Tide) ───────────────────────────────────────────

  vec3 horizontalBg(vec2 uv01, float hue, float time) {
    float y = uv01.y, x = uv01.x;
    float t = time * uDriftSpeed;
    float sunX  = 0.5 + 0.3 * sin(t * 0.025);
    float sunY  = 0.50 + 0.04 * sin(t * 0.038 + 0.8);
    float tideH = 0.42 + 0.06 * sin(t * 0.018 + 2.1);
    float sunDist = length(vec2((x - sunX) * 1.6, y - sunY));
    float sunGlow = smoothstep(0.60, 0.0, sunDist) * (0.28 + uRms * 0.18 + uBeat * 0.10);
    float deepT = smoothstep(tideH, 1.0, y);
    float freqHueShift = uFreqNorm * 28.0;
    vec3 deepCol = lchToRgb(
      clamp(16.0 + (1.0 - deepT) * 16.0 + uRms * 14.0 + uBeat * 6.0, 0.0, 44.0),
      clamp(42.0 + uRms * 28.0 + uVelocity * 10.0, 0.0, 80.0),
      hue + t * 1.2 + freqHueShift
    );
    float sandT = smoothstep(tideH + 0.04, tideH - 0.18, y);
    vec3 sandCol = lchToRgb(
      clamp(32.0 + uRms * 12.0 + sunGlow * 14.0, 0.0, 54.0),
      clamp(34.0 + uRms * 22.0, 0.0, 65.0),
      50.0 + uRms * 18.0 + sunGlow * 12.0
    );
    vec3 bg = mix(deepCol, sandCol, sandT);
    float horizonBand = exp(-pow((y - sunY) * 16.0, 2.0)) * 0.14;
    bg += vec3(horizonBand * 0.9, horizonBand * 0.82, horizonBand * 0.62);
    vec3 sunCol = lchToRgb(clamp(44.0 + uRms * 12.0 + uBeat * 6.0, 0.0, 58.0), clamp(52.0 + uRms * 18.0, 0.0, 75.0), 50.0 + uFreqNorm * 20.0);
    bg = mix(bg, sunCol, sunGlow * 0.45);
    float waveZone = clamp(1.0 - abs(y - sunY - 0.03) * 8.0, 0.0, 1.0);
    float waveAmp = 0.025 + uRms * 0.04 + uBeat * 0.02;
    float wave1 = noise(vec2(x * 9.0 + t * 1.1, y * 5.0 + t * 0.4)) * waveAmp * waveZone;
    float wave2 = noise(vec2(x * 5.0 - t * 0.7, y * 3.0 + t * 0.6)) * waveAmp * 0.6 * waveZone;
    bg += wave1 + wave2;
    float beatFlash = uBeat * (sunGlow * 0.15 + waveZone * 0.06);
    bg += vec3(beatFlash * 0.7, beatFlash * 0.85, beatFlash);
    float luma = dot(bg, vec3(0.2126, 0.7152, 0.0722));
    bg *= min(1.0, 0.80 / max(luma, 0.001));
    return bg;
  }

  // ── Modo Claro (lienzo crema Zobel antiguo) ───────────────────────────────

  vec3 lightBg(vec2 uv, float hue, float time) {
    float dist = length(uv);
    float t    = time * uDriftSpeed;
    float Lb = 93.0 - uRms * 4.0 - uBeat * 2.5;
    vec3 bg = lchToRgb(clamp(Lb, 87.0, 96.0), 3.5 + uRms * 5.0, 235.0 + t * 0.3);
    float freqMod = uFreqNorm;
    vec2 cold1 = vec2(sin(t*0.038 + 1.4)*0.32 - 0.12, cos(t*0.028 + 0.7)*0.25 + 0.05);
    vec2 cold2 = vec2(cos(t*0.044 + 3.1)*0.28 + 0.18, sin(t*0.034 + 2.2)*0.22 - 0.16);
    vec2 warm1 = vec2(sin(t*0.031 + 5.5)*0.22 + 0.06, cos(t*0.042 + 1.1)*0.18 + 0.12);
    float sc = 2.8 + uRms * 1.4, sw = 3.8 + uRms * 1.8;
    float mc1 = exp(-dot(uv-cold1, uv-cold1) * sc);
    float mc2 = exp(-dot(uv-cold2, uv-cold2) * sc * 0.85);
    float mw1 = exp(-dot(uv-warm1, uv-warm1) * sw);
    float Lc = clamp(42.0 + uRms * 12.0, 30.0, 58.0);
    vec3 coldCol = lchToRgb(Lc, clamp(22.0 + uRms*14.0, 0.0, 42.0), 230.0 + freqMod*30.0);
    float Lw = clamp(62.0 + uRms * 10.0, 50.0, 75.0);
    vec3 warmCol = lchToRgb(Lw, clamp(38.0 + uRms*20.0, 0.0, 65.0), 72.0 + freqMod*20.0);
    float coldTotal = mc1 + mc2 * 0.75;
    float coldAlpha = clamp(coldTotal * (0.28 + uRms*0.20 + uBeat*0.10), 0.0, 0.52);
    float warmAlpha = clamp(mw1     * (0.18 + uRms*0.16 + uBeat*0.08), 0.0, 0.32);
    vec3 coldMix = (mc1 * coldCol + mc2 * 0.75 * coldCol) / max(coldTotal, 0.001);
    bg = mix(bg, coldMix, coldAlpha);
    bg = mix(bg, warmCol, warmAlpha);
    float fog1 = noise(uv * 0.7 + vec2(t*0.022, t*0.018)) * uRms * 0.18;
    float fog2 = noise(uv * 1.1 + vec2(-t*0.028 + 1.8, t*0.024)) * uRms * 0.12;
    bg = mix(bg, lchToRgb(75.0, 12.0, 220.0 + freqMod*40.0), fog1 * 0.45);
    bg = mix(bg, lchToRgb(78.0, 18.0, 68.0), fog2 * 0.38);
    float beatFlash = uBeat * exp(-dist * dist * 5.0) * 0.08;
    bg = mix(bg, lchToRgb(70.0, 35.0, 72.0), beatFlash * 0.6);
    bg -= uBeat * smoothstep(0.5, 0.0, dist) * 0.035;
    bg += noise(uv * 280.0 + t * 0.08) * 0.012;
    return clamp(bg, 0.0, 1.0);
  }

  // ── Modo Orgánico (Rist) ──────────────────────────────────────────────────

  vec3 organicBg(vec2 uv01, float hue, float time) {
    float t = time * uDriftSpeed;
    vec2  p = uv01;
    float wx1 = noise(p * 1.8 + vec2(t * 0.07, t * 0.05));
    float wy1 = noise(p * 1.8 + vec2(t * 0.06 + 4.2, -t * 0.07));
    vec2  w1  = vec2(wx1, wy1) * 0.38;
    float wx2 = noise((p + w1) * 3.5 + vec2(-t * 0.12, t * 0.09));
    float wy2 = noise((p + w1) * 3.5 + vec2(t * 0.10 + 7.1, t * 0.08));
    vec2  w2  = vec2(wx2, wy2) * 0.22;
    vec2  wp  = p + w1 + w2 * (0.5 + uRms * 0.5);
    float cellScale = 3.2 + uRms * 0.8 + uBeat * 0.4;
    vec2 cell = fract(wp * cellScale) - 0.5;
    float cellDist = length(cell);
    float cellScale2 = 6.5 + uRms * 1.2;
    vec2 cell2 = fract(wp * cellScale2 + vec2(0.3, 0.7)) - 0.5;
    float cellDist2 = length(cell2);
    float cavity  = smoothstep(0.0, 0.28, cellDist)  * (1.0 - smoothstep(0.28, 0.42, cellDist));
    float cavity2 = smoothstep(0.0, 0.22, cellDist2) * (1.0 - smoothstep(0.22, 0.36, cellDist2));
    float edge  = exp(-pow((cellDist  - 0.38) * 14.0, 2.0));
    float edge2 = exp(-pow((cellDist2 - 0.30) * 18.0, 2.0));
    float organicHue = hue + uFreqNorm * 45.0 + t * 4.0;
    float L_base = 24.0 + uRms * 18.0 + noise(wp * 4.0 + t * 0.3) * 8.0;
    float C_base = 42.0 + uRms * 28.0 + uVelocity * 12.0;
    vec3 bg = lchToRgb(clamp(L_base, 0.0, 48.0), clamp(C_base, 0.0, 80.0), organicHue);
    bg *= (1.0 - (cavity * 0.88 + cavity2 * 0.55));
    float edgeTotal = edge * (0.6 + uRms * 0.4) + edge2 * (0.4 + uRms * 0.3);
    vec3 edgeCol = lchToRgb(clamp(55.0 + uRms * 15.0 + uBeat * 10.0, 0.0, 72.0), clamp(30.0 + uRms * 20.0, 0.0, 55.0), organicHue + 55.0 + uFreqNorm * 20.0);
    bg = mix(bg, edgeCol, edgeTotal * 0.65);
    float g1 = noise(wp * 95.0 + t * 2.1);
    float g2 = noise(wp * 140.0 - t * 1.7 + vec2(3.1, 5.9));
    float g3 = noise(wp * 200.0 + t * 1.3 + vec2(8.4, 2.7));
    float glitter = pow(g1 * g2 * g3, 2.5) * (0.45 + uRms * 0.55 + uBeat * 0.3);
    bg += vec3(glitter * 0.95, glitter * 0.72, glitter * 0.08);
    float boil = uBeat * (1.0 - smoothstep(0.25, 0.45, cellDist)) * 0.18;
    bg += vec3(boil * 0.8, boil * 0.45, 0.0);
    bg += noise(wp * 22.0 + t * 0.5) * 0.06 * vec3(0.9, 0.6, 0.1);
    float luma = dot(bg, vec3(0.2126, 0.7152, 0.0722));
    bg *= min(1.0, 0.82 / max(luma, 0.001));
    return bg;
  }

  // ── Main ─────────────────────────────────────────────────────────────────

  void main() {
    vec2 uv   = vUv - 0.5; // [-0.5, 0.5] centrado
    vec2 uv01 = vUv;       // [0,1] para modo horizontal

    float hueFreq = uFreqNorm * 300.0;
    float drift   = sin(uTime * 0.04 * uDriftSpeed) * 15.0;
    float bgHue   = uBgBaseHue * 0.35 + hueFreq * 0.65 + drift;

    vec3 bg;

    // Zobel tiene prioridad: su fondo es una obra de arte independiente
    if (uZobel > 0.5) {
      bg = zobelBg(uv, uTime);
    } else if (uLightMode > 0.5) {
      bg = lightBg(uv, bgHue, uTime);
    } else if (uOrganic > 0.5) {
      bg = organicBg(uv01, bgHue, uTime);
    } else if (uHorizontal > 0.5) {
      bg = horizontalBg(uv01, bgHue, uTime);
    } else {
      bg = radialBg(uv, bgHue, uTime);
    }

    // ── Grano analógico (solo en modos no-Zobel — Zobel ya tiene impasto) ──
    if (uZobel < 0.5) {
      float grain = noise(vUv * 180.0 + uTime * 0.3) * 0.025;
      bg += grain;
    }

    float dist = length(uv);

    // ── Beat flash radial (desactivado en Zobel — ya maneja beats interno) ──
    float beatFlash = (1.0 - uZobel) * (1.0 - uHorizontal) * uBeat * smoothstep(0.6, 0.0, dist) * 0.09;
    bg += vec3(beatFlash * 0.45, beatFlash * 0.7, beatFlash);

    // ── Onda de choque en beat ─────────────────────────────────────────────
    float shockRadius = (1.0 - uShock) * 0.85;
    float shockRing   = exp(-pow((dist - shockRadius) * 12.0, 2.0));
    float shockAlpha  = sqrt(uShock) * shockRing * 0.10;
    // En Zobel: shock ring más dorado-ámbar que azul
    vec3 shockColor = uZobel > 0.5
      ? vec3(shockAlpha * 0.9, shockAlpha * 0.65, shockAlpha * 0.0)
      : vec3(shockAlpha * 0.5, shockAlpha * 0.7,  shockAlpha * 1.0);
    bg += shockColor;

    // ── Vignette ──────────────────────────────────────────────────────────
    float vignetteStr = mix(0.78, 0.50, uHorizontal);
    // Zobel: vignette suave pero presente — enmarca la composición
    float vignetteBase = 1.0 - smoothstep(0.28, vignetteStr, dist);
    float vignette = mix(vignetteBase, 1.0, max(uLightMode, uZobel * 0.3));
    bg *= vignette;

    // ── Modo monocromo ─────────────────────────────────────────────────────
    float luma = dot(bg, vec3(0.2126, 0.7152, 0.0722));
    bg = mix(bg, vec3(luma), uMonochrome);
    bg = mix(bg, clamp((bg - 0.5) * 2.0 + 0.5, 0.0, 1.0), uMonochrome * 0.5);

    gl_FragColor = vec4(bg, 1.0);
  }
`;
