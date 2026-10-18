// Модель стоимости оперативной памяти процесса — общая для сводки прогона
// (summary.mjs) и HTML-отчёта (report-html.mjs).
//
//   AXON в сутки    = пик памяти × цена байта в сутки (замер арендой powerup);
//   AXON за процесс = AXON в сутки × дней процесса.
//
// Пик — потому что аренда даёт квоту на срок, и квоты должно хватить на самый
// тяжёлый момент процесса. Дни процесса — PROCESS_DAYS (решение владельца
// 18.10.2026: поставка и вступление — 3 дня, «Образование» — 14), их
// переопределяет `RAM_COST_PROCESS_DAYS` (JSON «процесс → дни»).

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Сколько дней идёт процесс: ключ — имя отчёта процесса. Порядок — порядок в отчётах. */
export const PROCESS_DAYS = {
  'marketplace-order': 3,
  'marketplace-order-first': 3,
  'registration': 3,
  'education': 14,
  'general-meet': 14,
  'general-meet-restart': 28,
  'free-decision': 7,
  'membership-exit': 14,
  'share-deposit': 1,
  ...(process.env.RAM_COST_PROCESS_DAYS ? JSON.parse(process.env.RAM_COST_PROCESS_DAYS) : {}),
};

const ORDER = Object.keys(PROCESS_DAYS);

/** Цена и отчёты процессов из каталога прогона. */
export function loadRun(dir) {
  if (!dir || !existsSync(dir))
    return { price: null, reports: [] };
  const price = existsSync(join(dir, 'price.json')) ? JSON.parse(readFileSync(join(dir, 'price.json'), 'utf8')) : null;
  const rank = slug => (ORDER.includes(slug) ? ORDER.indexOf(slug) : ORDER.length);
  const reports = readdirSync(dir)
    .filter(f => f.endsWith('.json') && f !== 'price.json')
    .map(f => ({ slug: f.replace(/\.json$/, ''), r: JSON.parse(readFileSync(join(dir, f), 'utf8')) }))
    .sort((a, b) => rank(a.slug) - rank(b.slug) || a.slug.localeCompare(b.slug));
  return { price, reports };
}

/** Байты → AXON в сутки по замеренной цене (нет цены — null). */
export function axonPerDay(price, bytes) {
  return price ? bytes * price.axon_per_byte_day : null;
}

/** Строка сводки процесса: пик, AXON в сутки, дни, AXON за процесс — всего и кооператив. */
export function processRow(slug, r, price) {
  const peakAll = r.totals.peak.bytes;
  const peakCoop = r.payer_totals.peak.bytes;
  const days = PROCESS_DAYS[slug] ?? r.days_total;
  const dayAll = axonPerDay(price, peakAll);
  const dayCoop = axonPerDay(price, peakCoop);
  return {
    slug,
    title: r.process,
    peakAll,
    peakCoop,
    peakStage: r.stages.find(s => s.key === r.totals.peak.stage)?.title ?? r.totals.peak.stage,
    dayAll,
    dayCoop,
    days,
    processAll: dayAll === null ? null : dayAll * days,
    processCoop: dayCoop === null ? null : dayCoop * days,
    residual: r.totals.residual_bytes,
  };
}

export const kb = b => (b / 1024).toFixed(2);
export const ax = v => (v === null || v === undefined ? '—' : v.toFixed(2));
