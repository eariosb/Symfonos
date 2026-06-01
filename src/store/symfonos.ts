/**
 * symfonos.ts — Zustand store global
 * ------------------------------------
 * Single source of truth para toda la aplicación SymFonos.
 */

import { create } from "zustand";
import type { SpringPendulumParams } from "@/lib/physics/springPendulum";
import type { DoublePendulumParams } from "@/lib/physics/doublePendulum";
import { DEFAULT_PARAMS as DEFAULT_SP } from "@/lib/physics/springPendulum";
import { DEFAULT_DP_PARAMS as DEFAULT_DP } from "@/lib/physics/doublePendulum";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type Equation = "spring" | "double";

export type PresetName = "kandinsky" | "vignelli" | "neon" | "particle" | "tide" | "acid" | "zobel" | "caos";

export const PRESET_NAMES: PresetName[] = ["kandinsky", "vignelli", "neon", "particle", "tide", "acid", "zobel", "caos"];

// Nombres de artistas inspiradores — cada preset encarna una estética
export const PRESET_LABELS: Record<PresetName, string> = {
  kandinsky: "Reas",       // Emergencia geométrica — Casey Reas
  vignelli:  "Ikeda",      // Minimalismo radical — Ryoji Ikeda
  neon:      "Klingemann", // Estética del glitch — Mario Klingemann
  particle:  "Kwok",       // Coreografía algorítmica — Raven Kwok
  tide:      "Akten",      // Sistemas armónicos — Memo Akten
  acid:      "Rist",       // Fluido psicodélico orgánico — Pipilotti Rist
  zobel:     "Zobel",      // Gesto y silencio — Fernando Zobel
  caos:      "Molnár",     // Atractor extraño — Vera Molnár / Lorenz
};

// ─── Estado ───────────────────────────────────────────────────────────────────

export interface SymfonosState {
  // Ecuación activa
  equation: Equation;

  // Preset visual activo
  preset: PresetName;

  // Parámetros físicos
  springParams: SpringPendulumParams;
  doublePendulumParams: DoublePendulumParams;

  // Audio
  sensitivity: number; // [0.5, 5]

  // UI
  panelOpen: boolean;
  uiVisible: boolean;
  monochrome: boolean;     // modo accesibilidad monocromo
  tutorialDone: boolean;   // tutorial completado
  zenMode: boolean;        // modo zen: oculta toda la UI numérica (solo canvas)
  chaosMode: boolean;      // modo caos: impulsos aleatorios continuos

  // Acciones
  setEquation: (eq: Equation) => void;
  setPreset: (p: PresetName) => void;
  nextPreset: () => void;
  setSpringParams: (p: Partial<SpringPendulumParams>) => void;
  setDPParams: (p: Partial<DoublePendulumParams>) => void;
  setSensitivity: (s: number) => void;
  setPanelOpen: (open: boolean) => void;
  setUiVisible: (v: boolean) => void;
  toggleMonochrome: () => void;
  toggleZenMode: () => void;
  toggleChaosMode: () => void;
  setTutorialDone: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSymfonos = create<SymfonosState>((set, get) => ({
  equation: "spring",
  preset: "acid",

  springParams: { ...DEFAULT_SP },
  doublePendulumParams: { ...DEFAULT_DP },

  sensitivity: 2.0,
  panelOpen: false,
  monochrome: false,
  tutorialDone: false,
  uiVisible: true,
  zenMode: false,
  chaosMode: false,

  setEquation: (eq) => set({ equation: eq }),

  setPreset: (p) => set({ preset: p }),

  nextPreset: () => {
    const idx = PRESET_NAMES.indexOf(get().preset);
    const next = PRESET_NAMES[(idx + 1) % PRESET_NAMES.length];
    set({ preset: next });
  },

  setSpringParams: (p) =>
    set((s) => ({ springParams: { ...s.springParams, ...p } })),

  setDPParams: (p) =>
    set((s) => ({ doublePendulumParams: { ...s.doublePendulumParams, ...p } })),

  setSensitivity: (sensitivity) => set({ sensitivity }),

  setPanelOpen: (panelOpen) => set({ panelOpen }),

  setUiVisible: (uiVisible) => set({ uiVisible }),

  toggleMonochrome:  () => set((s) => ({ monochrome: !s.monochrome })),
  toggleZenMode:     () => set((s) => ({ zenMode: !s.zenMode })),
  toggleChaosMode:   () => set((s) => ({ chaosMode: !s.chaosMode })),

  setTutorialDone: () => set({ tutorialDone: true }),
}));
