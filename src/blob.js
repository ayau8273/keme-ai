import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// Ashima 3D simplex noise
const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const lerp = (a, b, t) => a + (b - a) * t;

// How far the displaced surface can reach beyond the base radius.
export const BLOB_MARGIN = 1.34;

function speckMaterial(uniforms, color, kind) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: uniforms.uTime,
      uPx: uniforms.uPx,
      uScale: uniforms.uScale,
      uAlpha: kind === 'plume' ? uniforms.uPlume : uniforms.uRing,
      uColor: { value: new THREE.Color(color) },
    },
    vertexShader: /* glsl */ `
      attribute vec4 seed;
      uniform float uTime; uniform float uPx; uniform float uScale;
      varying float vAlpha;
      void main(){
        vec3 p = position;
        float t = uTime * seed.y;
        ${kind === 'plume' ? `
        if (seed.w > 0.5) {
          float life = fract(seed.x + t * 0.18);
          p.y = 0.7 + life * 1.15;
          p.x += sin(t * 1.3 + seed.z) * 0.08 * life;
          p.z += cos(t * 1.1 + seed.z) * 0.08 * life;
          vAlpha = smoothstep(0.0, 0.15, life) * (1.0 - smoothstep(0.55, 1.0, life));
        } else {
          p += vec3(sin(t + seed.z), cos(t * 0.8 + seed.z), sin(t * 0.6 + seed.z * 2.0)) * 0.08;
          vAlpha = 0.35 + 0.35 * sin(t * 2.0 + seed.z);
        }` : `
          vAlpha = 0.45 + 0.4 * sin(t * 3.0 + seed.z);
        `}
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (${kind === 'plume' ? '1.6 + seed.x * 2.2' : '1.3 + seed.x * 1.9'}) * uPx * uScale * (9.0 / -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uAlpha;
      varying float vAlpha;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        gl_FragColor = vec4(uColor, vAlpha * uAlpha * smoothstep(0.5, 0.1, d) * 0.8);
      }`,
  });
}

export function createBlob(canvas, { reducedMotion = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    canvas.style.display = 'none';
    return null;
  }
  const isSmall = window.innerWidth < 760;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const l1 = new THREE.DirectionalLight(0x8ff0dc, 1.9); l1.position.set(-3, 4, 5); scene.add(l1);
  const l2 = new THREE.DirectionalLight(0x9d8fff, 1.7); l2.position.set(4, -2, 3); scene.add(l2);
  const l3 = new THREE.DirectionalLight(0x6fc0ff, 1.0); l3.position.set(0, -4, -2); scene.add(l3);
  scene.add(new THREE.AmbientLight(0xffffff, 0.2));

  const uniforms = {
    uTime: { value: 0 },
    uAmp: { value: 0.24 },
    uFreq: { value: 0.9 },
    uPx: { value: renderer.getPixelRatio() },
    uScale: { value: 1 },
    uPlume: { value: 1 },
    uRing: { value: 0.6 },
  };

  // ---------- the blob ----------
  const geo = new THREE.IcosahedronGeometry(1, isSmall ? 48 : 80);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.2,
    metalness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    iridescence: 0.7,
    iridescenceIOR: 1.5,
    iridescenceThicknessRange: [300, 950],
    sheen: 0.5,
    sheenColor: new THREE.Color(0x7d6cff),
    sheenRoughness: 0.45,
    envMapIntensity: 0.3,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uAmp = uniforms.uAmp;
    shader.uniforms.uFreq = uniforms.uFreq;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uAmp; uniform float uFreq;
        varying float vDisp;
        ${NOISE}
        vec3 displace(vec3 p){
          vec3 q = p * uFreq;
          float n = snoise(q + vec3(0.0, uTime * 0.22, uTime * 0.12));
          n += 0.22 * snoise(q * 2.1 - vec3(uTime * 0.17, 0.0, uTime * 0.1));
          return p + normalize(p) * n * uAmp;
        }`)
      .replace('#include <beginnormal_vertex>', `
        vec3 tangentA = normalize(cross(normal, abs(normal.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
        vec3 tangentB = normalize(cross(normal, tangentA));
        float eps = 0.006;
        vec3 dP0 = displace(position);
        vec3 dP1 = displace(position + tangentA * eps);
        vec3 dP2 = displace(position + tangentB * eps);
        vec3 objectNormal = normalize(cross(dP1 - dP0, dP2 - dP0));
        vDisp = length(dP0) - 1.0;
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(tangent.xyz);
        #endif`)
      .replace('#include <begin_vertex>', 'vec3 transformed = dP0;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vDisp;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 cLow = vec3(0.0, 0.33, 0.32);
        vec3 cMid = vec3(0.04, 0.56, 0.62);
        vec3 cHigh = vec3(0.38, 0.40, 0.95);
        float k = smoothstep(-0.25, 0.32, vDisp);
        diffuseColor.rgb = mix(mix(cLow, cMid, smoothstep(0.0, 0.55, k)), cHigh, smoothstep(0.6, 1.0, k));`);
  };
  const mesh = new THREE.Mesh(geo, mat);

  const group = new THREE.Group();
  scene.add(group);

  // ---------- soft aura behind the blob ----------
  const gc = document.createElement('canvas');
  gc.width = gc.height = 256;
  const g2 = gc.getContext('2d');
  const grad = g2.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(60,200,180,0.6)');
  grad.addColorStop(0.4, 'rgba(110,200,230,0.28)');
  grad.addColorStop(0.72, 'rgba(160,215,240,0.08)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g2.fillStyle = grad;
  g2.fillRect(0, 0, 256, 256);
  const glowTex = new THREE.CanvasTexture(gc);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, depthTest: false, opacity: 0.85 }));
  glow.scale.setScalar(4.4);
  glow.position.z = -1.6;
  glow.renderOrder = -1;
  group.add(glow);
  group.add(mesh);

  // ---------- particle plume (rises above the blob) ----------
  const COUNT = isSmall ? 350 : 700;
  const pPos = new Float32Array(COUNT * 3);
  const pSeed = new Float32Array(COUNT * 4);
  for (let i = 0; i < COUNT; i++) {
    const plume = Math.random() < 0.6;
    if (plume) {
      const r = Math.pow(Math.random(), 1.6) * 0.55;
      const a = Math.random() * Math.PI * 2;
      pPos.set([Math.cos(a) * r, 0.6 + Math.random() * 2.6, Math.sin(a) * r], i * 3);
    } else {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(1.38 + Math.random() * 0.36);
      pPos.set([v.x, v.y, v.z], i * 3);
    }
    pSeed.set([Math.random(), 0.15 + Math.random() * 0.45, Math.random() * Math.PI * 2, plume ? 1 : 0], i * 4);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('seed', new THREE.BufferAttribute(pSeed, 4));
  const plume = new THREE.Points(pGeo, speckMaterial(uniforms, 0x0f7d6c, 'plume'));
  group.add(plume);

  // ---------- orbit rings of specks ----------
  const rings = [];
  const ringSpec = [
    { r: 1.5, n: isSmall ? 240 : 380, tilt: [1.22, 0.32], speed: 0.06 },
    { r: 1.86, n: isSmall ? 300 : 480, tilt: [1.08, -0.26], speed: -0.04 },
  ];
  ringSpec.forEach((s) => {
    const pos = new Float32Array(s.n * 3);
    const seed = new Float32Array(s.n * 4);
    for (let i = 0; i < s.n; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = s.r + (Math.random() - 0.5) * 0.12;
      pos.set([Math.cos(a) * rr, (Math.random() - 0.5) * 0.05, Math.sin(a) * rr], i * 3);
      seed.set([Math.random(), 0.3 + Math.random() * 0.6, Math.random() * 6.28, 0], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
    const pts = new THREE.Points(g, speckMaterial(uniforms, 0x0f7d6c, 'ring'));
    const holder = new THREE.Group();
    holder.rotation.set(s.tilt[0], 0, s.tilt[1]);
    holder.add(pts);
    group.add(holder);
    rings.push({ pts, speed: s.speed });
  });

  // ---------- state (all in CSS pixels, viewport-relative) ----------
  const state = { cx: window.innerWidth / 2, cy: window.innerHeight * 1.1, r: 150, plume: 1, ring: 0.5 };
  const target = { ...state };
  const rot = { x: 0.2, y: 0, vx: 0, vy: 0 };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let width = 1, height = 1, wpp = 0.01;
  let active = true;
  let dragging = false;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const visH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    wpp = visH / height; // world units per CSS pixel at z = 0
  }
  resize();
  window.addEventListener('resize', resize);

  let compiled = false;
  const ready = (renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve())
    .catch(() => {})
    .then(() => { compiled = true; });

  const clock = new THREE.Clock();
  let raf = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!active || !compiled) return;
    uniforms.uTime.value += dt * (reducedMotion ? 0.25 : 1);

    // fast follow: targets already move smoothly with scroll, this only removes wheel jitter
    const k = 1 - Math.pow(0.000002, dt);
    for (const key in state) state[key] = lerp(state[key], target[key], k);

    pointer.sx = lerp(pointer.sx, pointer.x, 1 - Math.pow(0.02, dt));
    pointer.sy = lerp(pointer.sy, pointer.y, 1 - Math.pow(0.02, dt));

    if (!dragging) {
      rot.vx *= Math.pow(0.04, dt);
      rot.vy *= Math.pow(0.04, dt);
      rot.y += rot.vy * dt + (reducedMotion ? 0 : dt * 0.08);
      rot.x += rot.vx * dt;
      rot.x = lerp(rot.x, 0.2, 1 - Math.pow(0.5, dt));
    }

    group.position.set((state.cx - width / 2) * wpp, -(state.cy - height / 2) * wpp, 0);
    group.scale.setScalar(state.r * wpp);
    mesh.rotation.set(rot.x + pointer.sy * 0.18, rot.y + pointer.sx * 0.3, 0);
    plume.rotation.y = rot.y * 0.25;
    rings.forEach((r) => { r.pts.rotation.y += dt * r.speed * (reducedMotion ? 0.2 : 1); });
    uniforms.uScale.value = Math.max(0.7, Math.min(1.25, state.r / 170));
    uniforms.uPlume.value = state.plume;
    uniforms.uRing.value = state.ring;

    renderer.render(scene, camera);
  }
  frame();

  return {
    ready,
    setTarget(t) { Object.assign(target, t); },
    jumpTo(t) { Object.assign(state, t); Object.assign(target, t); },
    setPointer(nx, ny) { pointer.x = nx; pointer.y = ny; },
    setActive(v) { active = v; canvas.style.visibility = v ? 'visible' : 'hidden'; },
    /** visible circle of the blob in CSS px (current, eased) */
    circle() { return { cx: state.cx, cy: state.cy, r: state.r * BLOB_MARGIN }; },
    dragStart() { dragging = true; rot.vx = rot.vy = 0; },
    dragMove(dx, dy, dt) {
      const ry = dx * 0.006, rx = dy * 0.006;
      rot.y += ry; rot.x += rx;
      rot.vy = ry / Math.max(dt, 0.008); rot.vx = rx / Math.max(dt, 0.008);
    },
    dragEnd() { dragging = false; },
    destroy() { cancelAnimationFrame(raf); renderer.dispose(); },
  };
}
