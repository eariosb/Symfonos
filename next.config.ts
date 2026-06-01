import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Web Workers: Next.js con webpack bundlea automáticamente los workers
   * cuando se usa `new Worker(new URL('./...', import.meta.url))`.
   * No se requiere configuración extra, pero documentamos aquí la dependencia.
   */

  /**
   * Three.js usa módulos ES que pueden requerir transpilación.
   */
  transpilePackages: ["three"],

  /**
   * Cabeceras de seguridad para SharedArrayBuffer (por si se usa en el futuro)
   * y para mantener el contexto de audio sin throttling.
   */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
