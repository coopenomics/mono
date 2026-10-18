#!/usr/bin/env node
// Сводка замера оперативной памяти по всем типовым процессам прогона —
// Markdown для сводки прогона в GitHub. Формула и дни процессов — model.mjs.
//
// Использование: node scripts/ram-cost/summary.mjs <каталог отчётов>

import { ax, kb, loadRun, processRow } from './model.mjs';

const { price, reports } = loadRun(process.argv[2]);
if (!reports.length) {
  console.log('_Отчётов нет — замер не дошёл до первого процесса._');
  process.exit(0);
}

const out = [];
out.push('# Оперативная память цепи: сводка по типовым процессам', '');
out.push(price
  ? `**1 КБ в сутки = ${(price.axon_per_byte_day * 1024).toFixed(4)} AXON** — замер арендой: ${price.payment_axon} AXON → ${price.bytes_per_payment} Б на ${price.powerup_days} сут.`
  : '> Цена памяти не замерена — колонки AXON пусты.', '');
out.push('AXON в сутки = пик × цена; AXON за процесс = AXON в сутки × дней. «Всего» — вся память процесса, «кооператив» — память, которую оплачивает кооператив.', '');
out.push('| процесс | пик, КБ: всего / кооператив | AXON в сутки: всего / кооператив | дней | AXON за процесс: всего / кооператив | остаётся после процесса, КБ |');
out.push('|---|---|---|---|---|---|');
for (const { slug, r } of reports) {
  const p = processRow(slug, r, price);
  out.push(`| ${p.title} | ${kb(p.peakAll)} / ${kb(p.peakCoop)} | ${ax(p.dayAll)} / ${ax(p.dayCoop)} | ${p.days} | ${ax(p.processAll)} / ${ax(p.processCoop)} | ${kb(p.residual)} |`);
}
out.push('');
out.push('Собрание — цена всего собрания: голос участника добавляет 8 Б на каждый вопрос повестки, доля одного пайщика — цена, делённая на число участников. '
  + 'Подробности по этапам — в отчёте каждого процесса ниже и в артефакте прогона (`ram-cost/<процесс>.md` и `.json`).', '');
console.log(out.join('\n'));
