/**
 * physicsWorker.ts — Worker de física unificado
 * -----------------------------------------------
 * Maneja Spring Pendulum y Double Pendulum en un único worker.
 * El tipo de ecuación se selecciona con SET_EQUATION.
 *
 * ── Mensajes main → worker ──────────────────────────────────────────────────
 *   { type: "START" }
 *   { type: "STOP" }
 *   { type: "SET_EQUATION",  equation: "spring" | "double" }
 *   { type: "SET_FORCE",     value: number }   — F_ext (spring) o tau_ext (double)
 *   { type: "SET_SP_PARAMS", params: Partial<SpringPendulumParams> }
 *   { type: "SET_DP_PARAMS", params: Partial<DoublePendulumParams> }
 *   { type: "RESET" }
 *
 * ── Mensajes worker → main ──────────────────────────────────────────────────
 *   { type: "FRAME_SP", state: State,   t: number }
 *   { type: "FRAME_DP", state: DPState, t: number }
 *   { type: "ERROR",    message: string }
 */

import {
  rk4Step,
  DEFAULT_PARAMS as DEFAULT_SP,
  INITIAL_STATE as INITIAL_SP,
} from "../lib/physics/springPendulum";
import type {
  SpringPendulumParams,
  State as SPState,
} from "../lib/physics/springPendulum";

import {
  rk4StepDP,
  DEFAULT_DP_PARAMS as DEFAULT_DP,
  INITIAL_DP_STATE,
} from "../lib/physics/doublePendulum";
import type {
  DoublePendulumParams,
  DPState,
} from "../lib/physics/doublePendulum";

// ─── Estado interno ───────────────────────────────────────────────────────────

type Equation = "spring" | "double";

let equation: Equation = "spring";

let spParams: SpringPendulumParams = { ...DEFAULT_SP };
let spState: SPState = [...INITIAL_SP];

let dpParams: DoublePendulumParams = { ...DEFAULT_DP };
let dpState: DPState = [...INITIAL_DP_STATE];

const DT_FIXED = 0.001;   // 1 ms sub-paso RK4
const MAX_STEP = 0.05;    // cap a 50 ms

let intervalId: ReturnType<typeof setInterval> | null = null;
let lastTs: number | null = null;

// ─── Loop ─────────────────────────────────────────────────────────────────────

function startLoop() {
  if (intervalId !== null) return;
  lastTs = Date.now();

  intervalId = setInterval(() => {
    const now = Date.now();
    let elapsed = ((now - (lastTs ?? now)) / 1000);
    lastTs = now;
    if (elapsed > MAX_STEP) elapsed = MAX_STEP;

    if (equation === "spring") {
      let t = 0;
      while (t < elapsed) {
        const dt = Math.min(DT_FIXED, elapsed - t);
        spState = rk4Step(spState, spParams, dt);
        t += dt;
      }
      self.postMessage({ type: "FRAME_SP", state: spState, t: now });
    } else {
      let t = 0;
      while (t < elapsed) {
        const dt = Math.min(DT_FIXED, elapsed - t);
        dpState = rk4StepDP(dpState, dpParams, dt);
        t += dt;
      }
      self.postMessage({ type: "FRAME_DP", state: dpState, t: now });
    }
  }, 1000 / 60);
}

function stopLoop() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  lastTs = null;
}

// ─── Mensajes ─────────────────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent) => {
  const msg = e.data as {
    type: string;
    equation?: Equation;
    value?: number;
    params?: Partial<SpringPendulumParams> | Partial<DoublePendulumParams>;
  };

  switch (msg.type) {
    case "START":
      startLoop();
      break;

    case "STOP":
      stopLoop();
      break;

    case "SET_EQUATION":
      if (msg.equation && msg.equation !== equation) {
        equation = msg.equation;
        // Reiniciar estado al cambiar de ecuación
        spState = [...INITIAL_SP];
        dpState = [...INITIAL_DP_STATE];
      }
      break;

    case "SET_FORCE":
      if (msg.value !== undefined) {
        // Clampar fuerza: evita explosiones numéricas en el integrador RK4
        const clamped = Math.min(15, Math.max(-15, msg.value));
        spParams.F_ext   = clamped;
        dpParams.tau_ext = clamped;
      }
      break;

    case "IMPULSE": {
      // Kick de velocidad instantáneo — modifica el estado directamente.
      // Clampar cada componente a ±8 rad/s para evitar divergencia numérica.
      const clampImp = (v: unknown) => Math.min(8, Math.max(-8, (v as number) ?? 0));
      if (equation === "spring") {
        spState[3] += clampImp((msg as { kx?: number }).kx);  // ẋ
        spState[4] += clampImp((msg as { k1?: number }).k1);  // θ̇₁
        spState[5] += clampImp((msg as { k2?: number }).k2);  // θ̇₂
      } else {
        dpState[2] += clampImp((msg as { k1?: number }).k1);  // ω₁
        dpState[3] += clampImp((msg as { k2?: number }).k2);  // ω₂
      }
      break;
    }

    case "SET_SP_PARAMS":
      if (msg.params) {
        spParams = { ...spParams, ...(msg.params as Partial<SpringPendulumParams>) };
      }
      break;

    case "SET_DP_PARAMS":
      if (msg.params) {
        dpParams = { ...dpParams, ...(msg.params as Partial<DoublePendulumParams>) };
      }
      break;

    case "RESET":
      spState = [...INITIAL_SP];
      dpState = [...INITIAL_DP_STATE];
      break;

    default:
      self.postMessage({ type: "ERROR", message: `Tipo desconocido: ${msg.type}` });
  }
};

export {};
