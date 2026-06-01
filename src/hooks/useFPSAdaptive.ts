"use client";

/**
 * useFPSAdaptive
 * Measures real FPS using requestAnimationFrame averaged over 90 frames,
 * and returns a quality level and particle multiplier for adaptive rendering.
 */

import { useState, useEffect, useRef } from "react";

type QualityLevel = "high" | "medium" | "low";

export interface FPSAdaptiveResult {
  /** Current measured frames per second (averaged over last 90 frames). */
  fps: number;
  /** Derived quality tier based on FPS thresholds. */
  qualityLevel: QualityLevel;
  /**
   * Suggested multiplier for particle counts:
   * high → 1.0, medium → 0.5, low → 0.15
   */
  particleMultiplier: number;
}

const SAMPLE_SIZE = 90;

function deriveQuality(fps: number): QualityLevel {
  if (fps >= 50) return "high";
  if (fps >= 35) return "medium";
  return "low";
}

function deriveMultiplier(quality: QualityLevel): number {
  switch (quality) {
    case "high":
      return 1.0;
    case "medium":
      return 0.5;
    case "low":
      return 0.15;
  }
}

export function useFPSAdaptive(): FPSAdaptiveResult {
  const [fps, setFps] = useState<number>(60);
  const [qualityLevel, setQualityLevel] = useState<QualityLevel>("high");
  const [particleMultiplier, setParticleMultiplier] = useState<number>(1.0);

  const rafIdRef = useRef<number | null>(null);
  const timestampsRef = useRef<number[]>([]);

  useEffect(() => {
    let running = true;

    const tick = (now: number): void => {
      if (!running) return;

      const stamps = timestampsRef.current;
      stamps.push(now);

      if (stamps.length > SAMPLE_SIZE) {
        stamps.splice(0, stamps.length - SAMPLE_SIZE);
      }

      if (stamps.length >= 2) {
        const elapsed = stamps[stamps.length - 1] - stamps[0];
        const measuredFps = ((stamps.length - 1) / elapsed) * 1000;
        const rounded = Math.round(measuredFps);
        const quality = deriveQuality(measuredFps);
        const multiplier = deriveMultiplier(quality);

        setFps(rounded);
        setQualityLevel(quality);
        setParticleMultiplier(multiplier);
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      timestampsRef.current = [];
    };
  }, []);

  return { fps, qualityLevel, particleMultiplier };
}
