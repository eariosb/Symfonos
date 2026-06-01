"use client";

import { useState, useEffect, useCallback } from "react";

interface TutorialStep {
  step: number;
  title: string;
  description: string;
  icon: string;
}

const STEPS: TutorialStep[] = [
  {
    step: 1,
    title: "Bienvenido a SymFonos",
    description:
      "Un visualizador de física caótica sincronizado con tu música. Pulsa Space para activar el micrófono o sube un archivo de audio.",
    icon: "🎵",
  },
  {
    step: 2,
    title: "Física Caótica",
    description:
      "Elige entre Spring Pendulum (carro + resortes) y Double Pendulum. Cada uno genera patrones únicos e impredecibles.",
    icon: "⚛",
  },
  {
    step: 3,
    title: "Estilos Visuales",
    description:
      "Multiples presets artísticos. Cambia con la tecla P.",
    icon: "🎨",
  },
  {
    step: 4,
    title: "Panel Laboratorio",
    description:
      "Pulsa L para abrir el panel y ajustar masas, longitudes y constantes de resorte en tiempo real.",
    icon: "⚗",
  },
  {
    step: 5,
    title: "Modo Inmersivo",
    description:
      "La interfaz se oculta automáticamente. Mueve el ratón o presiona cualquier tecla para mostrarla.",
    icon: "✨",
  },
];

interface TutorialOverlayProps {
  onComplete: () => void;
  accentColor?: string;
}

export default function TutorialOverlay({
  onComplete,
  accentColor = "#00ffff",
}: TutorialOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const done = localStorage.getItem("symfonos_tutorial_done");
      if (done === null) {
        setVisible(true);
        // Trigger enter animation on next frame
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setEntered(true));
        });
      }
    }
  }, []);

  const complete = useCallback(() => {
    localStorage.setItem("symfonos_tutorial_done", "1");
    setVisible(false);
    onComplete();
  }, [onComplete]);

  const goToStep = useCallback(
    (next: number) => {
      if (animating) return;
      setAnimating(true);
      setEntered(false);
      setTimeout(() => {
        setCurrentStep(next);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setEntered(true);
            setAnimating(false);
          });
        });
      }, 200);
    },
    [animating]
  );

  const handleNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      goToStep(currentStep + 1);
    } else {
      complete();
    }
  }, [currentStep, goToStep, complete]);

  if (!visible) return null;

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(4px)",
        background: "rgba(5,5,16,0.88)",
        pointerEvents: "none",
      }}
    >
      {/* Card */}
      <div
        className={entered ? "tutorial-step-active" : "tutorial-step-enter"}
        style={{
          pointerEvents: "auto",
          maxWidth: 420,
          width: "calc(100% - 2rem)",
          background: "rgba(5,5,16,0.97)",
          border: `1px solid ${accentColor}33`,
          borderRadius: 8,
          padding: "2rem 1.75rem 1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
        }}
      >
        {/* Icon + title */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "1.75rem", lineHeight: 1 }}>{step.icon}</span>
          <h2
            style={{
              margin: 0,
              fontSize: "1rem",
              fontWeight: 600,
              letterSpacing: "0.06em",
              color: accentColor,
              textTransform: "uppercase",
            }}
          >
            {step.title}
          </h2>
        </div>

        {/* Description */}
        <p
          style={{
            margin: 0,
            fontSize: "0.82rem",
            lineHeight: 1.65,
            color: "rgba(255,255,255,0.72)",
          }}
        >
          {step.description}
        </p>

        {/* Progress dots */}
        <div style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
          {STEPS.map((_, i) => (
            <span
              key={i}
              style={{
                display: "block",
                width: i === currentStep ? 10 : 7,
                height: i === currentStep ? 10 : 7,
                borderRadius: "50%",
                background:
                  i === currentStep ? accentColor : "transparent",
                border: `1px solid ${i === currentStep ? accentColor : accentColor + "55"}`,
                transition: "all 0.2s",
                boxShadow:
                  i === currentStep
                    ? `0 0 6px ${accentColor}88`
                    : "none",
              }}
            />
          ))}
        </div>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            onClick={complete}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.4)",
              fontSize: "0.7rem",
              letterSpacing: "0.08em",
              cursor: "pointer",
              padding: "0.25rem 0",
              textTransform: "uppercase",
            }}
          >
            Saltar
          </button>

          <button className="btn-neon" onClick={handleNext}>
            {isLast ? "Comenzar →" : "Siguiente →"}
          </button>
        </div>
      </div>
    </div>
  );
}
