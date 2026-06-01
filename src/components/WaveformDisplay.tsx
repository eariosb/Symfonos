"use client";

/**
 * WaveformDisplay
 * ---------------
 * Canvas ligero que dibuja la forma de onda de audio en tiempo real.
 * Usa los datos del AnalyserNode (tiempo-dominio) pasados como prop.
 * Sin dependencias extra — puro canvas 2D.
 *
 * Características:
 *   • Waveform en tiempo-dominio (osciloscópico)
 *   • Gradiente de color reactivo a RMS
 *   • Línea de cero semitransparente
 *   • Pico flash en beat
 */

import { useEffect, useRef } from "react";

interface WaveformDisplayProps {
  /** Uint8Array del AnalyserNode.getByteTimeDomainData() */
  timeDomainData: Uint8Array;
  /** RMS normalizado [0,1] */
  rms: number;
  /** Si hay beat activo */
  isBeat: boolean;
  /** Color CSS de acento (para el gradiente) */
  accentColor?: string;
  className?: string;
}

export default function WaveformDisplay({
  timeDomainData,
  rms,
  isBeat,
  accentColor = "#00ffff",
  className = "",
}: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<{ data: Uint8Array; rms: number; isBeat: boolean }>({
    data: timeDomainData,
    rms,
    isBeat,
  });
  const rafRef = useRef<number | null>(null);

  // Actualizar datos sin re-renderizar React
  useEffect(() => {
    frameRef.current = { data: timeDomainData, rms, isBeat };
  }, [timeDomainData, rms, isBeat]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);

      const { data, rms: r, isBeat: beat } = frameRef.current;
      const W = canvas.width;
      const H = canvas.height;

      // Fondo (limpiar con fade para efecto de trail)
      ctx.fillStyle = "rgba(5, 5, 16, 0.6)";
      ctx.fillRect(0, 0, W, H);

      // Línea central de referencia
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();

      // Gradiente de color reactivo
      const brightness = Math.min(1.0, beat ? 1.0 : 0.4 + r * 1.5);
      const toHex = (v: number) => Math.min(255, Math.round(v)).toString(16).padStart(2, "0");
      const grad = ctx.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, `${accentColor}${toHex(brightness * 80)}`);
      grad.addColorStop(0.5, `${accentColor}${toHex(brightness * 255)}`);
      grad.addColorStop(1, `${accentColor}${toHex(brightness * 80)}`);

      // Waveform
      ctx.beginPath();
      ctx.strokeStyle = grad;
      ctx.lineWidth = beat ? 2.5 : 1.5;
      ctx.shadowBlur = beat ? 12 : 4;
      ctx.shadowColor = accentColor;

      const sliceW = W / data.length;
      for (let i = 0; i < data.length; i++) {
        const v = data[i] / 128 - 1; // [-1, 1]
        const y = (v * H) / 2 + H / 2;
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo(i * sliceW, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    draw();

    // Resize canvas al tamaño del contenedor
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    });
    ro.observe(canvas);

    // Set inicial
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accentColor]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        borderRadius: "3px",
      }}
    />
  );
}
