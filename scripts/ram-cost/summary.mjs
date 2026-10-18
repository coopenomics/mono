#!/usr/bin/env node
// Сводка замера оперативной памяти по всем типовым процессам прогона.
//
// Каждый набор ram-cost (components/boot/src/tests/ram-cost,
// components/api-tests/src/ram-cost) пишет в каталог отчётов JSON процесса —
// этапы и пик — и цену памяти `price.json`. Скрипт сводит их в одну таблицу
// по одной формуле:
//
//   AXON в сутки   = пик памяти × цена байта в сутки (замер арендой powerup);
//   AXON за процесс = AXON в сутки × дней процесса.
//
// Пик — потому что аренда даёт квоту на срок, и квоты должно хватить на самый
// тяжёлый момент процесса. Дни процесса — по таблице PROCESS_DAYS ниже
// (решение владельца 18.10.2026: поставка и вступление — 3 дня, «Образование» —
// 14), переопределяются `RAM_COST_PROCESS_DAYS` (JSON «процесс → дни»).
//
// Использование: node scripts/ram-cost/summary.mjs <каталог отчётов>
// Выход — Markdown в stdout (workflow кладёт его в сводку прогона).

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Сколько дней идёт процесс: ключ — имя отчёта процесса. */
const PROCESS_DAYS = {
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

const dir = process.argv[2];
if (!dir || !existsSync(dir)) {
  console.log('_Отчётов нет — замер не дошёл до первого процесса._');
  process.exit(0);
}

const price = existsSync(join(dir, 'price.json')) ? JSON.parse(readFileSync(join(dir, 'price.json'), 'utf8')) : null;
const reports = readdirSync(dir)
  .filter(f => f.endsWith('.json') && f !== 'price.json')
  .sort()
  .map(f => ({ slug: f.replace(/\.json$/, ''), r: JSON.parse(readFileSync(join(dir, f), 'utf8')) }));

const kb = b => (b / 1024).toFixed(2);
const ax = v => (v === null ? '—' : v.toFixed(2));
const perDay = b => (price ? b * price.axon_per_byte_day : null);

const out = [];
out.push('# Оперативная память цепи: сводка по типовым процессам', '');
if (price) {
  out.push(`**1 КБ в сутки = ${(price.axon_per_byte_day * 1024).toFixed(4)} AXON** — замер арендой: ${price.payment_axon} AXON → ${price.bytes_per_payment} Б на ${price.powerup_days} сут.`, '');
}
else {
  out.push('> Цена памяти не замерена — колонки AXON пусты.', '');
}
out.push('AXON в сутки = пик × цена; AXON за процесс = AXON в сутки × дней. «Всего» — вся память процесса, «кооператив» — память, которую оплачивает кооператив.', '');
out.push('| процесс | пик, КБ: всего / кооператив | AXON в сутки: всего / кооператив | дней | AXON за процесс: всего / кооператив | остаётся после процесса, КБ |');
out.push('|---|---|---|---|---|---|');
for (const { slug, r } of reports) {
  const all = r.totals.peak.bytes;
  const coop = r.payer_totals.peak.bytes;
  const days = PROCESS_DAYS[slug] ?? r.days_total;
  const dAll = perDay(all);
  const dCoop = perDay(coop);
  out.push(`| ${r.process} | ${kb(all)} / ${kb(coop)} | ${ax(dAll)} / ${ax(dCoop)} | ${days} | ${ax(dAll === null ? null : dAll * days)} / ${ax(dCoop === null ? null : dCoop * days)} | ${kb(r.totals.residual_bytes)} |`);
}
out.push('');
out.push('Собрание — цена всего собрания: голос участника добавляет около 16 Б, доля одного пайщика — цена, делённая на число участников. '
  + 'Подробности по этапам — в отчёте каждого процесса ниже и в артефакте прогона (`ram-cost/<процесс>.md` и `.json`).', '');
console.log(out.join('\n'));
