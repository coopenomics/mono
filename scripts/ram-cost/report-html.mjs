#!/usr/bin/env node
// HTML-отчёт замера оперативной памяти: сводка по процессам и разбор каждого
// процесса по этапам. Формула и дни процессов — model.mjs.
//
// Использование: node scripts/ram-cost/report-html.mjs <каталог отчётов> <файл.html> [номер прогона]

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { PROCESS_DAYS, ax, axonPerDay, kb, loadRun, processRow } from './model.mjs';

const [dir, outFile, runId] = process.argv.slice(2);
if (!dir || !outFile) {
  console.error('Использование: report-html.mjs <каталог отчётов> <файл.html> [номер прогона]');
  process.exit(2);
}
const { price, reports } = loadRun(dir);
if (!reports.length) {
  console.error(`В ${dir} нет отчётов процессов`);
  process.exit(1);
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const runUrl = runId ? `https://github.com/coopenomics/mono/actions/runs/${runId}` : '';
const generated = reports[0].r.generated_at?.slice(0, 10) ?? '';

/** Список «ключ +число» для ячейки: кто держит память или какие строки лежат. */
function list(d) {
  const items = Object.entries(d ?? {}).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  return items.length ? items.map(([k, v]) => `<div>${esc(k)} <b>${v > 0 ? '+' : ''}${v}</b></div>`).join('') : '<span class="muted">—</span>';
}

function summaryTable() {
  const rows = reports.map(({ slug, r }) => {
    const p = processRow(slug, r, price);
    return `<tr>
      <td>${esc(p.title)}</td>
      <td class="n">${kb(p.peakAll)}</td><td class="n">${kb(p.peakCoop)}</td>
      <td class="n">${ax(p.dayAll)}</td><td class="n">${ax(p.dayCoop)}</td>
      <td class="n">${p.days}</td>
      <td class="n strong">${ax(p.processAll)}</td><td class="n strong">${ax(p.processCoop)}</td>
      <td class="n">${kb(p.residual)}</td>
    </tr>`;
  }).join('');
  return `<table>
    <thead>
      <tr><th rowspan="2">процесс</th><th colspan="2">пик, КБ</th><th colspan="2">AXON в сутки</th><th rowspan="2">дней</th><th colspan="2">AXON за процесс</th><th rowspan="2">остаётся после процесса, КБ</th></tr>
      <tr><th>всего</th><th>кооператив</th><th>всего</th><th>кооператив</th><th>всего</th><th>кооператив</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function processSection({ slug, r }) {
  const p = processRow(slug, r, price);
  const rows = r.stages.map((s, i) => {
    const peak = s.key === r.totals.peak.stage;
    return `<tr class="${peak ? 'peak' : ''}">
      <td class="n">${i + 1}</td>
      <td>${esc(s.title)}${peak ? ' <span class="tag">пик</span>' : ''}</td>
      <td class="muted">${esc(s.awaits)}</td>
      <td class="n">${kb(s.held_bytes)}</td><td class="n">${kb(s.payer_held_bytes)}</td>
      <td class="n">${ax(axonPerDay(price, s.held_bytes))}</td><td class="n">${ax(axonPerDay(price, s.payer_held_bytes))}</td>
      <td class="small">${list(s.accounts_held)}</td>
      <td class="small">${list(s.rows_held)}</td>
    </tr>`;
  }).join('');
  return `<section>
    <h3>${esc(p.title)}</h3>
    <p>Пик <b>${kb(p.peakAll)} КБ</b> (кооператив ${kb(p.peakCoop)} КБ) — этап «${esc(p.peakStage)}».
      В сутки <b>${ax(p.dayAll)} AXON</b> (кооператив ${ax(p.dayCoop)}). ${p.days} дн. → <b>${ax(p.processAll)} AXON</b> за процесс (кооператив ${ax(p.processCoop)}).
      После процесса остаётся ${kb(p.residual)} КБ.</p>
    <table class="stages">
      <thead>
        <tr><th rowspan="2">№</th><th rowspan="2">этап</th><th rowspan="2">процесс ждёт</th><th colspan="2">держит, КБ</th><th colspan="2">AXON в сутки</th><th rowspan="2">кто держит, байт от начала</th><th rowspan="2">строки таблиц от начала</th></tr>
        <tr><th>всего</th><th>кооп.</th><th>всего</th><th>кооп.</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

const priceLine = price
  ? `<b>1 КБ в сутки = ${(price.axon_per_byte_day * 1024).toFixed(4)} AXON</b> (1 байт в сутки = ${price.axon_per_byte_day} AXON). Цена замерена арендой: кооператив заплатил <code>powerup</code> ${price.payment_axon} AXON, квота выросла на ${price.bytes_per_payment} Б на ${price.powerup_days} сут.`
  : 'Цена памяти в этом прогоне не замерена — колонки AXON пусты.';

const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Оперативная память цепи: стоимость типовых процессов</title>
<style>
  :root { --ink:#1b1f24; --muted:#6b7280; --line:#e5e7eb; --soft:#f6f7f9; --accent:#2f5bd3; --peak:#fff7e0; }
  * { box-sizing:border-box; }
  body { margin:0; font:15px/1.5 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color:var(--ink); background:#fff; }
  main { max-width:1200px; margin:0 auto; padding:32px 24px 64px; }
  h1 { font-size:26px; margin:0 0 4px; } h2 { font-size:20px; margin:36px 0 12px; } h3 { font-size:17px; margin:28px 0 8px; }
  p { margin:8px 0; } .muted { color:var(--muted); } .small { font-size:12px; } code { background:var(--soft); padding:1px 4px; border-radius:4px; }
  .box { background:var(--soft); border:1px solid var(--line); border-radius:8px; padding:14px 18px; margin:16px 0; }
  table { width:100%; border-collapse:collapse; margin:8px 0 4px; }
  th, td { border:1px solid var(--line); padding:6px 8px; vertical-align:top; text-align:left; }
  th { background:var(--soft); font-weight:600; font-size:13px; }
  td.n { text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; } td.strong { font-weight:700; }
  tr.peak td { background:var(--peak); } .tag { font-size:11px; background:#f2c94c; border-radius:4px; padding:0 5px; }
  .stages td.small div { white-space:nowrap; }
  a { color:var(--accent); }
</style>
</head>
<body>
<main>
  <h1>Оперативная память цепи: стоимость типовых процессов</h1>
  <p class="muted">Замер ${esc(generated)}${runId ? ` · прогон <a href="${runUrl}">${esc(runId)}</a>` : ''} · workflow <code>ram-cost.yaml</code></p>

  <div class="box">
    <p>${priceLine}</p>
    <p><b>AXON в сутки</b> = пик памяти процесса × цена. <b>AXON за процесс</b> = AXON в сутки × дней процесса.
      Пик — потому что аренда даёт квоту на срок, и её должно хватить на самый тяжёлый момент процесса.</p>
    <p><b>Всего</b> — вся память процесса, кто бы её ни оплачивал. <b>Кооператив</b> — только память, которую цепь списала с кооператива.</p>
    <p>Дни процессов — допущения (поставка и вступление 3, «Образование» 14 — по решению владельца; остальные — оценка): ${Object.entries(PROCESS_DAYS).map(([k, v]) => `${esc(k)} ${v}`).join(', ')}.
      Поменять: <code>RAM_COST_PROCESS_DAYS='{"education":7}'</code>.</p>
  </div>

  <h2>Сводка</h2>
  ${summaryTable()}
  <p class="small muted">Собрание — цена всего собрания. Голос участника пишет 8 Б в список голосов каждого вопроса повестки; при двух вопросах пик не растёт до ~140 голосующих. Доля одного пайщика — цена собрания, делённая на число участников.
    Поставка, вступление, «Образование», выход и паевой взнос замерены на одного пайщика. «Остаётся после процесса» — память, которая живёт дальше (пайщик в кооперативе, открытая подписка ученика); отрицательное — память, которую процесс освободил.</p>

  <h2>Процессы по этапам</h2>
  <p class="muted">«Держит» — байты от снимка «до процесса», пока процесс ждёт следующего шага. Строка пика подсвечена.</p>
  ${reports.map(processSection).join('\n')}

  <p class="small muted" style="margin-top:40px">Файл: ~/shared/artifacts/ram-cost/ · собирает scripts/ram-cost/pull.sh из артефакта прогона ram-cost.</p>
</main>
</body>
</html>
`;

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, html);
console.log(outFile);
