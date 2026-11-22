import { catalogCopy, profileUrl } from './catalog-data.js';
import { T } from './i18n.js';

const symbols = {
  sup: '<path d="M4 4.5h16v12H11l-5.5 4v-4H4z"/><path d="M8 9h8m-8 3h5"/>',
  mkt: '<path d="m3 10 12-4 4-2v15l-4-2-12-3zM6 15l2 6h3l-2-5m6-10v11"/>',
  hr: '<circle cx="9" cy="8" r="3.3"/><path d="M2.5 20c.5-6.7 12.5-6.7 13 0M16 8h6m-5 4h4"/>',
};

export function agentMark(id) {
  return `<span class="agent-mark tone-${id}" aria-hidden="true"><i></i><i></i><b><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${symbols[id]}</svg></b></span>`;
}

export function agentCard(agent, lang, actions = '') {
  const c = catalogCopy(lang);
  return `<article class="acard directory-card">
    <div class="acard__top">${agentMark(agent.id)}<span class="pill">${T[lang]['ag.badge']}</span></div>
    <p class="acard__cat">${agent.category}</p>
    <h3><a href="${profileUrl(agent.id)}">${agent.name}${actions ? ' <small aria-hidden="true">↗</small>' : ''}</a></h3>
    <p class="acard__task">${agent.task}</p>
    <div class="directory-card__foot">${actions || `<a class="link" href="${profileUrl(agent.id)}" aria-label="${c.profile} · ${agent.name}">${c.profile} <span aria-hidden="true">↗</span></a>`}</div>
  </article>`;
}
