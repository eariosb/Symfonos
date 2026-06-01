# SymFonos

> *El sonido se vuelve caos. El caos se vuelve color. El color se vuelve música.*

**SymFonos** es un visualizador musical generativo que convierte audio en vivo en simulaciones de física caótica renderizadas en WebGL. Conecta tu micrófono o sube un archivo de audio, y el sistema responde con esculturas cinéticas impulsadas por péndulos de resorte y péndulos dobles, resueltos fotograma a fotograma mediante el método Runge-Kutta 4 y efectos de color, movimiento y forma conforme evoluciona el ritmo.

---

## Tabla de Contenidos

1. [Concepto Artístico](#concepto-artístico)
2. [Visión General de la Arquitectura](#visión-general-de-la-arquitectura)
3. [Motor de Física](#motor-de-física)
4. [Motor de Audio](#motor-de-audio)
5. [Sistema Visual](#sistema-visual)
6. [Instalación](#instalación)
7. [Ejecución Local](#ejecución-local)
8. [Despliegue en Vercel](#despliegue-en-vercel)
9. [Atajos de Teclado](#atajos-de-teclado)
10. [Configuración y Presets](#configuración-y-presets)
11. [Estructura del Proyecto](#estructura-del-proyecto)
12. [Créditos y Referencias](#créditos-y-referencias)

---

## Concepto Artístico

SymFonos se sitúa en la intersección de cuatro tradiciones artísticas, integrando también los principios de movimiento y percepción cromática de los maestros del diseño:

**Wassily Kandinsky** postuló que color, forma y sonido conforman un lenguaje perceptual unificado. Su serie *Komposition* (1910–1940) mapeaba la tonalidad musical a la forma visual. SymFonos operacionaliza esta idea: las frecuencias graves producen tonos cálidos, las agudas generan tonos fríos, y la amplitud controla la luminancia — todo ello codificado en el espacio de color perceptual uniforme **LCH** (Luminosidad, Croma, Matiz), donde distancias numéricas iguales producen diferencias perceptuales iguales, evitando los artefactos del espacio RGB.

**Massimo Vignelli** defendía que el diseño debe reducirse a su estructura irreducible. El preset *Vignelli Grid* reduce la visualización a geometrías primarias y una proporción tipográfica exacta, tratando al caos como una cuadrícula que ha olvidado sus orígenes. Su obsesión por la retícula y las formas atemporales garantiza una base estructural robusta.

**Saul Bass** construía tensión a partir del movimiento — sus secuencias de títulos para *Vértigo* y *Anatomía de un asesinato* convirtieron la forma gráfica en cinética. Los brazos en espiral y la estela decadente en SymFonos toman prestada su sensación de vértigo rotacional.

**John Maeda** (*Las leyes de la simplicidad*, 2006) argumentaba que el arte computacional solo gana su complejidad cuando revela un orden subyacente. La teoría del caos hace exactamente esto: el péndulo doble es determinista pero impredecible; su exponente de Lyapunov hace que la predicción sea exponencialmente costosa. SymFonos hace visible lo exponencial.

Además, el proyecto bebe del **Constructivismo Ruso** y **De Stijl** (abstracción geométrica), del **Arte Cinético** (el movimiento como elemento) y del **Expresionismo Abstracto** (emoción pura), permitiendo que cada preset navegue entre la estructura analítica y la espontaneidad orgánica.

---

## Visión General de la Arquitectura
┌──────────────────────────────────────────────────────────┐
│ page.tsx (orquestador) │
│ ┌──────────────┐ ┌─────────────┐ ┌────────────────┐ │
│ │ useAudioEngine│ │usePhysicsWk │ │ useFPSAdaptive │ │
│ │ (Web Audio) │ │ (Worker) │ │ (calidad) │ │
│ └──────┬───────┘ └──────┬──────┘ └───────┬────────┘ │
│ │ AudioMetrics │ FrameData │ factor │
│ └──────────────────▼─────────────────▼──────── │
│ PhysicsCanvas.tsx │
│ ┌──────────────────────┐ │
│ │ Escena Three.js │ │
│ │ Quad de fondo │ │
│ │ Malla péndulos │ │
│ │ Sistema partículas │ │
│ │ EffectComposer │ │
│ │ RenderPass │ │
│ │ UnrealBloom │ │
│ │ Aberración cromática │ │
│ │ OutputPass │ │
│ └──────────────────────┘ │
└──────────────────────────────────────────────────────────┘

Web Worker (physicsWorker.ts)
├── Péndulo de resorte RK4 (springPendulum.ts)
└── Péndulo doble RK4 (doublePendulum.ts)

text

**Flujo de datos:**

1. `useAudioEngine` captura el micrófono o archivo de audio a través de la Web Audio API y produce `AudioMetrics` (RMS, frecuencia dominante, detección de beat, energía de graves) a 60 fps.
2. `usePhysicsWorker` envía `SET_FORCE` al Web Worker en cada fotograma; el Worker avanza la ODE con sub-pasos RK4 de 1 ms y devuelve el vector de estado.
3. `page.tsx` ensambla un objeto `FrameData` y llama a `pushFrame()` en `PhysicsCanvas`.
4. `PhysicsCanvas` actualiza los uniforms de Three.js, avanza las partículas, ejecuta el pipeline de EffectComposer y renderiza.

---

## Motor de Física

### Péndulo de Resorte

Vector de estado: `[x, θ₁, θ₂, ẋ, θ̇₁, θ̇₂]`

Un carro de masa **M** se desliza sobre un riel sin fricción. Dos péndulos de masa **m1/m2** y longitud **L1/L2** cuelgan del carro, conectados por una constante de resorte **k**. El sistema es lagrangiano; las ecuaciones de movimiento se reducen a un sistema lineal de 3×3 que se resuelve por eliminación gaussiana en cada sub-paso.

La fuerza externa `F_ext = rms × sensibilidad × 30` impulsa el carro a partir de la amplitud del audio.

### Péndulo Doble

Vector de estado: `[θ₁, θ₂, ω₁, ω₂]`

Dos masas puntuales conectadas por varillas rígidas de longitud **l1/l2**. Las ecuaciones producen un sistema lineal de 2×2 resuelto mediante la regla de Cramer. Se inicializa con `θ₁ = π/2, θ₂ = π/3` para un inicio inmediato del caos.

El exponente de Lyapunov de este sistema es positivo: condiciones iniciales cercanas divergen exponencialmente. El audio aplica un impulso de torque `τ = rms × sensibilidad × 30` sobre la varilla superior.

### Integración Numérica

Ambos sistemas utilizan **Runge-Kutta de cuarto orden** con:
- Sub-paso fijo `DT = 0.001 s` (1 ms)
- Límite por tiempo real `MAX_STEP = 0.05 s` por fotograma (evita espirales al recuperar el foco de la pestaña)
- Ejecución en un **Web Worker** mediante `setInterval` a 60 fps (pues `requestAnimationFrame` no está disponible en workers)

---

## Motor de Audio

`useAudioEngine` envuelve la Web Audio API:

| Señal | Método |
|---|---|
| **RMS** | Raíz cuadrada de la media cuadrática de las muestras del `AnalyserNode` |
| **Frecuencia dominante** | Bin de mayor magnitud del espectro FFT (2048 puntos, ventana Blackman) |
| **Detección de beat** | Energía en graves (20–250 Hz) vs. media móvil de 43 frames; umbral ×1.4, enfriamiento de 200 ms |
| **Normalización de frecuencia** | Escala log₁₀: 20 Hz → 0.0, 20 kHz → 1.0 |

Fuentes: micrófono del navegador (`getUserMedia`) o archivo de audio subido (`MediaElementSource`).

---

## Sistema Visual

### Espacio de Color LCH

Todo el cálculo de color se realiza en **LCH (Luminosidad, Croma, Matiz)** — un espacio perceptual uniforme derivado del CIELAB. El shader de fondo GLSL implementa toda la pipeline en línea: LCH → Lab → XYZ → sRGB lineal → sRGB con gamma.

Beneficio perceptual: un ΔE de 10 en LCH se ve igual de diferente independientemente del matiz. Esto significa que los barridos de frecuencia producen transiciones de color suaves y visualmente consistentes, sin los puntos medios turbios que plagan la interpolación HSL.

Mapeo de frecuencia → Matiz (escala log):
- 20 Hz → 0° (rojo)
- 1 kHz → ~150° (verde-cyan)
- 20 kHz → 300° (violeta)

### Pipeline de Shaders
RenderPass → UnrealBloomPass → ShaderPass(aberracionCromatica) → OutputPass

text

**Shader de fondo** (`backgroundShader.ts`): Quad en espacio de clip (`gl_Position = vec4(position.xy, 1.0, 1.0)`) que renderiza un gradiente radial LCH con ruido procesal, viñeteado y flash de beat. Se ejecuta a resolución completa independientemente de la cámara.

**Shader de masas** (`massShader.ts`): `ShaderMaterial` en las mallas de las masas del péndulo. La etapa de vértices aplica un pulso radial en el beat (`sin(uTime * 30) * uBeat * 0.18`) y una deformación ondulatoria a partir del RMS. La etapa de fragmentos añade iluminación de borde tipo Fresnel.

**Aberración cromática** (`chromaticShader.ts`): `ShaderPass` que separa los canales R y B en `±0.012 * uIntensity` en una dirección UV que rota lentamente. Se activa en el beat y decae en unos 14 fotogramas.

### Presets

| Preset | Paleta | Bloom | Partículas | Glitch |
|---|---|---|---|---|
| **Kandinsky Pulse** | Naranja / violeta cálidos | 1.8 | 800 | En beat |
| **Vignelli Grid** | Rojo/azul/amarillo primarios | 0.6 | 200 | Off |
| **Neon Filament** | Cyan / magenta | 2.2 | 600 | En beat |
| **Particle Swarm** | Verde / naranja | 1.5 | 1200 | Sutil |

### Calidad Adaptativa por FPS

`useFPSAdaptive` mide una ventana móvil de 90 fotogramas:

| FPS | Calidad | Multiplicador de partículas |
|---|---|---|
| ≥ 50 | Alta | 1.0× |
| 35–49 | Media | 0.5× |
| < 35 | Baja | 0.15× |

---

## Instalación

**Requisitos previos:** Node.js 20+, npm 10+

```bash
git clone https://github.com/youruser/symfonos.git
cd symfonos
npm install
Dependencias principales (en package.json):

three@^0.177.0 + @types/three@^0.177.0

zustand@^5.0.0

next@^16.x (App Router)

Ejecución Local
bash
npm run dev
Abre http://localhost:3000

Acceso al micrófono: El navegador solicitará permiso. Concédelo y haz clic en MIC para comenzar. El procesamiento de audio usa AudioContext — algunos navegadores requieren un gesto del usuario (clic) para iniciar el contexto.

Cabeceras COOP/COEP: next.config.ts establece Cross-Origin-Opener-Policy: same-origin y Cross-Origin-Embedder-Policy: require-corp. Esto puede afectar la carga de archivos de audio de origen cruzado; prefiere archivos del mismo origen o usa la entrada de micrófono.

Build de producción
bash
npm run build
npm start
Despliegue en Vercel
El repositorio incluye vercel.json con las cabeceras de seguridad COOP/COEP necesarias. Haz push a GitHub e impórtalo en Vercel — no se necesita configuración adicional.

bash
# Configuración CLI única
npm i -g vercel

# Desplegar a producción
vercel --prod
Vercel detecta Next.js automáticamente y aplica las sobreescrituras de cabeceras de vercel.json, asegurando que los Web Workers funcionen correctamente en el entorno desplegado.

Atajos de Teclado
Tecla	Acción
Espacio	Iniciar / detener micrófono
E	Cambiar ecuación (Resorte ↔ Péndulo doble)
P	Siguiente preset visual
L	Mostrar/ocultar panel de control
F	Pantalla completa
M	Modo monocromo de alto contraste (accesibilidad)
R	Reiniciar estado físico
Configuración y Presets
Todo el estado global vive en el store de Zustand (src/store/symfonos.ts). Los parámetros físicos se ajustan mediante el panel colapsable (tecla L o botón de alternancia).

Parámetros del Péndulo de Resorte
Parámetro	Valor por defecto	Rango	Descripción
M	2.0	0.5–5.0	Masa del carro (kg)
m1	0.5	0.1–2.0	Masa de la primera lenteja (kg)
m2	0.3	0.1–2.0	Masa de la segunda lenteja (kg)
L1	1.2	0.3–3.0	Longitud de la primera varilla (m)
L2	0.8	0.3–3.0	Longitud de la segunda varilla (m)
k	8.0	1–30	Constante del resorte (N/m)
damping	0.05	0–0.5	Amortiguamiento viscoso
Parámetros del Péndulo Doble
Parámetro	Valor por defecto	Rango
m1	1.0	0.1–3.0
m2	1.0	0.1–3.0
l1	1.5	0.3–3.0
l2	1.5	0.3–3.0
damping	0.02	0–0.3
Estructura del Proyecto
text
symfonos/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Layout raíz, fuente Inter
│   │   ├── page.tsx            # Orquestador principal
│   │   └── globals.css         # Variables CSS, utilidades neon
│   ├── components/
│   │   ├── PhysicsCanvas.tsx   # Escena Three.js + EffectComposer
│   │   ├── ControlPanel.tsx    # Sliders de parámetros colapsables
│   │   ├── AudioControls.tsx   # UI micrófono/archivo + medidor de nivel
│   │   ├── WaveformDisplay.tsx # Forma de onda con Canvas 2D
│   │   ├── RecordButton.tsx    # MediaRecorder → descarga .webm
│   │   └── TutorialOverlay.tsx # Tutorial inicial de 5 pasos
│   ├── hooks/
│   │   ├── useAudioEngine.ts   # Wrapper de Web Audio API
│   │   ├── usePhysicsWorker.ts # Comunicación con el Worker
│   │   ├── useFullscreen.ts    # API Fullscreen (compatibilidad webkit)
│   │   └── useFPSAdaptive.ts   # Escalado de calidad por FPS
│   ├── lib/
│   │   ├── physics/
│   │   │   ├── springPendulum.ts   # RK4 + ecuaciones lagrangianas
│   │   │   └── doublePendulum.ts   # RK4 + regla de Cramer
│   │   ├── shaders/
│   │   │   ├── backgroundShader.ts # Gradiente LCH + FX
│   │   │   ├── massShader.ts       # Fresnel + deformación por pulso
│   │   │   └── chromaticShader.ts  # Paso de aberración cromática
│   │   ├── presets.ts          # 4 definiciones de presets visuales
│   │   └── colorSystem.ts      # LCH↔RGB, freqToHue(), reactiveColor()
│   ├── store/
│   │   └── symfonos.ts         # Store global de Zustand
│   └── workers/
│       └── physicsWorker.ts    # Worker unificado (Resorte + Doble)
├── vercel.json                 # Cabeceras COOP/COEP para Vercel
├── next.config.ts              # transpilePackages, cabeceras de seguridad
└── package.json
Créditos y Referencias
Física

Mecánica lagrangiana: Goldstein, Mecánica Clásica (3ª ed.)

Integración RK4: Press et al., Numerical Recipes in C (2ª ed.)

Caos en péndulo doble: Strogatz, Nonlinear Dynamics and Chaos (2ª ed.)

Ciencia del Color

CIELAB/LCH: CIE 15:2004

Uniformidad perceptual: Sharma, Digital Color Imaging Handbook, CRC Press

LCH en herramientas creativas: oklch.com

Inspiración Artística y de Diseño

Kandinsky, W. — De lo espiritual en el arte (1912)

Vignelli, M. — El canon de Vignelli (2010)

Bass, S. — Secuencias de títulos para Vértigo (1958), Anatomía de un asesinato (1959)

Maeda, J. — Las leyes de la simplicidad (2006); Design by Numbers (1999)

Técnico

Three.js r177

Zustand v5

Next.js 16 App Router

