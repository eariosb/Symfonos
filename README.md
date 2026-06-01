# SymFonos

> *Sound becomes chaos. Chaos becomes color. Color becomes music.*

**SymFonos** is a generative musical visualizer that turns live audio into real-time chaotic physics simulations rendered in WebGL. Feed it your microphone or an audio file — it responds with kinetic sculpture driven by Spring Pendulums and Double Pendulums solved frame-by-frame using Runge-Kutta 4.

---

## Table of Contents

1. [Artistic Concept](#artistic-concept)
2. [Architecture Overview](#architecture-overview)
3. [Physics Engine](#physics-engine)
4. [Audio Engine](#audio-engine)
5. [Visual System](#visual-system)
6. [Installation](#installation)
7. [Running Locally](#running-locally)
8. [Deploying to Vercel](#deploying-to-vercel)
9. [Keyboard Shortcuts](#keyboard-shortcuts)
10. [Configuration & Presets](#configuration--presets)
11. [Project Structure](#project-structure)
12. [Credits & References](#credits--references)

---

## Artistic Concept

SymFonos sits at the intersection of four artistic traditions:

**Wassily Kandinsky** established that color, shape, and sound are unified perceptual languages. His *Komposition* series (1910–1940) mapped musical tonality to visual form. SymFonos operationalizes this: bass frequencies produce warm hues, treble produces cool, and amplitude controls luminance — all encoded in the perceptually uniform **LCH color space** so that equal numeric distances produce equal perceptual distances.

**Massimo Vignelli** argued that design must be reduced to its irreducible structure. The *Vignelli Grid* preset strips the visualization to primary geometries and exact typographic proportion, treating chaos as a grid that has forgotten its origins.

**Saul Bass** built tension from motion — his title sequences for *Vertigo* and *Anatomy of a Murder* made graphic form kinetic. The spiral arms and trail decay in SymFonos borrow his sense of rotational dread.

**John Maeda** (*The Laws of Simplicity*, 2006) argued that computational art earns its complexity only when it reveals underlying order. Chaos theory does exactly this: the Double Pendulum is deterministic but unpredictable; its Lyapunov exponent makes prediction exponentially expensive. SymFonos makes the exponential visible.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    page.tsx (orchestrator)           │
│  ┌──────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │ useAudioEngine│  │usePhysicsWk │  │useFPSAdapt │  │
│  │  (Web Audio) │  │  (Worker)   │  │  (quality) │  │
│  └──────┬───────┘  └──────┬──────┘  └─────┬──────┘  │
│         │ AudioMetrics     │ FrameData      │ mult.   │
│         └──────────────────▼───────────────▼─────    │
│                    PhysicsCanvas.tsx                  │
│                  ┌──────────────────┐                │
│                  │   Three.js Scene │                │
│                  │  Background Quad │                │
│                  │  Spring/DP mesh  │                │
│                  │  Particle system │                │
│                  │  EffectComposer  │                │
│                  │    RenderPass    │                │
│                  │  UnrealBloom     │                │
│                  │  ChromaticAber.  │                │
│                  │   OutputPass     │                │
│                  └──────────────────┘                │
└─────────────────────────────────────────────────────┘

Web Worker (physicsWorker.ts)
  ├── Spring Pendulum RK4 (springPendulum.ts)
  └── Double Pendulum RK4 (doublePendulum.ts)
```

**Data flow:**

1. `useAudioEngine` captures microphone / audio file via Web Audio API, produces `AudioMetrics` (RMS, dominant frequency, beat flag, bass energy) at 60 fps.
2. `usePhysicsWorker` sends `SET_FORCE` to the Web Worker each frame; the Worker advances the ODE with 1 ms RK4 sub-steps and posts back the state vector.
3. `page.tsx` assembles a `FrameData` object and calls `pushFrame()` into `PhysicsCanvas`.
4. `PhysicsCanvas` updates Three.js uniforms, advances particles, runs the EffectComposer pipeline, and renders.

---

## Physics Engine

### Spring Pendulum

State vector: `[x, θ₁, θ₂, ẋ, θ̇₁, θ̇₂]`

A cart of mass **M** slides on a frictionless rail. Two pendulums of mass **m1/m2** and length **L1/L2** hang from the cart, connected by spring constant **k**. The system is Lagrangian; the equations of motion reduce to a 3×3 linear system solved by Gaussian elimination at each sub-step.

External force `F_ext = rms × sensitivity × 30` drives the cart from audio amplitude.

### Double Pendulum

State vector: `[θ₁, θ₂, ω₁, ω₂]`

Two point masses connected by rigid rods of length **l1/l2**. The equations yield a 2×2 linear system solved by Cramér's rule. Initialized at `θ₁ = π/2, θ₂ = π/3` for immediate chaotic onset.

The Lyapunov exponent of this system is positive — nearby initial conditions diverge exponentially. Audio drives a torque impulse `τ = rms × sensitivity × 30` on the upper rod.

### Numerical Integration

Both systems use **Runge-Kutta 4th order** with:
- Fixed sub-step `DT = 0.001 s` (1 ms)
- Wall-clock cap `MAX_STEP = 0.05 s` per frame (prevents spiral on tab focus)
- Runs in a **Web Worker** via `setInterval` at 60 fps (RAF unavailable in workers)

---

## Audio Engine

`useAudioEngine` wraps the Web Audio API:

| Signal | Method |
|---|---|
| **RMS** | Square root of mean-squared samples from `AnalyserNode` |
| **Dominant frequency** | Peak bin of FFT magnitude spectrum (2048-point, Blackman window) |
| **Beat detection** | Bass energy (20–250 Hz) vs. 43-frame rolling average; threshold ×1.4, 200 ms cooldown |
| **Frequency normalization** | Log₁₀ scale: 20 Hz → 0.0, 20 kHz → 1.0 |

Sources: browser microphone (`getUserMedia`) or uploaded audio file (`MediaElementSource`).

---

## Visual System

### LCH Color Space

All color computation happens in **LCH (Lightness, Chroma, Hue)** — a perceptually uniform space derived from CIELAB. The GLSL background shader implements the full pipeline inline: LCH → Lab → XYZ → linear sRGB → gamma-encoded sRGB.

Perceptual benefit: a ΔE of 10 in LCH looks equally different regardless of hue. This means frequency sweeps produce smooth, visually consistent color transitions without the muddy midpoints that plague HSL interpolation.

Frequency → Hue mapping (log scale):
- 20 Hz → 0° (red)
- 1 kHz → ~150° (green-cyan)
- 20 kHz → 300° (violet)

### Shader Pipeline

```
RenderPass → UnrealBloomPass → ShaderPass(chromaticAberration) → OutputPass
```

**Background shader** (`backgroundShader.ts`): Clip-space quad (`gl_Position = vec4(position.xy, 1.0, 1.0)`) that renders a radial LCH gradient with procedural noise grain, vignette, and beat flash. Runs at full resolution independently of camera.

**Mass shader** (`massShader.ts`): `ShaderMaterial` on pendulum bob meshes. Vertex stage applies radial pulse on beat (`sin(uTime * 30) * uBeat * 0.18`) and wave deformation from RMS. Fragment stage adds Fresnel rim lighting.

**Chromatic aberration** (`chromaticShader.ts`): `ShaderPass` that splits R and B channels by `±0.012 * uIntensity` in a slowly-rotating UV direction. Triggered on beat, decays over ~14 frames.

### Presets

| Preset | Palette | Bloom | Particles | Glitch |
|---|---|---|---|---|
| **Kandinsky Pulse** | Warm orange / violet | 1.8 | 800 | On beat |
| **Vignelli Grid** | Primary red/blue/yellow | 0.6 | 200 | Off |
| **Neon Filament** | Cyan / magenta | 2.2 | 600 | On beat |
| **Particle Swarm** | Green / orange | 1.5 | 1200 | Subtle |

### FPS-Adaptive Quality

`useFPSAdaptive` measures a 90-frame rolling window:

| FPS | Quality | Particle multiplier |
|---|---|---|
| ≥ 50 | High | 1.0× |
| 35–49 | Medium | 0.5× |
| < 35 | Low | 0.15× |

---

## Installation

**Prerequisites:** Node.js 20+, npm 10+

```bash
git clone https://github.com/youruser/symfonos.git
cd symfonos
npm install
```

Key dependencies (in `package.json`):
- `three@^0.177.0` + `@types/three@^0.177.0`
- `zustand@^5.0.0`
- `next@^16.x` (App Router)

---

## Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Microphone access:** The browser will request microphone permission. Grant it and click **MIC** to start. Audio processing uses `AudioContext` — some browsers require a user gesture before the context can start.

> **COOP/COEP headers:** `next.config.ts` sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. This may affect loading cross-origin audio files; prefer same-origin files or use the mic input.

### Production build

```bash
npm run build
npm start
```

---

## Deploying to Vercel

The repo includes `vercel.json` with the required COOP/COEP security headers. Push to GitHub and import into Vercel — no additional configuration needed.

```bash
# One-time CLI setup
npm i -g vercel

# Deploy to production
vercel --prod
```

Vercel detects Next.js automatically and applies the `vercel.json` header overrides, ensuring Web Workers function correctly in the deployed environment.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Start / stop microphone |
| `E` | Switch equation (Spring ↔ Double Pendulum) |
| `P` | Cycle to next preset |
| `L` | Toggle control panel |
| `F` | Toggle fullscreen |
| `M` | Toggle monochrome accessibility mode |
| `R` | Reset physics state |

---

## Configuration & Presets

All state lives in the **Zustand store** (`src/store/symfonos.ts`). Physics parameters are adjusted via the collapsible control panel (keyboard `L` or panel toggle button).

### Spring Pendulum parameters

| Param | Default | Range | Description |
|---|---|---|---|
| M | 2.0 | 0.5–5.0 | Cart mass (kg) |
| m1 | 0.5 | 0.1–2.0 | Bob 1 mass (kg) |
| m2 | 0.3 | 0.1–2.0 | Bob 2 mass (kg) |
| L1 | 1.2 | 0.3–3.0 | Rod 1 length (m) |
| L2 | 0.8 | 0.3–3.0 | Rod 2 length (m) |
| k | 8.0 | 1–30 | Spring constant (N/m) |
| damping | 0.05 | 0–0.5 | Viscous damping |

### Double Pendulum parameters

| Param | Default | Range |
|---|---|---|
| m1 | 1.0 | 0.1–3.0 |
| m2 | 1.0 | 0.1–3.0 |
| l1 | 1.5 | 0.3–3.0 |
| l2 | 1.5 | 0.3–3.0 |
| damping | 0.02 | 0–0.3 |

---

## Project Structure

```
symfonos/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout, Inter font
│   │   ├── page.tsx            # Main orchestrator
│   │   └── globals.css         # CSS variables, neon utilities
│   ├── components/
│   │   ├── PhysicsCanvas.tsx   # Three.js scene + EffectComposer
│   │   ├── ControlPanel.tsx    # Collapsible parameter sliders
│   │   ├── AudioControls.tsx   # Mic/file UI + level meter
│   │   ├── WaveformDisplay.tsx # Canvas 2D waveform
│   │   ├── RecordButton.tsx    # MediaRecorder → .webm download
│   │   └── TutorialOverlay.tsx # 5-step first-time tutorial
│   ├── hooks/
│   │   ├── useAudioEngine.ts   # Web Audio API wrapper
│   │   ├── usePhysicsWorker.ts # Worker communication
│   │   ├── useFullscreen.ts    # Fullscreen API (webkit compat)
│   │   └── useFPSAdaptive.ts   # Quality scaling by FPS
│   ├── lib/
│   │   ├── physics/
│   │   │   ├── springPendulum.ts   # RK4 + Lagrangian equations
│   │   │   └── doublePendulum.ts   # RK4 + Cramér's rule
│   │   ├── shaders/
│   │   │   ├── backgroundShader.ts # LCH gradient + FX
│   │   │   ├── massShader.ts       # Fresnel + pulse deform
│   │   │   └── chromaticShader.ts  # Chromatic aberration pass
│   │   ├── presets.ts          # 4 visual preset definitions
│   │   └── colorSystem.ts      # LCH↔RGB, freqToHue(), reactiveColor()
│   ├── store/
│   │   └── symfonos.ts         # Zustand global store
│   └── workers/
│       └── physicsWorker.ts    # Unified Spring + Double Pendulum worker
├── vercel.json                 # COOP/COEP headers for Vercel
├── next.config.ts              # transpilePackages, security headers
└── package.json
```

---

## Credits & References

**Physics**
- Lagrangian mechanics: Goldstein, *Classical Mechanics* (3rd ed.)
- RK4 integration: Press et al., *Numerical Recipes in C* (2nd ed.)
- Double pendulum chaos: Strogatz, *Nonlinear Dynamics and Chaos* (2nd ed.)

**Color Science**
- CIELAB/LCH: CIE 15:2004
- Perceptual uniformity: Sharma, *Digital Color Imaging Handbook*, CRC Press
- LCH in creative tools: [oklch.com](https://oklch.com)

**Art & Design Inspiration**
- Kandinsky, W. — *Concerning the Spiritual in Art* (1912)
- Vignelli, M. — *The Vignelli Canon* (2010)
- Bass, S. — Title sequences for *Vertigo* (1958), *Anatomy of a Murder* (1959)
- Maeda, J. — *The Laws of Simplicity* (2006); *Design by Numbers* (1999)

**Technical**
- [Three.js](https://threejs.org) r177
- [Zustand](https://zustand-demo.pmnd.rs) v5
- [Next.js](https://nextjs.org) 16 App Router

---

*SymFonos — where differential equations become art.*
