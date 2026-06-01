"use client";

/**
 * RecordButton
 * Records the Three.js canvas session using MediaRecorder + captureStream.
 * Automatically downloads the recording as a .webm file when stopped.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";

interface RecordButtonProps {
  /** Ref to the canvas element to capture. */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /**
   * Set to true once the canvas is mounted and ready to capture.
   * Needed because canvasRef is a mutable ref — React won't re-render on assignment.
   */
  canvasReady?: boolean;
  /** Accent color for inline style overrides. Defaults to #ff00ff. */
  accentColor?: string;
}

const MIME_VP9 = "video/webm;codecs=vp9";
const MIME_WEBM = "video/webm";

function getSupportedMime(): string {
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(MIME_VP9)) {
    return MIME_VP9;
  }
  return MIME_WEBM;
}

/** RecordButton component — toggles canvas recording and auto-downloads the result. */
export default function RecordButton({
  canvasRef,
  canvasReady = false,
  accentColor = "#ff00ff",
}: RecordButtonProps): React.ReactElement {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const revokeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Clear the seconds timer. */
  const clearTimer = useCallback((): void => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** Stop any active recording and clean up. */
  const stopRecording = useCallback((): void => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    clearTimer();
    setIsRecording(false);
    setDuration(0);
  }, [clearTimer]);

  /** Cleanup on unmount. */
  useEffect(() => {
    return () => {
      stopRecording();
      if (revokeTimerRef.current !== null) {
        clearTimeout(revokeTimerRef.current);
        revokeTimerRef.current = null;
      }
    };
  }, [stopRecording]);

  const handleToggle = useCallback((): void => {
    if (isRecording) {
      stopRecording();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    chunksRef.current = [];

    const stream = canvas.captureStream(30);
    const mime = getSupportedMime();
    const recorder = new MediaRecorder(stream, { mimeType: mime });

    recorder.ondataavailable = (event: BlobEvent): void => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = (): void => {
      const blob = new Blob(chunksRef.current, { type: mime });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `symfonos-recording-${Date.now()}.webm`;
      anchor.click();
      // Revoke after a short delay to allow the download to start.
      if (revokeTimerRef.current !== null) clearTimeout(revokeTimerRef.current);
      revokeTimerRef.current = setTimeout(() => {
        URL.revokeObjectURL(url);
        revokeTimerRef.current = null;
      }, 10_000);
      chunksRef.current = [];
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    setDuration(0);

    timerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  }, [isRecording, canvasRef, stopRecording]);

  const isDisabled = !canvasReady || !canvasRef.current;

  const buttonStyle: React.CSSProperties = {
    ["--neon-color" as string]: accentColor,
    borderColor: accentColor,
    color: isRecording ? "#fff" : accentColor,
    backgroundColor: isRecording ? accentColor : "transparent",
    boxShadow: isRecording
      ? `0 0 12px ${accentColor}, 0 0 24px ${accentColor}`
      : `0 0 6px ${accentColor}`,
  };

  return (
    <button
      className="btn-neon btn-neon-magenta"
      style={buttonStyle}
      onClick={handleToggle}
      disabled={isDisabled}
      aria-label={isRecording ? "Stop recording" : "Start recording"}
      title={isDisabled ? "Canvas not available" : undefined}
    >
      {isRecording ? (
        <>
          <span aria-hidden="true">⏹</span>
          {" STOP"}
          <span style={{ marginLeft: "0.5em", fontVariantNumeric: "tabular-nums" }}>
            {String(Math.floor(duration / 60)).padStart(2, "0")}:
            {String(duration % 60).padStart(2, "0")}
          </span>
        </>
      ) : (
        <>
          <span aria-hidden="true">⏺</span>
          {" REC"}
        </>
      )}
    </button>
  );
}
