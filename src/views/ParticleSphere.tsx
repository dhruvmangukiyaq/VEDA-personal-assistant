"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { audioBus } from "@/lib/audioBus";

export type SphereState = "idle" | "listening" | "thinking" | "speaking";
type Props = { state: SphereState; introKey: number };

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SPHERE_VERT = /* glsl */ `
attribute float aSeed;
attribute float aCore;
attribute vec3 aStart;
uniform float uTime, uPR, uSize, uIntro, uSuck, uSwirl, uVoice, uPeak, uPulse, uBreathe;
varying vec3 vColor;
varying float vAlpha;
void main() {
  // intro: fly from far start to sphere position, staggered
  float d = clamp(uIntro * 1.3 - aSeed * 0.3, 0.0, 1.0);
  float e = d * d * (3.0 - 2.0 * d);
  vec3 target = position;
  // gentle curl-ish wobble while flying
  vec3 fly = mix(aStart, target, e);
  fly.x += sin(uTime * 2.0 + aSeed * 20.0) * (1.0 - e) * 0.4;
  fly.y += cos(uTime * 1.7 + aSeed * 26.0) * (1.0 - e) * 0.4;
  vec3 p = fly;
  float r = length(p);
  vec3 dir = r > 0.0001 ? p / r : vec3(0.0, 1.0, 0.0);
  // breathing
  p *= 1.0 + uBreathe * 0.022;
  // listening: pulled inward
  p *= 1.0 - uSuck * 0.16;
  // thinking: orbit swirl
  float sw = uSwirl * (1.6 - r);
  float ca = cos(sw), sa = sin(sw);
  p = vec3(ca * p.x - sa * p.z, p.y, sa * p.x + ca * p.z);
  // speaking: surface ripple + burst on peaks
  float rip = sin(r * 9.0 - uTime * 11.0 + aSeed * 6.28) * 0.055 * uVoice;
  float burst = step(aSeed, uPeak * 0.18) * uPeak * (0.5 + aSeed);
  p += dir * (rip + burst);
  // completion pulse ring
  p += dir * uPulse * 0.35 * sin(r * 6.0 - uPulse * 12.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float front = clamp(normalize((modelViewMatrix * vec4(dir, 0.0)).xyz).z * 0.5 + 0.5, 0.15, 1.0);
  vec3 cyan = vec3(0.10, 0.75, 0.95);
  vec3 warm = vec3(1.00, 0.55, 0.20);
  vec3 base = mix(cyan, warm, aCore);
  float glow = 0.55 + 0.45 * front + uVoice * 0.5 + uSuck * 0.35 + uPulse * 0.8;
  vColor = base * glow;
  float tw = 0.75 + 0.25 * sin(uTime * 2.4 + aSeed * 43.0);
  vAlpha = tw * e;
  gl_PointSize = uSize * uPR * (0.7 + aSeed * 0.6) / max(0.6, -mv.z * 0.28);
}
`;

const SPHERE_FRAG = /* glsl */ `
precision mediump float;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float a = smoothstep(0.5, 0.08, d) * vAlpha;
  gl_FragColor = vec4(vColor * a, a);
}
`;

const STAR_VERT = /* glsl */ `
attribute float aSeed;
attribute float aDepth;
uniform float uTime, uPR;
varying float vA;
void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.05 + aSeed * 20.0) * 0.15 * aDepth;
  p.y += cos(uTime * 0.04 + aSeed * 26.0) * 0.12 * aDepth;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vA = (0.25 + 0.55 * abs(sin(uTime * (0.6 + aSeed) + aSeed * 40.0))) * aDepth;
  gl_PointSize = (0.8 + aSeed * 1.6) * uPR;
}
`;
const STAR_FRAG = /* glsl */ `
precision mediump float;
varying float vA;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.1, length(uv)) * vA;
  gl_FragColor = vec4(vec3(0.55, 0.8, 1.0) * a, a);
}
`;

function glowTexture(inner: string, outer: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(128, 128, 4, 128, 128, 128);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export default function ParticleSphere({ state, introKey }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const introRef = useRef(introKey);
  const [dbg, setDbg] = useState<{ html: string } | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    } catch {
      mount.innerHTML = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:13px;padding:24px;text-align:center">WebGL unavailable — voice chat still works on the right.</div>`;
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;
    const COUNT = isMobile ? 12000 : 30000;

    renderer.setClearColor(0x02040c, 1);
    // FIX: canvas element needs explicit CSS size, else it displays at
    // buffer size (2x on Retina) and overflows the container.
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
    camera.position.set(0, 0, 5.2);
    camera.lookAt(0, 0, 0);

    const rnd = mulberry32(21);
    // --- sphere points: 68% shell + 32% warm core ---
    const pos = new Float32Array(COUNT * 3);
    const start = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT);
    const core = new Float32Array(COUNT);
    const R = 1.18;
    for (let i = 0; i < COUNT; i++) {
      const isCore = rnd() < 0.32;
      let x = 0, y = 0, z = 0;
      if (isCore) {
        const r = R * 0.55 * Math.cbrt(rnd());
        const th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1);
        x = r * Math.sin(ph) * Math.cos(th); y = r * Math.cos(ph); z = r * Math.sin(ph) * Math.sin(th);
      } else {
        // fibonacci shell + jitter
        const k = i + 0.5, ga = Math.PI * (3 - Math.sqrt(5));
        const yy = 1 - (k / COUNT) * 2;
        const rad = Math.sqrt(Math.max(0, 1 - yy * yy));
        const th = ga * k;
        const j = 0.03;
        x = Math.cos(th) * rad * R + (rnd() - 0.5) * j;
        y = yy * R + (rnd() - 0.5) * j;
        z = Math.sin(th) * rad * R + (rnd() - 0.5) * j;
      }
      pos.set([x, y, z], i * 3);
      const a = rnd() * Math.PI * 2, rr = 2.6 + rnd() * 1.6;
      start.set([Math.cos(a) * rr, (rnd() - 0.5) * 3, Math.sin(a) * rr - 0.5], i * 3);
      seed[i] = rnd();
      core[i] = isCore ? 0.65 + rnd() * 0.35 : rnd() * 0.15;
    }
    const sgeo = new THREE.BufferGeometry();
    sgeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    sgeo.setAttribute("aStart", new THREE.BufferAttribute(start, 3));
    sgeo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    sgeo.setAttribute("aCore", new THREE.BufferAttribute(core, 1));
    const smat = new THREE.ShaderMaterial({
      vertexShader: SPHERE_VERT, fragmentShader: SPHERE_FRAG,
      uniforms: {
        uTime: { value: 0 }, uPR: { value: 1 }, uSize: { value: 2.6 },
        uIntro: { value: 0 }, uSuck: { value: 0 }, uSwirl: { value: 0 },
        uVoice: { value: 0 }, uPeak: { value: 0 }, uPulse: { value: 0 }, uBreathe: { value: 0 },
      },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const sphere = new THREE.Points(sgeo, smat);
    const rig = new THREE.Group();
    rig.add(sphere);
    rig.position.set(0, 0, 0); // exact center — never offset
    scene.add(rig);

    // --- stars ---
    const SN = isMobile ? 900 : 2600;
    const spos = new Float32Array(SN * 3);
    const sseed = new Float32Array(SN);
    const sdepth = new Float32Array(SN);
    for (let i = 0; i < SN; i++) {
      spos.set([(rnd() - 0.5) * 22, (rnd() - 0.5) * 13, -4 - rnd() * 10], i * 3);
      sseed[i] = rnd(); sdepth[i] = 0.3 + rnd() * 0.7;
    }
    const stgeo = new THREE.BufferGeometry();
    stgeo.setAttribute("position", new THREE.BufferAttribute(spos, 3));
    stgeo.setAttribute("aSeed", new THREE.BufferAttribute(sseed, 1));
    stgeo.setAttribute("aDepth", new THREE.BufferAttribute(sdepth, 1));
    const stmat = new THREE.ShaderMaterial({
      vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
      uniforms: { uTime: { value: 0 }, uPR: { value: 1 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    scene.add(new THREE.Points(stgeo, stmat));

    // --- nebula sprites ---
    const nebs: { mesh: THREE.Sprite; bx: number; sp: number; ph: number }[] = [];
    const nebCols: [string, string][] = [
      ["rgba(30,90,200,0.20)", "rgba(0,0,0,0)"],
      ["rgba(120,60,200,0.14)", "rgba(0,0,0,0)"],
      ["rgba(220,120,50,0.10)", "rgba(0,0,0,0)"],
    ];
    nebCols.forEach(([a, b], i) => {
      const m = new THREE.SpriteMaterial({ map: glowTexture(a, b), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const sp = new THREE.Sprite(m);
      const s = 9 + i * 3;
      sp.scale.set(s, s, 1);
      sp.position.set(-5 + i * 4.5, 2 - i * 2.2, -9);
      scene.add(sp);
      nebs.push({ mesh: sp, bx: sp.position.x, sp: 0.12 + i * 0.05, ph: i * 2.1 });
    });

    // --- shooting star (single recycled streak) ---
    const SH = 14;
    const shPos = new Float32Array(SH * 3);
    const shGeo = new THREE.BufferGeometry();
    shGeo.setAttribute("position", new THREE.BufferAttribute(shPos, 3));
    const shMat = new THREE.PointsMaterial({ color: 0xbfe9ff, size: 3.2, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false });
    const shooter = new THREE.Points(shGeo, shMat);
    shooter.visible = false;
    scene.add(shooter);
    let shootT = -1, nextShoot = 5 + rnd() * 6;
    let shootFrom = { x: 0, y: 0 }, shootTo = { x: 0, y: 0 };

    const R_WORLD = 1.18;
    const resize = () => {
      const wpx = mount.clientWidth, hpx = mount.clientHeight;
      if (!wpx || !hpx) return;
      renderer.setSize(wpx, hpx, false);
      const pr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(pr);
      smat.uniforms.uPR.value = pr;
      (stmat.uniforms.uPR as { value: number }).value = pr;
      camera.aspect = wpx / hpx;
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      // sphere diameter = 55% of min(container) — exact center, never cropped
      const dist = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
      const worldPerPx = (2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / hpx;
      rig.scale.setScalar((0.55 * Math.min(wpx, hpx) * worldPerPx) / (2 * R_WORLD));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // intro state
    let introT = reduced ? 99 : 0;
    let pulse = 0;
    const damp = { suck: 0, swirl: 0, voice: 0, peak: 0, breathe: 0 };
    let rotY = 0, rotSpeed = 0.12;
    let visible = true;
    const onVis = () => { visible = !document.hidden; };
    document.addEventListener("visibilitychange", onVis);

    let raf = 0, last = performance.now(), fpsAcc = 0, fpsN = 0, fpsT = performance.now(), lowT = 0;
    let drawn = COUNT;
    const T_MAX = 3600;

    // temporary D-key diagnostics: crosshair + sizing numbers
    const dbgRefs = { renderer, camera, rig, mount, canvas: renderer.domElement };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "d" && e.key !== "D") return;
      const cvs = dbgRefs.canvas;
      const mr = dbgRefs.mount.getBoundingClientRect();
      const cr = cvs.getBoundingClientRect();
      const v = new THREE.Vector3(0, 0, 0).project(dbgRefs.camera);
      const sx = (v.x * 0.5 + 0.5) * mr.width;
      const sy = (-v.y * 0.5 + 0.5) * mr.height;
      setDbg((p) => (p ? null : { html:
        `container=${mr.width.toFixed(0)}x${mr.height.toFixed(0)} ` +
        `canvas.attr=${cvs.width}x${cvs.height} canvas.css=${cvs.clientWidth}x${cvs.clientHeight} ` +
        `canvasRect=${cr.width.toFixed(0)}x${cr.height.toFixed(0)}@${cr.left.toFixed(0)},${cr.top.toFixed(0)} ` +
        `mountRect=${mr.width.toFixed(0)}x${mr.height.toFixed(0)}@${mr.left.toFixed(0)},${mr.top.toFixed(0)} ` +
        `dpr=${window.devicePixelRatio} rendererPR=${dbgRefs.renderer.getPixelRatio()} cam=${dbgRefs.camera.type}/${dbgRefs.camera.aspect.toFixed(3)} ` +
        `camPos=${dbgRefs.camera.position.toArray().map((n: number) => n.toFixed(2)).join(",")} ` +
        `rig=${dbgRefs.rig.position.toArray().join(",")} projCenter=${sx.toFixed(0)},${sy.toFixed(0)}` }));
    };
    window.addEventListener("keydown", onKey);

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible) { last = now; return; }
      const rawDt = Math.max(0, (now - last) / 1000); // wall-clock: intro stays 3s on slow devices
      const dt = Math.min(0.1, rawDt);
      last = now;
      const t = (now / 1000) % T_MAX;
      const st = stateRef.current;

      // intro progress (~1.2s wall-clock) then soft pulse
      if (introT < 1.8) {
        introT += reduced ? 99 : rawDt;
        if (introT >= 1.5 && pulse <= 0) pulse = 0.0001;
      }
      const intro = reduced ? 1 : Math.min(1, introT / 1.2);
      if (pulse > 0) {
        pulse += rawDt * 1.4;
        if (pulse > 1.2) pulse = 0;
      }
      const uPulse = pulse > 0 ? Math.sin(Math.min(1, pulse) * Math.PI) : 0;

      // eased state targets
      const mic = audioBus.micLevel, tts = audioBus.ttsLevel;
      const want = {
        suck: st === "listening" ? Math.min(1, 0.35 + mic * 1.4) : 0,
        swirl: st === "thinking" ? 2.2 : 0.25,
        voice: st === "speaking" ? Math.min(1, 0.3 + tts * 1.5) : 0,
        peak: st === "speaking" ? Math.max(0, tts - 0.55) * 2 : 0,
        breathe: 0.5 + 0.5 * Math.sin(t * 1.1),
      };
      const k = 1 - Math.pow(0.002, dt);
      damp.suck += (want.suck - damp.suck) * k;
      damp.swirl += (want.swirl - damp.swirl) * k;
      damp.voice += (want.voice - damp.voice) * k;
      damp.peak += (want.peak - damp.peak) * (1 - Math.pow(0.0005, dt));
      damp.breathe += (want.breathe - damp.breathe) * k;
      rotSpeed = st === "thinking" ? 0.55 : st === "speaking" ? 0.2 : 0.12;
      if (!reduced) rotY += rotSpeed * dt;
      rig.rotation.y = rotY;
      rig.rotation.x = Math.sin(t * 0.23) * 0.05;

      const U = smat.uniforms;
      U.uTime.value = t; U.uIntro.value = intro;
      U.uSuck.value = damp.suck; U.uSwirl.value = damp.swirl;
      U.uVoice.value = damp.voice; U.uPeak.value = damp.peak;
      U.uPulse.value = uPulse; U.uBreathe.value = reduced ? 0 : damp.breathe;
      (stmat.uniforms.uTime as { value: number }).value = t;

      // nebula drift
      for (const n of nebs) n.mesh.position.x = n.bx + Math.sin(t * n.sp + n.ph) * 0.8;
      // shooting star
      if (t > nextShoot && shootT < 0) {
        shootT = 0;
        shootFrom = { x: 4 + rnd() * 5, y: 2 + rnd() * 3 };
        shootTo = { x: shootFrom.x - 6 - rnd() * 4, y: shootFrom.y - 2 - rnd() * 2 };
        nextShoot = t + 6 + rnd() * 9;
      }
      if (shootT >= 0) {
        shootT += dt * 1.6;
        shooter.visible = true;
        for (let i = 0; i < SH; i++) {
          const kk = Math.max(0, shootT - i * 0.02);
          const e = 1 - Math.pow(1 - Math.min(1, kk), 2);
          shPos[i * 3] = shootFrom.x + (shootTo.x - shootFrom.x) * e;
          shPos[i * 3 + 1] = shootFrom.y + (shootTo.y - shootFrom.y) * e;
          shPos[i * 3 + 2] = -6;
        }
        shGeo.attributes.position.needsUpdate = true;
        (shMat as THREE.PointsMaterial).opacity = Math.max(0, 0.9 * (1 - shootT));
        if (shootT > 1.4) { shootT = -1; shooter.visible = false; }
      }

      renderer.render(scene, camera);
      (window as unknown as { __sphereDbg?: object }).__sphereDbg = {
        intro: Math.round(intro * 100) / 100, drawn, rotY: Math.round(rotY * 100) / 100,
      };

      // fps + auto-degrade
      fpsAcc += 1 / Math.max(dt, 1e-4); fpsN++;
      if (now - fpsT > 2000) {
        const fps = fpsAcc / fpsN;
        fpsAcc = 0; fpsN = 0; fpsT = now;
        if (process.env.NODE_ENV === "development") console.info(`[sphere] ${Math.round(fps)}fps ${drawn}pts`);
        if (fps < 45 && drawn > 9000) {
          lowT++;
          if (lowT >= 2) {
            lowT = 0;
            drawn = Math.floor(drawn * 0.8);
            sgeo.setDrawRange(0, drawn);
          }
        } else lowT = 0;
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("keydown", onKey);
      scene.traverse((o) => {
        const mesh = o as THREE.Points;
        if (mesh.geometry) mesh.geometry.dispose();
        const m = mesh.material as THREE.Material | THREE.Material[];
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else if (m) m.dispose();
      });
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introKey]);

  return (
    <div ref={mountRef} className="absolute inset-0 h-full w-full" aria-hidden>
      {dbg && (
        <>
          <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px bg-red-500/80" />
          <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full bg-red-500/80" />
          <div className="pointer-events-none absolute left-1 top-1 max-w-full break-words bg-black/85 p-2 font-mono text-[10px] leading-relaxed text-lime-300">
            DBG {dbg.html}
          </div>
        </>
      )}
    </div>
  );
}
