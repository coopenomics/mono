#!/usr/bin/env node
// Сводка замера оперативной памяти по всем типовым процессам прогона.
//
// Каждый набор ram-cost (components/boot/src/tests/ram-cost,
// components/api-tests/src/ram-cost) пишет в каталог отчётов JSON процесса —
// этапы, пик, остаток, байт·сутки — и цену памяти `price.json`. Скрипт сводит
// их в одну таблицу: какой процесс сколько держит на пике и сколько стоит
// аренда памяти — посуточно по этапам и за одно окно аренды.
//
// Использование: node scripts/ram-cost/summary.mjs <каталог отчётов>
// Выход — Markdown в stdout (workflow кладёт его в сводку прогона).

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

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

const kb = b => (Math.abs(b) >= 1024 ? `${(b / 1024).toFixed(2)} КБ` : `${b} Б`);
const ax = v => (v === null || v === undefined ? '—' : v.toFixed(4));
const titleOf = (r, key) => r.stages.find(s => s.key === key)?.title ?? key;

const out = [];
out.push('# Оперативная память цепи: сводка по типовым процессам', '');
if (price) {
  out.push(`Цена памяти замерена арендой: ${price.payment_axon} AXON → ${price.bytes_per_payment} Б на ${price.powerup_days} сут. `
    + `**1 КБ·сутки = ${(price.axon_per_byte_day * 1024).toFixed(4)} AXON.** `
    + 'Сутки этапов — допущения наборов, их задаёт каждый набор; «окно» — одна аренда пика на срок `powerup`.', '');
}
else {
  out.push('> Цена памяти не замерена — колонки AXON пусты.', '');
}

out.push('| процесс | пик, вся цепь | пик, кооператив | этап пика | остаток после завершения | сутки процесса | AXON посуточно, вся цепь | AXON посуточно, кооператив | AXON за окно, вся цепь | AXON за окно, кооператив |');
out.push('|---|---|---|---|---|---|---|---|---|---|');
for (const { r } of reports) {
  const t = r.totals;
  const c = r.payer_totals;
  out.push(`| ${r.process} | ${kb(t.peak.bytes)} | ${kb(c.peak.bytes)} | ${titleOf(r, t.peak.stage)} | ${kb(t.residual_bytes)} | ${r.days_total} | ${ax(t.axon)} | ${ax(c.axon)} | ${ax(t.peak_window_axon)} | ${ax(c.peak_window_axon)} |`);
}
out.push('');
out.push('Подробности по этапам — в отчёте каждого процесса ниже и в артефакте прогона (`ram-cost/<процесс>.md` и `.json`).', '');
console.log(out.join('\n'));
