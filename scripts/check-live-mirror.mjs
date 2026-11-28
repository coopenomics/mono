#!/usr/bin/env node
// Гейт «экран без зеркала».
//
// Экран, который загружает данные при открытии (onMounted/onBeforeMount,
// watch с immediate) или опрашивает сервер по таймеру, обязан иметь ws-зеркало:
// живое обновление по ленте изменений цепи —
//
//   useLiveReload([liveTable(CapitalContract, CapitalContract.Tables.Contributors)], reload)
//
// (у Стола заказов — useLiveReload(marketLiveTables(...), reload)). Иначе экран показывает то,
// что было на момент открытия, и пайщик узнаёт об изменении перезагрузкой.
//
// Нет источника (данные только из localStorage, статичный справочник) —
// пометка с причиной, её гейт выводит списком:
//
//   // realtime: нет источника — ширина панели из localStorage
//
// Храповик пометок (слово владельца 28.11.2026: «ты забываешь каждый раз
// строить живые обновления… хотелось бы, чтобы ты помнил»). Пометки сняты
// поимённо в scripts/lib/live-mirror-optouts.json; новую пометку гейт не
// пропускает. Данные базы узла — таблица ленты (declareLocalTables); данные
// внешнего сервиса — сигнал publishLocal от сервера после мутации и по опросу.
// Исключение вносит в список владелец; --update только вычёркивает
// пометки, которых больше нет.
//
// Тронул файл — переведи. Проверяются экраны: pages/ и widgets/ ядра и
// расширений.
//
// Использование:
//   node scripts/check-live-mirror.mjs            проверка
//   node scripts/check-live-mirror.mjs --update   переснять снимок (только вниз)

import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { REPO_ROOT, listFiles, splitLines, verdict } from './lib/fact-gates.mjs';

const ROOTS = ['components/desktop/src', 'components/desktop/extensions'];
// Экраны и их части: страницы, виджеты и фичи с собственной загрузкой.
const SCREEN = /\/(pages|widgets|features)\//;
const EXCLUDE = [/\/_dev\//];

const LOAD = /\b(load|fetch|refresh|reload|init|get)[A-Za-z0-9_]*\s*\(|\bclient\.Query\b|\.Query\(/;
// Хук, которому загрузчик передан ссылкой: onMounted(load), onMounted(loadAll).
const LOAD_REF = /^\(\s*(load|fetch|refresh|reload|init)[A-Za-z0-9_]*\s*\)$/;
// Загрузка прямо на верхнем уровне <script setup>: loadX(), store.loadX({...}).
const TOP_LEVEL_LOAD = /^(?:void\s+|await\s+)?(?:[\w$]+\.)*(load|fetch|refresh|reload)[A-Za-z0-9_]*\s*\(/;
const POLL = /\b(setInterval|useDataPoller)\s*\(/;
// Зеркало — useLiveReload и обёртки над ним с именем useLive* (useLiveProposalList…).
const MIRROR = /\b(useLive[A-Z]\w*|registerLiveReload)\s*\(/;
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
    if (LOAD.test(body) || LOAD_REF.test(body)) return { index: m.index, text: m[0] };
  }
  for (const m of code.matchAll(WATCH)) {
    const body = callBody(code, m.index + m[0].length - 1);
    const immediate = m[1] === 'Effect' || /immediate:\s*true/.test(body);
    if (immediate && LOAD.test(body)) return { index: m.index, text: `${m[0]} immediate` };
  }
  const poll = code.match(POLL);
  if (poll) return { index: poll.index, text: poll[0] };
  let offset = 0;
  for (const line of code.split('\n')) {
    if (TOP_LEVEL_LOAD.test(line)) return { index: offset, text: `${line.trim().slice(0, 40)} — загрузка на верхнем уровне` };
    offset += line.length + 1;
  }
  return null;
}

const OPTOUTS_PATH = join(REPO_ROOT, 'scripts/lib/live-mirror-optouts.json');
const found = {};
const optOuts = [];
/** Файлы с пометкой «нет источника» в этом проходе. */
const optOutFiles = new Set();
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
    optOutFiles.add(file);
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

// Храповик пометок: список только сокращается, пополняет его владелец.
const listed = existsSync(OPTOUTS_PATH) ? JSON.parse(readFileSync(OPTOUTS_PATH, 'utf8')) : { files: [] };
const allowed = new Set(listed.files);
let optOutCode = 0;
if (process.argv.includes('--update')) {
  const kept = listed.files.filter((f) => optOutFiles.has(f));
  writeFileSync(OPTOUTS_PATH, `${JSON.stringify({ ...listed, files: kept }, null, 2)}\n`);
  console.log(`  список пометок: ${kept.length} (вычеркнуто ${listed.files.length - kept.length})`);
} else {
  const fresh = [...optOutFiles].filter((f) => !allowed.has(f)).sort();
  if (fresh.length) {
    optOutCode = 1;
    console.log(`  ✖ новая пометка «нет источника» (${fresh.length}) — подключите живое обновление:`);
    fresh.forEach((f) => console.log(`      ${f}`));
    console.log(
      '\n  Данные базы узла — таблица ленты (CHAIN_CHANGES_PORT.declareLocalTables); данные внешнего сервиса — ' +
        'сигнал publishLocal от сервера после мутации и по опросу. Пометку разрешает только владелец: ' +
        'он вносит файл в scripts/lib/live-mirror-optouts.json.',
    );
  }
}
process.exit(code || optOutCode);
