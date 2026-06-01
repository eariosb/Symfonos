"use client";

/**
 * usePhysicsWorker — v2
 * ---------------------
 * Wrapper del worker unificado (Spring + Double Pendulum).
 * Se sincroniza con el store Zustand y reenvía params al worker
 * cada vez que cambian (sin reiniciar la animación).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { SpringPendulumParams, State as SPState } from "@/lib/physics/springPendulum";
import type { DoublePendulumParams, DPState } from "@/lib/physics/doublePendulum";
import { INITIAL_STATE as INITIAL_SP } from "@/lib/physics/springPendulum";
import { INITIAL_DP_STATE } from "@/lib/physics/doublePendulum";
import type { Equation } from "@/store/symfonos";

export interface PhysicsFrame {
  equation: Equation;
  spState: SPState;
  dpState: DPState;
}

export interface PhysicsControls {
  start: () => void;
  stop: () => void;
  setEquation: (eq: Equation) => void;
  setForce: (value: number) => void;
  /** Kick de velocidad instantáneo en cada beat — genera quiebre caótico */
  applyImpulse: (kx: number, k1: number, k2: number) => void;
  setSpringParams: (p: Partial<SpringPendulumParams>) => void;
  setDPParams: (p: Partial<DoublePendulumParams>) => void;
  reset: () => void;
}

export function usePhysicsWorker(): PhysicsFrame & PhysicsControls {
  const workerRef = useRef<Worker | null>(null);
  const [frame, setFrame] = useState<PhysicsFrame>({
    equation: "spring",
    spState: [...INITIAL_SP],
    dpState: [...INITIAL_DP_STATE],
  });

  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/physicsWorker.ts", import.meta.url)
    );

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as {
        type: string;
        state?: number[];
        message?: string;
      };

      if (msg.type === "FRAME_SP" && msg.state) {
        setFrame((prev) => ({
          ...prev,
          equation: "spring",
          spState: msg.state as SPState,
        }));
      } else if (msg.type === "FRAME_DP" && msg.state) {
        setFrame((prev) => ({
          ...prev,
          equation: "double",
          dpState: msg.state as DPState,
        }));
      } else if (msg.type === "ERROR") {
        console.error("[PhysicsWorker]", msg.message);
      }
    };

    worker.onerror = (err) => console.error("[PhysicsWorker]", err);
    workerRef.current = worker;

    return () => {
      worker.postMessage({ type: "STOP" });
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const send = useCallback((msg: object) => {
    workerRef.current?.postMessage(msg);
  }, []);

  const start = useCallback(() => send({ type: "START" }), [send]);
  const stop  = useCallback(() => send({ type: "STOP" }),  [send]);

  const setEquation = useCallback(
    (eq: Equation) => {
      send({ type: "SET_EQUATION", equation: eq });
      setFrame((prev) => ({ ...prev, equation: eq }));
    },
    [send]
  );

  const setForce = useCallback(
    (value: number) => send({ type: "SET_FORCE", value }),
    [send]
  );

  const applyImpulse = useCallback(
    (kx: number, k1: number, k2: number) => send({ type: "IMPULSE", kx, k1, k2 }),
    [send]
  );

  const setSpringParams = useCallback(
    (p: Partial<SpringPendulumParams>) => send({ type: "SET_SP_PARAMS", params: p }),
    [send]
  );

  const setDPParams = useCallback(
    (p: Partial<DoublePendulumParams>) => send({ type: "SET_DP_PARAMS", params: p }),
    [send]
  );

  const reset = useCallback(() => {
    send({ type: "RESET" });
    setFrame((prev) => ({
      ...prev,
      spState: [...INITIAL_SP],
      dpState: [...INITIAL_DP_STATE],
    }));
  }, [send]);

  return { ...frame, start, stop, setEquation, setForce, applyImpulse, setSpringParams, setDPParams, reset };
}
