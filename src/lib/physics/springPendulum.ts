/**
 * springPendulum.ts
 * -----------------
 * Ecuaciones de movimiento del Spring Pendulum (carro + 2 péndulos con resortes).
 *
 * Estado: q = [x, θ₁, θ₂, ẋ, θ̇₁, θ̇₂]
 *   x   — posición horizontal del carro
 *   θ₁  — ángulo del péndulo izquierdo (rad)
 *   θ₂  — ángulo del péndulo derecho (rad)
 *   ẋ   — velocidad del carro
 *   θ̇₁  — velocidad angular péndulo izquierdo
 *   θ̇₂  — velocidad angular péndulo derecho
 *
 * Parámetros del sistema (todos en unidades SI simplificadas):
 *   M      — masa del carro
 *   m1, m2 — masas de los péndulos
 *   L1, L2 — longitudes de los péndulos
 *   k_left, k_right — constantes de los resortes laterales
 *   damping — amortiguamiento viscoso
 *   g       — gravedad
 */

export interface SpringPendulumParams {
  M: number;        // masa del carro [kg]
  m1: number;       // masa péndulo izquierdo [kg]
  m2: number;       // masa péndulo derecho [kg]
  L1: number;       // longitud péndulo 1 [m]
  L2: number;       // longitud péndulo 2 [m]
  k_left: number;   // constante resorte izquierdo [N/m]
  k_right: number;  // constante resorte derecho [N/m]
  damping: number;  // coeficiente de amortiguamiento
  g: number;        // gravedad [m/s²]
  F_ext: number;    // fuerza externa en X [N] (modulada por audio)
}

export type State = [number, number, number, number, number, number];
// [x, θ₁, θ₂, ẋ, θ̇₁, θ̇₂]

/**
 * Calcula las derivadas del estado dado el estado actual y los parámetros.
 *
 * Ecuaciones de Lagrange reducidas para el sistema carro + 2 péndulos simples:
 *
 *   (M + m1 + m2) ẍ + m1·L1·(θ̈₁·cosθ₁ − θ̇₁²·sinθ₁)
 *                   + m2·L2·(θ̈₂·cosθ₂ − θ̇₂²·sinθ₂)
 *                   + (k_left + k_right)·x
 *                   + damping·ẋ = F_ext
 *
 *   m1·L1·(θ̈₁ + g/L1·sinθ₁) + m1·L1·ẍ·cosθ₁ + damping·θ̇₁ = 0
 *   m2·L2·(θ̈₂ + g/L2·sinθ₂) + m2·L2·ẍ·cosθ₂ + damping·θ̇₂ = 0
 *
 * Resolvemos el sistema lineal [ẍ, θ̈₁, θ̈₂] con eliminación de Gauss:
 */
export function springPendulumDerivatives(
  state: State,
  params: SpringPendulumParams
): State {
  const [x, θ1, θ2, xDot, θ1Dot, θ2Dot] = state;
  const { M, m1, m2, L1, L2, k_left, k_right, damping, g, F_ext } = params;

  const c1 = Math.cos(θ1);
  const s1 = Math.sin(θ1);
  const c2 = Math.cos(θ2);
  const s2 = Math.sin(θ2);

  const Mtot = M + m1 + m2;

  // ── Construimos la matriz A y vector b del sistema A·[ẍ, θ̈₁, θ̈₂] = b ──
  //
  // Fila 0 (ecuación del carro):
  //   Mtot·ẍ + m1·L1·c1·θ̈₁ + m2·L2·c2·θ̈₂ = b0
  const b0 =
    F_ext
    - (k_left + k_right) * x
    - damping * xDot
    + m1 * L1 * θ1Dot * θ1Dot * s1
    + m2 * L2 * θ2Dot * θ2Dot * s2;

  // Fila 1 (ecuación θ₁):
  //   m1·L1·c1·ẍ + m1·L1²·θ̈₁ = b1
  const b1 = -m1 * L1 * g * s1 - damping * θ1Dot;

  // Fila 2 (ecuación θ₂):
  //   m2·L2·c2·ẍ + m2·L2²·θ̈₂ = b2
  const b2 = -m2 * L2 * g * s2 - damping * θ2Dot;

  // Coeficientes de la matriz:
  const a00 = Mtot;         const a01 = m1 * L1 * c1; const a02 = m2 * L2 * c2;
  const a10 = m1 * L1 * c1; const a11 = m1 * L1 * L1; const a12 = 0;
  const a20 = m2 * L2 * c2; const a21 = 0;             const a22 = m2 * L2 * L2;

  // ── Eliminación de Gauss con pivoteo parcial ──────────────────────────────
  // Pivotamos sobre a00 para eliminar a10 y a20

  const f10 = a10 / a00;
  const f20 = a20 / a00;

  const r1_1 = a11 - f10 * a01;
  const r1_2 = a12 - f10 * a02; // = -f10 * a02
  const rb1  = b1  - f10 * b0;

  const r2_1 = a21 - f20 * a01; // = -f20 * a01
  const r2_2 = a22 - f20 * a02;
  const rb2  = b2  - f20 * b0;

  // Pivotamos sobre r1_1 para eliminar r2_1
  const f21 = r2_1 / r1_1;

  const r2_2f = r2_2 - f21 * r1_2;
  const rb2f  = rb2  - f21 * rb1;

  // Sustitución hacia atrás
  const xDDot_2 = rb2f / r2_2f;                            // θ̈₂
  const xDDot_1 = (rb1 - r1_2 * xDDot_2) / r1_1;          // θ̈₁
  const xDDot_0 = (b0 - a01 * xDDot_1 - a02 * xDDot_2) / a00; // ẍ

  return [xDot, θ1Dot, θ2Dot, xDDot_0, xDDot_1, xDDot_2];
}

// ─── Solver RK4 ───────────────────────────────────────────────────────────────

/**
 * Avanza el estado un paso dt usando el método Runge-Kutta de orden 4.
 */
export function rk4Step(
  state: State,
  params: SpringPendulumParams,
  dt: number
): State {
  const f = (s: State) => springPendulumDerivatives(s, params);

  const k1 = f(state);
  const k2 = f(addScaled(state, k1, dt / 2));
  const k3 = f(addScaled(state, k2, dt / 2));
  const k4 = f(addScaled(state, k3, dt));

  const next: State = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 6; i++) {
    next[i] = state[i] + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  }
  return next;
}

/** state + scale * delta (vectorial) */
function addScaled(s: State, delta: State, scale: number): State {
  return [
    s[0] + scale * delta[0],
    s[1] + scale * delta[1],
    s[2] + scale * delta[2],
    s[3] + scale * delta[3],
    s[4] + scale * delta[4],
    s[5] + scale * delta[5],
  ];
}

// ─── Estado inicial por defecto ───────────────────────────────────────────────

export const DEFAULT_PARAMS: SpringPendulumParams = {
  M: 2.0,
  m1: 0.5,
  m2: 0.5,
  L1: 1.5,
  L2: 1.5,
  k_left: 3.0,
  k_right: 3.0,
  damping: 0.12,  // más amortiguamiento → movimiento más fluido, menos errático
  g: 9.81,
  F_ext: 0,
};

export const INITIAL_STATE: State = [
  0,           // x
  0.6,         // θ₁ (rad) — ángulo mayor para régimen más dinámico (~34°)
  -0.8,        // θ₂ (rad) — asimétrico para romper simetría y generar caos
  0.2,         // ẋ — pequeña velocidad inicial del carro
  0.5,         // θ̇₁ — velocidad angular inicial para movimiento inmediato
  -0.4,        // θ̇₂
];
