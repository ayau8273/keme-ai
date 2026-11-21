import { T, LANGS } from './i18n.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const BLOB_MARGIN = 1.34; // keep in sync with blob.js
const RING_REACH = 1.75;  // orbit rings extend this far (× base radius)

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

/* =========================================================
   Data
   ========================================================= */
const ICONS = {
  sup: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-7l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01"/></svg>',
  mkt: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  hr: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="8" r="3.2"/><path d="M4 19c.8-3.2 3.2-5 6-5s5.2 1.8 6 5"/><path d="M16 10.5l1.6 1.6 3-3.2"/></svg>',
};
// Prices / ratings shown as sample values for the launch catalog.
const AGENTS = [
  { id: 'sup', price: 24900, rating: 4.9, subs: 458, variant: 'teal', tone: 'teal' },
  { id: 'mkt', price: 19900, rating: 4.8, subs: 312, variant: 'dark', tone: 'blue' },
  { id: 'hr', price: 14900, rating: 4.7, subs: 196, variant: 'light', tone: 'violet' },
];
const AREA_AGENT = { 0: 'mkt', 2: 'sup', 3: 'hr' };
const AREA_ICONS = [
  'M3 10v4h3l6 4V6L6 10H3zM16 9a4 4 0 0 1 0 6',
  'M3 17l6-6 4 4 8-8M15 7h6v6',
  'M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v5H5a1 1 0 0 1-1-1v-4zM20 14h-3v5h2a1 1 0 0 0 1-1v-4z',
  'M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM3 21c.6-3.4 3.4-6 7-6M17.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM21 22l-1.6-1.6',
  'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 18h.01M12 18h.01M16 18h.01',
  'M20.8 8.6a5 5 0 0 0-8.8-3.2A5 5 0 0 0 3.2 8.6C3.2 14 12 20 12 20s8.8-6 8.8-11.4zM3.5 12h4l1.5-3 3 6 1.5-3h7',
  'M12 3v18M5 7h14M5 7l-3 6a3 3 0 0 0 6 0L5 7zM19 7l-3 6a3 3 0 0 0 6 0l-3-6zM8 21h8',
  'M2 9l10-5 10 5-10 5-10-5zM6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5M22 9v6',
  'M4 20V10M10 20V4M16 20v-7M22 20H2',
  'M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M15 9h3a1 1 0 0 1 1 1v11M3 21h18M8 8h4M8 12h4M8 16h4',
  'M5 8h14l-1 13H6L5 8zM9 8V6a3 3 0 0 1 6 0v2',
  'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z',
];
// night shift: [minutes after 21:00, bar height px, handed off?]
const TICKS = [
  [5], [15], [25], [38, 18], [48], [60], [72], [84], [95], [105], [118], [122, 40], [132, 14], [145], [158], [170], [182],
  [200, 20], [215], [240], [270, 22], [300], [335], [400, 26, 1], [430], [490, 26, 1], [530], [560, 14], [590], [600],
  [620], [640], [655, 16], [670], [685], [700], [710],
];
const CANDIDATES = [['Айгерим С.', 92], ['Данияр К.', 88], ['Мария Л.', 85], ['Ерлан Т.', 81], ['Асель Б.', 79]];

/* =========================================================
   i18n
   ========================================================= */
let lang = store.get('keme-lang');
if (!LANGS.includes(lang)) lang = 'ru';
const t = (k) => (T[lang] && T[lang][k] !== undefined ? T[lang][k] : T.ru[k]);
const fmt = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(n)).replace(/ | /g, ' ');
const tenge = (n) => `${fmt(n)} ₸`;
const dec = (n) => (lang === 'en' ? n.toFixed(1) : n.toFixed(1).replace('.', ','));

function renderOf() {
  $$('[data-of]').forEach((el) => {
    const [a, b] = el.dataset.of.split(',');
    const done = el.dataset.done === '1';
    el.innerHTML = `<span data-count="${a}"${done ? ' data-done="1"' : ''}>${done ? a : 0}</span> <i>${t('of')}</i> ${b}`;
  });
}

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
  renderOf();
  splitWords();
  renderCards();
  renderAreas();
  renderWeek(false);
  renderHr();
  setChat(activeTick, false);
  updateCalc();
  positionTabPill();
  if (modalAgent) fillModal(modalAgent, false);
  $('#modalOut').dataset.empty = t('modal.empty');
  store.set('keme-lang', lang);
  requestAnimationFrame(() => { measure(); onScroll(); });
}
$$('[data-lang]').forEach((b) => b.addEventListener('click', () => applyLang(b.dataset.lang)));

/* =========================================================
   Word-by-word scroll reveal
   ========================================================= */
function splitWords() {
  $$('[data-words]').forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map((w) => `<span class="w">${w.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>`).join(' ');
    el._words = $$('.w', el);
  });
}
function updateWords(vh) {
  $$('[data-words]').forEach((el) => {
    const section = el.closest('section');
    const r = section.getBoundingClientRect();
    const sticky = getComputedStyle(el.closest('.sticky')).position === 'sticky';
    const p = sticky
      ? clamp(-r.top / (r.height - vh) * 1.35)
      : clamp((vh * 0.9 - el.getBoundingClientRect().top) / (vh * 0.6));
    const lit = p * (el._words.length + 2);
    el._words.forEach((w, i) => { w.style.opacity = (0.14 + 0.86 * clamp(lit - i)).toFixed(3); });
    const after = el.parentElement.querySelector('[data-after-words]');
    if (after) after.classList.toggle('in', p > 0.9);
  });
}

/* =========================================================
   Reveal on intersect + counters
   ========================================================= */
let cardsShown = false;
const onRevealHooks = new Map();
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const el = e.target;
    el.classList.add('in');
    io.unobserve(el);
    if (el.classList.contains('acard')) cardsShown = true;
    runCounters(el);
    const hook = onRevealHooks.get(el.id);
    if (hook) hook();
  });
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
function observeReveals(root = document) { $$('[data-reveal]', root).forEach((el) => io.observe(el)); }

function runCounters(root, dur = 1600) {
  $$('[data-count]', root).forEach((el) => {
    if (el.dataset.done === '1') return;
    el.dataset.done = '1';
    const holder = el.closest('[data-of]');
    if (holder) holder.dataset.done = '1';
    const end = +el.dataset.count;
    if (reducedMotion) { el.textContent = end; return; }
    const d = +(el.closest('[data-count-dur]')?.dataset.countDur || dur);
    const start = performance.now();
    const tick = (now) => {
      const k = clamp((now - start) / d);
      el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/* =========================================================
   Nav + tabs
   ========================================================= */
const nav = $('#nav');
const burger = $('.nav__burger');
burger.addEventListener('click', () => {
  const open = !nav.classList.contains('is-open');
  nav.classList.toggle('is-open', open);
  burger.setAttribute('aria-expanded', open);
});
$$('.nav__mobile a, .nav__mobile button').forEach((a) => a.addEventListener('click', () => {
  nav.classList.remove('is-open');
  burger.setAttribute('aria-expanded', 'false');
}));

const tabs = $$('.tabs [data-tab]');
const pill = $('.tabs__pill');
function positionTabPill() {
  const active = $('.tabs [data-tab].is-active');
  if (!active) return;
  pill.style.width = `${active.offsetWidth}px`;
  pill.style.transform = `translateX(${active.offsetLeft - 4}px)`;
}
function selectTab(id) {
  tabs.forEach((b) => { const on = b.dataset.tab === id; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on); });
  $$('.steps').forEach((p) => p.classList.toggle('is-active', p.dataset.panel === id));
  positionTabPill();
}
tabs.forEach((b) => b.addEventListener('click', () => selectTab(b.dataset.tab)));

/* =========================================================
   Popular agent cards
   ========================================================= */
function renderCards() {
  const wrap = $('#agentCards');
  wrap.innerHTML = AGENTS.map((a, i) => `
    <article class="acard acard--${a.variant}" data-reveal style="--d:${i * 0.08}s">
      <div class="acard__top">
        <h3>${t(`${a.id}.name`)}</h3>
        <span class="acard__demo"><i></i>${t('card.demo')}</span>
      </div>
      <p class="acard__cat">${t(`${a.id}.cat`)} · keme</p>
      <p class="acard__desc">${t(`${a.id}.desc`)}</p>
      <div class="acard__meta">
        <span class="mono">${tenge(a.price)}${t('card.month')}</span>
        <span title="${t('card.rating')}"><svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z" fill="currentColor"/></svg>${dec(a.rating)}</span>
        <span title="${t('card.subs')}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.4 3.3-5.5 6.5-5.5s5.9 2.1 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.8c1.6.9 2.7 2.7 3 5.2"/></svg>${a.subs}</span>
      </div>
      <div class="acard__bottom">
        <span class="trial"><i></i>${t('card.trial')}</span>
        <button type="button" class="acard__more" data-try="${a.id}">${t('card.more')} <span aria-hidden="true">→</span></button>
      </div>
    </article>`).join('');
  $$('[data-try]', wrap).forEach((b) => b.addEventListener('click', () => openModal(b.dataset.try)));
  if (cardsShown) $$('[data-reveal]', wrap).forEach((el) => el.classList.add('in'));
  else observeReveals(wrap);
}

/* =========================================================
   Areas grid
   ========================================================= */
let areasShown = false;
function renderAreas() {
  const grid = $('#areasGrid');
  grid.innerHTML = t('areas').map(([title, desc], i) => {
    const agent = AREA_AGENT[i];
    return `
    <button type="button" class="area${agent ? ' area--live' : ''}" data-area="${i}" data-reveal style="--d:${(i % 4) * 0.05}s">
      <svg class="area__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${AREA_ICONS[i]}"/></svg>
      <svg class="area__arrow" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 11l6-6M6 5h5v5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      <h3>${title}</h3>
      <p>${desc}</p>
      <span class="area__status">${agent ? t('ar.one') : t('ar.soon')}</span>
    </button>`;
  }).join('');
  $$('[data-area]', grid).forEach((b) => b.addEventListener('click', () => {
    const agent = AREA_AGENT[b.dataset.area];
    if (agent) openModal(agent); else showToast(t('ar.toast'));
  }));
  if (areasShown) $$('[data-reveal]', grid).forEach((el) => el.classList.add('in'));
  else {
    observeReveals(grid);
    areasShown = true;
  }
}

/* =========================================================
   Infographic 1 — night shift timeline
   ========================================================= */
const timeline = $('#timeline');
const hhmm = (m) => {
  const total = (21 * 60 + m) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};
timeline.insertAdjacentHTML('beforeend', TICKS.map(([m, h = 12, ho], i) =>
  `<button type="button" class="tick${ho ? ' tick--h' : ''}" style="left:${(m / 720) * 100}%;--h:${h}px;--i:${i}" data-tick="${i}" aria-label="${hhmm(m)}"><span></span></button>`).join(''));
const tickEls = $$('.tick', timeline);
let activeTick = TICKS.findIndex(([m]) => m === 122);

function chatFor(i) {
  const [m, , ho] = TICKS[i];
  const pool = t('n.chats').filter((c) => !!c.h === !!ho);
  return pool.reduce((best, c) => (Math.abs(c.t - m) < Math.abs(best.t - m) ? c : best), pool[0]);
}
function setChat(i, animate = true) {
  activeTick = i;
  tickEls.forEach((el, k) => el.classList.toggle('is-active', k === i));
  const c = chatFor(i);
  const ho = !!TICKS[i][2];
  const apply = () => {
    $('#chatTime').textContent = hhmm(TICKS[i][0]);
    $('#chatQ').textContent = c.q;
    $('#chatA').textContent = c.a;
    const meta = $('#chatMeta');
    meta.textContent = ho ? `· ${t('n.handoff')}` : `· ${1 + (i % 3)} ${t('n.sec')}`;
    meta.classList.toggle('is-h', ho);
  };
  const chat = $('.chat');
  if (!animate || reducedMotion) { apply(); return; }
  chat.classList.add('swap');
  setTimeout(() => { apply(); chat.classList.remove('swap'); }, 160);
}
let autoplay = null;
let userTouched = false;
function startAutoplay() {
  if (reducedMotion || userTouched || autoplay) return;
  const seq = t('n.chats').map((c) => TICKS.reduce((b, [m], k) => (Math.abs(m - c.t) < Math.abs(TICKS[b][0] - c.t) ? k : b), 0));
  let n = seq.indexOf(activeTick);
  autoplay = setInterval(() => { n = (n + 1) % seq.length; setChat(seq[n]); }, 2800);
}
function stopAutoplay() { clearInterval(autoplay); autoplay = null; }
tickEls.forEach((el, i) => {
  const pick = () => { userTouched = true; stopAutoplay(); setChat(i); };
  el.addEventListener('pointerenter', pick);
  el.addEventListener('focus', pick);
  el.addEventListener('click', pick);
});
$('#night').dataset.countDur = '2400';
onRevealHooks.set('night', () => setTimeout(startAutoplay, 2600));

/* =========================================================
   Infographic 2 — content week
   ========================================================= */
let weekPlan = [[0, 1], [2], [0, 1], [3], [0, 2], [1], [0, 1]];
function regenPlan() {
  const weights = [0.38, 0.3, 0.2, 0.12];
  const pickType = () => { let r = Math.random(); for (let k = 0; k < 4; k++) { if ((r -= weights[k]) < 0) return k; } return 0; };
  const plan = Array.from({ length: 7 }, () => [pickType()]);
  for (let left = 5; left > 0;) {
    const d = Math.floor(Math.random() * 7);
    if (plan[d].length < 3) { plan[d].push(pickType()); left--; }
  }
  return plan;
}
function renderWeek(replay) {
  const grid = $('#weekGrid');
  const types = t('types');
  const short = t('types.short');
  let k = 0;
  grid.innerHTML = t('days').map((d, i) => `
    <div class="week__day"><span class="week__label mono">${d}</span>${weekPlan[i].map((ty) =>
      `<span class="tchip t${ty}" style="--i:${k++}" title="${types[ty]}"><span class="tchip__l">${types[ty]}</span><span class="tchip__s">${short[ty]}</span></span>`).join('')}</div>`).join('');
  const counts = [0, 0, 0, 0];
  weekPlan.flat().forEach((ty) => counts[ty]++);
  $('#weekTypes').innerHTML = types.map((name, i) => `<span><i class="t${i}"></i>${name} ${counts[i]}</span>`).join('');
  if (replay) {
    grid.classList.remove('on');
    void grid.offsetWidth;
    grid.classList.add('on');
  }
}
$('#weekRegen').addEventListener('click', () => { weekPlan = regenPlan(); renderWeek(true); });
onRevealHooks.set('week', () => $('#weekGrid').classList.add('on'));

/* =========================================================
   Infographic 3 — resume screening
   ========================================================= */
const hrScores = (() => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const arr = Array.from({ length: 45 }, () => Math.round(28 + rnd() * 45));
  const slots = [3, 14, 22, 37, 46];
  CANDIDATES.forEach(([, s], i) => arr.splice(slots[i], 0, s));
  return arr;
})();
function renderHr() {
  const top = new Map(CANDIDATES.map(([, s], i) => [s, i]));
  $('#hrGrid').innerHTML = hrScores.map((s, i) => {
    const rank = top.has(s) ? top.get(s) : -1;
    return `<span class="sq${rank >= 0 ? ' sq--top' : ''}" style="--s:${(s / 100).toFixed(2)};--i:${i}"${rank >= 0 ? ` data-rank="${rank}" title="${CANDIDATES[rank][0]} · ${s}%"` : ''}></span>`;
  }).join('');
  $('#hrList').innerHTML = CANDIDATES.map(([name, s], i) => `
    <li data-rank="${i}" style="--i:${i}"><span class="hr__name">${name}</span><span class="hr__bar"><i style="--w:${s}%"></i></span><span class="hr__score mono">${s}%</span></li>`).join('');
  const link = (rank, on) => $$(`#hrviz [data-rank="${rank}"]`).forEach((el) => el.classList.toggle('hl', on));
  $$('#hrviz [data-rank]').forEach((el) => {
    el.addEventListener('pointerenter', () => link(el.dataset.rank, true));
    el.addEventListener('pointerleave', () => link(el.dataset.rank, false));
  });
}

/* =========================================================
   Demo modal
   ========================================================= */
const modal = $('#modal');
let modalAgent = null;
let streamTimer = null;
let lastFocus = null;
function fillModal(id, resetOutput = true) {
  const a = AGENTS.find((x) => x.id === id);
  $('#modalTitle').textContent = t(`${id}.name`);
  const icon = $('#modalIcon');
  icon.dataset.tone = a.tone;
  icon.innerHTML = ICONS[id];
  $('#modalInput').value = t(`demo.${id}.prompt`);
  $('#modalPrice').textContent = `${t('modal.price')} ${tenge(a.price)}${t('card.month')}`;
  if (resetOutput) { stopStream(); $('#modalOut').innerHTML = ''; }
}
function openModal(id) {
  modalAgent = id;
  lastFocus = document.activeElement;
  fillModal(id);
  modal.hidden = false;
  modal.classList.remove('is-closing');
  document.body.style.overflow = 'hidden';
  setTimeout(() => $('#modalRun').focus(), 50);
}
function closeModal() {
  if (modal.hidden) return;
  stopStream();
  modal.classList.add('is-closing');
  setTimeout(() => {
    modal.hidden = true;
    modal.classList.remove('is-closing');
    document.body.style.overflow = '';
    modalAgent = null;
    lastFocus && lastFocus.focus();
  }, 200);
}
function stopStream() { clearTimeout(streamTimer); streamTimer = null; }
function runDemo() {
  if (!modalAgent) return;
  stopStream();
  const out = $('#modalOut');
  const text = t(`demo.${modalAgent}.out`);
  out.innerHTML = `<span class="thinking">${t('modal.thinking')} <i></i><i></i><i></i></span>`;
  streamTimer = setTimeout(() => {
    if (reducedMotion) { out.textContent = text; return; }
    let i = 0;
    const node = document.createTextNode('');
    const caret = document.createElement('span');
    caret.className = 'caret';
    out.innerHTML = '';
    out.append(node, caret);
    const step = () => {
      i = Math.min(text.length, i + 2 + Math.floor(Math.random() * 3));
      node.textContent = text.slice(0, i);
      if (i < text.length) streamTimer = setTimeout(step, 16 + Math.random() * 22);
      else caret.remove();
    };
    step();
  }, reducedMotion ? 200 : 900);
}
$('#modalRun').addEventListener('click', runDemo);
$$('[data-close]', modal).forEach((el) => el.addEventListener('click', closeModal));
document.addEventListener('keydown', (e) => {
  if (modal.hidden) return;
  if (e.key === 'Escape') closeModal();
  if (e.key === 'Tab') {
    const f = $$('button, textarea, [href]', modal).filter((el) => el.offsetParent !== null);
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

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
document.addEventListener('click', (e) => { if (e.target.closest('[data-toast]')) showToast(t('toast.demo')); });

/* =========================================================
   Income calculator
   ========================================================= */
const inPrice = $('#inPrice');
const inSubs = $('#inSubs');
const setFill = (input) => input.style.setProperty('--p', `${((input.value - input.min) / (input.max - input.min)) * 100}%`);
function updateCalc() {
  const gross = +inPrice.value * +inSubs.value;
  $('#outPrice').textContent = tenge(+inPrice.value);
  $('#outSubs').textContent = fmt(+inSubs.value);
  $('#outYou').textContent = tenge(gross * 0.95);
  $('#outFee').textContent = tenge(gross * 0.05);
  setFill(inPrice); setFill(inSubs);
}
inPrice.addEventListener('input', updateCalc);
inSubs.addEventListener('input', updateCalc);

/* =========================================================
   Halftone dot waves (popular section background)
   ========================================================= */
const dots = $('.popular .dots');
const dctx = dots.getContext('2d');
let dotsVisible = false, dW = 0, dH = 0;
function sizeDots() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  dW = dots.clientWidth; dH = dots.clientHeight;
  dots.width = dW * dpr; dots.height = dH * dpr;
  dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function drawDots(time) {
  const tt = time * 0.001;
  const step = 7;
  dctx.clearRect(0, 0, dW, dH);
  // top band
  dctx.fillStyle = 'rgb(120, 200, 188)';
  for (let y = 0; y < 120; y += step) {
    for (let x = 0; x < dW; x += step) {
      const edge = 62 + 24 * Math.sin(x * 0.006 + tt * 0.35) + 12 * Math.sin(x * 0.017 - tt * 0.5);
      if (y > edge) continue;
      const v = 1 - y / edge;
      dctx.globalAlpha = 0.06 + 0.22 * v;
      const s = step * (0.3 + 0.38 * v);
      dctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
  }
  // bottom band — teal to blue
  const bandTop = dH - 150;
  for (let y = Math.floor(bandTop / step) * step; y < dH + step; y += step) {
    for (let x = 0; x < dW; x += step) {
      const edge = dH - (86 + 30 * Math.sin(x * 0.005 - tt * 0.3) + 16 * Math.sin(x * 0.013 + tt * 0.45));
      if (y < edge) continue;
      const v = clamp((y - edge) / (dH - edge + 1));
      const k = x / dW;
      dctx.fillStyle = `rgb(${Math.round(70 + 30 * k)}, ${Math.round(190 - 20 * k)}, ${Math.round(175 + 60 * k)})`;
      dctx.globalAlpha = 0.1 + 0.5 * v;
      const s = step * (0.3 + 0.42 * v);
      dctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
  }
  dctx.globalAlpha = 1;
}
new IntersectionObserver(([e]) => { dotsVisible = e.isIntersecting; }).observe(dots);

/* =========================================================
   3D blob + scroll choreography
   ========================================================= */
let blob = null;
let anchors = [];
let hiddenRanges = [];
let blobVisible = true;
const rail = $('.rail__fill');
const scrollHint = $('.scroll-hint');

/*
  Each [data-blob] section owns a zone. The blob is placed relative to the zone's
  LIVE rect, so it scrolls together with the content and never drifts over text.
  - mode "below": blob's top edge sits at the zone top (zone starts under the CTA)
  - mode "fit":   blob (and its orbit rings) fit inside the zone
  Between hero → "what" the blob travels (blend); later hand-offs happen while
  the blob is covered by opaque sections (switch).
*/
function measure() {
  const vh = window.innerHeight, sy = window.scrollY;
  anchors = $$('[data-blob]').map((sec) => {
    const r = sec.getBoundingClientRect();
    const top = r.top + sy;
    const f = sec.dataset.blobAt !== undefined ? +sec.dataset.blobAt : 0.5;
    const [plume, ring] = (sec.dataset.blobFx || '1,0').split(',').map(Number);
    // scroll position at which this section's text first enters the viewport
    const text = $('[data-blob-text]', sec);
    const sticky = $('.sticky', sec);
    const textTop = text ? text.getBoundingClientRect().top - (sticky ? sticky.getBoundingClientRect().top : r.top) + top : top;
    return {
      zone: $('[data-blob-zone]', sec), mode: sec.dataset.blob, plume, ring,
      top, bottom: top + r.height, at: top + Math.max(0, r.height - vh) * f,
      textIn: textTop - vh,
    };
  });
  const whatBottom = $('#what').getBoundingClientRect().bottom + sy;
  const finalTop = $('#final').getBoundingClientRect().top + sy;
  const footerTop = $('.footer').getBoundingClientRect().top + sy;
  hiddenRanges = [[whatBottom + 40, finalTop - vh - 40], [footerTop - vh * 0.2, Infinity]];
  sizeDots();
}

function zoneTarget(a) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const z = a.zone.getBoundingClientRect();
  let r, cy;
  if (a.mode === 'fit') {
    r = Math.min(z.width / 2 / (a.ring ? RING_REACH : BLOB_MARGIN), z.height / 2 / BLOB_MARGIN);
    cy = z.top + z.height / 2;
  } else {
    r = clamp(Math.min(vw, vh) * (vw < 760 ? 0.27 : 0.19), 90, 220);
    cy = z.top + r * BLOB_MARGIN;
  }
  return { cx: z.left + z.width / 2, cy, r, plume: a.plume, ring: a.ring };
}

function blobTargetAt(sy) {
  if (!anchors.length) return null;
  const vh = window.innerHeight;
  if (sy <= anchors[0].at) return zoneTarget(anchors[0]);
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i], b = anchors[i + 1];
    if (sy >= b.at) continue;
    if (i === 0) {
      // hero → what: travel. x leads so the blob clears the text column early.
      const k0 = clamp((sy - a.at) / (b.at - a.at));
      const k = k0 * k0 * (3 - 2 * k0);
      // finish the sideways move before the text column scrolls into view
      const xEnd = b.textIn > a.at + 80 ? Math.min(b.textIn, b.at) : b.at;
      const kxl = clamp((sy - a.at) / (xEnd - a.at));
      const kx = 1 - Math.pow(1 - kxl, 2);
      const A = zoneTarget(a), B = zoneTarget(b);
      return {
        cx: A.cx + (B.cx - A.cx) * kx,
        cy: A.cy + (B.cy - A.cy) * k,
        r: A.r + (B.r - A.r) * k,
        plume: A.plume + (B.plume - A.plume) * k,
        ring: A.ring + (B.ring - A.ring) * k,
      };
    }
    const mid = (a.bottom + (b.top - vh)) / 2; // inside the hidden range
    return zoneTarget(sy < mid ? a : b);
  }
  return zoneTarget(anchors[anchors.length - 1]);
}

function onScroll() {
  const sy = window.scrollY;
  const vh = window.innerHeight;
  nav.classList.toggle('is-scrolled', sy > 30);
  scrollHint.classList.toggle('is-hidden', sy > 40);
  const max = document.documentElement.scrollHeight - vh;
  rail.style.transform = `scaleY(${max > 0 ? sy / max : 0})`;
  updateWords(vh);
  if (blob) {
    const tg = blobTargetAt(sy);
    const visible = !hiddenRanges.some(([a, b]) => b > a && sy > a && sy < b);
    if (tg) {
      if (visible && !blobVisible) blob.jumpTo(tg); // re-enter in place, no swoop
      else blob.setTarget(tg);
    }
    blobVisible = visible;
    blob.setActive(visible);
  }
}

function initDrag() {
  $$('.blob-hit').forEach((hit) => {
    let lx = 0, ly = 0, lt = 0, id = null;
    hit.addEventListener('pointerdown', (e) => {
      if (!blob) return;
      id = e.pointerId; lx = e.clientX; ly = e.clientY; lt = performance.now();
      hit.setPointerCapture(id);
      blob.dragStart();
    });
    hit.addEventListener('pointermove', (e) => {
      if (id !== e.pointerId) return;
      const now = performance.now();
      blob.dragMove(e.clientX - lx, e.clientY - ly, (now - lt) / 1000);
      lx = e.clientX; ly = e.clientY; lt = now;
    });
    const end = (e) => { if (id === e.pointerId) { id = null; blob.dragEnd(); } };
    hit.addEventListener('pointerup', end);
    hit.addEventListener('pointercancel', end);
  });
  window.addEventListener('pointermove', (e) => {
    if (!blob || e.pointerType !== 'mouse') return;
    blob.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });
}

async function initBlob() {
  try {
    const { createBlob } = await import('./blob.js');
    blob = createBlob($('#blob'), { reducedMotion });
    if (!blob) return;
    measure();
    const tg = blobTargetAt(window.scrollY);
    if (tg) blob.jumpTo({ ...tg, r: tg.r * 0.6 });
    onScroll();
    initDrag();
    if (new URLSearchParams(location.search).has('debug')) exposeDebug();
    await blob.ready;
    requestAnimationFrame(() => requestAnimationFrame(() => $('#blob').classList.add('ready')));
  } catch (err) {
    console.warn('3D scene unavailable', err);
    $('#blob').style.display = 'none';
  }
}

// ?debug — overlap checker: lists visible text that collides with the blob's final position
function exposeDebug() {
  window.__keme = {
    blob,
    sync() { measure(); onScroll(); },
    async audit() {
      const out = {};
      const vh = window.innerHeight;
      const H = document.documentElement.scrollHeight;
      for (let y = 0; y < H; y += vh * 0.2) {
        window.scrollTo({ top: y, behavior: 'instant' });
        await new Promise((r) => setTimeout(r, 30));
        onScroll();
        const o = this.overlaps();
        if (o.length) out[`${Math.round(y)} (${(y / vh).toFixed(1)}vh)`] = o;
      }
      window.scrollTo({ top: 0, behavior: 'instant' });
      return out;
    },
    overlaps() {
      const tg = blobTargetAt(window.scrollY);
      if (!tg || !$('#blob').checkVisibility?.() || $('#blob').style.visibility === 'hidden') return [];
      const c = { cx: tg.cx, cy: tg.cy, r: tg.r * BLOB_MARGIN };
      const vh = window.innerHeight;
      // only text in sections the canvas can show through
      return $$('#top, #what, #final').flatMap((s) => $$('h1, h2, h3, p, .btn, .label, .caption, .stats > div, .scroll-hint, .badge', s))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (!r.width || r.bottom < 0 || r.top > vh || getComputedStyle(el).visibility === 'hidden') return false;
          if (el.closest('.modal, .nav')) return false;
          const nx = clamp(c.cx, r.left, r.right), ny = clamp(c.cy, r.top, r.bottom);
          return Math.hypot(c.cx - nx, c.cy - ny) < c.r;
        })
        .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}: ${el.textContent.trim().slice(0, 40)}`);
    },
  };
}

/* =========================================================
   Loops + boot
   ========================================================= */
let ticking = false;
window.addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { ticking = false; onScroll(); });
}, { passive: true });
window.addEventListener('resize', () => { measure(); onScroll(); positionTabPill(); });

let lastDots = 0;
function loop(time) {
  if (dotsVisible && time - lastDots > 40) { drawDots(reducedMotion ? 0 : time); lastDots = time; }
  requestAnimationFrame(loop);
}

applyLang(lang);
observeReveals();
measure();
onScroll();
requestAnimationFrame(loop);
document.fonts && document.fonts.ready.then(() => { measure(); onScroll(); positionTabPill(); });
let blobStarted = false;
const startBlob = () => { if (!blobStarted) { blobStarted = true; initBlob(); } };
window.addEventListener('load', () => { measure(); onScroll(); setTimeout(startBlob, 700); });
setTimeout(startBlob, 2000);
