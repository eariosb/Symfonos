"use client";

/**
 * useAudioEngine
 * --------------
 * Encapsula la lógica de Web Audio API para SymFonos.
 *
 * Fuentes soportadas:
 *   • Micrófono (getUserMedia)
 *   • Archivo de audio (.mp3 / .wav / .ogg)
 *
 * Métricas en tiempo real (60 fps via requestAnimationFrame):
 *   • rms          — nivel RMS normalizado [0, 1]
 *   • dominantFreq — frecuencia dominante en Hz
 *   • isBeat       — detección de beat (energía de bajos)
 *   • frequencyData — Uint8Array del analizador completo
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type AudioSource = "mic" | "file" | "none";

export interface AudioMetrics {
  rms: number;              // [0, 1]
  dominantFreq: number;     // Hz
  isBeat: boolean;
  frequencyData: Uint8Array;
  timeDomainData: Uint8Array; // para WaveformDisplay
  /** Energía de bajos normalizada [0,1] */
  bassEnergy: number;
}

export interface AudioEngineState {
  source: AudioSource;
  isReady: boolean;
  error: string | null;
  metrics: AudioMetrics;
}

export interface AudioEngineControls {
  startMic: () => Promise<void>;
  stopMic: () => void;
  loadFile: (file: File) => Promise<void>;
  stopFile: () => void;
  stop: () => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const FFT_SIZE = 2048;
const SMOOTHING = 0.8;

/** Rango de frecuencias de graves para detección de beat (Hz). */
const BASS_LOW_HZ = 20;
const BASS_HIGH_HZ = 200;

/**
 * Energía de beat se detecta cuando la energía de bajos supera
 * BEAT_THRESHOLD veces la media de bajos reciente.
 */
const BEAT_THRESHOLD = 1.4;
/** Ventana de historia para promedio de energía de bajos (frames). */
const BEAT_HISTORY_LEN = 43; // ~43 frames @ 60fps ≈ 700 ms
/** Tiempo mínimo entre beats (ms). */
const BEAT_COOLDOWN_MS = 200;

const EMPTY_METRICS: AudioMetrics = {
  rms: 0,
  dominantFreq: 0,
  isBeat: false,
  frequencyData: new Uint8Array(FFT_SIZE / 2),
  timeDomainData: new Uint8Array(FFT_SIZE),
  bassEnergy: 0,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Calcula RMS normalizado de un buffer de bytes [0, 255]. */
function calcRMS(buf: Uint8Array): number {
  let sumSq = 0;
  for (let i = 0; i < buf.length; i++) {
    const normalized = (buf[i] - 128) / 128; // [-1, 1]
    sumSq += normalized * normalized;
  }
  return Math.sqrt(sumSq / buf.length);
}

/** Devuelve la frecuencia dominante dado el espectro de magnitudes. */
function calcDominantFreq(
  freqData: Uint8Array,
  sampleRate: number
): number {
  let maxVal = -1;
  let maxIdx = 0;
  for (let i = 0; i < freqData.length; i++) {
    if (freqData[i] > maxVal) {
      maxVal = freqData[i];
      maxIdx = i;
    }
  }
  const nyquist = sampleRate / 2;
  return (maxIdx / freqData.length) * nyquist;
}

/** Convierte Hz a índice de bin del AnalyserNode. */
function hzToBin(hz: number, sampleRate: number, fftSize: number): number {
  return Math.round((hz / (sampleRate / 2)) * (fftSize / 2));
}

/** Energía media de una banda de frecuencias [binLow, binHigh]. */
function bandEnergy(freqData: Uint8Array, binLow: number, binHigh: number): number {
  let sum = 0;
  const count = binHigh - binLow;
  for (let i = binLow; i < binHigh && i < freqData.length; i++) {
    sum += freqData[i];
  }
  return count > 0 ? sum / count : 0;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAudioEngine(): AudioEngineState & AudioEngineControls {
  const [state, setState] = useState<AudioEngineState>({
    source: "none",
    isReady: false,
    error: null,
    metrics: EMPTY_METRICS,
  });

  // Refs para recursos de audio (no causan re-render)
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const sourceNodeRef = useRef<AudioNode | null>(null);
  const rafRef = useRef<number | null>(null);

  // Estado de beat detection (sin re-render)
  const bassHistoryRef = useRef<number[]>([]);
  const lastBeatRef = useRef<number>(0);

  // ── Bucle de análisis ──────────────────────────────────────────────────────

  const startAnalysisLoop = useCallback(() => {
    const analyser = analyserRef.current;
    const ctx = ctxRef.current;
    if (!analyser || !ctx) return;

    const timeDomainBuf = new Uint8Array(analyser.fftSize);
    const freqBuf = new Uint8Array(analyser.frequencyBinCount);
    const bassLowBin = hzToBin(BASS_LOW_HZ, ctx.sampleRate, analyser.fftSize);
    const bassHighBin = hzToBin(BASS_HIGH_HZ, ctx.sampleRate, analyser.fftSize);

    const tick = () => {
      analyser.getByteTimeDomainData(timeDomainBuf);
      analyser.getByteFrequencyData(freqBuf);

      const rms = calcRMS(timeDomainBuf);
      const dominantFreq = calcDominantFreq(freqBuf, ctx.sampleRate);

      // Beat detection
      const currentBassEnergy = bandEnergy(freqBuf, bassLowBin, bassHighBin);
      bassHistoryRef.current.push(currentBassEnergy);
      if (bassHistoryRef.current.length > BEAT_HISTORY_LEN) {
        bassHistoryRef.current.shift();
      }
      const avgBass =
        bassHistoryRef.current.reduce((a, b) => a + b, 0) /
        bassHistoryRef.current.length;

      const now = performance.now();
      const isBeat =
        currentBassEnergy > avgBass * BEAT_THRESHOLD &&
        now - lastBeatRef.current > BEAT_COOLDOWN_MS;

      if (isBeat) lastBeatRef.current = now;

      const normalizedBass = Math.min(currentBassEnergy / 200, 1);

      setState((prev) => ({
        ...prev,
        isReady: true,
        metrics: {
          rms,
          dominantFreq,
          isBeat,
          frequencyData: freqBuf.slice(),
          timeDomainData: timeDomainBuf.slice(),
          bassEnergy: normalizedBass,
        },
      }));

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopAnalysisLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // ── Crear/obtener AudioContext ─────────────────────────────────────────────

  const getOrCreateContext = useCallback((): AudioContext => {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const setupAnalyser = useCallback((ctx: AudioContext): AnalyserNode => {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = SMOOTHING;
    analyserRef.current = analyser;
    return analyser;
  }, []);

  // ── Desconectar fuente anterior ────────────────────────────────────────────

  const disconnectCurrentSource = useCallback(() => {
    stopAnalysisLoop();

    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect(); } catch { /* ignorar */ }
      sourceNodeRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = "";
      audioElRef.current = null;
    }

    bassHistoryRef.current = [];
    lastBeatRef.current = 0;
  }, [stopAnalysisLoop]);

  // ── startMic ──────────────────────────────────────────────────────────────

  const startMic = useCallback(async () => {
    disconnectCurrentSource();
    setState((prev) => ({ ...prev, source: "mic", isReady: false, error: null }));

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;

      const ctx = getOrCreateContext();
      const analyser = setupAnalyser(ctx);

      const micNode = ctx.createMediaStreamSource(stream);
      micNode.connect(analyser);
      sourceNodeRef.current = micNode;

      startAnalysisLoop();
    } catch (err) {
      setState((prev) => ({
        ...prev,
        source: "none",
        isReady: false,
        error: err instanceof Error ? err.message : "Error al acceder al micrófono",
      }));
    }
  }, [disconnectCurrentSource, getOrCreateContext, setupAnalyser, startAnalysisLoop]);

  // ── stopMic ───────────────────────────────────────────────────────────────

  const stopMic = useCallback(() => {
    disconnectCurrentSource();
    setState((prev) => ({ ...prev, source: "none", isReady: false, metrics: EMPTY_METRICS }));
  }, [disconnectCurrentSource]);

  // ── loadFile ──────────────────────────────────────────────────────────────

  const loadFile = useCallback(
    async (file: File) => {
      disconnectCurrentSource();
      setState((prev) => ({ ...prev, source: "file", isReady: false, error: null }));

      try {
        const ctx = getOrCreateContext();
        const analyser = setupAnalyser(ctx);

        const audioEl = new Audio();
        audioEl.src = URL.createObjectURL(file);
        audioEl.crossOrigin = "anonymous";
        audioElRef.current = audioEl;

        const mediaNode = ctx.createMediaElementSource(audioEl);
        mediaNode.connect(analyser);
        analyser.connect(ctx.destination); // para escuchar la reproducción
        sourceNodeRef.current = mediaNode;

        audioEl.play();
        startAnalysisLoop();
      } catch (err) {
        setState((prev) => ({
          ...prev,
          source: "none",
          isReady: false,
          error: err instanceof Error ? err.message : "Error al cargar archivo de audio",
        }));
      }
    },
    [disconnectCurrentSource, getOrCreateContext, setupAnalyser, startAnalysisLoop]
  );

  // ── stopFile ──────────────────────────────────────────────────────────────

  const stopFile = useCallback(() => {
    disconnectCurrentSource();
    setState((prev) => ({ ...prev, source: "none", isReady: false, metrics: EMPTY_METRICS }));
  }, [disconnectCurrentSource]);

  // ── stop (genérico) ───────────────────────────────────────────────────────

  const stop = useCallback(() => {
    disconnectCurrentSource();
    setState({ source: "none", isReady: false, error: null, metrics: EMPTY_METRICS });
  }, [disconnectCurrentSource]);

  // ── Cleanup al desmontar ──────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopAnalysisLoop();
      disconnectCurrentSource();
      if (ctxRef.current && ctxRef.current.state !== "closed") {
        ctxRef.current.close();
      }
    };
  }, [stopAnalysisLoop, disconnectCurrentSource]);

  return {
    ...state,
    startMic,
    stopMic,
    loadFile,
    stopFile,
    stop,
  };
}
