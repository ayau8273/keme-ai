/**
 * Second interaction layer, modelled on the mechanics of prismscience.org
 * (own implementation, Keme AI palette):
 *  - inertial smooth scroll (Lenis)
 *  - sliding hover pill in the nav
 *  - headlines that rise in word by word
 *  - twinkling "ticks" in section corners
 *  - glowing sticks in dark sections that grow toward the pointer
 *  - drag-to-rotate for the hero figure
 *  - footer content that slides up as it is revealed
 * Under prefers-reduced-motion everything is static and fully visible.
 */
import Lenis from 'lenis';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
let RM = false; // reduced motion, set in setupPrism

/* ---------------- smooth scroll ---------------- */
let lenis = null;
export function setupSmoothScroll(reduced, offset = 76) {
  if (!reduced) lenis = new Lenis({ lerp: 0.095, wheelMultiplier: 1, smoothWheel: true, autoRaf: true });
  // in-page anchors: glide to the section, leaving room for the fixed nav
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
    const id = a.getAttribute('href');
    const el = id.length > 1 ? document.querySelector(id) : null;
    if (!el) return;
    e.preventDefault();
    scrollToEl(el, offset);
    history.replaceState(null, '', id);
  });
  return lenis;
}
export function scrollToEl(el, offset = 76) {
  if (lenis) lenis.scrollTo(el, { offset: -offset, duration: 1.2 });
  else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: 'auto' });
}
export const pauseScroll = (on) => { if (lenis) (on ? lenis.stop() : lenis.start()); };

/* ---------------- nav: pill that slides under the hovered link ---------------- */
export function setupNavPill(nav) {
  if (!nav) return;
  const pill = document.createElement('span');
  pill.className = 'nav__pill';
  pill.setAttribute('aria-hidden', 'true');
  nav.prepend(pill);
  const moveTo = (a, instant) => {
    if (!a) { pill.style.opacity = '0'; return; }
    if (instant) pill.style.transition = 'none';
    pill.style.opacity = '1';
    pill.style.width = `${a.offsetWidth}px`;
    pill.style.transform = `translateX(${a.offsetLeft}px)`;
    if (instant) { pill.offsetWidth; pill.style.transition = ''; }
  };
  let hovering = false;
  nav.addEventListener('pointerover', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    moveTo(a, !hovering && pill.style.opacity !== '1');
    hovering = true;
    nav.classList.add('is-hover');
  });
  nav.addEventListener('pointerleave', () => {
    hovering = false;
    nav.classList.remove('is-hover');
    moveTo(nav.querySelector('a.is-current'));
  });
  return { sync() { if (!hovering) moveTo(nav.querySelector('a.is-current')); } };
}

/* ---------------- headlines rising word by word ---------------- */
const splitIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    splitIO.unobserve(e.target);
  });
}, { rootMargin: '0px 0px -8% 0px' });

/** Wrap each word in a mask + inner span. Safe to call again after the text changes. */
export function splitHeading(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  let i = 0;
  nodes.forEach((n) => {
    const frag = document.createDocumentFragment();
    n.textContent.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
      const mask = document.createElement('span');
      mask.className = 'sw';
      const inner = document.createElement('span');
      inner.className = 'sw__i';
      inner.style.setProperty('--i', i++);
      inner.textContent = part;
      mask.appendChild(inner);
      frag.appendChild(mask);
    });
    n.replaceWith(frag);
  });
  if (!el.classList.contains('in')) splitIO.observe(el);
}

/* ---------------- ticks: twinkling dashes fading from a corner ---------------- */
function ticks(host) {
  const origin = host.dataset.ticks || 'top-right';
  const canvas = document.createElement('canvas');
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let dots = [], W = 0, H = 0, raf = 0, last = 0, visible = false;
  const reduced = RM;
  const build = () => {
    const r = host.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cw = 7, ch = 10, right = origin.endsWith('right'), top = origin.startsWith('top');
    dots = [];
    for (let x = 0; x < W; x += cw) {
      const fx = 1 - (right ? W - x : x) / W;
      for (let y = 0; y < H; y += ch) {
        const fy = 1 - (top ? y : H - y) / H;
        const p = fx * fy;
        if (Math.random() > p ** 1.25) continue;
        dots.push({ x, y, a: (0.2 + Math.random() * 0.8) * Math.min(1, p * 1.6), ph: Math.random() * 6.28 });
      }
    }
    draw(0);
  };
  const color = () => getComputedStyle(host).color;
  let fill = color();
  const draw = (t) => {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = fill;
    for (const d of dots) {
      ctx.globalAlpha = d.a * (t ? 0.55 + 0.45 * Math.sin(t * 0.0011 + d.ph) : 1);
      ctx.fillRect(d.x, d.y, 2, 6);
    }
    ctx.globalAlpha = 1;
  };
  const loop = (t) => {
    raf = visible ? requestAnimationFrame(loop) : 0;
    if (t - last < 90) return; // ~11 fps is plenty for a twinkle
    last = t;
    draw(t);
  };
  new ResizeObserver(() => { fill = color(); build(); }).observe(host);
  if (!reduced) new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(loop); }).observe(host);
}

/* ---------------- glowing sticks: vertical light bars, taller near the pointer ---------------- */
function sticks(host) {
  const canvas = document.createElement('canvas');
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const zone = host.closest('[data-sticks-zone]') || host.parentElement;
  const reduced = RM;
  let W = 0, H = 0, raf = 0, visible = false, t = 0, last = 0;
  let mx = -1, mxT = -1, lift = 0, liftT = 0;
  const gap = 9;
  const resize = () => {
    const r = host.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  };
  const hill = (x) => 0.35 + 0.25 * Math.sin(x * 4.1 + 1.3) + 0.18 * Math.sin(x * 9.7 + t * 0.25) + 0.12 * Math.sin(x * 23 - t * 0.4);
  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const n = Math.ceil(W / gap);
    for (let i = 0; i <= n; i++) {
      const x = i * gap;
      const u = x / W;
      let h = clamp(hill(u) * (0.75 + 0.25 * Math.sin(t * 0.7 + i * 0.37)), 0.04, 1);
      if (lift > 0.001) h = Math.min(1.15, h + lift * 0.7 * Math.exp(-(((x - mx) / 110) ** 2)));
      const top = H - h * H * 0.9;
      const g = ctx.createLinearGradient(0, H, 0, top);
      g.addColorStop(0, 'rgba(120,190,255,0.55)');
      g.addColorStop(0.55, 'rgba(70,140,240,0.22)');
      g.addColorStop(1, 'rgba(60,120,230,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, top, 1.6, H - top);
      ctx.globalAlpha = 0.18;
      ctx.fillRect(x - 3, top + (H - top) * 0.25, 7.6, (H - top) * 0.75);
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';
  };
  const loop = (now) => {
    raf = 0;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    t += dt;
    mx += (mxT - mx) * (1 - Math.pow(0.002, dt));
    lift += (liftT - lift) * (1 - Math.pow(0.01, dt));
    draw();
    if (visible) raf = requestAnimationFrame(loop);
  };
  new ResizeObserver(resize).observe(host);
  if (reduced) return;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) { last = 0; raf = requestAnimationFrame(loop); } }).observe(host);
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = host.getBoundingClientRect();
    mxT = e.clientX - r.left;
    if (mx < 0) mx = mxT;
    liftT = 1;
  });
  zone.addEventListener('pointerleave', () => { liftT = 0; });
}

/* ---------------- hero figure: drag to rotate, with inertia ---------------- */
export function dragRotate(stage, zone) {
  let rx = 0, ry = 0, vx = 0, vy = 0, drag = null, raf = 0, last = 0;
  const LIM = 32;
  const apply = () => {
    stage.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
    stage.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
  };
  const settle = (now) => {
    raf = 0;
    const dt = Math.min(0.032, (now - (last || now)) / 1000);
    last = now;
    if (!drag) {
      // spring back to rest, keeping a bit of the throw
      vx += (-38 * rx - 6.5 * vx) * dt;
      vy += (-38 * ry - 6.5 * vy) * dt;
      rx += vx * dt; ry += vy * dt;
      apply();
      if (Math.abs(rx) + Math.abs(ry) + Math.abs(vx) + Math.abs(vy) < 0.02) { rx = ry = vx = vy = 0; apply(); return; }
    }
    raf = requestAnimationFrame(settle);
  };
  zone.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, t: performance.now() };
    zone.setPointerCapture?.(e.pointerId);
    stage.classList.add('is-rotating');
  });
  zone.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const now = performance.now();
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    const dt = Math.max(0.008, (now - drag.t) / 1000);
    const k = 0.18;
    const ny = clamp(ry + dx * k, -LIM, LIM), nx = clamp(rx - dy * k, -LIM, LIM);
    vy = (ny - ry) / dt; vx = (nx - rx) / dt;
    ry = ny; rx = nx;
    drag = { x: e.clientX, y: e.clientY, t: now };
    apply();
  });
  const end = () => {
    if (!drag) return;
    drag = null;
    stage.classList.remove('is-rotating');
    vx = clamp(vx, -160, 160); vy = clamp(vy, -160, 160);
    last = 0;
    if (!raf) raf = requestAnimationFrame(settle);
  };
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
}

/* ---------------- footer reveal: content rises as the ending scrolls in ---------------- */
let ending = null, endingInner = null;
function updateEnding(vh) {
  if (!ending) return;
  const r = ending.getBoundingClientRect();
  const n = Math.min(ending.offsetHeight, vh);
  const p = clamp((vh - r.top) / n);
  endingInner.style.translate = `0 ${(0.28 * n * (1 - easeOut(p))).toFixed(1)}px`;
}

export function onScrollPrism() {
  updateEnding(window.innerHeight);
}

/**
 * @param {{ reducedMotion: boolean }} opts
 */
export function setupPrism({ reducedMotion }) {
  RM = reducedMotion;
  document.querySelectorAll('[data-ticks]').forEach(ticks);
  document.querySelectorAll('[data-sticks]').forEach(sticks);
  if (reducedMotion) return;
  ending = document.querySelector('.ending');
  endingInner = ending?.querySelector('.final__grid') || null;
  if (!endingInner) ending = null;
}

/** Dynamically rendered hosts (e.g. agent cards re-rendered on language change). */
export function mountTicks(root) {
  root.querySelectorAll('[data-ticks]:not(:has(canvas))').forEach((h) => ticks(h));
}
export { finePointer };
