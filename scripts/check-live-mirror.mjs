#!/usr/bin/env node
// Гейт «экран без зеркала».
//
// Экран, который загружает данные при открытии (onMounted/onBeforeMount,
// watch с immediate) или опрашивает сервер по таймеру, обязан иметь ws-зеркало:
// живое обновление по ленте изменений цепи —
//
//   useLiveReload([liveTable(CapitalContract, CapitalContract.Tables.Contributors)], reload)
//
// (или useMarketplaceRealtime у Стола заказов). Иначе экран показывает то,
// что было на момент открытия, и пайщик узнаёт об изменении перезагрузкой.
//
// Нет источника (данные только из localStorage, статичный справочник) —
// пометка с причиной, её гейт выводит списком:
//
//   // realtime: нет источника — ширина панели из localStorage
//
// Тронул файл — переведи. Проверяются экраны: pages/ и widgets/ ядра и
// расширений.
//
// Использование:
//   node scripts/check-live-mirror.mjs            проверка
//   node scripts/check-live-mirror.mjs --update   переснять снимок (только вниз)

import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { REPO_ROOT, listFiles, splitLines, verdict } from './lib/fact-gates.mjs';

const ROOTS = ['components/desktop/src', 'components/desktop/extensions'];
const SCREEN = /\/(pages|widgets)\//;
const EXCLUDE = [/\/_dev\//];

const LOAD = /\b(load|fetch|refresh|reload|init|get)[A-Za-z0-9_]*\s*\(|\bclient\.Query\b|\.Query\(/;
const POLL = /\b(setInterval|useDataPoller)\s*\(/;
const MIRROR = /\b(useLiveReload|useMarketplaceRealtime|registerLiveReload)\s*\(/;
const HOOK = /\b(onMounted|onBeforeMount|onActivated)\s*\(/g;
const WATCH = /\bwatch(Effect)?\s*\(/g;

/** Текст вызова от открывающей скобки до парной закрывающей. */
function callBody(code, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < code.length; i++) {
    if (code[i] === '(') depth++;
    else if (code[i] === ')') {
      depth--;
      if (depth === 0) return code.slice(openIndex, i + 1);
    }
  }
  return code.slice(openIndex);
}

function lineOf(code, index) {
  return code.slice(0, index).split('\n').length;
}

/** Первая загрузка при открытии или опрос — { line, text } либо null. */
function findLoader(code) {
  for (const m of code.matchAll(HOOK)) {
    const body = callBody(code, m.index + m[0].length - 1);
    if (LOAD.test(body)) return { index: m.index, text: m[0] };
  }
  for (const m of code.matchAll(WATCH)) {
    const body = callBody(code, m.index + m[0].length - 1);
    const immediate = m[1] === 'Effect' || /immediate:\s*true/.test(body);
    if (immediate && LOAD.test(body)) return { index: m.index, text: `${m[0]} immediate` };
  }
  const poll = code.match(POLL);
  if (poll) return { index: poll.index, text: poll[0] };
  return null;
}

const found = {};
const optOuts = [];
for (const file of listFiles(ROOTS, { exts: ['.vue'], exclude: EXCLUDE })) {
  if (!SCREEN.test(file)) continue;
  const text = readFileSync(join(REPO_ROOT, file), 'utf8');
  const scripts = [...text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
  const lines = splitLines(scripts);
  const code = lines.map((l) => l.code).join('\n');

  const loader = findLoader(code);
  if (!loader || MIRROR.test(code)) {
    found[file] = [];
    continue;
  }
  const optOut = lines.map((l) => l.comment.match(/\brealtime:\s*(\S.*)$/)).find(Boolean);
  if (optOut) {
    optOuts.push(`${file} — ${optOut[1].trim()}`);
    found[file] = [];
    continue;
  }
  found[file] = [{ line: lineOf(code, loader.index), text: `${loader.text} — загрузка без живого обновления` }];
}

console.log('гейт «экран без зеркала»');
const code = verdict({
  title: 'экран без зеркала',
  baselinePath: join(REPO_ROOT, 'scripts/lib/live-mirror-baseline.json'),
  found,
  note:
    'Экраны (pages/, widgets/), которые загружают данные при открытии или опрашивают по таймеру без живого обновления (scripts/check-live-mirror.mjs). Тронул файл — добавь useLiveReload; долг только снижается.',
  hint:
    'Добавьте useLiveReload([liveTable(<Контракт>, <Контракт>.Tables.<Таблица>)], reload) из src/shared/lib/realtime ' +
    '(таблица объявляется в ленте: ядро — chain-changes.service.ts, расширение — CHAIN_CHANGES_PORT). ' +
    'Источника нет — пометка // realtime: нет источника — <причина>.',
});
if (optOuts.length) {
  console.log(`  без зеркала по пометке (${optOuts.length}):`);
  optOuts.forEach((o) => console.log(`    ${o}`));
}
process.exit(code);
