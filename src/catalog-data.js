import { T } from './i18n.js';
import { AGENT_DEMOS } from './api.js';

export const agentIds = Object.keys(AGENT_DEMOS);
export const catalogUrl = '/catalog/';
export const profileUrl = id => catalogUrl + '?agent=' + encodeURIComponent(id);

const copy = {
  ru: {
    title: 'Каталог ИИ-агентов', subtitle: 'Пока в каталоге три демо-агента команды Keme AI. Со временем здесь появятся агенты от других разработчиков для разных задач бизнеса.',
    filter: 'Фильтр', direction: 'Направление', all: 'Все направления',
    search: 'Поиск по названию или задаче', clear: 'Сбросить фильтры', empty: 'Агенты не найдены',
    browse: 'Перейти в каталог', back: 'К каталогу', results: 'Найдено', profile: 'Подробнее', sample: 'Пример задачи', missing: 'Такого агента в каталоге нет',
  },
  kk: {
    title: 'ЖИ-агенттер каталогы', subtitle: 'Әзірге каталогта Keme AI командасының үш демо-агенті бар. Кейін басқа әзірлеушілердің бизнес міндеттеріне арналған агенттері қосылады.',
    filter: 'Сүзгі', direction: 'Бағыт', all: 'Барлық бағыт',
    search: 'Атауы немесе міндеті бойынша іздеу', clear: 'Сүзгілерді тазарту', empty: 'Агенттер табылмады',
    browse: 'Каталогқа өту', back: 'Каталогқа оралу', results: 'Табылды', profile: 'Толығырақ', sample: 'Тапсырма мысалы', missing: 'Каталогта мұндай агент жоқ',
  },
  en: {
    title: 'AI agent catalog', subtitle: 'Explore three demo agents from the Keme AI team. Agents from other developers will join the catalog for a wider range of business tasks.',
    filter: 'Filter', direction: 'Business area', all: 'All business areas',
    search: 'Search by name or task', clear: 'Clear filters', empty: 'No matching agents',
    browse: 'Open catalog', back: 'Back to catalog', results: 'Matches', profile: 'View details', sample: 'Example task', missing: 'This agent is not in the catalog',
  },
};

export const catalogCopy = lang => copy[lang];
export function getAgent(id, lang) {
  const t = T[lang];
  return {
    id, name: t[id + '.name'], category: t[id + '.cat'], task: t[id + '.task'],
    features: [t[id + '.p1'], t[id + '.p2']], input: t['ac.' + id + '.in'], output: t['ac.' + id + '.out'],
  };
}
