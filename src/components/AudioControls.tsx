"use client";

/**
 * AudioControls
 * -------------
 * Panel de controles de audio y física para SymFonos.
 *
 * • Botón Start Mic / Stop Mic
 * • Upload de archivo .mp3/.wav/.ogg
 * • Slider de sensibilidad (escala la fuerza sobre el carro)
 * • Indicador visual de nivel de audio (barra RMS)
 * • Indicador de beat (punto pulsante)
 * • Indicador de frecuencia dominante
 * • Errores de audio
 */

import { useRef } from "react";
import type { AudioSource } from "@/hooks/useAudioEngine";

interface AudioControlsProps {
  source: AudioSource;
  isReady: boolean;
  error: string | null;
  rms: number;
  isBeat: boolean;
  dominantFreq: number;
  sensitivity: number;
  accentColor?: string;
  onStartMic: () => void;
  onStopMic: () => void;
  onLoadFile: (file: File) => void;
  onStopFile: () => void;
  onSensitivityChange: (val: number) => void;
}

export default function AudioControls({
  source,
  isReady,
  error,
  rms,
  isBeat,
  dominantFreq,
  sensitivity,
  accentColor = "#00ffff",
  onStartMic,
  onStopMic,
  onLoadFile,
  onStopFile,
  onSensitivityChange,
}: AudioControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onLoadFile(file);
    // Reset para permitir cargar el mismo archivo de nuevo
    e.target.value = "";
  };

  const handleMicClick = () => {
    if (source === "mic") {
      onStopMic();
    } else {
      onStartMic();
    }
  };

  const handleFileClick = () => {
    if (source === "file") {
      onStopFile();
    } else {
      fileInputRef.current?.click();
    }
  };

  return (
    <div
      className="flex flex-col gap-3 p-4 rounded-lg"
      style={{
        background: "rgba(5, 5, 16, 0.85)",
        border: `1px solid ${accentColor}22`,
        backdropFilter: "blur(8px)",
        minWidth: "220px",
      }}
    >
      {/* ── Título ── */}
      <div
        className="text-xs tracking-widest uppercase"
        style={{ color: `${accentColor}88`, fontSize: "0.6rem" }}
      >
        Audio Input
      </div>

      {/* ── Botones de fuente ── */}
      <div className="flex gap-2">
        <button
          className={`btn-neon flex-1 ${source === "mic" ? "active" : ""}`}
          onClick={handleMicClick}
        >
          {source === "mic" ? "■ Mic" : "▶ Mic"}
        </button>

        <button
          className={`btn-neon btn-neon-magenta flex-1 ${source === "file" ? "active" : ""}`}
          onClick={handleFileClick}
        >
          {source === "file" ? "■ File" : "▶ File"}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* ── Error ── */}
      {error && (
        <div
          className="text-xs rounded px-2 py-1"
          style={{
            color: "#ff4444",
            background: "rgba(255, 0, 0, 0.1)",
            border: "1px solid rgba(255, 0, 0, 0.3)",
          }}
        >
          {error}
        </div>
      )}

      {/* ── Nivel RMS + Beat ── */}
      <div className="flex flex-col gap-1">
        <div
          className="flex items-center justify-between"
          style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)" }}
        >
          <span>Level</span>
          <div className="flex items-center gap-1.5">
            <span style={{ color: "rgba(255,255,255,0.3)" }}>Beat</span>
            <div className={`beat-dot ${isBeat && isReady ? "lit" : ""}`} />
          </div>
        </div>
        <div className="level-track">
          <div
            className="level-fill"
            style={{
              width: `${Math.min(rms * 100 * 3, 100)}%`,
              background: accentColor,
              boxShadow: `0 0 8px ${accentColor}88`,
            }}
          />
        </div>
      </div>

      {/* ── Frecuencia dominante ── */}
      {isReady && (
        <div
          className="flex justify-between"
          style={{ fontSize: "0.62rem", color: "rgba(255, 255, 255, 0.35)" }}
        >
          <span>Freq</span>
          <span style={{ color: "rgba(0, 255, 255, 0.6)" }}>
            {Math.round(dominantFreq)} Hz
          </span>
        </div>
      )}

      {/* ── Sensibilidad ── */}
      <div className="flex flex-col gap-1">
        <div
          className="flex justify-between"
          style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)" }}
        >
          <span>Sensitivity</span>
          <span style={{ color: "rgba(0,255,255,0.6)" }}>{sensitivity.toFixed(1)}×</span>
        </div>
        <input
          type="range"
          min={0.5}
          max={5}
          step={0.1}
          value={sensitivity}
          onChange={(e) => onSensitivityChange(parseFloat(e.target.value))}
        />
      </div>

      {/* ── Estado ── */}
      <div
        style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.2)" }}
      >
        {source === "none"
          ? "Sin fuente de audio"
          : source === "mic"
          ? isReady
            ? "🎙 Micrófono activo"
            : "Conectando micrófono…"
          : isReady
          ? "▶ Reproduciendo archivo"
          : "Cargando archivo…"}
      </div>
    </div>
  );
}
