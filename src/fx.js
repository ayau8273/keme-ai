/**
 * Small interaction layer: scroll-driven reading text and parallax,
 * pointer tilt on cards, magnetic buttons, and the "hold and drag" cursor pill.
 * Everything is a no-op under prefers-reduced-motion (content stays fully visible).
 */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

/* ---------- Reading text: words light up as the block scrolls into view ---------- */
const reading = new Set();

/** Wrap every word of `el` in a span (keeps inline markup like <em>). Call after each i18n render. */
export function splitWords(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((n) => {
    const parts = n.textContent.split(/(\s+)/);
    const frag = document.createDocumentFragment();
    parts.forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
      const s = document.createElement('span');
      s.className = 'rw';
      s.textContent = part;
      frag.appendChild(s);
    });
    n.replaceWith(frag);
  });
  el._words = [...el.querySelectorAll('.rw')];
  el._last = -1;
  reading.add(el);
}

function updateReading(vh) {
  reading.forEach((el) => {
    if (!el.isConnected) { reading.delete(el); return; }
    const r = el.getBoundingClientRect();
    if (r.bottom < -vh || r.top > vh * 2) return;
    // 0 when the block's top reaches 90% of the viewport, 1 when it reaches 45%
    const prog = clamp((vh * 0.9 - r.top) / (vh * 0.45));
    const n = el._words.length;
    const lit = prog * (n + 3);
    const key = Math.round(lit * 20);
    if (key === el._last) return;
    el._last = key;
    // a soft front about three words wide
    el._words.forEach((w, i) => { w.style.opacity = (0.18 + 0.82 * clamp((lit - i) / 3)).toFixed(3); });
  });
}

/* ---------- Parallax: data-parallax="0.08" shifts the element against the scroll ---------- */
function updateParallax(vh) {
  document.querySelectorAll('[data-parallax]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.bottom < -200 || r.top > vh + 200) return;
    const f = parseFloat(el.dataset.parallax) || 0.08;
    const off = (r.top + r.height / 2 - vh / 2) * f;
    el.style.translate = `0 ${off.toFixed(1)}px`;
  });
}

/* ---------- Scroll progress for a section, written to a CSS variable ---------- */
const progressEls = [];
/** @param {HTMLElement} el @param {string} prop CSS variable, e.g. '--pp' */
export function trackProgress(el, prop, { start = 0.95, span = 0.55 } = {}) { progressEls.push({ el, prop, start, span }); }
function updateProgress(vh) {
  progressEls.forEach(({ el, prop, start, span }) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty(prop, clamp((vh * start - r.top) / (vh * span)).toFixed(3));
  });
}

export function onScrollFx() {
  const vh = window.innerHeight;
  updateReading(vh);
  updateParallax(vh);
  updateProgress(vh);
}

/* ---------- Tilt + spotlight on [data-tilt] (delegated, so re-rendered cards work) ---------- */
function setupTilt() {
  let cur = null;
  const reset = (el) => { el.style.transform = ''; el.style.transition = ''; el.classList.remove('is-tilt'); };
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target.closest('[data-tilt]');
    if (cur && cur !== el) { reset(cur); cur = null; }
    if (!el) return;
    cur = el;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    const max = parseFloat(el.dataset.tilt) || 5;
    el.classList.add('is-tilt');
    el.style.transition = 'transform .18s ease-out';
    el.style.transform = `perspective(900px) rotateX(${((0.5 - y) * max).toFixed(2)}deg) rotateY(${((x - 0.5) * max).toFixed(2)}deg)`;
    el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
  }, { passive: true });
  document.addEventListener('pointerleave', () => { if (cur) { reset(cur); cur = null; } });
}

/* ---------- Magnetic buttons: [data-magnetic] drift toward the cursor ---------- */
function setupMagnetic() {
  let cur = null;
  const release = (el) => { el.style.translate = ''; el.classList.remove('is-mag'); };
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target.closest('[data-magnetic]');
    if (cur && cur !== el) { release(cur); cur = null; }
    if (!el) return;
    cur = el;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    el.classList.add('is-mag');
    el.style.translate = `${(dx * 0.18).toFixed(1)}px ${(dy * 0.3).toFixed(1)}px`;
  }, { passive: true });
}

/* ---------- Cursor pill for [data-hold] zones ("Hold and drag") ---------- */
function setupHoldPill(getText) {
  const pill = document.createElement('div');
  pill.className = 'holdpill';
  pill.setAttribute('aria-hidden', 'true');
  pill.innerHTML = '<span></span>';
  document.body.appendChild(pill);
  const label = pill.firstChild;
  let zone = null, x = 0, y = 0, raf = 0;
  const place = () => { raf = 0; pill.style.transform = `translate3d(${x + 18}px, ${y + 18}px, 0)`; };
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const z = e.target.closest('[data-hold]');
    const overControl = e.target.closest('a, button, input, select, textarea, [data-tilt]');
    if (z !== zone) {
      zone = z;
      if (z) label.textContent = getText(z.dataset.hold);
    }
    pill.classList.toggle('is-on', !!z && !overControl);
    x = e.clientX; y = e.clientY;
    if (!raf) raf = requestAnimationFrame(place);
  }, { passive: true });
  document.addEventListener('pointerdown', (e) => { if (zone && e.button === 0) pill.classList.add('is-down'); });
  window.addEventListener('pointerup', () => pill.classList.remove('is-down'));
  document.addEventListener('pointerleave', () => pill.classList.remove('is-on'));
  // the page moves under a still cursor while scrolling: hide until the next pointer move
  window.addEventListener('scroll', () => { if (!pill.classList.contains('is-down')) { pill.classList.remove('is-on'); zone = null; } }, { passive: true });
  return { refresh() { if (zone) label.textContent = getText(zone.dataset.hold); } };
}

/**
 * @param {{ reducedMotion: boolean, getText: (key: string) => string }} opts
 */
export function setupFx({ reducedMotion, getText }) {
  if (reducedMotion) return { refresh() {}, enabled: false };
  let pill = { refresh() {} };
  if (finePointer.matches) {
    setupTilt();
    setupMagnetic();
  }
  return { refresh: () => pill.refresh(), enabled: true };
}
