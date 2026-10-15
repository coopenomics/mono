#!/usr/bin/env node
// Гейт «пауза вместо факта».
//
// Ответ приходит после факта из цепи: транзакция возвращается, когда узел
// разобрал её блок, а экран обновляется по ленте изменений. Пауза «подождём и
// перечитаем», цикл-ожидание статуса, опрос по таймеру — это прятанье того,
// что факта не дождались. Поэтому каждый таймер обязан объяснить себя
// пометкой рядом:
//
//   // timing: debounce — сбор ввода перед поиском
//
// Виды: debounce, throttle, backoff (повтор после сбоя), timeout (предел
// ожидания факта), animation, schedule (фоновая задача по расписанию), ui.
// Таймер без пометки — долг; тронул файл — пометь или убери.
//
// Использование:
//   node scripts/check-timing.mjs            проверка
//   node scripts/check-timing.mjs --update   переснять снимок (только вниз)

import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { REPO_ROOT, annotationNear, listFiles, splitLines, verdict } from './lib/fact-gates.mjs';

const ROOTS = [
  'components/controller/src',
  'components/extension-kit/src',
  'components/desktop/src',
  'components/desktop/extensions',
];
const EXCLUDE = [/\.spec\.ts$/, /\.test\.ts$/, /\/tests?\//, /\/_dev\//, /\/zeus\//];
const KINDS = ['debounce', 'throttle', 'backoff', 'timeout', 'animation', 'schedule', 'ui'];

// Таймеры и ожидания: setTimeout/setInterval, sleep/delay, опросчик страниц.
const TIMER = /\b(setTimeout|setInterval|sleep|delay|useDataPoller)\s*\(/;

const found = {};
const badKinds = [];
for (const file of listFiles(ROOTS, { exts: ['.ts', '.vue'], exclude: EXCLUDE })) {
  const lines = splitLines(readFileSync(join(REPO_ROOT, file), 'utf8'));
  const hits = [];
  lines.forEach((l, i) => {
    if (!TIMER.test(l.code)) return;
    // Объявление функции-обёртки (function sleep(...)) — не вызов.
    if (/\bfunction\s+(sleep|delay)\b|\b(const|let)\s+(sleep|delay)\s*=/.test(l.code)) return;
    // …и метод класса: `private sleep(ms: number): Promise<void> {`.
    if (/^\s*((private|public|protected|static|async)\s+)*(sleep|delay)\s*\(.*\{\s*$/.test(l.code)) return;
    const note = annotationNear(lines, i, 'timing');
    if (note === null) {
      hits.push({ line: i + 1, text: l.raw });
      return;
    }
    const kind = note.split(/[\s—–-]/)[0];
    if (!KINDS.includes(kind)) badKinds.push(`${file}:${i + 1} — вид «${kind}» не из списка: ${KINDS.join(', ')}`);
  });
  found[file] = hits;
}

console.log('гейт «пауза вместо факта»');
let code = verdict({
  title: 'пауза вместо факта',
  baselinePath: join(REPO_ROOT, 'scripts/lib/timing-baseline.json'),
  found,
  note:
    'Таймеры без пометки `// timing: <вид>` по файлам (scripts/check-timing.mjs). Тронул файл — пометь таймер или убери паузу; долг только снижается.',
  hint:
    'Пауза перед чтением после мутации не нужна: транзакция возвращается после разбора блока, экран обновляется useLiveReload. ' +
    `Законный таймер пометьте: // timing: <${KINDS.join('|')}> — зачем.`,
});
if (badKinds.length) {
  badKinds.forEach((b) => console.log(`  ✖ ${b}`));
  code = 1;
}
process.exit(code);
