/**
 * colorSystem.ts
 * ---------------
 * Utilidades de color para el sistema reactivo de SymFonos.
 *
 * Implementa:
 *   • Conversión LCH → sRGB (perceptualmente uniforme)
 *   • Mapeo de frecuencia dominante → matiz LCH
 *   • Interpolación cromática suave entre estados de audio
 *   • Paletas base por preset moduladas por audio
 */

// ── LCH → sRGB ────────────────────────────────────────────────────────────────

/** Función auxiliar cúbica de Lab */
function labF(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

/** Inversa de labF */
function labFInv(t: number): number {
  return t > 0.206897 ? t * t * t : (t - 16 / 116) / 7.787;
}

/** Convierte LCH a sRGB [0,1] */
export function lchToRgb(L: number, C: number, H: number): [number, number, number] {
  // LCH → Lab
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  // Lab → XYZ (iluminante D65)
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;

  const xyz: [number, number, number] = [
    0.95047 * labFInv(fx),
    1.00000 * labFInv(fy),
    1.08883 * labFInv(fz),
  ];

  // XYZ → sRGB lineal (matriz IEC 61966-2-1)
  const rLin =  3.2406 * xyz[0] - 1.5372 * xyz[1] - 0.4986 * xyz[2];
  const gLin = -0.9689 * xyz[0] + 1.8758 * xyz[1] + 0.0415 * xyz[2];
  const bLin =  0.0557 * xyz[0] - 0.2040 * xyz[1] + 1.0570 * xyz[2];

  // Gamma sRGB
  function gammaEncode(c: number): number {
    const clipped = Math.max(0, c);
    return clipped <= 0.0031308
      ? 12.92 * clipped
      : 1.055 * Math.pow(clipped, 1 / 2.4) - 0.055;
  }

  return [
    Math.min(1, gammaEncode(rLin)),
    Math.min(1, gammaEncode(gLin)),
    Math.min(1, gammaEncode(bLin)),
  ];
}

/** Convierte [r,g,b] ∈ [0,1] a CSS `rgb(r,g,b)` */
export function rgbToCss(rgb: [number, number, number]): string {
  return `rgb(${Math.round(rgb[0] * 255)},${Math.round(rgb[1] * 255)},${Math.round(rgb[2] * 255)})`;
}

/** Convierte [r,g,b] ∈ [0,1] a hex 0xRRGGBB para Three.js */
export function rgbToHex(rgb: [number, number, number]): number {
  const r = Math.round(rgb[0] * 255);
  const g = Math.round(rgb[1] * 255);
  const b = Math.round(rgb[2] * 255);
  return (r << 16) | (g << 8) | b;
}

// ── Mapeo audio → color ───────────────────────────────────────────────────────

/**
 * Mapea frecuencia dominante (Hz) a matiz LCH (°).
 *
 * Rango auditivo: 20 Hz – 20 000 Hz (logarítmico)
 * Mapeo de matiz:
 *   20  Hz  →   0° (rojo)
 *   200 Hz  →  60° (naranja-amarillo) — graves/kick
 *   1   kHz → 180° (cian) — midrange
 *   8   kHz → 240° (azul) — presencia
 *   20  kHz → 300° (violeta/magenta) — aire
 */
export function freqToHue(hz: number): number {
  const logMin = Math.log10(20);
  const logMax = Math.log10(20000);
  const logHz  = Math.log10(Math.max(20, Math.min(hz, 20000)));
  const t = (logHz - logMin) / (logMax - logMin); // [0, 1]
  return t * 300; // [0°, 300°]
}

/**
 * Genera el color LCH reactivo al audio.
 * @param baseHue    matiz base del preset (°)
 * @param freq       frecuencia dominante (Hz)
 * @param rms        nivel RMS [0,1]
 * @param isBeat     si hay beat activo
 * @param chroma     croma base [0,100]
 * @param lightness  luminosidad base [0,100]
 */
export function reactiveColor(
  baseHue: number,
  freq: number,
  rms: number,
  isBeat: boolean,
  chroma = 40,
  lightness = 30
): [number, number, number] {
  const freqHue = freqToHue(freq);
  // Blend entre matiz base y matiz de frecuencia
  const H = baseHue * 0.4 + freqHue * 0.6;
  const C = chroma + rms * 60 + (isBeat ? 30 : 0);
  const L = lightness + rms * 25 + (isBeat ? 15 : 0);
  return lchToRgb(Math.min(100, L), Math.min(130, C), H % 360);
}

// ── Configuración de fondo por preset ────────────────────────────────────────

export interface BgColorConfig {
  baseHue: number;   // matiz LCH base (°)
  chromaMin: number; // croma mínima (sin audio)
  chromaMax: number; // croma máxima (audio pleno)
  lightnessMin: number;
  lightnessMax: number;
  /** Matiz del segundo punto de gradiente */
  accentHue: number;
}

export const PRESET_BG_CONFIGS: Record<string, BgColorConfig> = {
  kandinsky: { baseHue: 30,  chromaMin: 30, chromaMax: 90, lightnessMin: 8,  lightnessMax: 35, accentHue: 60  },
  vignelli:  { baseHue: 240, chromaMin: 20, chromaMax: 60, lightnessMin: 5,  lightnessMax: 20, accentHue: 10  },
  neon:      { baseHue: 180, chromaMin: 40, chromaMax: 100,lightnessMin: 4,  lightnessMax: 25, accentHue: 300 },
  particle:  { baseHue: 150, chromaMin: 35, chromaMax: 80, lightnessMin: 6,  lightnessMax: 30, accentHue: 30  },
};

// ── Contraste dinámico ────────────────────────────────────────────────────────

/**
 * Devuelve el matiz de las masas garantizando contraste perceptual con el fondo.
 *
 * Usa split-complementary (offset base 150°) en vez de complementario exacto (180°)
 * para evitar vibración óptica. El offset se modula ±30° con la velocidad cinética:
 * a mayor velocidad, mayor separación cromática → las masas "gritan" con el movimiento.
 *
 * @param bgHue        matiz del fondo [0, 360)
 * @param velocityNorm velocidad física normalizada [0, 1]
 * @returns matiz para las masas [0, 360)
 */
export function complementaryHue(bgHue: number, velocityNorm: number): number {
  const baseOffset = 150;
  const dynamicOffset = velocityNorm * 30; // 0–30° extra con velocidad
  return (bgHue + baseOffset + dynamicOffset) % 360;
}

/**
 * Calcula el matiz del fondo a partir de la frecuencia dominante y el tiempo,
 * suavizado con el matiz base del preset.
 */
export function backgroundHue(
  presetBaseHue: number,
  freqNorm: number,
  time: number,
  slowDrift = true
): number {
  const freqHue = freqNorm * 300;
  const drift = slowDrift ? Math.sin(time * 0.04) * 15 : 0;
  return (presetBaseHue * 0.35 + freqHue * 0.65 + drift) % 360;
}

// ── Interpolación suave (lowpass) ─────────────────────────────────────────────

/**
 * Filtro lowpass de primer orden para suavizar transiciones de color.
 * Llamar en cada frame: `smoothed = lerp(smoothed, target, alpha)`
 */
export function lerp(a: number, b: number, alpha: number): number {
  return a + (b - a) * alpha;
}

export function lerpRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
