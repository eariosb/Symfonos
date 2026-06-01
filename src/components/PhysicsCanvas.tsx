"use client";

/**
 * PhysicsCanvas — v4 (Sprint 4 — Trayectorias como Arte)
 * -------------------------------------------------------
 * El péndulo es el LÁPIZ. Las trayectorias caóticas son el CUADRO.
 *
 * Arquitectura del sistema de trail (nuevo):
 *   • THREE.Points con ShaderMaterial custom: glow gaussiano por punto
 *   • TRAIL_MAX = 3000 — historia de 50 segundos a 60fps
 *   • sizeRing por punto: encodes velocidad + beat en el momento del registro
 *   • AfterimagePass (persistencia Milkdrop): las capas se acumulan como pigmento
 *   • Hue drift autónomo en presets trailRainbow: el arco iris revela el tiempo
 *   • Phase portrait (preset Caos): trail en espacio de fase (θ, ω) → atractor extraño
 *   • Fade casi plano (pow 0.05) en modo oscuro → densidad = brillo (atractor visible)
 *   • AdditiveBlending: donde la trayectoria se superpone, el color se acumula
 *
 * Post-processing: RenderPass → UnrealBloom → AfterimagePass → ChromaticShader → Output
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer }  from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass }      from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass }      from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { AfterimagePass }  from "three/examples/jsm/postprocessing/AfterimagePass.js";
import { OutputPass }      from "three/examples/jsm/postprocessing/OutputPass.js";

import { backgroundFragmentShader } from "@/lib/shaders/backgroundShader";
import { massVertexShader, massFragmentShader }             from "@/lib/shaders/massShader";
import { chromaticAberrationShader }                        from "@/lib/shaders/chromaticShader";
import { trailPointVertexShader, trailPointFragmentShader } from "@/lib/shaders/trailPointShader";
import type { Equation, PresetName } from "@/store/symfonos";
import { PRESETS } from "@/lib/presets";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface FrameData {
  state: number[];
  equation: Equation;
  preset: PresetName;
  rms: number;
  isBeat: boolean;
  freqNorm: number;
  monochrome: boolean;
  particleLimit: number;
  velocityNorm: number;
  bassEnergy: number;
}

interface PhysicsCanvasProps {
  onMount: (push: (data: FrameData) => void, canvas: () => HTMLCanvasElement | null) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSpringGeometry(
  from: THREE.Vector3, to: THREE.Vector3, coils = 10, radius = 0.055
): THREE.BufferGeometry {
  const dir  = to.clone().sub(from);
  const len  = dir.length();
  const dirN = dir.clone().normalize();
  let perp   = new THREE.Vector3(0, 1, 0).cross(dirN).normalize();
  if (perp.lengthSq() < 0.001) perp.set(0, 0, 1);
  const segments = coils * 14;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, angle = t * Math.PI * 2 * coils;
    pts.push(
      from.clone()
        .add(dirN.clone().multiplyScalar(t * len))
        .add(perp.clone().multiplyScalar(Math.cos(angle) * radius))
        .add(new THREE.Vector3(0, Math.sin(angle) * radius, 0))
    );
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

// ── Partículas ────────────────────────────────────────────────────────────────

interface Particle {
  pos: THREE.Vector3; vel: THREE.Vector3;
  life: number; maxLife: number; hex: number;
}

class ParticleSystem {
  pool: Particle[] = [];
  geo: THREE.BufferGeometry;
  mat: THREE.PointsMaterial;
  mesh: THREE.Points;
  maxCount: number;

  constructor(maxCount: number, scene: THREE.Scene) {
    this.maxCount = maxCount;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(maxCount * 3), 3));
    this.geo.setAttribute("color",    new THREE.BufferAttribute(new Float32Array(maxCount * 3), 3));
    this.mat  = new THREE.PointsMaterial({
      size: 0.09, vertexColors: true,
      transparent: true, opacity: 0.88,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.mesh = new THREE.Points(this.geo, this.mat);
    scene.add(this.mesh);
  }

  emit(origin: THREE.Vector3, count: number, speedMin: number, speedMax: number,
       lifetime: number, palette: number[]) {
    for (let i = 0; i < count; i++) {
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 0.4
      ).normalize();
      this.pool.push({
        pos: origin.clone(),
        vel: dir.multiplyScalar(speedMin + Math.random() * (speedMax - speedMin)),
        life: lifetime, maxLife: lifetime,
        hex: palette[Math.floor(Math.random() * palette.length)],
      });
    }
    if (this.pool.length > this.maxCount)
      this.pool.splice(0, this.pool.length - this.maxCount);
  }

  update(sizeBase: number, sizeOnBeat: number, beatActive: boolean) {
    const pos = this.geo.attributes.position.array as Float32Array;
    const col = this.geo.attributes.color.array as Float32Array;
    for (let i = 0; i < this.maxCount; i++) {
      if (i < this.pool.length) {
        const p = this.pool[i];
        p.life--; p.pos.add(p.vel); p.vel.multiplyScalar(0.97);
        const t = p.life / p.maxLife;
        const c = new THREE.Color(p.hex);
        pos[i*3] = p.pos.x; pos[i*3+1] = p.pos.y; pos[i*3+2] = p.pos.z;
        col[i*3] = c.r*t;   col[i*3+1] = c.g*t;   col[i*3+2] = c.b*t;
      } else {
        pos[i*3] = pos[i*3+1] = pos[i*3+2] = 1e6;
        col[i*3] = col[i*3+1] = col[i*3+2] = 0;
      }
    }
    this.pool = this.pool.filter((p) => p.life > 0);
    this.mat.size = beatActive ? sizeOnBeat * 0.05 : sizeBase * 0.05;
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate    = true;
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.mesh); this.geo.dispose(); this.mat.dispose();
  }
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function PhysicsCanvas({ onMount }: PhysicsCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── Renderer ─────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: false, powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.72;
    mount.appendChild(renderer.domElement);

    // ── Escena y cámara ───────────────────────────────────────────────────────
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, mount.clientWidth / mount.clientHeight, 0.01, 120);
    camera.position.set(0, 1.2, 9);
    camera.lookAt(0, -0.5, 0);
    const camBaseX = 0, camBaseY = 1.2, camBaseZ = 9;

    // ── Luces ─────────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.03));
    const pointLight  = new THREE.PointLight(0x00ffff, 1.2, 14);
    pointLight.position.set(0, 3, 3);
    scene.add(pointLight);
    const pointLight2 = new THREE.PointLight(0xff00ff, 0.8, 12);
    pointLight2.position.set(-3, -1, 2);
    scene.add(pointLight2);

    // ── Plano de fondo fullscreen ─────────────────────────────────────────────
    const bgUniforms = {
      uTime:       { value: 0.0 },
      uRms:        { value: 0.0 },
      uFreqNorm:   { value: 0.3 },
      uBeat:       { value: 0.0 },
      uVelocity:   { value: 0.0 },
      uColorA:     { value: new THREE.Color(0x00ffff) },
      uColorB:     { value: new THREE.Color(0xff00ff) },
      uBgBaseHue:  { value: 180.0 },
      uMonochrome: { value: 0.0 },
      uHorizontal: { value: 0.0 },
      uDriftSpeed: { value: 1.0 },
      uShock:      { value: 0.0 },
      uOrganic:    { value: 0.0 },
      uLightMode:  { value: 0.0 },
      uZobel:      { value: 0.0 },
    };
    const bgMat = new THREE.ShaderMaterial({
      uniforms: bgUniforms,
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 1.0, 1.0);
        }
      `,
      fragmentShader: backgroundFragmentShader,
      depthTest: false, depthWrite: false, side: THREE.FrontSide,
    });
    const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
    bgMesh.renderOrder = -10; bgMesh.frustumCulled = false;
    scene.add(bgMesh);

    // ── Mass ShaderMaterials ──────────────────────────────────────────────────
    const mass1Uniforms = {
      uTime: { value: 0.0 }, uBeat: { value: 0.0 }, uRms: { value: 0.0 },
      uColor:    { value: new THREE.Color(0x110022) },
      uEmissive: { value: new THREE.Color(0xff00ff) },
    };
    const mass2Uniforms = {
      uTime: { value: 0.0 }, uBeat: { value: 0.0 }, uRms: { value: 0.0 },
      uColor:    { value: new THREE.Color(0x001100) },
      uEmissive: { value: new THREE.Color(0x00ffff) },
    };
    const mass1Mat = new THREE.ShaderMaterial({
      uniforms: mass1Uniforms, vertexShader: massVertexShader,
      fragmentShader: massFragmentShader, lights: false,
    });
    const mass2Mat = new THREE.ShaderMaterial({
      uniforms: mass2Uniforms, vertexShader: massVertexShader,
      fragmentShader: massFragmentShader, lights: false,
    });

    // ── Meshes — masas pequeñas (el trail es el protagonista) ────────────────
    const cartGeo     = new THREE.BoxGeometry(1.0, 0.38, 0.38);
    const sphereGeo   = new THREE.SphereGeometry(0.11, 24, 24); // más pequeñas
    const sphereSmall = new THREE.SphereGeometry(0.08, 16, 16);

    const cartMat = new THREE.MeshPhongMaterial({
      color: 0x001a1a, emissive: 0x00ffff, emissiveIntensity: 0.3,
      transparent: true, opacity: 0.75,
    });
    const cartWireMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.35,
    });
    const pivotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });

    const cart     = new THREE.Mesh(cartGeo,     cartMat);
    const cartWire = new THREE.Mesh(cartGeo,     cartWireMat);
    const mass1    = new THREE.Mesh(sphereGeo,   mass1Mat);
    const mass2    = new THREE.Mesh(sphereGeo,   mass2Mat);
    const pivot    = new THREE.Mesh(sphereSmall, pivotMat);

    const rodMat1  = new THREE.LineBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.55 });
    const rodMat2  = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.55 });
    const springMat= new THREE.LineBasicMaterial({ color: 0xffffff });

    const rodGeo1  = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0,-1,0)]);
    const rodGeo2  = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0,-1,0)]);
    const rod1     = new THREE.Line(rodGeo1, rodMat1);
    const rod2     = new THREE.Line(rodGeo2, rodMat2);
    scene.add(cart, cartWire, mass1, mass2, rod1, rod2, pivot);

    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.04, 0.15),
      new THREE.MeshBasicMaterial({ color: 0x112222, transparent: true, opacity: 0.35 })
    );
    const anchorGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const anchorMat = new THREE.MeshBasicMaterial({ color: 0x888888 });
    const anchorL   = new THREE.Mesh(anchorGeo, anchorMat);
    const anchorR   = new THREE.Mesh(anchorGeo, anchorMat);
    anchorL.position.set(-5.5, 0, 0);
    anchorR.position.set( 5.5, 0, 0);
    scene.add(rail, anchorL, anchorR);

    const gridHelper = new THREE.GridHelper(20, 40, 0x112233, 0x0a1a22);
    gridHelper.position.y = -3;
    scene.add(gridHelper);

    // ── Trail — sistema de puntos glow ────────────────────────────────────────
    //
    // Cada punto del trail almacena: posición, color (al momento del registro)
    // y tamaño (proporcional a velocidad + beat en ese instante).
    // Con AdditiveBlending + fade plano, las zonas densas del atractor se
    // acumulan visualmente: el BRILLO revela la FRECUENCIA de la trayectoria.
    //
    const TRAIL_MAX = 3000;

    const t1PosRing  = new Float32Array(TRAIL_MAX * 3);
    const t2PosRing  = new Float32Array(TRAIL_MAX * 3);
    const t1ColRing  = new Float32Array(TRAIL_MAX * 3);
    const t2ColRing  = new Float32Array(TRAIL_MAX * 3);
    const t1SizeRing = new Float32Array(TRAIL_MAX);    // tamaño por punto
    const t2SizeRing = new Float32Array(TRAIL_MAX);

    // Geometrías de trail: position + color + aSize
    const trail1Geo = new THREE.BufferGeometry();
    const trail2Geo = new THREE.BufferGeometry();
    trail1Geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL_MAX * 3), 3));
    trail1Geo.setAttribute("color",    new THREE.BufferAttribute(new Float32Array(TRAIL_MAX * 3), 3));
    trail1Geo.setAttribute("aSize",    new THREE.BufferAttribute(new Float32Array(TRAIL_MAX),     1));
    trail2Geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL_MAX * 3), 3));
    trail2Geo.setAttribute("color",    new THREE.BufferAttribute(new Float32Array(TRAIL_MAX * 3), 3));
    trail2Geo.setAttribute("aSize",    new THREE.BufferAttribute(new Float32Array(TRAIL_MAX),     1));

    // Shader material para puntos glow
    const makeTrailMat = (opacity: number) => new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: opacity } },
      vertexShader:   trailPointVertexShader,
      fragmentShader: trailPointFragmentShader,
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });

    const trail1Mat = makeTrailMat(0.95);
    const trail2Mat = makeTrailMat(0.95);
    const trail1    = new THREE.Points(trail1Geo, trail1Mat);
    const trail2    = new THREE.Points(trail2Geo, trail2Mat);
    scene.add(trail1, trail2);

    let t1Idx = 0, t2Idx = 0, trailFilled = 0;
    let activeTrailLen = 60;

    // Partículas
    const particles = new ParticleSystem(1500, scene);

    // Resortes
    let springL: THREE.Line | null = null;
    let springR: THREE.Line | null = null;
    const WALL_L = -5.5, WALL_R = 5.5;
    const DP_PIVOT = new THREE.Vector3(0, 1, 0);
    pivot.position.copy(DP_PIVOT);

    // ── Post-processing ───────────────────────────────────────────────────────
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(mount.clientWidth, mount.clientHeight), 2.0, 0.6, 0.1
    );
    composer.addPass(bloomPass);

    // AfterimagePass — persistencia Milkdrop
    // Usa max(oldFrame * damp, newFrame): acumula el brillo sin mezclar suciedad.
    // El fondo negro se mantiene negro; solo los puntos brillantes persisten.
    const afterimagePass = new AfterimagePass(0.95);
    afterimagePass.enabled = false; // se activa por preset en applyPreset()
    composer.addPass(afterimagePass);

    // Chromatic aberration
    const chromaticPass = new ShaderPass(chromaticAberrationShader);
    chromaticPass.enabled = false;
    composer.addPass(chromaticPass);

    composer.addPass(new OutputPass());

    // ── Estado mutable ────────────────────────────────────────────────────────
    let currentFrame: FrameData = {
      state: [0, 0.3, -0.3, 0, 0, 0], equation: "spring", preset: "neon",
      rms: 0, isBeat: false, freqNorm: 0.3, monochrome: false,
      particleLimit: 1, velocityNorm: 0, bassEnergy: 0,
    };
    let lastPreset:   PresetName | null = null;
    let lastEquation: Equation | null   = null;

    let beatDecay    = 0;
    let chromaticDecay = 0;
    let clock        = 0;
    let shockDecay   = 0;

    // Trail color state
    let trailHue1    = 300;  // hue suavizado masa1
    let trailHue2    = 180;  // hue suavizado masa2
    let trailHueDrift = 0;   // deriva autónoma (trailRainbow)

    // Lag filters
    let smoothRMS  = 0;
    let smoothFreq = 0.3;
    let smoothBass = 0;

    // ── applyPreset ───────────────────────────────────────────────────────────
    function applyPreset(name: PresetName) {
      const p = PRESETS[name];
      const c = p.colors;

      cartMat.color.set(c.cart);
      cartMat.emissive.set(c.cartEmissive);
      cartWireMat.color.set(c.cartEmissive);
      mass1Uniforms.uColor.value.set(c.mass1);
      mass1Uniforms.uEmissive.value.set(c.mass1Emissive);
      mass2Uniforms.uColor.value.set(c.mass2);
      mass2Uniforms.uEmissive.value.set(c.mass2Emissive);
      rodMat1.color.set(c.rod1);
      rodMat2.color.set(c.rod2);
      springMat.color.set(c.spring);
      trail1Mat.uniforms.uOpacity.value = p.trailOpacity;
      trail2Mat.uniforms.uOpacity.value = p.trailOpacity;
      gridHelper.visible = p.showGrid;

      const materials = gridHelper.material;
      if (Array.isArray(materials) && materials.length >= 2) {
        const mat0 = materials[0] as THREE.LineBasicMaterial;
        const mat1 = materials[1] as THREE.LineBasicMaterial;
      if (p.bgLight) {
        mat0.color.set(0xc8b080);
        mat1.color.set(0xd8c090);
      } else {
        mat0.color.set(0x112233);
        mat1.color.set(0x0a1a22);
      }
    }

      cartWire.visible = p.wireframeCart;
      bloomPass.strength  = p.bloom.enabled ? p.bloom.strength : 0;
      bloomPass.radius    = p.bloom.radius;
      bloomPass.threshold = p.bloom.threshold;
      pointLight.color.set(c.mass1Emissive);
      pointLight2.color.set(c.mass2Emissive);

      bgUniforms.uColorA.value.set(c.mass2Emissive);
      bgUniforms.uColorB.value.set(c.mass1Emissive);
      bgUniforms.uBgBaseHue.value  = p.bgBaseHue;
      bgUniforms.uHorizontal.value = p.bgHorizontal ? 1.0 : 0.0;
      bgUniforms.uOrganic.value    = p.bgOrganic    ? 1.0 : 0.0;
      bgUniforms.uLightMode.value  = p.bgLight      ? 1.0 : 0.0;
      bgUniforms.uZobel.value      = p.bgZobel      ? 1.0 : 0.0;
      bgUniforms.uDriftSpeed.value = p.bgDriftSpeed;
      renderer.toneMappingExposure = p.bgLight ? 1.35 : 0.72;

      // Trail blending: AdditiveBlending siempre para puntos glow oscuros
      // Solo NormalBlending si fondo claro + trailDark (caso poco común)
      const tBlend = (p.trailDark && p.bgLight) ? THREE.NormalBlending : THREE.AdditiveBlending;
      trail1Mat.blending = tBlend; trail1Mat.needsUpdate = true;
      trail2Mat.blending = tBlend; trail2Mat.needsUpdate = true;

      // AfterimagePass — activar solo en modo oscuro con fuerza > 0
      afterimagePass.enabled = !p.bgLight && p.afterimageStrength > 0;
      if (afterimagePass.enabled) {
        afterimagePass.uniforms["damp"].value = p.afterimageStrength;
      }

      if (p.hideCartElements) {
        cart.visible = cartWire.visible = rail.visible = anchorL.visible = anchorR.visible = false;
        pivot.visible = true;
      }

      // Rods semitransparentes en modo phase portrait (el trailer es el protagonista)
      const rodAlpha = p.phasePortrait ? 0.0 : 0.55;
      rodMat1.opacity = rodAlpha;
      rodMat2.opacity = rodAlpha;
      rodMat1.transparent = true;
      rodMat2.transparent = true;

      // Masas invisibles en phase portrait (solo el trail importa)
      mass1.visible = mass2.visible = !p.phasePortrait;
      // Pivot: visible solo para doble péndulo físico (no phase portrait, sí hideCartElements)
      pivot.visible = p.hideCartElements && !p.phasePortrait;

      // Actualizar lastPreset ANTES de llamar applyEquationMode para que
      // applyEquationMode use los flags del preset NUEVO (ej: phasePortrait)
      lastPreset = name;

      if (p.preferredEquation && p.preferredEquation !== lastEquation) {
        applyEquationMode(p.preferredEquation);
      }
    }

    // ── applyEquationMode ─────────────────────────────────────────────────────
    function applyEquationMode(eq: Equation) {
      const isSpring = eq === "spring";
      const cfg = PRESETS[lastPreset ?? "neon"];
      const showCart = isSpring && !cfg.hideCartElements;
      cart.visible = cartWire.visible = rail.visible = anchorL.visible = anchorR.visible = showCart;
      // Pivot visible solo en doble péndulo físico (hideCartElements=true implica doble péndulo)
      pivot.visible = cfg.hideCartElements && !cfg.phasePortrait;
      t1PosRing.fill(0); t2PosRing.fill(0);
      t1ColRing.fill(0); t2ColRing.fill(0);
      t1SizeRing.fill(0); t2SizeRing.fill(0);
      t1Idx = t2Idx = 0;
      trailFilled = 0;
      activeTrailLen = 60;
      lastEquation = eq;
      // Limpiar geometría de trail
      const clr = (geo: THREE.BufferGeometry) => {
        (geo.attributes.position.array as Float32Array).fill(0);
        (geo.attributes.color.array    as Float32Array).fill(0);
        (geo.attributes.aSize.array    as Float32Array).fill(0);
        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate    = true;
        geo.attributes.aSize.needsUpdate    = true;
      };
      clr(trail1Geo); clr(trail2Geo);
    }

    // ── Resize ────────────────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      if (!mount) return;
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
      bloomPass.resolution.set(w, h);
    });
    ro.observe(mount);

    // ── RAF ───────────────────────────────────────────────────────────────────
    let animId: number;
    let lastMs = performance.now();

    const animate = () => {
      animId = requestAnimationFrame(animate);

      const nowMs = performance.now();
      const dtSec = Math.min((nowMs - lastMs) / 1000, 0.05);
      lastMs = nowMs;
      clock += dtSec;

      const {
        state, equation, preset, rms, isBeat, freqNorm,
        monochrome, particleLimit, velocityNorm, bassEnergy,
      } = currentFrame;

      if (preset   !== lastPreset)   applyPreset(preset);
      if (equation !== lastEquation) applyEquationMode(equation);

      const cfg = PRESETS[preset];

      // ── Lag filters ───────────────────────────────────────────────────────
      const rmsAttack  = rms        > smoothRMS  ? 0.3  : 0.07;
      const bassAttack = bassEnergy > smoothBass ? 0.25 : 0.08;
      smoothRMS  += (rms        - smoothRMS)  * rmsAttack;
      smoothFreq += (freqNorm   - smoothFreq) * 0.12;
      smoothBass += (bassEnergy - smoothBass) * bassAttack;

      // ── Beat decay ────────────────────────────────────────────────────────
      if (isBeat) {
        beatDecay  = 1.0;
        shockDecay = 1.0;
        if (cfg.glitch.enabled) chromaticDecay = 14;
      }
      beatDecay  *= 0.88;
      shockDecay *= 0.82;

      // ── Camera shake ──────────────────────────────────────────────────────
      if (isBeat) {
        const shk = 0.04 * smoothRMS;
        camera.position.x = camBaseX + (Math.random() - 0.5) * shk;
        camera.position.y = camBaseY + (Math.random() - 0.5) * shk;
      } else {
        camera.position.x += (camBaseX - camera.position.x) * 0.15;
        camera.position.y += (camBaseY - camera.position.y) * 0.15;
      }

      // ── Chromatic aberration ──────────────────────────────────────────────
      if (chromaticDecay > 0) {
        chromaticDecay--;
        chromaticPass.enabled = true;
        chromaticPass.uniforms["uIntensity"].value = chromaticDecay / 14;
        chromaticPass.uniforms["uTime"].value      = clock;
      } else {
        chromaticPass.enabled = false;
      }

      // ── Bloom reactivo ────────────────────────────────────────────────────
      if (cfg.bloom.enabled) {
        const energy = Math.min(1, smoothRMS * 0.35 + smoothBass * 0.45);
        const target = cfg.bloom.strength + Math.sqrt(energy) * cfg.bloom.reactivity * 0.55;
        bloomPass.strength += (Math.min(cfg.bloom.maxStrength, target) - bloomPass.strength) * 0.08;
      }

      // ── Luces ─────────────────────────────────────────────────────────────
      const rmsSqrt = Math.sqrt(Math.min(1, smoothRMS));
      pointLight.intensity  = 0.8 + rmsSqrt * 0.9 + velocityNorm * 0.25;
      pointLight2.intensity = 0.5 + rmsSqrt * 0.6;

      // ── Uniforms de fondo ─────────────────────────────────────────────────
      bgUniforms.uTime.value       = clock;
      bgUniforms.uRms.value        = smoothRMS;
      bgUniforms.uFreqNorm.value   = smoothFreq;
      bgUniforms.uBeat.value       = beatDecay;
      bgUniforms.uVelocity.value   = velocityNorm;
      bgUniforms.uMonochrome.value = monochrome ? 1.0 : 0.0;
      bgUniforms.uShock.value      = shockDecay;

      // ── Color de masas (LCH → RGB) ────────────────────────────────────────
      const bgHueApprox   = cfg.bgBaseHue * 0.35 + smoothFreq * 300 * 0.65;
      const organicOffset = cfg.bgLight ? 0 : 150 + Math.sin(clock * 0.3) * 10;
      const massHueOffset = cfg.bgLight ? 0 : organicOffset + velocityNorm * 20;
      const mass1Hue      = cfg.bgLight ? 72  + smoothFreq * 15 : (bgHueApprox + massHueOffset) % 360;
      const mass2Hue      = cfg.bgLight ? 228 + smoothFreq * 20 : (bgHueApprox + massHueOffset + 40) % 360;

      const hueToColor = (hue: number, L: number, C: number): THREE.Color => {
        const rad = (hue * Math.PI) / 180;
        const a = C * Math.cos(rad), b = C * Math.sin(rad);
        const fy = (L + 16) / 116, fx = a / 500 + fy, fz = fy - b / 200;
        const labFInv = (t: number) => t > 0.206897 ? t * t * t : (t - 16 / 116) / 7.787;
        const x = 0.95047 * labFInv(fx), y = 1.0 * labFInv(fy), z = 1.08883 * labFInv(fz);
        const rL =  3.2406*x - 1.5372*y - 0.4986*z;
        const gL = -0.9689*x + 1.8758*y + 0.0415*z;
        const bL =  0.0557*x - 0.2040*y + 1.0570*z;
        const gc = (c: number) => c <= 0.0031308 ? 12.92*c : 1.055*Math.pow(Math.max(0,c),1/2.4)-0.055;
        return new THREE.Color(
          Math.min(1,Math.max(0,gc(rL))),
          Math.min(1,Math.max(0,gc(gL))),
          Math.min(1,Math.max(0,gc(bL)))
        );
      };

      const satFactor = Math.pow(Math.min(1, smoothRMS * 1.2), 1.8);
      const emissiveL = cfg.bgLight
        ? Math.max(8, 8 + beatDecay * 47 + smoothRMS * 22)
        : 75 + smoothRMS * 22 + beatDecay * 18;
      const emissiveC = cfg.bgLight
        ? Math.min(60, beatDecay * 52 + smoothRMS * 30)
        : Math.min(95, 55 + satFactor * 40 + velocityNorm * 18);
      mass1Uniforms.uEmissive.value = hueToColor(mass1Hue, emissiveL, emissiveC);
      mass2Uniforms.uEmissive.value = hueToColor(mass2Hue, emissiveL, emissiveC);

      if (lastPreset !== null) {
        const lerpColor = (u: THREE.Color, targetHex: number, alpha: number) => {
          const t = new THREE.Color(targetHex);
          u.r += (t.r - u.r) * alpha; u.g += (t.g - u.g) * alpha; u.b += (t.b - u.b) * alpha;
        };
        lerpColor(cartMat.color,    cfg.colors.cart,         0.06);
        lerpColor(cartMat.emissive, cfg.colors.cartEmissive, 0.06);
      }

      [mass1Uniforms, mass2Uniforms].forEach((u) => {
        u.uTime.value = clock; u.uBeat.value = beatDecay; u.uRms.value = smoothRMS;
      });

      if (cfg.bgLight) {
        rodMat1.color.set(cfg.colors.rod1);
        rodMat2.color.set(cfg.colors.rod2);
      } else {
        rodMat1.color.copy(mass1Uniforms.uEmissive.value);
        rodMat2.color.copy(mass2Uniforms.uEmissive.value);
      }

      // ── Hue del trail ─────────────────────────────────────────────────────
      // Deriva autónoma: cuando trailRainbow=true, el hue gira constantemente
      // creando una banda arco iris sobre el atractor. La frecuencia del sonido
      // modula la velocidad de la deriva.
      if (cfg.trailRainbow) {
        trailHueDrift += 0.30 + smoothFreq * 0.25; // ~18°/s base + reactivo al audio
      }

      const targetHue1 = cfg.trailDark
        ? 52  + smoothFreq * 18                          // oro (Zobel)
        : (mass1Hue + trailHueDrift) % 360;
      const targetHue2 = cfg.trailDark
        ? 210 - smoothFreq * 20                          // pizarra-teal (Zobel)
        : (mass2Hue + trailHueDrift + 160) % 360;       // +160°: complementario con arco iris

      trailHue1 += (targetHue1 - trailHue1) * 0.35;
      trailHue2 += (targetHue2 - trailHue2) * 0.35;

      // ── L/C del trail ─────────────────────────────────────────────────────
      const ptL1 = cfg.trailDark
        ? (cfg.bgLight
          ? 48 + beatDecay * 18 + smoothRMS * 12
          : Math.max(45, 60 + beatDecay * 28 + smoothRMS * 18))
        : 48 + smoothRMS * 42 + beatDecay * 22;
      const ptC1 = cfg.trailDark
        ? (cfg.bgLight
          ? Math.min(78, 55 + beatDecay * 20 + smoothRMS * 15)
          : Math.min(90, 65 + beatDecay * 22 + smoothRMS * 18))
        : Math.min(70, 42 + satFactor * 35 + velocityNorm * 12);
      const ptL2z = cfg.trailDark
        ? (cfg.bgLight
          ? 22 + smoothRMS * 10 + beatDecay * 8
          : Math.max(32, 45 + smoothRMS * 18 + beatDecay * 10))
        : ptL1;
      const ptC2z = cfg.trailDark
        ? (cfg.bgLight
          ? Math.min(48, 28 + satFactor * 18 + smoothRMS * 10)
          : Math.min(62, 38 + satFactor * 24 + smoothRMS * 16))
        : ptC1;

      const ptCol1 = hueToColor(trailHue1, ptL1, ptC1);
      const ptCol2 = hueToColor(trailHue2, ptL2z, ptC2z);

      // ── Tamaño del punto (encodes velocidad + beat) ───────────────────────
      // Puntos grandes en zonas rápidas/caóticas. Puntos pequeños en silencio.
      const ptSize1 = (velocityNorm * 2.8 + beatDecay * 2.5 + 0.15) * cfg.trailBasePointSize;
      const ptSize2 = (velocityNorm * 2.2 + beatDecay * 2.0 + 0.12) * cfg.trailBasePointSize;

      // ── Longitud activa del trail ─────────────────────────────────────────
      const energyForLen = rms * 0.5 + bassEnergy * 0.3 + beatDecay * 0.2;
      const targetLen    = Math.round(cfg.trailLength * Math.min(1, 0.15 + energyForLen * 0.85));
      activeTrailLen    += (Math.min(TRAIL_MAX, targetLen) - activeTrailLen) * 0.05;
      const drawLen      = Math.max(4, Math.min(Math.round(activeTrailLen), trailFilled));

      // ── Helper: reconstruir geometry desde ring buffer ────────────────────
      const updateTrail = (
        posRing: Float32Array, colRing: Float32Array, sizeRing: Float32Array,
        idx: number, pts: THREE.Points
      ) => {
        const posBuf = pts.geometry.attributes.position.array as Float32Array;
        const colBuf = pts.geometry.attributes.color.array    as Float32Array;
        const sizBuf = pts.geometry.attributes.aSize.array    as Float32Array;

        for (let i = 0; i < drawLen; i++) {
          const ri  = ((idx - drawLen + i) % TRAIL_MAX + TRAIL_MAX) % TRAIL_MAX;
          const age = i / Math.max(1, drawLen - 1); // 0=más viejo, 1=más nuevo

          // Fade:
          //   trailDark: pow(age, 0.05) — casi plano: toda la espiral visible
          //              En zonas densas, el brillo se acumula por AdditiveBlending
          //   normal:    pow(age, 0.9)  — caída suave pero perceptible
          const fade = cfg.trailDark ? Math.pow(age, 0.05) : Math.pow(age, 0.90);

          posBuf[i*3]   = posRing[ri*3];
          posBuf[i*3+1] = posRing[ri*3+1];
          posBuf[i*3+2] = posRing[ri*3+2];
          colBuf[i*3]   = colRing[ri*3]   * fade;
          colBuf[i*3+1] = colRing[ri*3+1] * fade;
          colBuf[i*3+2] = colRing[ri*3+2] * fade;
          // Tamaño: el punto más nuevo (age=1) es el más grande
          sizBuf[i] = sizeRing[ri] * (0.3 + age * 0.7);
        }

        // Punto más reciente: sin fade → brilla al máximo (la "punta del lápiz")
        if (drawLen > 0) {
          const ri = (idx - 1 + TRAIL_MAX) % TRAIL_MAX;
          const last = drawLen - 1;
          colBuf[last*3]   = colRing[ri*3];
          colBuf[last*3+1] = colRing[ri*3+1];
          colBuf[last*3+2] = colRing[ri*3+2];
          sizBuf[last] = sizeRing[ri] * 1.4; // punta más brillante
        }

        // Ocultar puntos fuera del drawLen (posición 1e6 = fuera de viewport)
        for (let i = drawLen; i < TRAIL_MAX; i++) {
          posBuf[i*3] = posBuf[i*3+1] = posBuf[i*3+2] = 1e6;
          colBuf[i*3] = colBuf[i*3+1] = colBuf[i*3+2] = 0;
          sizBuf[i] = 0;
        }

        pts.geometry.attributes.position.needsUpdate = true;
        pts.geometry.attributes.color.needsUpdate    = true;
        pts.geometry.attributes.aSize.needsUpdate    = true;
        pts.geometry.computeBoundingSphere();
      };

      // ── Función para registrar un punto en el ring buffer ─────────────────
      const writePt = (
        posRing: Float32Array, colRing: Float32Array, sizeRing: Float32Array,
        idx: number, x: number, y: number, col: THREE.Color, size: number
      ) => {
        posRing[idx*3] = x; posRing[idx*3+1] = y; posRing[idx*3+2] = 0;
        colRing[idx*3] = col.r; colRing[idx*3+1] = col.g; colRing[idx*3+2] = col.b;
        sizeRing[idx]  = size;
      };

      // ── Spring Pendulum ───────────────────────────────────────────────────
      if (equation === "spring") {
        const [x, θ1, θ2] = state;
        const L1 = 1.5, L2 = 1.5;
        cart.position.set(x, 0, 0);
        cartWire.position.set(x, 0, 0);
        const m1x = x + L1 * Math.sin(θ1), m1y = -L1 * Math.cos(θ1);
        const m2x = x + L2 * Math.sin(θ2), m2y = -L2 * Math.cos(θ2);
        mass1.position.set(m1x, m1y, 0);
        mass2.position.set(m2x, m2y, 0);

        rod1.geometry.setFromPoints([new THREE.Vector3(x, 0, 0), new THREE.Vector3(m1x, m1y, 0)]);
        rod2.geometry.setFromPoints([new THREE.Vector3(x, 0, 0), new THREE.Vector3(m2x, m2y, 0)]);
        rod1.geometry.computeBoundingSphere();
        rod2.geometry.computeBoundingSphere();

        if (springL) { scene.remove(springL); springL.geometry.dispose(); }
        if (springR) { scene.remove(springR); springR.geometry.dispose(); }
        springMat.color.copy(hueToColor(trailHue1, 40 + smoothRMS * 15, 40 + smoothRMS * 20));
        springL = new THREE.Line(makeSpringGeometry(new THREE.Vector3(WALL_L,0,0), new THREE.Vector3(x-0.5,0,0)), springMat);
        springR = new THREE.Line(makeSpringGeometry(new THREE.Vector3(x+0.5,0,0), new THREE.Vector3(WALL_R,0,0)), springMat);
        scene.add(springL, springR);

        writePt(t1PosRing, t1ColRing, t1SizeRing, t1Idx, m1x, m1y, ptCol1, ptSize1);
        writePt(t2PosRing, t2ColRing, t2SizeRing, t2Idx, m2x, m2y, ptCol2, ptSize2);
        t1Idx = (t1Idx + 1) % TRAIL_MAX;
        t2Idx = (t2Idx + 1) % TRAIL_MAX;
        trailFilled = Math.min(trailFilled + 1, TRAIL_MAX);
        updateTrail(t1PosRing, t1ColRing, t1SizeRing, t1Idx, trail1);
        updateTrail(t2PosRing, t2ColRing, t2SizeRing, t2Idx, trail2);

        if (cfg.particles.enabled) {
          const lim = Math.round(cfg.particles.count * particleLimit);
          const cnt = isBeat ? lim : Math.ceil(smoothRMS * lim * 0.4);
          if (cnt > 0) {
            particles.emit(mass1.position, Math.ceil(cnt/2), cfg.particles.speedMin, cfg.particles.speedMax, cfg.particles.lifetime, cfg.colors.particles);
            particles.emit(mass2.position, Math.ceil(cnt/2), cfg.particles.speedMin, cfg.particles.speedMax, cfg.particles.lifetime, cfg.colors.particles);
          }
        }
        cartMat.emissiveIntensity = 0.12 + smoothRMS * 0.4;
      }

      // ── Double Pendulum ───────────────────────────────────────────────────
      if (equation === "double") {
        const [θ1, θ2, ω1, ω2] = state;
        const L1 = 1.5, L2 = 1.5;

        let m1x: number, m1y: number, m2x: number, m2y: number;

        if (cfg.phasePortrait) {
          // ── Modo espacio de fase ──────────────────────────────────────────
          // Trail1: retrato de fase (θ, ω) de cada péndulo — revela el atractor extraño
          // Escala calibrada para que θ ∈ [-π, π] y ω ∈ [-∞,∞] (acotado ~[-20,20])
          // llenen la pantalla cómodamente.
          const PS_ANG = 1.2;  // escala ángulo: π → 3.77 unidades Three.js
          const PS_VEL = 0.18; // escala velocidad angular: ω=10 → 1.8 unidades
          m1x = θ1 * PS_ANG;
          m1y = ω1 * PS_VEL;
          m2x = θ2 * PS_ANG;
          m2y = ω2 * PS_VEL;
          // Rods invisibles en phase portrait — solo el atractor importa
          rod1.geometry.setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,0)]);
          rod2.geometry.setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,0)]);
        } else {
          // ── Espacio físico ────────────────────────────────────────────────
          const px = DP_PIVOT.x, py = DP_PIVOT.y;
          m1x = px + L1 * Math.sin(θ1); m1y = py - L1 * Math.cos(θ1);
          m2x = m1x + L2 * Math.sin(θ2); m2y = m1y - L2 * Math.cos(θ2);
          mass1.position.set(m1x, m1y, 0);
          mass2.position.set(m2x, m2y, 0);
          rod1.geometry.setFromPoints([DP_PIVOT.clone(), new THREE.Vector3(m1x, m1y, 0)]);
          rod2.geometry.setFromPoints([new THREE.Vector3(m1x, m1y, 0), new THREE.Vector3(m2x, m2y, 0)]);
          rod1.geometry.computeBoundingSphere();
          rod2.geometry.computeBoundingSphere();
        }

        writePt(t1PosRing, t1ColRing, t1SizeRing, t1Idx, m1x, m1y, ptCol1, ptSize1);
        writePt(t2PosRing, t2ColRing, t2SizeRing, t2Idx, m2x, m2y, ptCol2, ptSize2);
        t1Idx = (t1Idx + 1) % TRAIL_MAX;
        t2Idx = (t2Idx + 1) % TRAIL_MAX;
        trailFilled = Math.min(trailFilled + 1, TRAIL_MAX);
        updateTrail(t1PosRing, t1ColRing, t1SizeRing, t1Idx, trail1);
        updateTrail(t2PosRing, t2ColRing, t2SizeRing, t2Idx, trail2);

        if (cfg.particles.enabled && isBeat) {
          const lim = Math.round(cfg.particles.count * particleLimit);
          if (!cfg.phasePortrait) {
            particles.emit(mass2.position, lim, cfg.particles.speedMin, cfg.particles.speedMax, cfg.particles.lifetime, cfg.colors.particles);
          }
        }
      }

      particles.update(cfg.particles.sizeBase, cfg.particles.sizeOnBeat, beatDecay > 0.3);
      composer.render();
    };

    animate();

    onMount(
      (data: FrameData) => { currentFrame = data; },
      () => renderer.domElement
    );

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      particles.dispose(scene);
      springL?.geometry.dispose();
      springR?.geometry.dispose();
      bgMat.dispose();
      mass1Mat.dispose();
      mass2Mat.dispose();
      trail1Mat.dispose();
      trail2Mat.dispose();
      trail1Geo.dispose();
      trail2Geo.dispose();
      renderer.dispose();
      composer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className="w-full h-full" style={{ background: "#000000" }} />;
}
