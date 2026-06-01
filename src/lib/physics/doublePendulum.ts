/**
 * doublePendulum.ts
 * -----------------
 * Ecuaciones de movimiento del péndulo doble clásico.
 *
 * Estado: q = [θ₁, θ₂, ω₁, ω₂]
 *   θ₁  — ángulo del primer brazo (rad, desde vertical)
 *   θ₂  — ángulo del segundo brazo (rad, desde vertical)
 *   ω₁  — velocidad angular del primer brazo
 *   ω₂  — velocidad angular del segundo brazo
 *
 * Parámetros:
 *   m1, m2  — masas de los brazos [kg]
 *   l1, l2  — longitudes [m]
 *   g       — gravedad [m/s²]
 *   damping — amortiguamiento viscoso
 *   tau_ext — torque externo aplicado en θ₁ (modulado por audio)
 *
 * Referencias:
 *   Derivación Lagrangiana estándar para péndulo doble planar.
 *   Aceleraciones angulares obtenidas resolviendo el sistema 2×2:
 *
 *   (m1+m2)l1·θ̈₁ + m2·l2·θ̈₂·cos(θ₁-θ₂) = b1
 *   m2·l2·θ̈₂     + m2·l1·θ̈₁·cos(θ₁-θ₂) = b2
 */

export interface DoublePendulumParams {
  m1: number;      // masa brazo 1 [kg]
  m2: number;      // masa brazo 2 [kg]
  l1: number;      // longitud brazo 1 [m]
  l2: number;      // longitud brazo 2 [m]
  g: number;       // gravedad [m/s²]
  damping: number; // amortiguamiento viscoso
  tau_ext: number; // torque externo en θ₁ (audio → caos)
}

export type DPState = [number, number, number, number];
// [θ₁, θ₂, ω₁, ω₂]

/**
 * Calcula las derivadas del estado del péndulo doble.
 */
export function doublePendulumDerivatives(
  state: DPState,
  p: DoublePendulumParams
): DPState {
  const [θ1, θ2, ω1, ω2] = state;
  const { m1, m2, l1, l2, g, damping, tau_ext } = p;

  const Δθ = θ1 - θ2;
  const cosΔ = Math.cos(Δθ);
  const sinΔ = Math.sin(Δθ);
  const sin1 = Math.sin(θ1);
  const sin2 = Math.sin(θ2);

  // Términos de la mano derecha
  const b1 =
    tau_ext
    - (m1 + m2) * g * l1 * sin1
    - m2 * l1 * l2 * ω2 * ω2 * sinΔ
    - damping * ω1;

  const b2 =
    -m2 * g * l2 * sin2
    + m2 * l1 * l2 * ω1 * ω1 * sinΔ
    - damping * ω2;

  // Coeficientes del sistema 2×2
  const a11 = (m1 + m2) * l1 * l1;
  const a12 = m2 * l1 * l2 * cosΔ;
  const a21 = m2 * l1 * l2 * cosΔ;
  const a22 = m2 * l2 * l2;

  // Determinante
  const det = a11 * a22 - a12 * a21;

  // Regla de Cramer
  const α1 = (a22 * b1 - a12 * b2) / det;
  const α2 = (a11 * b2 - a21 * b1) / det;

  return [ω1, ω2, α1, α2];
}

/**
 * Avanza el estado un paso dt con RK4.
 */
export function rk4StepDP(
  state: DPState,
  params: DoublePendulumParams,
  dt: number
): DPState {
  const f = (s: DPState) => doublePendulumDerivatives(s, params);

  const k1 = f(state);
  const k2 = f(addScaledDP(state, k1, dt / 2));
  const k3 = f(addScaledDP(state, k2, dt / 2));
  const k4 = f(addScaledDP(state, k3, dt));

  return [
    state[0] + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
    state[1] + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
    state[2] + (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
    state[3] + (dt / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]),
  ];
}

function addScaledDP(s: DPState, d: DPState, scale: number): DPState {
  return [
    s[0] + scale * d[0],
    s[1] + scale * d[1],
    s[2] + scale * d[2],
    s[3] + scale * d[3],
  ];
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_DP_PARAMS: DoublePendulumParams = {
  m1: 1.0,
  m2: 1.0,
  l1: 1.5,
  l2: 1.5,
  g: 9.81,
  damping: 0.06,  // más amortiguamiento → arcos elegantes, no spin frenético
  tau_ext: 0,
};

/** Perturbación inicial para régimen caótico inmediato. */
export const INITIAL_DP_STATE: DPState = [
  Math.PI / 2,   // θ₁ — 90°
  Math.PI / 3,   // θ₂ — 60°
  0,             // ω₁
  0,             // ω₂
];
