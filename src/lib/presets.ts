/**
 * presets.ts
 * ----------
 * Definición de los presets visuales de SymFonos.
 * Cada preset configura colores, bloom, glitch, partículas y comportamiento
 * de los materiales de Three.js.
 *
 * ─── Filosofía visual ────────────────────────────────────────────────────────
 * Las trayectorias caóticas SON el arte. El péndulo es solo el "lápiz".
 * El sistema de trail de puntos con glow gaussiano + AdditiveBlending acumula
 * brillo donde la trayectoria pasa con más frecuencia, revelando el atractor
 * extraño como una pintura generativa.
 */

import type { PresetName, Equation } from "@/store/symfonos";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ColorPalette {
  bg: number;
  cart: number;
  cartEmissive: number;
  mass1: number;
  mass1Emissive: number;
  mass2: number;
  mass2Emissive: number;
  rod1: number;
  rod2: number;
  spring: number;
  trail1: number;
  trail2: number;
  particles: number[];
  fogColor: number;
  accent: string;
  accentSecondary: string;
}

export interface BloomConfig {
  enabled: boolean;
  strength: number;
  radius: number;
  threshold: number;
  reactivity: number;
  maxStrength: number;
}

export interface GlitchConfig {
  enabled: boolean;
  onBeatOnly: boolean;
}

export interface ParticleConfig {
  enabled: boolean;
  count: number;
  speedMin: number;
  speedMax: number;
  lifetime: number;
  sizeBase: number;
  sizeOnBeat: number;
  colorCycle: boolean;
}

export interface VisualizerPreset {
  name: string;
  colors: ColorPalette;
  bloom: BloomConfig;
  glitch: GlitchConfig;
  particles: ParticleConfig;
  wireframeCart: boolean;
  showGrid: boolean;
  trailOpacity: number;
  trailLength: number;
  beatScaleFactor: number;
  bgGradient: boolean;
  bgBaseHue: number;
  bgHorizontal: boolean;
  bgOrganic: boolean;
  bgDriftSpeed: number;
  bgLight: boolean;
  trailDark: boolean;
  hideCartElements: boolean;
  preferredEquation: Equation;

  // ── Trail de puntos (nuevo sistema de atractor) ───────────────────────────
  /** Tamaño base de los puntos glow (1.0 = normal, 2.0 = doble) */
  trailBasePointSize: number;
  /** Si true, el hue del trail deriva autónomamente creando arco iris sobre el atractor */
  trailRainbow: boolean;
  /** Fuerza del AfterimagePass [0=off, 0.90–0.97 = persistencia Milkdrop] */
  afterimageStrength: number;
  /** Si true, muestra el espacio de fase (θ, ω) en vez del espacio físico (x, y) */
  phasePortrait: boolean;
  /** Si true, activa el shader zobelBg() en backgroundShader */
  bgZobel: boolean;
}

// ── Paletas ───────────────────────────────────────────────────────────────────

export const PRESETS: Record<PresetName, VisualizerPreset> = {

  // ── Kandinsky Pulse ────────────────────────────────────────────────────────
  // Emergencia geométrica — Casey Reas
  kandinsky: {
    name: "Kandinsky Pulse",
    colors: {
      bg: 0x0a0008,
      fogColor: 0x0a0008,
      cart: 0x1a0510,
      cartEmissive: 0xff6600,
      mass1: 0x200010,
      mass1Emissive: 0xff2200,
      mass2: 0x100020,
      mass2Emissive: 0xffcc00,
      rod1: 0xff4400,
      rod2: 0xffaa00,
      spring: 0xff8800,
      trail1: 0xff3300,
      trail2: 0xffcc00,
      particles: [0xff2200, 0xff6600, 0xffcc00, 0xff00aa],
      accent: "#ff6600",
      accentSecondary: "#ffcc00",
    },
    bloom: { enabled: true, strength: 0.35, radius: 0.55, threshold: 0.3, reactivity: 0.9, maxStrength: 1.2 },
    glitch: { enabled: false, onBeatOnly: false },
    particles: {
      enabled: true, count: 18, speedMin: 0.02, speedMax: 0.08,
      lifetime: 60, sizeBase: 3, sizeOnBeat: 8, colorCycle: false,
    },
    wireframeCart: false,
    showGrid: false,
    trailOpacity: 0.85,
    trailLength: 1200,
    beatScaleFactor: 1.5,
    bgGradient: true,
    bgBaseHue: 30,
    bgHorizontal: false,
    bgOrganic: false,
    bgDriftSpeed: 0.6,
    bgLight: false,
    trailDark: false,
    hideCartElements: false,
    preferredEquation: "spring",
    trailBasePointSize: 1.0,
    trailRainbow: false,
    afterimageStrength: 0.92,
    phasePortrait: false,
    bgZobel: false,
  },

  // ── Vignelli Grid ──────────────────────────────────────────────────────────
  // Minimalismo radical — Ryoji Ikeda
  vignelli: {
    name: "Vignelli Grid",
    colors: {
      bg: 0x000510,
      fogColor: 0x000510,
      cart: 0x000820,
      cartEmissive: 0x0044ff,
      mass1: 0x000010,
      mass1Emissive: 0xff0000,
      mass2: 0x000010,
      mass2Emissive: 0x0044ff,
      rod1: 0xcc0000,
      rod2: 0x0033cc,
      spring: 0xffffff,
      trail1: 0xee0000,
      trail2: 0x0055ff,
      particles: [0xff0000, 0x0044ff, 0xffff00, 0xffffff],
      accent: "#cc0000",
      accentSecondary: "#0044ff",
    },
    bloom: { enabled: true, strength: 0.15, radius: 0.3, threshold: 0.55, reactivity: 0.4, maxStrength: 0.6 },
    glitch: { enabled: false, onBeatOnly: false },
    particles: {
      enabled: false, count: 0, speedMin: 0, speedMax: 0,
      lifetime: 0, sizeBase: 2, sizeOnBeat: 4, colorCycle: false,
    },
    wireframeCart: true,
    showGrid: true,
    trailOpacity: 0.6,
    trailLength: 900,
    beatScaleFactor: 1.2,
    bgGradient: false,
    bgBaseHue: 240,
    bgHorizontal: false,
    bgOrganic: false,
    bgDriftSpeed: 0.2,
    bgLight: false,
    trailDark: false,
    hideCartElements: false,
    preferredEquation: "spring",
    trailBasePointSize: 0.6,
    trailRainbow: false,
    afterimageStrength: 0.88,
    phasePortrait: false,
    bgZobel: false,
  },

  // ── Neon Filament ─────────────────────────────────────────────────────────
  // Estética del glitch — Mario Klingemann
  neon: {
    name: "Neon Filament",
    colors: {
      bg: 0x050510,
      fogColor: 0x050510,
      cart: 0x001a1a,
      cartEmissive: 0x00ffff,
      mass1: 0x110022,
      mass1Emissive: 0xff00ff,
      mass2: 0x001100,
      mass2Emissive: 0x00ffff,
      rod1: 0xff00ff,
      rod2: 0x00ffff,
      spring: 0xffffff,
      trail1: 0xff00ff,
      trail2: 0x00ffff,
      particles: [0x00ffff, 0xff00ff, 0xffffff, 0x00ff88],
      accent: "#00ffff",
      accentSecondary: "#ff00ff",
    },
    bloom: { enabled: true, strength: 0.45, radius: 0.65, threshold: 0.2, reactivity: 1.0, maxStrength: 1.6 },
    glitch: { enabled: true, onBeatOnly: true },
    particles: {
      enabled: true, count: 12, speedMin: 0.01, speedMax: 0.06,
      lifetime: 45, sizeBase: 2, sizeOnBeat: 6, colorCycle: true,
    },
    wireframeCart: false,
    showGrid: false,
    trailOpacity: 0.88,
    trailLength: 1500,
    beatScaleFactor: 1.4,
    bgGradient: false,
    bgBaseHue: 180,
    bgHorizontal: false,
    bgOrganic: false,
    bgDriftSpeed: 1.0,
    bgLight: false,
    trailDark: false,
    hideCartElements: false,
    preferredEquation: "spring",
    trailBasePointSize: 1.1,
    trailRainbow: false,
    afterimageStrength: 0.93,
    phasePortrait: false,
    bgZobel: false,
  },

  // ── Particle Swarm ────────────────────────────────────────────────────────
  // Coreografía algorítmica — Raven Kwok
  particle: {
    name: "Particle Swarm",
    colors: {
      bg: 0x020108,
      fogColor: 0x020108,
      cart: 0x050315,
      cartEmissive: 0x8800ff,
      mass1: 0x050010,
      mass1Emissive: 0x00ff88,
      mass2: 0x100005,
      mass2Emissive: 0xff4400,
      rod1: 0x00ff88,
      rod2: 0xff4400,
      spring: 0x8800ff,
      trail1: 0x00ff88,
      trail2: 0xff4400,
      particles: [0x00ff88, 0xff4400, 0x8800ff, 0x00ccff, 0xffaa00],
      accent: "#00ff88",
      accentSecondary: "#ff4400",
    },
    bloom: { enabled: true, strength: 0.35, radius: 0.75, threshold: 0.2, reactivity: 0.9, maxStrength: 1.3 },
    glitch: { enabled: false, onBeatOnly: false },
    particles: {
      enabled: true, count: 40, speedMin: 0.03, speedMax: 0.12,
      lifetime: 80, sizeBase: 2.5, sizeOnBeat: 10, colorCycle: true,
    },
    wireframeCart: false,
    showGrid: false,
    trailOpacity: 0.80,
    trailLength: 1800,
    beatScaleFactor: 1.8,
    bgGradient: true,
    bgBaseHue: 150,
    bgHorizontal: false,
    bgOrganic: false,
    bgDriftSpeed: 0.8,
    bgLight: false,
    trailDark: false,
    hideCartElements: false,
    preferredEquation: "spring",
    trailBasePointSize: 1.2,
    trailRainbow: true,
    afterimageStrength: 0.91,
    phasePortrait: false,
    bgZobel: false,
  },

  // ── Tide (Marea) ──────────────────────────────────────────────────────────
  // Sistemas armónicos — Memo Akten
  tide: {
    name: "Tide",
    colors: {
      bg: 0x020c18,
      fogColor: 0x020c18,
      cart: 0x051422,
      cartEmissive: 0x00b4d8,
      mass1: 0x031020,
      mass1Emissive: 0x48cae4,
      mass2: 0x101808,
      mass2Emissive: 0xe9c46a,
      rod1: 0x0096c7,
      rod2: 0xf4a261,
      spring: 0x90e0ef,
      trail1: 0x00b4d8,
      trail2: 0xe9c46a,
      particles: [0x48cae4, 0x90e0ef, 0xe9c46a, 0xf4a261, 0x023e8a],
      accent: "#48cae4",
      accentSecondary: "#e9c46a",
    },
    bloom: { enabled: true, strength: 0.4, radius: 0.9, threshold: 0.25, reactivity: 0.9, maxStrength: 1.6 },
    glitch: { enabled: false, onBeatOnly: false },
    particles: {
      enabled: true, count: 20, speedMin: 0.01, speedMax: 0.05,
      lifetime: 100, sizeBase: 2, sizeOnBeat: 5, colorCycle: false,
    },
    wireframeCart: false,
    showGrid: false,
    trailOpacity: 0.70,
    trailLength: 1400,
    beatScaleFactor: 1.25,
    bgGradient: true,
    bgBaseHue: 205,
    bgHorizontal: true,
    bgOrganic: false,
    bgDriftSpeed: 0.25,
    bgLight: false,
    trailDark: false,
    hideCartElements: false,
    preferredEquation: "spring",
    trailBasePointSize: 0.9,
    trailRainbow: false,
    afterimageStrength: 0.90,
    phasePortrait: false,
    bgZobel: false,
  },

  // ── Acid / Rist ───────────────────────────────────────────────────────────
  // Fluido psicodélico orgánico — Pipilotti Rist
  acid: {
    name: "Rist",
    colors: {
      bg: 0x0d0800,
      fogColor: 0x0d0800,
      cart: 0x1a0e00,
      cartEmissive: 0xff8800,
      mass1: 0x1a0800,
      mass1Emissive: 0xff6600,
      mass2: 0x120a00,
      mass2Emissive: 0xffcc00,
      rod1: 0xcc4400,
      rod2: 0xdd9900,
      spring: 0xff8833,
      trail1: 0xff6600,
      trail2: 0xffaa00,
      particles: [0xff6600, 0xffcc00, 0xff3300, 0xddaa00, 0xff9944],
      accent: "#ff8800",
      accentSecondary: "#ffcc00",
    },
    bloom: { enabled: true, strength: 0.5, radius: 0.85, threshold: 0.18, reactivity: 1.1, maxStrength: 1.8 },
    glitch: { enabled: false, onBeatOnly: false },
    particles: {
      enabled: true, count: 25, speedMin: 0.008, speedMax: 0.045,
      lifetime: 90, sizeBase: 2.5, sizeOnBeat: 7, colorCycle: false,
    },
    wireframeCart: false,
    showGrid: false,
    trailOpacity: 0.82,
    trailLength: 1600,
    beatScaleFactor: 1.6,
    bgGradient: true,
    bgBaseHue: 32,
    bgHorizontal: false,
    bgOrganic: true,
    bgDriftSpeed: 0.35,
    bgLight: false,
    trailDark: false,
    hideCartElements: false,
    preferredEquation: "spring",
    trailBasePointSize: 1.1,
    trailRainbow: false,
    afterimageStrength: 0.91,
    phasePortrait: false,
    bgZobel: false,
  },

  // ── Zobel — Pintura sobre oscuro ──────────────────────────────────────────
  // Gesto y silencio — Fernando Zobel (1924–1984)
  // Paleta de la obra tardía: arcos espirales translúcidos gris-pizarra,
  // venas de oro/amarillo brillante, densidades teal/azul-verde.
  // Fondo negro-azulado profundo — AdditiveBlending acumula brillo.
  // La espiral del doble péndulo revela el atractor como pincelada gestual.
  zobel: {
    name: "Zobel",
    colors: {
      bg: 0x04060e,
      fogColor: 0x04060e,
      cart: 0x080c1a,
      cartEmissive: 0xc8a030,
      mass1: 0x060408,
      mass1Emissive: 0xe8c040,
      mass2: 0x040810,
      mass2Emissive: 0x2a7090,
      rod1: 0xc09028,
      rod2: 0x1e5870,
      spring: 0x403020,
      trail1: 0xe8c040,
      trail2: 0x2a6888,
      particles: [0xe8c040, 0x2a7090, 0xf0d050, 0x1a4868, 0xa07818, 0x3a8898],
      accent: "#e8c040",
      accentSecondary: "#2a7090",
    },
    bloom: { enabled: true, strength: 0.28, radius: 0.8, threshold: 0.35, reactivity: 0.7, maxStrength: 0.65 },
    glitch: { enabled: false, onBeatOnly: false },
    particles: {
      enabled: true, count: 14, speedMin: 0.005, speedMax: 0.022,
      lifetime: 160, sizeBase: 1.5, sizeOnBeat: 5.0, colorCycle: false,
    },
    wireframeCart: false,
    showGrid: false,
    trailOpacity: 0.75,
    trailLength: 2400,
    beatScaleFactor: 1.18,
    bgGradient: false,
    bgBaseHue: 220,
    bgHorizontal: false,
    bgOrganic: false,
    bgDriftSpeed: 0.14,
    bgLight: false,
    trailDark: true,
    hideCartElements: true,
    preferredEquation: "double",
    trailBasePointSize: 0.85,
    trailRainbow: false,
    afterimageStrength: 0.94,
    phasePortrait: false,
    bgZobel: true,
  },

  // ── Caos — El Atractor Extraño ────────────────────────────────────────────
  // Visualización pura del espacio de fase del péndulo doble caótico.
  // El trail dibuja directamente en coordenadas (θ, ω) — el espacio de fase —
  // revelando la geometría fractal del atractor extraño sobre el fondo vacío.
  // Inspirado en Lorenz, Rössler y la tradición del arte computacional (Vera Molnár).
  // El color deriva autónomamente: el arco iris es el tiempo, la densidad es el espacio.
  caos: {
    name: "Caos",
    colors: {
      bg: 0x000000,
      fogColor: 0x000000,
      cart: 0x000000,
      cartEmissive: 0x111111,
      mass1: 0x000000,
      mass1Emissive: 0xffffff,
      mass2: 0x000000,
      mass2Emissive: 0xffffff,
      rod1: 0x222222,
      rod2: 0x222222,
      spring: 0x111111,
      trail1: 0xff0000,
      trail2: 0x00ffff,
      particles: [0xff0000, 0x00ff00, 0x0000ff, 0xff00ff, 0xffff00, 0x00ffff],
      accent: "#ff3300",
      accentSecondary: "#00ffff",
    },
    // Bloom fuerte: las regiones densas del atractor deben brillar
    bloom: { enabled: true, strength: 0.25, radius: 0.95, threshold: 0.08, reactivity: 1.3, maxStrength: 2.2 },
    glitch: { enabled: false, onBeatOnly: false },
    particles: {
      enabled: false, count: 0, speedMin: 0, speedMax: 0,
      lifetime: 0, sizeBase: 1, sizeOnBeat: 2, colorCycle: false,
    },
    wireframeCart: false,
    showGrid: false,
    trailOpacity: 0.92,
    trailLength: 3000,           // buffer completo — toda la historia del atractor
    beatScaleFactor: 1.05,
    bgGradient: false,
    bgBaseHue: 0,
    bgHorizontal: false,
    bgOrganic: false,
    bgDriftSpeed: 0,
    bgLight: false,
    trailDark: false,
    hideCartElements: true,
    preferredEquation: "double",
    trailBasePointSize: 0.7,     // puntos pequeños: la densidad revela el atractor
    trailRainbow: true,          // hue deriva autónomamente → arco iris sobre el atractor
    afterimageStrength: 0.96,    // persistencia máxima — el pasado nunca muere del todo
    phasePortrait: true,         // MODO ESPACIO DE FASE: θ vs ω en vez de x,y físicos
    bgZobel: false,
  },
};
