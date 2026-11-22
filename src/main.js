import { catalogCopy, agentIds as AGENT_IDS } from './catalog-data.js';
import { T, LANGS } from './i18n.js';
import { createFlow } from './flow.js';
import { createWave } from './wave.js';
import { setupFx, splitWords, trackProgress, onScrollFx } from './fx.js';
import { setupSmoothScroll, pauseScroll, setupNavPill, splitHeading, setupPrism, onScrollPrism } from './prism.js';
import { submitDeveloperApplication, submitConnectionRequest } from './api.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

/* =========================================================
   Data
   ========================================================= */
/* =========================================================
   i18n
   ========================================================= */
let lang = store.get('keme-lang');
if (!LANGS.includes(lang)) lang = 'ru';
const t = (k) => (T[lang] && T[lang][k] !== undefined ? T[lang][k] : T.ru[k]);
const fx = setupFx({ reducedMotion, getText: (k) => t(k) });
setupSmoothScroll(reducedMotion);
let navPill = null;
// headlines rise word by word instead of fading as a block
if (!reducedMotion) {
  $$('h1.display[data-reveal], .h2[data-reveal]').forEach((el) => { el.removeAttribute('data-reveal'); el.setAttribute('data-split', ''); });
}
// cinematic intro (pure CSS animation): hero waits for the bars to open, then the intro is dropped
const intro = $('.intro');
if (intro) {
  if (reducedMotion) intro.remove();
  else {
    document.documentElement.classList.add('intro-play');
    setTimeout(() => intro.remove(), 2300);
    setTimeout(() => document.documentElement.classList.remove('intro-play'), 3600);
  }
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function applyLang(next) {
  lang = next;
  document.documentElement.lang = lang;
  document.title = t('meta.title');
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  $$('[data-lang]').forEach((b) => {
    const on = b.dataset.lang === lang;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', on);
  });
  $('#catalogLink span').textContent = catalogCopy(lang).browse;
  renderAreas();
  renderSelects();
  setStep(step, false);
  renderPipe(false);
  if (fx.enabled) $$('[data-read]').forEach(splitWords);
  $$('[data-split]').forEach(splitHeading);
  fx.refresh();
  store.set('keme-lang', lang);
  requestAnimationFrame(() => { drawLinks(); onScroll(); });
}
$$('[data-lang]').forEach((b) => b.addEventListener('click', () => applyLang(b.dataset.lang)));

/* =========================================================
   Reveal on intersect
   ========================================================= */
const revealIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    revealIO.unobserve(e.target);
  });
}, { rootMargin: '0px 0px -6% 0px', threshold: 0.1 });
const observeReveals = (root = document) => $$('[data-reveal]:not(.in)', root).forEach((el) => revealIO.observe(el));

/* =========================================================
   Nav
   ========================================================= */
const nav = $('#nav');
/* =========================================================
   Toast
   ========================================================= */
const toast = $('#toast');
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

/* =========================================================
   1–2 Flow visuals
   ========================================================= */
function setupEndingWave() {
  const ending = $('.ending');
  const box = $('[data-wave]');
  return createWave(box, { zones: [ending], reducedMotion })
    || createFlow(box, { variant: 'band', reducedMotion, zone: reducedMotion ? null : ending });
}
// hold zones: grabbing cursor + no text selection while the button is down
document.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const z = e.target.closest('[data-hold]');
  if (!z) return;
  z.classList.add('is-holding');
  window.addEventListener('pointerup', () => z.classList.remove('is-holding'), { once: true });
});
function sceneProgress() {
  const result = $('#result');
  const r = result.getBoundingClientRect();
  const end = window.scrollY + r.top + r.height / 2 - window.innerHeight / 2; // result centered
  return clamp(window.scrollY / Math.max(1, end));
}

/* =========================================================
   3 Platform scheme: links from cards to the hub
   ========================================================= */
const pscheme = $('#pscheme');
const plinks = $('#plinks');
function linkGeom(card, box, hub) {
  const hubL = hub.left - box.left, hubR = hub.right - box.left;
  const hubY = hub.top - box.top + hub.height / 2;
  const c = card.getBoundingClientRect();
  const y = c.top - box.top + c.height / 2;
  const isDev = card.closest('[data-side="dev"]');
  const x1 = isDev ? c.right - box.left : hubR;
  const x2 = isDev ? hubL : c.left - box.left;
  const y1 = isDev ? y : hubY + (y - hubY) * 0.25;
  const y2 = isDev ? hubY + (y - hubY) * 0.25 : y;
  const k = (x2 - x1) * 0.5;
  return `M${x1.toFixed(1)},${y1.toFixed(1)} C${(x1 + k).toFixed(1)},${y1.toFixed(1)} ${(x2 - k).toFixed(1)},${y2.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
}
function drawLinks() {
  if (getComputedStyle(plinks).display === 'none') return;
  const cards = $$('.pcard', pscheme);
  if (!plinks.dataset.built) {
    // built once; later calls only move the paths (pulses keep their place while the hub is dragged)
    plinks.innerHTML = '<defs><linearGradient id="plinkGrad" x1="0" x2="1"><stop offset="0" stop-color="#3ae6dc"/><stop offset="1" stop-color="#8cc4ff"/></linearGradient></defs>'
      + cards.map((card, i) => {
        const id = card.dataset.link;
        const pulse = reducedMotion ? '' : `<circle class="pulse" r="2.6"><animateMotion dur="2.8s" begin="-${(i * 0.47).toFixed(2)}s" repeatCount="indefinite"><mpath href="#pl-${id}"/></animateMotion></circle>`;
        return `<path id="pl-${id}" pathLength="1" data-link="${id}"/><path class="flowing" data-link="${id}"/>${pulse}`;
      }).join('');
    plinks.dataset.built = '1';
  }
  const box = pscheme.getBoundingClientRect();
  const hub = $('#phub').getBoundingClientRect();
  cards.forEach((card) => {
    const d = linkGeom(card, box, hub);
    $$(`path[data-link="${card.dataset.link}"]`, plinks).forEach((p) => p.setAttribute('d', d));
  });
}
$$('.pcard', pscheme).forEach((card) => {
  const hot = (on) => {
    card.classList.toggle('is-hot', on);
    $$(`path[data-link="${card.dataset.link}"]`, plinks).forEach((p) => p.classList.toggle('is-hot', on));
  };
  card.addEventListener('pointerenter', () => hot(true));
  card.addEventListener('pointerleave', () => hot(false));
});

// draggable hub: pull it, the links stretch, release and it springs back
const hubEl = $('#phub');
let hubX = 0, hubY = 0, hubVX = 0, hubVY = 0, hubDrag = null, hubRaf = 0;
const placeHub = () => { hubEl.style.translate = `${hubX.toFixed(1)}px ${hubY.toFixed(1)}px`; drawLinks(); };
hubEl.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || reducedMotion || getComputedStyle(plinks).display === 'none') return;
  e.preventDefault();
  hubEl.setPointerCapture(e.pointerId);
  cancelAnimationFrame(hubRaf);
  hubVX = hubVY = 0;
  hubDrag = { sx: e.clientX, sy: e.clientY, ox: hubX, oy: hubY };
  hubEl.classList.add('is-dragging');
  plinks.classList.add('is-pulling');
});
hubEl.addEventListener('pointermove', (e) => {
  if (!hubDrag) return;
  const R = 80; // rubber band: the further you pull, the harder it gets
  hubX = R * Math.tanh((hubDrag.ox + (e.clientX - hubDrag.sx) * 0.7) / R);
  hubY = R * Math.tanh((hubDrag.oy + (e.clientY - hubDrag.sy) * 0.7) / R);
  placeHub();
});
const releaseHub = () => {
  if (!hubDrag) return;
  hubDrag = null;
  hubEl.classList.remove('is-dragging');
  plinks.classList.remove('is-pulling');
  let last = performance.now();
  const step = (now) => {
    const dt = Math.min(0.032, (now - last) / 1000);
    last = now;
    hubVX += (-260 * hubX - 15 * hubVX) * dt;
    hubVY += (-260 * hubY - 15 * hubVY) * dt;
    hubX += hubVX * dt; hubY += hubVY * dt;
    if (Math.abs(hubX) + Math.abs(hubY) + Math.abs(hubVX) + Math.abs(hubVY) < 0.3) {
      hubX = hubY = hubVX = hubVY = 0; hubEl.style.translate = ''; drawLinks(); return;
    }
    placeHub();
    hubRaf = requestAnimationFrame(step);
  };
  hubRaf = requestAnimationFrame(step);
};
hubEl.addEventListener('pointerup', releaseHub);
hubEl.addEventListener('pointercancel', releaseHub);
if (!reducedMotion) trackProgress(pscheme, '--pp', { start: 0.95, span: 0.6 });

/* =========================================================
   4 Journey stepper (one agent, both sides)
   ========================================================= */
const STEP_WHO = ['jr.lane.dev', null, 'jr.lane.biz', 'jr.lane.biz', 'jr.lane.biz', 'jr.lane.biz'];
let step = 0;
let jrTimer = null;
let jrTouched = false;
function setStep(i, animate = true) {
  step = i;
  $$('.jstep').forEach((b, k) => {
    b.classList.toggle('is-active', k === i);
    b.classList.toggle('is-done', k < i);
    b.setAttribute('aria-selected', k === i);
  });
  $('#jrFill').style.width = `${(i / 5) * 100}%`;
  $$('.mock').forEach((m) => m.classList.toggle('is-on', +m.dataset.mock === i));
  const text = $('.jr__text');
  const apply = () => {
    const who = $('#jrWho');
    who.textContent = STEP_WHO[i] ? t(STEP_WHO[i]) : 'Keme AI';
    who.className = `jr__who${i === 1 ? ' is-hub' : i > 1 ? ' is-biz' : ''}`;
    $('#jrTitle').textContent = t(`js${i + 1}.t`);
    $('#jrDesc').textContent = t(`js${i + 1}.d`);
    text.classList.remove('swap');
  };
  if (!animate || reducedMotion) { apply(); return; }
  text.classList.add('swap');
  setTimeout(apply, 180);
}
$$('.jstep').forEach((b) => b.addEventListener('click', () => { jrTouched = true; stopJourney(); setStep(+b.dataset.step); }));
function startJourney() {
  if (reducedMotion || jrTouched || jrTimer) return;
  jrTimer = setInterval(() => setStep((step + 1) % 6), 3600);
}
function stopJourney() { clearInterval(jrTimer); jrTimer = null; }
new IntersectionObserver(([e]) => { if (e.isIntersecting) startJourney(); else stopJourney(); }, { threshold: 0.35 }).observe($('#jr'));
$('#jr').addEventListener('pointerenter', stopJourney);
$('#jr').addEventListener('pointerleave', () => { if (!jrTouched) startJourney(); });

/* =========================================================
   5 Why: task -> agent -> ready result (prepared examples, cycling)
   ========================================================= */
const pipe = $('#pipe');
let pipeIdx = 0;
let pipeTimers = [];
let pipeOn = false;
function renderPipe(play = true) {
  pipeTimers.forEach(clearTimeout);
  pipeTimers = [];
  const items = t('pp.items');
  const [task, result] = items[pipeIdx % items.length];
  $('#pipeIn').textContent = task;
  $('#pipeOut').textContent = result;
  if (!play || reducedMotion) { pipe.className = 'pipe is-in is-work is-out in'; return; }
  pipe.classList.remove('is-in', 'is-work', 'is-out');
  void pipe.offsetWidth; // restart the CSS animations
  pipeTimers.push(setTimeout(() => pipe.classList.add('is-in'), 80));
  pipeTimers.push(setTimeout(() => pipe.classList.add('is-work'), 800));
  pipeTimers.push(setTimeout(() => pipe.classList.add('is-out'), 1700));
  pipeTimers.push(setTimeout(() => { pipeIdx++; if (pipeOn) renderPipe(); }, 4400));
}
new IntersectionObserver(([e]) => {
  pipeOn = e.isIntersecting;
  if (pipeOn) renderPipe(); else pipeTimers.forEach(clearTimeout);
}, { threshold: 0.3 }).observe(pipe);

/* =========================================================
   8 Areas
   ========================================================= */
function renderAreas() {
  const live = t('ar.liveItems');
  $('#areasLive').innerHTML = AGENT_IDS.map((id) => `
    <article class="alive" data-tilt="5">
      <h3>${esc(live[id][0])}</h3>
      <p>${esc(live[id][1])}</p>
      <a class="link" href="/catalog/">${esc(t('ar.see'))} →</a>
    </article>`).join('');
  $('#areasSoon').innerHTML = t('ar.soonItems').map((s) => `<li>${esc(s)}</li>`).join('');
}

/* =========================================================
   Forms (developer application / connection request)
   ========================================================= */
const modal = $('#modal');
const forms = { dev: $('#formDev'), conn: $('#formConn') };
const done = $('#formDone');
let openForm = null;
let lastFocus = null;

function renderSelects() {
  const launch = $('#launchSelect');
  const lv = launch.value || 'widget';
  launch.innerHTML = Object.entries(t('f.launchOpts')).map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
  launch.value = lv;
  const agent = $('#agentSelect');
  const av = agent.value || 'sup';
  agent.innerHTML = AGENT_IDS.map((id) => `<option value="${id}">${esc(t(`${id}.name`))}</option>`).join('');
  agent.value = av;
}

function openModal(kind, agent) {
  openForm = kind;
  lastFocus = document.activeElement;
  Object.entries(forms).forEach(([k, f]) => { f.hidden = k !== kind; });
  done.hidden = true;
  if (kind === 'conn' && agent) $('#agentSelect').value = agent;
  modal.setAttribute('aria-labelledby', kind === 'dev' ? 'modalTitle' : 'modalTitleConn');
  modal.hidden = false;
  modal.classList.remove('is-closing');
  document.body.style.overflow = 'hidden';
  pauseScroll(true);
  setTimeout(() => forms[kind].querySelector('input, select, textarea')?.focus(), 60);
}
function closeModal() {
  if (modal.hidden) return;
  modal.classList.add('is-closing');
  setTimeout(() => {
    modal.hidden = true;
    modal.classList.remove('is-closing');
    document.body.style.overflow = '';
    pauseScroll(false);
    lastFocus?.focus();
  }, 180);
}
$$('[data-close]', modal).forEach((el) => el.addEventListener('click', closeModal));
document.addEventListener('keydown', (e) => {
  if (modal.hidden) return;
  if (e.key === 'Escape') closeModal();
  if (e.key === 'Tab') {
    const f = $$('button, input, select, textarea, [href]', modal).filter((el) => el.offsetParent !== null);
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

const CONTACT_RE = /^([^\s@]+@[^\s@]+\.[^\s@]{2,}|@?[a-zA-Z0-9_]{5,32})$/;
function setError(field, msg) {
  const wrap = field.closest('.field');
  wrap.classList.toggle('has-error', !!msg);
  let err = wrap.querySelector('.field__err');
  if (msg) {
    if (!err) { err = document.createElement('span'); err.className = 'field__err'; wrap.appendChild(err); }
    err.textContent = msg;
    field.setAttribute?.('aria-invalid', 'true');
  } else {
    err?.remove();
    field.removeAttribute?.('aria-invalid');
  }
}
function validate(form) {
  let firstBad = null;
  $$('input[required], textarea[required], select[required]', form).forEach((el) => {
    const v = el.value.trim();
    let msg = '';
    if (!v) msg = t('f.required');
    else if (el.dataset.type === 'contact' && !CONTACT_RE.test(v)) msg = t('f.invalidContact');
    setError(el, msg);
    if (msg && !firstBad) firstBad = el;
  });
  const langs = form.querySelector('[data-group="languages"]');
  if (langs) {
    const any = $$('input:checked', langs).length > 0;
    langs.classList.toggle('has-error', !any);
    let err = langs.querySelector('.field__err');
    if (!any && !err) { err = document.createElement('span'); err.className = 'field__err'; langs.appendChild(err); }
    if (err) { if (any) err.remove(); else err.textContent = t('f.pickLang'); }
    if (!any && !firstBad) firstBad = langs.querySelector('input');
  }
  firstBad?.focus();
  return !firstBad;
}
$$('.form input, .form textarea, .form select').forEach((el) => el.addEventListener('input', () => {
  if (el.closest('.field')?.classList.contains('has-error')) setError(el, '');
}));

async function handleSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;
  if (!validate(form)) return;
  const fd = new FormData(form);
  const btn = form.querySelector('.form__submit');
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = t('f.sending');
  let res;
  if (form.dataset.form === 'dev') {
    /** @type {import('./api.js').DeveloperApplication} */
    const data = {
      name: fd.get('name').trim(), contact: fd.get('contact').trim(), agentName: fd.get('agentName').trim(),
      task: fd.get('task').trim(), capabilities: (fd.get('capabilities') || '').trim(),
      launch: fd.get('launch'), languages: fd.getAll('languages'), locale: lang,
    };
    res = await submitDeveloperApplication(data);
  } else {
    /** @type {import('./api.js').ConnectionRequest} */
    const data = {
      agent: fd.get('agent'), company: fd.get('company').trim(), contact: fd.get('contact').trim(),
      need: fd.get('need').trim(), locale: lang,
    };
    res = await submitConnectionRequest(data);
  }
  btn.disabled = false;
  btn.textContent = label;
  if (!res.ok) { showToast(t('f.error')); return; }
  form.hidden = true;
  done.hidden = false;
  done.classList.toggle('is-mock', !!res.mock);
  $('#doneTitle').textContent = res.mock ? t('f.mock.title') : t('f.ok.title');
  $('#doneText').textContent = res.mock ? t('f.mock.text') : t(form.dataset.form === 'dev' ? 'f.ok.dev' : 'f.ok.conn');
  if (!res.mock) form.reset();
  done.querySelector('[data-close]').focus();
}
Object.values(forms).forEach((f) => f.addEventListener('submit', handleSubmit));
$('#doneAgain').addEventListener('click', () => { done.hidden = true; forms[openForm].hidden = false; });

/* =========================================================
   Delegated actions
   ========================================================= */
document.addEventListener('click', (e) => {
  const open = e.target.closest('[data-open]');
  if (open) { openModal(open.dataset.open, open.dataset.agent); return; }
  if (e.target.closest('[data-action="login"]')) showToast(t('toast.login'));
});

/* =========================================================
   Scroll + resize
   ========================================================= */
// nav slides away while reading down, comes back on the slightest scroll up
let lastNavY = window.scrollY;
function updateNavHide() {
  const y = window.scrollY;
  const dy = y - lastNavY;
  const keep = nav.classList.contains('is-open') || nav.contains(document.activeElement) || y < 140;
  if (keep || dy < -3) nav.classList.remove('is-hidden');
  else if (dy > 3) nav.classList.add('is-hidden');
  if (Math.abs(dy) > 3) lastNavY = y;
}
function onScroll() {
  nav.classList.toggle('is-scrolled', window.scrollY > 20);
  updateNavHide();
  navPill?.sync();
  const sp = sceneProgress();
  sceneEl.style.setProperty('--sp', sp.toFixed(3));
  figure?.refresh();
  onScrollFx();
  onScrollPrism();
}
let ticking = false;
window.addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { ticking = false; onScroll(); });
}, { passive: true });
let resizeT;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { drawLinks(); onScroll(); }, 120);
});

/* =========================================================
   3D hero figure (Three.js, loaded on demand)
   ========================================================= */
const sceneEl = $('#scene');
let figure = null;
async function setupFigure() {
  try {
    const { createFigure } = await import('./figure.js');
    figure = createFigure($('[data-figure]'), {
      seaAnchor: $('[data-sea-anchor]'),
      desktopTarget: $('.water-target--desktop'),
      mobileTarget: $('.water-target--mobile'),
      reducedMotion,
    });
    sceneEl.classList.add('has-figure');
    figure.refresh();
  } catch {
    // The static sea and sphere stay visible on devices without WebGL.
  }
}

/* boot */
setupPrism({ reducedMotion });
// spotlight that follows the cursor across dark sections
$$('[data-spot]').forEach((el) => {
  const spot = document.createElement('div');
  spot.className = 'spot';
  spot.setAttribute('aria-hidden', 'true');
  el.prepend(spot);
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--cx', `${e.clientX - r.left}px`);
    el.style.setProperty('--cy', `${e.clientY - r.top}px`);
  }, { passive: true });
});
if (!reducedMotion) trackProgress($('#platform'), '--pe', { start: 1.05, span: 0.55 });
setupFigure();
navPill = setupNavPill($('.nav__links'));
setupEndingWave();
applyLang(lang);
const arrival = new URL(location.href);
const requestedAgent = arrival.searchParams.get('connect');
if (AGENT_IDS.includes(requestedAgent)) {
  openModal('conn', requestedAgent);
  arrival.searchParams.delete('connect');
  history.replaceState(null, '', arrival);
}
observeReveals();
onScroll();
document.fonts?.ready.then(() => { drawLinks(); onScroll(); });
new ResizeObserver(() => drawLinks()).observe(pscheme);
