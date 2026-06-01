"use client";

/**
 * ControlPanel
 * ------------
 * Drawer lateral desplegable con controles de física, audio y preset.
 * Se abre/cierra con el botón "LAB" o la tecla L.
 * Se oculta automáticamente (modo inmersivo) junto con el resto de la UI.
 */

import { useSymfonos, PRESET_LABELS, PRESET_NAMES } from "@/store/symfonos";
import type { PresetName } from "@/store/symfonos";

// ── Slider genérico ───────────────────────────────────────────────────────────

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  unit?: string;
  accent?: string;
}

function Slider({ label, value, min, max, step, onChange, unit = "", accent = "#00ffff" }: SliderProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between" style={{ fontSize: "0.62rem" }}>
        <span style={{ color: "rgba(255,255,255,0.45)" }}>{label}</span>
        <span style={{ color: accent }}>
          {value.toFixed(step < 0.1 ? 2 : 1)}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

// ── Separador ─────────────────────────────────────────────────────────────────

function Sep({ label }: { label: string }) {
  return (
    <div
      className="flex items-center gap-2 mt-2 mb-1"
      style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.25)", letterSpacing: "0.15em" }}
    >
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
      {label}
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
    </div>
  );
}

// ── Panel principal ───────────────────────────────────────────────────────────

export default function ControlPanel() {
  const {
    equation, setEquation,
    preset, setPreset,
    springParams, setSpringParams,
    doublePendulumParams, setDPParams,
    sensitivity, setSensitivity,
    panelOpen,
  } = useSymfonos();

  const isSpring = equation === "spring";
  const accent = preset === "kandinsky" ? "#ff6600"
    : preset === "vignelli"  ? "#cc0000"
    : preset === "neon"      ? "#00ffff"
    : "#00ff88";
  const accentSecondary = preset === "kandinsky" ? "#ffcc00"
    : preset === "vignelli"  ? "#0044ff"
    : preset === "neon"      ? "#ff00ff"
    : "#ff4400";

  if (!panelOpen) return null;

  return (
    <div
      className="flex flex-col gap-2 overflow-y-auto"
      style={{
        width: "240px",
        maxHeight: "calc(100vh - 120px)",
        padding: "16px",
        background: "rgba(4, 4, 18, 0.92)",
        border: `1px solid ${accent}33`,
        borderRadius: "6px",
        backdropFilter: "blur(12px)",
        scrollbarWidth: "thin",
      }}
    >
      {/* ── Título ── */}
      <div
        style={{
          fontSize: "0.6rem",
          letterSpacing: "0.2em",
          color: `${accent}88`,
          textTransform: "uppercase",
        }}
      >
        ⚗ Laboratorio
      </div>

      {/* ── Selector de ecuación ── */}
      <Sep label="ECUACIÓN" />
      <div className="flex gap-2">
        <button
          className={`btn-neon flex-1 ${equation === "spring" ? "active" : ""}`}
          style={{ borderColor: accent, color: equation === "spring" ? accent : "rgba(255,255,255,0.35)" }}
          onClick={() => setEquation("spring")}
        >
          Spring
        </button>
        <button
          className={`btn-neon flex-1 ${equation === "double" ? "active" : ""}`}
          style={{ borderColor: accentSecondary, color: equation === "double" ? accentSecondary : "rgba(255,255,255,0.35)" }}
          onClick={() => setEquation("double")}
        >
          Double
        </button>
      </div>

      {/* ── Parámetros Spring Pendulum ── */}
      {isSpring && (
        <>
          <Sep label="SPRING PENDULUM" />
          <Slider label="Masa carro (M)" value={springParams.M} min={0.5} max={5} step={0.1}
            onChange={(v) => setSpringParams({ M: v })} unit=" kg" accent={accent} />
          <Slider label="Masa 1 (m₁)" value={springParams.m1} min={0.1} max={3} step={0.05}
            onChange={(v) => setSpringParams({ m1: v })} unit=" kg" accent={accentSecondary} />
          <Slider label="Masa 2 (m₂)" value={springParams.m2} min={0.1} max={3} step={0.05}
            onChange={(v) => setSpringParams({ m2: v })} unit=" kg" accent={accentSecondary} />
          <Slider label="Longitud L₁" value={springParams.L1} min={0.5} max={3} step={0.05}
            onChange={(v) => setSpringParams({ L1: v })} unit=" m" accent={accent} />
          <Slider label="Longitud L₂" value={springParams.L2} min={0.5} max={3} step={0.05}
            onChange={(v) => setSpringParams({ L2: v })} unit=" m" accent={accent} />
          <Slider label="Resorte k" value={springParams.k_left} min={0.5} max={10} step={0.1}
            onChange={(v) => setSpringParams({ k_left: v, k_right: v })} unit=" N/m" accent={accent} />
          <Slider label="Amortiguamiento" value={springParams.damping} min={0} max={0.5} step={0.005}
            onChange={(v) => setSpringParams({ damping: v })} accent={accent} />
        </>
      )}

      {/* ── Parámetros Double Pendulum ── */}
      {!isSpring && (
        <>
          <Sep label="DOUBLE PENDULUM" />
          <Slider label="Masa 1 (m₁)" value={doublePendulumParams.m1} min={0.1} max={5} step={0.1}
            onChange={(v) => setDPParams({ m1: v })} unit=" kg" accent={accentSecondary} />
          <Slider label="Masa 2 (m₂)" value={doublePendulumParams.m2} min={0.1} max={5} step={0.1}
            onChange={(v) => setDPParams({ m2: v })} unit=" kg" accent={accentSecondary} />
          <Slider label="Longitud L₁" value={doublePendulumParams.l1} min={0.5} max={3} step={0.05}
            onChange={(v) => setDPParams({ l1: v })} unit=" m" accent={accent} />
          <Slider label="Longitud L₂" value={doublePendulumParams.l2} min={0.5} max={3} step={0.05}
            onChange={(v) => setDPParams({ l2: v })} unit=" m" accent={accent} />
          <Slider label="Amortiguamiento" value={doublePendulumParams.damping} min={0} max={0.3} step={0.005}
            onChange={(v) => setDPParams({ damping: v })} accent={accent} />
        </>
      )}

      {/* ── Audio ── */}
      <Sep label="AUDIO → FÍSICA" />
      <Slider label="Sensibilidad" value={sensitivity} min={0.5} max={8} step={0.1}
        onChange={setSensitivity} unit="×" accent={accent} />

      {/* ── Presets ── */}
      <Sep label="ESTILO VISUAL" />
      <div className="flex flex-col gap-1.5">
        {PRESET_NAMES.map((name: PresetName) => (
          <button
            key={name}
            className={`btn-neon text-left ${preset === name ? "active" : ""}`}
            style={{
              borderColor: preset === name ? accent : "rgba(255,255,255,0.12)",
              color: preset === name ? accent : "rgba(255,255,255,0.4)",
              padding: "0.4rem 0.6rem",
              fontSize: "0.68rem",
            }}
            onClick={() => setPreset(name)}
          >
            {PRESET_LABELS[name]}
          </button>
        ))}
      </div>

      {/* ── Atajos ── */}
      <Sep label="ATAJOS" />
      <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.2)", lineHeight: 1.9 }}>
        <div><kbd style={{ color: "rgba(255,255,255,0.4)" }}>Space</kbd> — Mic on/off</div>
        <div><kbd style={{ color: "rgba(255,255,255,0.4)" }}>E</kbd> — Cambiar ecuación</div>
        <div><kbd style={{ color: "rgba(255,255,255,0.4)" }}>P</kbd> — Siguiente preset</div>
        <div><kbd style={{ color: "rgba(255,255,255,0.4)" }}>L</kbd> — Panel Lab</div>
        <div><kbd style={{ color: "rgba(255,255,255,0.4)" }}>R</kbd> — Reset físico</div>
      </div>
    </div>
  );
}
