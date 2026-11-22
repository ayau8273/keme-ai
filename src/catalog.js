import { LANGS, T } from './i18n.js';
import { AGENT_DEMOS } from './api.js';
import { agentIds, catalogCopy, catalogUrl, getAgent } from './catalog-data.js';
import { agentCard, agentMark } from './catalog-cards.js';

const root = document.querySelector('#directory');
const url = new URL(location.href);
const id = url.searchParams.get('agent');
const groups = ['all', ...agentIds];
let group = url.searchParams.get('group');
if (!groups.includes(group)) group = 'all';
let query = url.searchParams.get('q') || '';
let lang = 'ru';
try { lang = localStorage.getItem('keme-lang') || lang; } catch { /* private browsing */ }
if (!LANGS.includes(lang)) lang = 'ru';

function listUrl() {
  const target = new URL(catalogUrl, location.origin);
  if (group !== 'all') target.searchParams.set('group', group);
  if (query.trim()) target.searchParams.set('q', query.trim());
  return target;
}

function renderResults() {
  const c = catalogCopy(lang);
  const terms = query.trim().toLocaleLowerCase(lang).split(/\s+/);
  const matches = agentIds.map(key => getAgent(key, lang)).filter(agent => {
    const fields = [agent.name, agent.category, agent.task, ...agent.features].join(' ').toLocaleLowerCase(lang);
    return (group === 'all' || agent.id === group) && terms.every(word => fields.includes(word));
  });
  root.querySelector('#count').textContent = c.results + ' · ' + matches.length;
  root.querySelectorAll('[data-group]').forEach(button => button.setAttribute('aria-pressed', button.dataset.group === group));
  root.querySelector('.filter-label').textContent = group === 'all' ? c.filter : c.filter + ' · ' + T[lang][group + '.cat'];
  const cards = root.querySelector('#matches');
  cards.innerHTML = matches.map(agent => agentCard(agent, lang)).join('');
  cards.querySelectorAll('a').forEach(link => {
    const profile = listUrl();
    profile.searchParams.set('agent', new URL(link.href).searchParams.get('agent'));
    link.href = profile.href;
  });
  root.querySelector('.directory-empty').hidden = !!matches.length;
}

function renderList() {
  const c = catalogCopy(lang);
  root.innerHTML = `<header class="directory-head"><h1 class="display">${c.title}</h1><p class="lead">${c.subtitle}</p></header>
    <div class="directory-tools">
      <label class="directory-search"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
        <input type="search" aria-label="${c.search}" placeholder="${c.search}" id="search"></label>
      <details class="directory-filter"><summary class="btn btn--secondary"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7h10m4 0h4M3 17h4m4 0h10"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg><span class="filter-label"></span></summary>
        <div class="directory-groups" role="group" aria-label="${c.direction}"><strong>${c.direction}</strong>
        ${groups.map(key => `<button type="button" data-group="${key}">${key === 'all' ? c.all : T[lang][key + '.cat']}</button>`).join('')}</div></details>
    </div>
    <p class="directory-count" id="count" role="status"></p><div class="acards" id="matches"></div>
    <div class="directory-empty" hidden><h2>${c.empty}</h2><button class="btn btn--secondary" data-reset>${c.clear}</button></div>`;
  root.querySelector('#search').value = query;
  renderResults();
}

function renderProfile() {
  const c = catalogCopy(lang);
  const t = T[lang];
  root.innerHTML = `<a class="link directory-back" href="/catalog/">← ${c.back}</a>`;
  root.querySelector('.directory-back').href = listUrl().href;
  if (!agentIds.includes(id)) {
    root.insertAdjacentHTML('beforeend', `<h1 class="h2">${c.missing}</h1>`);
    document.title = c.missing + ' — Keme AI';
    return;
  }
  const agent = getAgent(id, lang);
  document.title = agent.name + ' — Keme AI';
  const liveUrl = AGENT_DEMOS[id]?.liveDemoUrl;
  root.insertAdjacentHTML('beforeend', `<div class="profile-grid">
    <section class="profile-intro">
      <div class="profile-identity">${agentMark(id)}<span class="acard__cat">${agent.category}</span></div>
      <h1 class="display">${agent.name}</h1><p class="lead">${agent.task}</p>
      <ul class="acard__does">${agent.features.map(item => `<li>${item}</li>`).join('')}</ul>
      <div class="cta-row"><a class="btn btn--primary" href="/?connect=${id}#agents">${t['ag.request']}</a>${liveUrl ? `<a class="btn btn--secondary" href="${liveUrl}">${t['ag.try']}</a>` : ''}</div>
    </section>
    <section class="profile-example">
      <span class="pill">${t['ag.badge']}</span>
      <h2 class="h2">${c.sample}</h2>
      <dl><dt>${t['ac.input']}</dt><dd>${agent.input}</dd>
      <dt>${t['ac.result']}</dt><dd>${agent.output}</dd></dl>
      <p class="note">${t['ac.note']}</p>
    </section></div>`);
}

function render() {
  document.documentElement.lang = lang;
  document.title = catalogCopy(lang).title + ' — Keme AI';
  document.querySelectorAll('[data-label]').forEach(el => { el.textContent = T[lang][el.dataset.label]; });
  document.querySelectorAll('[data-lang]').forEach(button => {
    const active = button.dataset.lang === lang;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active);
  });
  if (id === null) renderList();
  else renderProfile();
}
document.querySelector('.lang').addEventListener('click', event => {
  const button = event.target.closest('[data-lang]');
  if (!button) return;
  lang = button.dataset.lang;
  try { localStorage.setItem('keme-lang', lang); } catch { /* private browsing */ }
  render();
});
root.addEventListener('input', event => {
  if (event.target.id !== 'search') return;
  query = event.target.value;
  history.replaceState(null, '', listUrl());
  renderResults();
});
root.addEventListener('click', event => {
  const button = event.target.closest('[data-group], [data-reset]');
  if (!button) return;
  group = button.dataset.group || 'all';
  if (button.hasAttribute('data-group')) closeFilter(true);
  if (button.hasAttribute('data-reset')) {
    query = '';
    const search = root.querySelector('#search');
    search.value = '';
    search.focus();
  }
  history.replaceState(null, '', listUrl());
  renderResults();
});
function closeFilter(restoreFocus) {
  const filter = root.querySelector('.directory-filter[open]');
  if (!filter) return;
  filter.open = false;
  if (restoreFocus) filter.querySelector('summary').focus();
}
document.addEventListener('click', event => {
  if (!event.target.closest('.directory-filter')) closeFilter(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeFilter(true);
});
render();
