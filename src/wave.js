/**
 * Keme AI footer wave: soft striped ribbons drawn by one fragment shader
 * (plain WebGL, no library). They drift on their own; while the left mouse
 * button (or a finger) is held, they bend toward the pointer and refract.
 * Returns null when WebGL is unavailable so the caller can fall back to SVG.
 */
const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uDpr;
uniform float uTime;
uniform vec2 uMouse;
uniform float uHold;
uniform float uHover;

// one ribbon: soft body + bright rims, rising from bottom-left to the right
float band(vec2 uv, float i, float t) {
  float x = uv.x;
  float base = 0.10 + 0.46 * smoothstep(-0.2, 1.15, x) - i * 0.085;
  float y = base
    + (0.07 + 0.02 * i) * sin(x * (2.2 + 0.45 * i) + t * (0.28 + 0.05 * i) + i * 1.3)
    + 0.025 * sin(x * 7.0 - t * 0.5 + i * 2.1);
  float w = (0.062 - i * 0.008) * (0.75 + 0.35 * sin(x * 3.4 + t * 0.37 + i * 0.8));
  float d = (uv.y - y) / w;
  float body = exp(-d * d * 0.9) * 0.5;
  float rim = exp(-pow(abs(d) - 0.95, 2.0) * 22.0) * 0.55;
  float glow = exp(-d * d * 0.05) * 0.035;
  return body + rim + glow;
}

vec3 field(vec2 uv, float t) {
  vec3 c = vec3(0.0);
  c += vec3(0.80, 0.91, 1.00) * band(uv, 0.0, t);
  c += vec3(0.46, 0.70, 0.99) * band(uv, 1.0, t);
  c += vec3(0.16, 0.42, 0.93) * band(uv, 2.0, t);
  c += vec3(0.18, 0.80, 0.82) * band(uv, 3.0, t);
  return c;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float asp = uRes.x / uRes.y;
  vec2 dm = (uv - uMouse) * vec2(asp, 1.0);
  float r2 = dot(dm, dm);
  float pull = uHold * exp(-r2 * 3.2) + uHover * exp(-r2 * 10.0) * 0.12;

  // sample from further away near the pointer -> ribbons appear drawn toward it
  vec2 w = uv + (uv - uMouse) * vec2(0.55, 1.35) * pull;
  vec2 off = (dm / (sqrt(r2) + 0.001)) * pull * 0.02 / vec2(asp, 1.0);

  float t = uTime;
  vec3 c = vec3(field(w + off, t).r, field(w, t).g, field(w - off, t).b);
  c *= 1.0 + pull * 0.7;

  float stripe = 0.8 + 0.2 * sin(gl_FragCoord.y / uDpr * 2.1);
  float fade = smoothstep(1.0, 0.5, uv.y) * smoothstep(0.0, 0.06, uv.x) * smoothstep(1.0, 0.94, uv.x);
  c = clamp(c * stripe * fade, 0.0, 1.0);
  float a = max(c.r, max(c.g, c.b));
  gl_FragColor = vec4(c, a);
}`;

/**
 * @param {HTMLElement} root  container; a <canvas> is appended to it
 * @param {{ zones?: HTMLElement[], reducedMotion?: boolean }} opts
 *   zones: elements whose pointer events drive the wave (default: root)
 */
export function createWave(root, { zones = [root], reducedMotion = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'wave__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true });
  if (!gl) return null;

  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  };
  const vs = sh(gl.VERTEX_SHADER, VERT);
  const fs = sh(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = Object.fromEntries(['uRes', 'uDpr', 'uTime', 'uMouse', 'uHold', 'uHover'].map((n) => [n, gl.getUniformLocation(prog, n)]));

  root.appendChild(canvas);

  let dpr = 1, W = 1, H = 1;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width * dpr));
    H = Math.max(1, Math.round(r.height * dpr));
    canvas.width = W; canvas.height = H;
    gl.viewport(0, 0, W, H);
    draw();
  };

  // pointer state (canvas-normalised, y up)
  const mouse = { x: 0.6, y: 0.4, tx: 0.6, ty: 0.4 };
  let hold = 0, holdT = 0, hover = 0, hoverT = 0;
  let t = 0, last = 0, raf = 0, visible = false;

  const toLocal = (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.tx = (e.clientX - r.left) / r.width;
    mouse.ty = 1 - (e.clientY - r.top) / r.height;
  };

  function draw() {
    gl.uniform2f(U.uRes, W, H);
    gl.uniform1f(U.uDpr, dpr);
    gl.uniform1f(U.uTime, t);
    gl.uniform2f(U.uMouse, mouse.x, mouse.y);
    gl.uniform1f(U.uHold, hold);
    gl.uniform1f(U.uHover, hover);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    if (!reducedMotion) t += dt;
    const k = 1 - Math.pow(0.002, dt);
    mouse.x += (mouse.tx - mouse.x) * k;
    mouse.y += (mouse.ty - mouse.y) * k;
    hold += (holdT - hold) * (1 - Math.pow(holdT > hold ? 0.0008 : 0.06, dt));
    hover += (hoverT - hover) * k;
    draw();
    const settling = Math.abs(holdT - hold) > 0.002 || Math.abs(mouse.tx - mouse.x) > 0.001;
    if (visible && (!reducedMotion || settling)) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf && visible) { last = 0; raf = requestAnimationFrame(frame); } };

  const down = (e) => {
    if (e.button !== 0) return;
    if (!e.target.closest('a, button, input, select, textarea, label')) e.preventDefault(); // no text selection while dragging
    toLocal(e); holdT = 1; kick();
  };
  const move = (e) => { toLocal(e); hoverT = e.pointerType === 'mouse' ? 1 : 0; kick(); };
  const up = () => { holdT = 0; kick(); };
  const leave = () => { hoverT = 0; if (!holdT) kick(); };

  zones.forEach((z) => {
    z.addEventListener('pointerdown', down);
    z.addEventListener('pointermove', move);
    z.addEventListener('pointerleave', leave);
  });
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  window.addEventListener('blur', up);

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); });
  io.observe(canvas);
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  return {
    destroy() {
      io.disconnect(); ro.disconnect(); cancelAnimationFrame(raf);
      zones.forEach((z) => { z.removeEventListener('pointerdown', down); z.removeEventListener('pointermove', move); z.removeEventListener('pointerleave', leave); });
      window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); window.removeEventListener('blur', up);
      canvas.remove();
    },
  };
}
