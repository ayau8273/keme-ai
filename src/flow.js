/**
 * Keme AI "flow": soft light-blue ribbons drawn as SVG paths.
 * - progress 0: a calm wave (hero)
 * - progress 1: the same ribbons gather on the left (tasks) and split on the right:
 *   three into the agent lane, one into the person lane (section 2)
 * No 3D, no canvas: ~4 paths recalculated per frame while visible.
 */
const NS = 'http://www.w3.org/2000/svg';
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

const RIBBONS = {
  hero: [
    { y0: 0.40, w0: 0.17, yIn: 0.46, yOut: 0.29, w1: 0.075, c: ['#d9eefc', '#aed8f7'] },
    { y0: 0.48, w0: 0.13, yIn: 0.49, yOut: 0.355, w1: 0.06, c: ['#bde0f9', '#74b6f2'] },
    { y0: 0.555, w0: 0.095, yIn: 0.52, yOut: 0.415, w1: 0.05, c: ['#97cbf6', '#2f7fe6'] },
    { y0: 0.615, w0: 0.06, yIn: 0.55, yOut: 0.74, w1: 0.045, c: ['#b2f0ea', '#1fb8c0'] },
  ],
  band: [
    { y0: 0.42, w0: 0.34, c: ['#e2f2fd', '#bfe1f9'] },
    { y0: 0.55, w0: 0.26, c: ['#c8e5fa', '#8cc6f5'] },
    { y0: 0.66, w0: 0.18, c: ['#a7d3f7', '#4a95ec'] },
    { y0: 0.74, w0: 0.1, c: ['#bff2ec', '#36c6cb'] },
  ],
};

let uid = 0;

/**
 * @param {HTMLElement} root  container; an <svg> is appended to it
 * @param {{ variant?: 'hero'|'band', progress?: number, reducedMotion?: boolean }} opts
 */
export function createFlow(root, { variant = 'hero', progress = 0, reducedMotion = false } = {}) {
  const W = variant === 'band' ? 1440 : 600;
  const H = variant === 'band' ? 300 : 460;
  const ribbons = RIBBONS[variant];
  const id = `kf${uid++}`;

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', variant === 'band' ? 'none' : 'xMidYMid meet');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('flow__svg');
  const defs = document.createElementNS(NS, 'defs');
  // soft fade at both ends
  defs.innerHTML = `
    <linearGradient id="${id}-fade" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/>
      <stop offset="0.12" stop-color="#fff" stop-opacity="1"/>
      <stop offset="0.88" stop-color="#fff" stop-opacity="1"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <mask id="${id}-mask"><rect width="${W}" height="${H}" fill="url(#${id}-fade)"/></mask>
    ${ribbons.map((r, i) => `
      <linearGradient id="${id}-g${i}" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="${r.c[0]}"/><stop offset="1" stop-color="${r.c[1]}"/>
      </linearGradient>`).join('')}`;
  svg.appendChild(defs);
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('mask', `url(#${id}-mask)`);
  const paths = ribbons.map((_, i) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('fill', `url(#${id}-g${i})`);
    p.classList.add('flow__ribbon');
    g.appendChild(p);
    return p;
  });
  svg.appendChild(g);
  root.prepend(svg);

  let target = progress;
  let p = progress;
  let t = 0;
  let visible = false;
  let raf = 0;
  let last = 0;
  const N = variant === 'band' ? 48 : 56;

  const toPath = (top, bot) => {
    const seg = (pts, start) => {
      let d = start ? `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}` : `L${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
        d += `Q${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
      }
      const e = pts[pts.length - 1];
      return `${d}L${e[0].toFixed(1)},${e[1].toFixed(1)}`;
    };
    return `${seg(top, true)}${seg(bot.reverse(), false)}Z`;
  };

  function draw() {
    ribbons.forEach((r, i) => {
      const top = [], bot = [];
      for (let k = 0; k <= N; k++) {
        const x = k / N;
        let y, w;
        if (variant === 'band') {
          y = r.y0 + 0.1 * Math.sin(x * Math.PI * 2 * 1.2 + t * 0.35 + i * 0.9) + 0.03 * Math.sin(x * 9 - t * 0.5 + i);
          w = r.w0 * (0.8 + 0.2 * Math.sin(x * 4 + t * 0.4 + i));
        } else {
          const wave = r.y0 + 0.07 * Math.sin(x * Math.PI * 1.7 + t * 0.55 + i * 0.8) * (0.75 + 0.25 * Math.sin(t * 0.27 + i));
          const route = lerp(r.yIn, r.yOut, smooth(0.3, 0.72, x)) + 0.01 * Math.sin(x * 8 + t * 0.8 + i);
          y = lerp(wave, route, p);
          const w0 = r.w0 * (0.86 + 0.14 * Math.sin(x * 5 + t * 0.6 + i)) * Math.pow(Math.sin(Math.PI * x), 0.55);
          w = lerp(w0, r.w1, p);
        }
        top.push([x * W, (y - w / 2) * H]);
        bot.push([x * W, (y + w / 2) * H]);
      }
      paths[i].setAttribute('d', toPath(top, bot));
    });
    root.style.setProperty('--flow-p', p.toFixed(3));
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    if (!reducedMotion) t += dt;
    p = lerp(p, target, 1 - Math.pow(0.0005, dt || 0.016));
    if (Math.abs(p - target) < 0.001) p = target;
    draw();
    if (visible && (!reducedMotion || p !== target)) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf && visible) { last = 0; raf = requestAnimationFrame(frame); } };

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); });
  io.observe(root);
  draw();

  return {
    setProgress(v) {
      target = Math.min(1, Math.max(0, v));
      if (reducedMotion) { p = target; draw(); } else kick();
    },
    destroy() { io.disconnect(); cancelAnimationFrame(raf); svg.remove(); },
  };
}
