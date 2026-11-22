import { T, LANGS } from './i18n.js';
import { createFlow } from './flow.js';
import { AGENT_DEMOS, submitDeveloperApplication, submitConnectionRequest } from './api.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const desktopScene = window.matchMedia('(min-width: 901px)');

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

/* =========================================================
   Data
   ========================================================= */
/** @type {import('./api.js').AgentId[]} */
const AGENT_IDS = ['sup', 'mkt', 'hr'];
const AGENT_ICONS = {
  sup: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5h14v10H11l-4 3v-3H5z"/></svg>',
  mkt: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4h3l6 4V6L7 10H4zM17 9a4 4 0 0 1 0 6"/></svg>',
  hr: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="8" r="3.4"/><path d="M4 19c.8-3.2 3.2-5 6-5s5.2 1.8 6 5M16 11l1.6 1.6L21 9"/></svg>',
};

/* =========================================================
   i18n
   ========================================================= */
let lang = store.get('keme-lang');
if (!LANGS.includes(lang)) lang = 'ru';
const t = (k) => (T[lang] && T[lang][k] !== undefined ? T[lang][k] : T.ru[k]);
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
  renderAgents();
  renderAreas();
  renderSelects();
  setStep(step, false);
  renderDemo(demoAgent, false);
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
const burger = $('.nav__burger');
const setMenu = (open) => { nav.classList.toggle('is-open', open); burger.setAttribute('aria-expanded', open); };
burger.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
$$('.nav__mobile a, .nav__mobile button').forEach((a) => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

const navLinks = $$('.nav__links a');
const sectionsForNav = [['#top', $('#scene')], ['#platform', $('#platform')], ['#agents', $('#agents')], ['#developers', $('#developers')]];
function updateNavCurrent() {
  const y = window.innerHeight * 0.35;
  let current = '#top';
  sectionsForNav.forEach(([href, el]) => { if (el.getBoundingClientRect().top <= y) current = href; });
  navLinks.forEach((a) => a.classList.toggle('is-current', a.getAttribute('href') === current));
}

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
const flows = { stage: null, hero: null, route: null, band: null };
function setupFlows() {
  const desk = desktopScene.matches;
  if (desk && !flows.stage) flows.stage = createFlow($('[data-flow="scroll"]'), { reducedMotion });
  if (!desk && !flows.hero) {
    flows.hero = createFlow($('[data-flow="0"]'), { reducedMotion, progress: 0 });
    flows.route = createFlow($('[data-flow="1"]'), { reducedMotion, progress: 1 });
  }
  if (!flows.band) flows.band = createFlow($('[data-flow="band"]'), { variant: 'band', reducedMotion });
}
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
function drawLinks() {
  if (getComputedStyle(plinks).display === 'none') return;
  const box = pscheme.getBoundingClientRect();
  const hub = $('#phub').getBoundingClientRect();
  const hubL = hub.left - box.left, hubR = hub.right - box.left;
  const hubY = hub.top - box.top + hub.height / 2;
  let d = '<defs><linearGradient id="plinkGrad" x1="0" x2="1"><stop offset="0" stop-color="#3ae6dc"/><stop offset="1" stop-color="#8cc4ff"/></linearGradient></defs>';
  $$('.pcard', pscheme).forEach((card) => {
    const c = card.getBoundingClientRect();
    const y = c.top - box.top + c.height / 2;
    const isDev = card.closest('[data-side="dev"]');
    const x1 = isDev ? c.right - box.left : hubR;
    const x2 = isDev ? hubL : c.left - box.left;
    const y1 = isDev ? y : hubY + (y - hubY) * 0.25;
    const y2 = isDev ? hubY + (y - hubY) * 0.25 : y;
    const k = (x2 - x1) * 0.5;
    const path = `M${x1},${y1} C${x1 + k},${y1} ${x2 - k},${y2} ${x2},${y2}`;
    d += `<path d="${path}" data-link="${card.dataset.link}"/><path class="flowing" d="${path}" data-link="${card.dataset.link}"/>`;
  });
  plinks.innerHTML = d;
}
$$('.pcard', pscheme).forEach((card) => {
  const hot = (on) => {
    card.classList.toggle('is-hot', on);
    $$(`path[data-link="${card.dataset.link}"]`, plinks).forEach((p) => p.classList.toggle('is-hot', on));
  };
  card.addEventListener('pointerenter', () => hot(true));
  card.addEventListener('pointerleave', () => hot(false));
});

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
   5 Router: typical requests → agent, complex → person
   ========================================================= */
const router = $('#router');
const chipsBox = $('#routerChips');
let routerTimer = null;
let routerN = 0;
function spawnChip() {
  const W = router.clientWidth, H = router.clientHeight;
  const complex = routerN % 4 === 3;
  const list = t(complex ? 'rt.complex' : 'rt.typical');
  const text = list[routerN % list.length];
  routerN++;
  const el = document.createElement('span');
  el.className = `rchip${complex ? ' is-h' : ''}`;
  el.textContent = text;
  chipsBox.appendChild(el);
  const w = el.offsetWidth, h = el.offsetHeight;
  const out = $('.router__col--out', router);
  const outL = out.offsetLeft, outW = out.offsetWidth;
  const startY = H * (0.3 + Math.random() * 0.45);
  const hubX = $('.router__hub', router).offsetLeft - w / 2, hubY = H * 0.5 - h / 2;
  const endX = outL + 6 + Math.random() * Math.max(0, outW - w - 12);
  const endY = complex ? H * (0.68 + Math.random() * 0.2) : H * (0.2 + Math.random() * 0.34);
  const anim = el.animate([
    { transform: `translate(${W * 0.03}px, ${startY}px)`, opacity: 0 },
    { transform: `translate(${W * 0.06}px, ${startY}px)`, opacity: 1, offset: 0.12 },
    { transform: `translate(${hubX}px, ${hubY}px) scale(.9)`, opacity: 1, offset: 0.5 },
    { transform: `translate(${endX}px, ${endY}px)`, opacity: 1, offset: 0.82 },
    { transform: `translate(${endX}px, ${endY}px)`, opacity: 0 },
  ], { duration: 4200, easing: 'cubic-bezier(.45,0,.25,1)' });
  anim.onfinish = () => el.remove();
}
function staticRouter() {
  chipsBox.innerHTML = '';
  const W = router.clientWidth, H = router.clientHeight;
  const place = (text, x, y, complex) => {
    const el = document.createElement('span');
    el.className = `rchip${complex ? ' is-h' : ''}`;
    el.textContent = text;
    el.style.transform = `translate(${x}px, ${y}px)`;
    chipsBox.appendChild(el);
  };
  const typ = t('rt.typical'), cx = t('rt.complex');
  const ox = $('.router__col--out', router).offsetLeft + 6;
  place(typ[0], W * 0.03, H * 0.38); place(cx[0], W * 0.03, H * 0.52, true); place(typ[1], W * 0.03, H * 0.66);
  place(typ[2], ox, H * 0.24); place(typ[3], ox, H * 0.38);
  place(cx[1], ox, H * 0.78, true);
}
new IntersectionObserver(([e]) => {
  if (reducedMotion) { if (e.isIntersecting) staticRouter(); return; }
  if (e.isIntersecting && !routerTimer) { spawnChip(); routerTimer = setInterval(spawnChip, 1300); }
  if (!e.isIntersecting) { clearInterval(routerTimer); routerTimer = null; }
}, { threshold: 0.2 }).observe(router);

/* =========================================================
   6 Demo agent cards
   ========================================================= */
let agentsShown = false;
function renderAgents() {
  const wrap = $('#agentCards');
  wrap.innerHTML = AGENT_IDS.map((id) => {
    const live = AGENT_DEMOS[id].liveDemoUrl;
    return `
    <article class="acard" data-reveal>
      <div class="acard__top">
        <span class="acard__icon" data-tone="${id}">${AGENT_ICONS[id]}</span>
        <span class="pill">${esc(t('ag.badge'))}</span>
      </div>
      <p class="acard__cat">${esc(t(`${id}.cat`))}</p>
      <h3>${esc(t(`${id}.name`))}</h3>
      <p class="acard__task">${esc(t(`${id}.task`))}</p>
      <ul class="acard__does" aria-label="${esc(t('ag.does'))}">
        <li>${esc(t(`${id}.p1`))}</li><li>${esc(t(`${id}.p2`))}</li>
      </ul>
      <div class="acard__actions">
        ${live
          ? `<a class="btn btn--primary btn--sm" href="${esc(live)}">${esc(t('ag.try'))}</a>`
          : `<button type="button" class="btn btn--primary btn--sm" data-example="${id}">${esc(t('ag.example'))}</button>`}
        <button type="button" class="btn btn--secondary btn--sm" data-open="conn" data-agent="${id}">${esc(t('ag.request'))}</button>
      </div>
    </article>`;
  }).join('');
  if (agentsShown) $$('[data-reveal]', wrap).forEach((el) => el.classList.add('in'));
  else { observeReveals(wrap); agentsShown = true; }
}

/* =========================================================
   7 Agent in action (prepared illustration)
   ========================================================= */
let demoAgent = 'sup';
let demoTimers = [];
let demoPlayed = false;
function renderDemo(id, play = true) {
  demoAgent = id;
  demoTimers.forEach(clearTimeout);
  demoTimers = [];
  $$('#acTabs [data-agent]').forEach((b) => {
    const on = b.dataset.agent === id;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', on);
  });
  const demo = $('#demo');
  $('#demoIn').textContent = t(`ac.${id}.in`);
  $('#demoOut').textContent = t(`ac.${id}.out`);
  $('#demoFoot').textContent = t(`ac.${id}.foot`);
  const steps = t(`ac.${id}.s`);
  const list = $('#demoSteps');
  list.innerHTML = steps.map((s) => `<li><i aria-hidden="true"></i><span>${esc(s)}</span></li>`).join('');
  const live = AGENT_DEMOS[id].liveDemoUrl;
  $('#demoCta').innerHTML = live
    ? `<a class="btn btn--primary btn--sm" href="${esc(live)}">${esc(t('ag.try'))}</a>`
    : `<button type="button" class="btn btn--primary btn--sm" data-open="conn" data-agent="${id}">${esc(t('ac.access'))}</button>`;

  const items = $$('li', list);
  if (!play || reducedMotion) {
    items.forEach((li) => { li.classList.add('is-done'); li.querySelector('i').textContent = '✓'; });
    demo.classList.add('is-done');
    return;
  }
  demo.classList.remove('is-done');
  items.forEach((li, k) => {
    demoTimers.push(setTimeout(() => li.classList.add('is-run'), 300 + k * 900));
    demoTimers.push(setTimeout(() => { li.classList.remove('is-run'); li.classList.add('is-done'); li.querySelector('i').textContent = '✓'; }, 300 + k * 900 + 800));
  });
  demoTimers.push(setTimeout(() => demo.classList.add('is-done'), 300 + items.length * 900));
}
$$('#acTabs [data-agent]').forEach((b) => b.addEventListener('click', () => renderDemo(b.dataset.agent)));
$('#demoReplay').addEventListener('click', () => renderDemo(demoAgent));
new IntersectionObserver(([e]) => {
  if (e.isIntersecting && !demoPlayed) { demoPlayed = true; renderDemo(demoAgent); }
}, { threshold: 0.35 }).observe($('#demo'));

/* =========================================================
   8 Areas
   ========================================================= */
function renderAreas() {
  const live = t('ar.liveItems');
  $('#areasLive').innerHTML = AGENT_IDS.map((id) => `
    <article class="alive">
      <h3>${esc(live[id][0])}</h3>
      <p>${esc(live[id][1])}</p>
      <button type="button" class="link" data-example="${id}">${esc(t('ar.see'))} →</button>
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
  setTimeout(() => forms[kind].querySelector('input, select, textarea')?.focus(), 60);
}
function closeModal() {
  if (modal.hidden) return;
  modal.classList.add('is-closing');
  setTimeout(() => {
    modal.hidden = true;
    modal.classList.remove('is-closing');
    document.body.style.overflow = '';
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
  const ex = e.target.closest('[data-example]');
  if (ex) {
    renderDemo(ex.dataset.example);
    demoPlayed = true;
    $('#action').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    return;
  }
  if (e.target.closest('[data-action="login"]')) showToast(t('toast.login'));
});

/* =========================================================
   Scroll + resize
   ========================================================= */
function onScroll() {
  nav.classList.toggle('is-scrolled', window.scrollY > 20);
  updateNavCurrent();
  if (flows.stage) flows.stage.setProgress(sceneProgress());
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
  resizeT = setTimeout(() => { setupFlows(); drawLinks(); onScroll(); if (reducedMotion) staticRouter(); }, 120);
});

/* boot */
setupFlows();
applyLang(lang);
observeReveals();
onScroll();
document.fonts?.ready.then(() => { drawLinks(); onScroll(); });
new ResizeObserver(() => drawLinks()).observe(pscheme);
