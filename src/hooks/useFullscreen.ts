"use client";

/**
 * useFullscreen
 * Wraps the browser Fullscreen API with vendor-prefix support (webkit).
 * Returns current fullscreen state and actions to toggle or exit fullscreen.
 */

import { useState, useEffect, useCallback } from "react";

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
}

interface UseFullscreenReturn {
  isFullscreen: boolean;
  toggleFullscreen: (element?: HTMLElement) => Promise<void>;
  exitFullscreen: () => Promise<void>;
}

export function useFullscreen(): UseFullscreenReturn {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const handleChange = (): void => {
      const doc = document as FullscreenDocument;
      const fullscreenEl =
        document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
      setIsFullscreen(fullscreenEl !== null);
    };

    document.addEventListener("fullscreenchange", handleChange);
    document.addEventListener("webkitfullscreenchange", handleChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleChange);
      document.removeEventListener("webkitfullscreenchange", handleChange);
    };
  }, []);

  const exitFullscreen = useCallback(async (): Promise<void> => {
    const doc = document as FullscreenDocument;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen();
    }
  }, []);

  const toggleFullscreen = useCallback(
    async (element?: HTMLElement): Promise<void> => {
      const doc = document as FullscreenDocument;
      const isCurrentlyFullscreen =
        !!(document.fullscreenElement ?? doc.webkitFullscreenElement);

      if (isCurrentlyFullscreen) {
        await exitFullscreen();
      } else {
        const target = (element ?? document.documentElement) as FullscreenElement;
        try {
          if (target.requestFullscreen) {
            await target.requestFullscreen();
          } else if (target.webkitRequestFullscreen) {
            await target.webkitRequestFullscreen();
          }
        } catch {
          // Fullscreen can be rejected by the browser (e.g. iframe without
          // allowfullscreen attribute, or permissions policy). Fail silently.
        }
      }
    },
    [exitFullscreen]
  );

  return { isFullscreen, toggleFullscreen, exitFullscreen };
}
