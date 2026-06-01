"use client";

/**
 * SymFonos — página principal v3 (Sprint 3)
 * -------------------------------------------
 * Orquestador final con:
 *   • useAudioEngine     — audio + métricas LCH
 *   • usePhysicsWorker   — RK4 worker unificado
 *   • PhysicsCanvas v3   — shaders + aberración cromática + fondo LCH
 *   • ControlPanel       — laboratorio de parámetros
 *   • WaveformDisplay    — forma de onda reactiva
 *   • TutorialOverlay    — tutorial interactivo primer uso
 *   • RecordButton       — grabación MediaRecorder
 *   • useFullscreen      — modo pantalla completa
 *   • useFPSAdaptive     — ajuste dinámico de calidad
 *   • Modo monocromo     — accesibilidad
 *
 * Atajos de teclado:
 *   Space — mic on/off
 *   E     — cambiar ecuación
 *   P     — siguiente preset
 *   L     — panel lab
 *   F     — pantalla completa
 *   M     — modo monocromo
 *   R     — reset físico
 */

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { usePhysicsWorker } from "@/hooks/usePhysicsWorker";
import { useFullscreen } from "@/hooks/useFullscreen";
import { useFPSAdaptive } from "@/hooks/useFPSAdaptive";
import { useSymfonos, PRESET_LABELS } from "@/store/symfonos";
import AudioControls from "@/components/AudioControls";
import ControlPanel from "@/components/ControlPanel";
import WaveformDisplay from "@/components/WaveformDisplay";
import TutorialOverlay from "@/components/TutorialOverlay";
import type { FrameData } from "@/components/PhysicsCanvas";
import { PRESETS } from "@/lib/presets";
import { freqToHue } from "@/lib/colorSystem";

const PhysicsCanvas = dynamic(() => import("@/components/PhysicsCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center"
      style={{ color: "rgba(0,255,255,0.2)", fontSize: "0.65rem", letterSpacing: "0.3em" }}>
      CARGANDO MOTOR…
    </div>
  ),
});

// Importación lazy de RecordButton (requiere canvas ref)
const RecordButton = dynamic(() => import("@/components/RecordButton"), { ssr: false });

const FORCE_SCALE = 12;   // reducido: movimiento más elegante, menos brusco
const UI_HIDE_DELAY = 3500;

export default function SymFonosPage() {
  const audio = useAudioEngine();
  const phys = usePhysicsWorker();
  const store = useSymfonos();
  const fullscreen = useFullscreen();
  const adaptive = useFPSAdaptive();

  const pageRef = useRef<HTMLDivElement>(null);
  const pushFrameRef = useRef<((d: FrameData) => void) | null>(null);
  const getCanvasRef = useRef<(() => HTMLCanvasElement | null) | null>(null);
  const canvasForRec = useRef<HTMLCanvasElement | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);

  const [uiVisible, setUiVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // FPS display — use a ref so the interval never closes over a stale value
  const [fps, setFps] = useState(0);
  const fpsTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const adaptiveRef = useRef(adaptive);
  adaptiveRef.current = adaptive;

  // Refs para los valores de frame — evitan deps de tamaño variable en useEffect
  const physRef = useRef(phys);
  const audioRef = useRef(audio);
  const storeRef = useRef(store);
  physRef.current = phys;
  audioRef.current = audio;
  storeRef.current = store;

  // ── UI auto-hide ──────────────────────────────────────────────────────────
  const resetHideTimer = useCallback(() => {
    setUiVisible(true);
    store.setUiVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setUiVisible(false);
      store.setUiVisible(false);
    }, UI_HIDE_DELAY);
  }, [store]);

  // ── Arrancar worker ───────────────────────────────────────────────────────
  useEffect(() => {
    phys.start();
    resetHideTimer();
    fpsTimer.current = setInterval(() => setFps(adaptiveRef.current.fps), 800);
    return () => {
      phys.stop();
      if (fpsTimer.current) clearInterval(fpsTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync: ecuación → worker ───────────────────────────────────────────────
  useEffect(() => { phys.setEquation(store.equation); }, [store.equation]); // eslint-disable-line
  useEffect(() => { phys.setSpringParams(store.springParams); }, [store.springParams]); // eslint-disable-line
  useEffect(() => { phys.setDPParams(store.doublePendulumParams); }, [store.doublePendulumParams]); // eslint-disable-line

  // ── Audio → fuerza externa ────────────────────────────────────────────────
  // Movido al RAF loop de abajo para evitar deps de tamaño variable.

  // ── Push frame a Three.js ─────────────────────────────────────────────────
  // Usamos refs para todos los valores de frame: evita deps de tamaño variable
  // (spState=6 ítems, dpState=4 ítems) que React rechaza cuando cambian de tamaño.
  // El RAF interno de PhysicsCanvas lee currentFrame en cada tick, por lo que
  // no se pierde ninguna actualización aunque este effect no se re-ejecute.
  useEffect(() => {
    let rafId: number;

    const pushLoop = () => {
      const p = physRef.current;
      const a = audioRef.current;
      const s = storeRef.current;
      const ad = adaptiveRef.current;

      // Fuerza shaped: pow(rms,1.6) enfatiza picos reales, evita linealidad plana.
      // La micro-modulación sinusoidal añade "swing" orgánico (como un instrumento analógico).
      const shapedRms = Math.pow(Math.min(1, a.metrics.rms), 1.6);
      const swingMod = 0.85 + 0.15 * Math.sin(Date.now() * 0.008);
      const baseF = shapedRms * s.sensitivity * FORCE_SCALE * swingMod;
      const beatF = a.metrics.isBeat
        ? a.metrics.bassEnergy * s.sensitivity * FORCE_SCALE * 1.8
        : 0;
      p.setForce(baseF + beatF);

      // Impulso instantáneo en cada beat: quiebre de trayectoria caótica
      if (a.metrics.isBeat) {
        const t = Date.now() * 0.001;
        const scale = a.metrics.bassEnergy * s.sensitivity * 1.6;
        p.applyImpulse(
          scale * Math.sin(t * 3.7),
          scale * Math.cos(t * 5.1) * 1.4,
          scale * Math.sin(t * 7.3 + 1.2) * 1.4
        );
      }

      // Chaos Mode: impulsos gaussianos aleatorios suaves cada ~33 frames
      // Activa el modo caos del sistema — genera variabilidad continua
      if (s.chaosMode && Math.random() < 0.03) {
        const cr = () => (Math.random() - 0.5) * 0.18;
        p.applyImpulse(cr(), cr(), cr());
      }

      const state = s.equation === "spring" ? p.spState : p.dpState;
      const freqHz = a.metrics.dominantFreq;
      const freqLog = Math.log10(Math.max(20, Math.min(freqHz, 20000)));
      const freqNorm = (freqLog - Math.log10(20)) / (Math.log10(20000) - Math.log10(20));

      // Señal cinética normalizada
      let velocityNorm = 0;
      if (s.equation === "spring" && state.length >= 6) {
        const v = Math.sqrt(state[3]! ** 2 + state[4]! ** 2 + state[5]! ** 2);
        velocityNorm = Math.min(1, v / 8);
      } else if (s.equation === "double" && state.length >= 4) {
        const v = Math.sqrt(state[2]! ** 2 + state[3]! ** 2);
        velocityNorm = Math.min(1, v / 12);
      }


      const frame: FrameData = {
        state,
        equation: s.equation,
        preset: s.preset,
        rms: a.metrics.rms,
        isBeat: a.metrics.isBeat,
        freqNorm,
        monochrome: s.monochrome,
        particleLimit: ad.particleMultiplier,
        velocityNorm,
        bassEnergy: Math.min(1, a.metrics.bassEnergy * 3),
      };

      pushFrameRef.current?.(frame);

      if (getCanvasRef.current) {
        canvasForRec.current = getCanvasRef.current();
      }

      rafId = requestAnimationFrame(pushLoop);
    };

    rafId = requestAnimationFrame(pushLoop);
    return () => cancelAnimationFrame(rafId);
  }, []); // deps vacíos — lee siempre los valores actuales vía refs

  // ── Atajos de teclado ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      resetHideTimer();
      switch (e.code) {
        case "Space":
          e.preventDefault();
          if (audio.source === "mic") audio.stopMic(); else audio.startMic();
          break;
        case "KeyE": store.setEquation(store.equation === "spring" ? "double" : "spring"); break;
        case "KeyP": store.nextPreset(); break;
        case "KeyL": store.setPanelOpen(!store.panelOpen); break;
        case "KeyF": fullscreen.toggleFullscreen(pageRef.current ?? undefined); break;
        case "KeyM": store.toggleMonochrome(); break;
        case "KeyR": phys.reset(); break;
        case "KeyZ": store.toggleZenMode(); break;
        case "KeyC": store.toggleChaosMode(); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [audio, store, phys, fullscreen, resetHideTimer]);

  // ── Mouse/touch → mostrar UI ──────────────────────────────────────────────
  useEffect(() => {
    const h = () => resetHideTimer();
    window.addEventListener("mousemove", h);
    window.addEventListener("touchstart", h);
    return () => { window.removeEventListener("mousemove", h); window.removeEventListener("touchstart", h); };
  }, [resetHideTimer]);

  const preset = PRESETS[store.preset];
  const accent = preset.colors.accent;
  const accentSec = preset.colors.accentSecondary;
  const curState = store.equation === "spring" ? phys.spState : phys.dpState;

  const qualityColor = adaptive.qualityLevel === "high" ? `${accent}55`
    : adaptive.qualityLevel === "medium" ? "rgba(255,180,0,0.6)"
      : "rgba(255,60,0,0.7)";

  return (
    <div
      ref={pageRef}
      className={`relative w-full h-full ${store.monochrome ? "monochrome-mode" : ""}`}
      style={{ background: "#050510", overflow: "hidden" }}
    >
      {/* ── Tutorial (primer uso) ── */}
      {!store.tutorialDone && (
        <TutorialOverlay
          accentColor={accent}
          onComplete={() => store.setTutorialDone()}
        />
      )}

      {/* ── Canvas Three.js ── */}
      <div className="absolute inset-0">
        <PhysicsCanvas
          onMount={(push, getCanvas) => {
            pushFrameRef.current = push;
            getCanvasRef.current = getCanvas;
            setCanvasReady(true);
          }}
        />
      </div>

      {/* ── Overlay UI (fade automático) ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: uiVisible ? 1 : 0, transition: "opacity 0.8s ease" }}
      >
        {/* ── HUD Superior ── */}
        <div
          className="absolute top-0 left-0 right-0 flex items-start justify-between px-5 py-4"
          style={{ pointerEvents: uiVisible ? "auto" : "none" }}
        >
          {/* Logo */}
          <div>
            <div style={{
              fontSize: "1.2rem", fontWeight: 300, letterSpacing: "0.3em",
              color: accent, textShadow: `0 0 18px ${accent}77`, textTransform: "uppercase",
            }}>
              SymFonos
            </div>
            <div style={{ fontSize: "0.5rem", letterSpacing: "0.18em", color: `${accent}44`, marginTop: "2px" }}>
              {store.equation === "spring" ? "Spring Pendulum" : "Double Pendulum"}
              {" · "}{PRESET_LABELS[store.preset]}{" · "}RK4 · WebGL
            </div>
          </div>

          {/* Estado: FPS + beat + grabación + fullscreen + monocromo */}
          <div className="flex items-center gap-3" style={{ marginTop: "4px" }}>
            <span style={{ fontSize: "0.55rem", color: qualityColor, letterSpacing: "0.1em" }}>
              {fps} FPS
              {adaptive.qualityLevel !== "high" && ` · ${adaptive.qualityLevel.toUpperCase()}`}
            </span>
            {audio.isReady && (
              <div className={`beat-dot ${audio.metrics.isBeat ? "lit" : ""}`} />
            )}
            {/* Botón monocromo */}
            <div className="tooltip-wrap">
              <button
                className={`btn-neon ${store.monochrome ? "active" : ""}`}
                style={{
                  borderColor: store.monochrome ? "#ffffff" : "rgba(255,255,255,0.2)",
                  color: store.monochrome ? "#ffffff" : "rgba(255,255,255,0.35)",
                  padding: "0.2rem 0.5rem", fontSize: "0.6rem",
                }}
                onClick={() => store.toggleMonochrome()}
              >
                ◑ [M]
              </button>
              <span className="tooltip">Modo monocromo</span>
            </div>
            {/* Zen Mode */}
            <div className="tooltip-wrap">
              <button
                className={`btn-neon ${store.zenMode ? "active" : ""}`}
                style={{
                  borderColor: store.zenMode ? accent : "rgba(255,255,255,0.2)",
                  color: store.zenMode ? accent : "rgba(255,255,255,0.35)",
                  padding: "0.2rem 0.5rem", fontSize: "0.6rem",
                }}
                onClick={() => store.toggleZenMode()}
              >
                ◎ [Z]
              </button>
              <span className="tooltip">Modo zen — oculta UI numérica</span>
            </div>
            {/* Chaos Mode */}
            <div className="tooltip-wrap">
              <button
                className={`btn-neon ${store.chaosMode ? "active" : ""}`}
                style={{
                  borderColor: store.chaosMode ? "#ff4444" : "rgba(255,255,255,0.2)",
                  color: store.chaosMode ? "#ff4444" : "rgba(255,255,255,0.35)",
                  padding: "0.2rem 0.5rem", fontSize: "0.6rem",
                  animation: store.chaosMode ? "pulse 1s infinite" : "none",
                }}
                onClick={() => store.toggleChaosMode()}
              >
                ⚡ [C]
              </button>
              <span className="tooltip">Modo caos — impulsos aleatorios continuos</span>
            </div>
            {/* Fullscreen */}
            <div className="tooltip-wrap">
              <button
                className="btn-neon"
                style={{
                  padding: "0.2rem 0.5rem", fontSize: "0.6rem",
                  borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.35)"
                }}
                onClick={() => fullscreen.toggleFullscreen(pageRef.current ?? undefined)}
              >
                {fullscreen.isFullscreen ? "⊡" : "⊞"} [F]
              </button>
              <span className="tooltip">Pantalla completa</span>
            </div>
          </div>
        </div>

        {/* ── Barra inferior — oculta en Zen Mode ── */}
        <div
          className="absolute bottom-0 left-0 right-0 flex items-end justify-between px-5 pb-5 gap-3"
          style={{
            pointerEvents: (uiVisible && !store.zenMode) ? "auto" : "none",
            opacity: store.zenMode ? 0 : 1,
            transition: "opacity 0.6s ease",
          }}
        >
          {/* Columna izquierda: waveform + audio controls */}
          <div className="flex flex-col gap-2" style={{ minWidth: "220px", maxWidth: "260px" }}>
            {audio.isReady && (
              <div style={{
                height: "50px", background: "rgba(5,5,16,0.72)",
                borderRadius: "4px", border: `1px solid ${accent}22`, overflow: "hidden",
              }}>
                <WaveformDisplay
                  timeDomainData={audio.metrics.timeDomainData}
                  rms={audio.metrics.rms}
                  isBeat={audio.metrics.isBeat}
                  accentColor={accent}
                />
              </div>
            )}
            <AudioControls
              source={audio.source}
              isReady={audio.isReady}
              error={audio.error}
              rms={audio.metrics.rms}
              isBeat={audio.metrics.isBeat}
              dominantFreq={audio.metrics.dominantFreq}
              sensitivity={store.sensitivity}
              accentColor={accent}
              onStartMic={audio.startMic}
              onStopMic={audio.stopMic}
              onLoadFile={audio.loadFile}
              onStopFile={audio.stopFile}
              onSensitivityChange={store.setSensitivity}
            />
          </div>

          {/* Centro: selección ecuación + presets + grabación */}
          <div className="flex flex-col items-center gap-2 flex-1">
            {/* Ecuaciones */}
            <div className="flex gap-2">
              {(["spring", "double"] as const).map((eq) => (
                <div key={eq} className="tooltip-wrap">
                  <button
                    className={`btn-neon ${store.equation === eq ? "active" : ""}`}
                    style={{
                      borderColor: store.equation === eq ? accent : "rgba(255,255,255,0.15)",
                      color: store.equation === eq ? accent : "rgba(255,255,255,0.35)",
                      fontSize: "0.65rem", padding: "0.28rem 0.85rem",
                    }}
                    onClick={() => store.setEquation(eq)}
                  >
                    {eq === "spring" ? "Spring [E]" : "Double [E]"}
                  </button>
                  <span className="tooltip">
                    {eq === "spring" ? "Carro + 2 péndulos + resortes" : "Péndulo doble clásico — máximo caos"}
                  </span>
                </div>
              ))}
            </div>

            {/* Presets */}
            <div className="flex gap-1.5">
              {(["kandinsky", "vignelli", "neon", "particle", "tide", "acid", "zobel"] as const).map((p) => (
                <div key={p} className="tooltip-wrap">
                  <button
                    className={`btn-neon ${store.preset === p ? "active" : ""}`}
                    style={{
                      borderColor: store.preset === p ? PRESETS[p].colors.accent : "rgba(255,255,255,0.12)",
                      color: store.preset === p ? PRESETS[p].colors.accent : "rgba(255,255,255,0.3)",
                      fontSize: "0.58rem", padding: "0.22rem 0.5rem",
                    }}
                    onClick={() => {
                      store.setPreset(p);
                      // Si el preset tiene ecuación preferida, sincronizar el store
                      const pref = PRESETS[p].preferredEquation;
                      if (pref && pref !== store.equation) store.setEquation(pref);
                    }}
                  >
                    {PRESET_LABELS[p].split(" ")[0]}
                  </button>
                  <span className="tooltip">{PRESET_LABELS[p]}</span>
                </div>
              ))}
            </div>

            {/* Grabación */}
            <RecordButton canvasRef={canvasForRec} canvasReady={canvasReady} accentColor={accentSec} />
          </div>

          {/* Columna derecha: lab + estado físico */}
          <div className="flex flex-col items-end gap-2">
            <div className="tooltip-wrap">
              <button
                className={`btn-neon ${store.panelOpen ? "active" : ""}`}
                style={{
                  borderColor: store.panelOpen ? accent : "rgba(255,255,255,0.2)",
                  color: store.panelOpen ? accent : "rgba(255,255,255,0.4)",
                }}
                onClick={() => store.setPanelOpen(!store.panelOpen)}
              >
                ⚗ Lab [L]
              </button>
              <span className="tooltip">Panel de laboratorio — ajustar física</span>
            </div>

            {/* Estado físico */}
            <div style={{
              fontSize: "0.56rem", color: "rgba(255,255,255,0.2)",
              letterSpacing: "0.04em", lineHeight: 1.9, textAlign: "right",
            }}>
              {store.equation === "spring" ? (
                <>
                  <div>x = <span style={{ color: `${accent}66` }}>{curState[0]?.toFixed(3)}</span></div>
                  <div>θ₁ = <span style={{ color: `${accentSec}66` }}>{curState[1]?.toFixed(3)}</span> rad</div>
                  <div>θ₂ = <span style={{ color: `${accent}66` }}>{curState[2]?.toFixed(3)}</span> rad</div>
                </>
              ) : (
                <>
                  <div>θ₁ = <span style={{ color: `${accentSec}66` }}>{curState[0]?.toFixed(3)}</span> rad</div>
                  <div>θ₂ = <span style={{ color: `${accent}66` }}>{curState[1]?.toFixed(3)}</span> rad</div>
                  <div>ω₂ = <span style={{ color: `${accentSec}66` }}>{curState[3]?.toFixed(3)}</span></div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Zen Mode: badge minimalista ── */}
      {store.zenMode && uiVisible && (
        <div
          className="absolute bottom-4 left-1/2 pointer-events-auto"
          style={{ transform: "translateX(-50%)", zIndex: 30 }}
        >
          <button
            onClick={() => store.toggleZenMode()}
            style={{
              fontSize: "0.52rem", letterSpacing: "0.25em",
              color: `${accent}66`, border: `1px solid ${accent}22`,
              background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)",
              padding: "0.3rem 1.2rem", borderRadius: "2px", cursor: "pointer",
              textTransform: "uppercase",
            }}
          >
            {PRESET_LABELS[store.preset]}
            {store.chaosMode && " · ⚡"}
            {" · [Z] salir zen"}
          </button>
        </div>
      )}

      {/* Panel lab (persistente) */}
      {store.panelOpen && !store.zenMode && (
        <div className="absolute right-5" style={{
          top: "75px", zIndex: 20,
          opacity: uiVisible ? 1 : 0,
          transition: "opacity 0.8s ease",
          pointerEvents: uiVisible ? "auto" : "none",
        }}>
          <ControlPanel />
        </div>
      )}

      {/* Beat flash overlay */}
      {audio.metrics.isBeat && audio.isReady && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(circle at 50% 50%, ${accentSec}07 0%, transparent 60%)`,
        }} />
      )}

      {/* Hint cuando sin fuente */}
      {!audio.isReady && store.tutorialDone && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ opacity: uiVisible ? 0.6 : 0, transition: "opacity 0.5s" }}>
          <div style={{
            fontSize: "0.62rem", letterSpacing: "0.22em", color: `${accent}55`,
            textTransform: "uppercase", textAlign: "center", lineHeight: 2.8,
          }}>
            <div><kbd style={{ color: `${accent}88` }}>Space</kbd> — activar micrófono</div>
          </div>
        </div>
      )}
    </div>
  );
}
