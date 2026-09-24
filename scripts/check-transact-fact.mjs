#!/usr/bin/env node
// Гейт «транзакция мимо факта».
//
// Транзакция отвечает после факта из цепи потому, что в цепь уходит одна
// дверь — BlockchainService.transact: она ждёт, пока узел разберёт блок
// транзакции. Два правила:
//
//   1. Жёстко: создать сессию wharfkit, вызвать session.transact,
//      push_transaction или send_transaction можно только в
//      components/controller/src/infrastructure/blockchain/blockchain.service.ts.
//      Отправка в обход — это ответ раньше базы.
//
//   2. Храповиком: паузы-обёртки «после транзакции подождём» больше не нужны
//      (waitAfterTransactBeforeChainTableRead). Тронул файл — убери вызов.
//
// Использование:
//   node scripts/check-transact-fact.mjs            проверка
//   node scripts/check-transact-fact.mjs --update   переснять снимок (только вниз)

import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { REPO_ROOT, listFiles, splitLines, verdict } from './lib/fact-gates.mjs';

const ROOTS = ['components/controller/src', 'components/extension-kit/src'];
const EXCLUDE = [/\.spec\.ts$/, /\.test\.ts$/, /\/tests?\//];
const DOOR = 'components/controller/src/infrastructure/blockchain/blockchain.service.ts';

const SEND = /\bnew\s+Session\s*\(|\bsession\.transact\s*\(|\bpush_transaction\s*\(|\bsend_transaction\s*\(/;
const POST_TX_WAIT = /\bwaitAfterTransactBeforeChainTableRead\s*\(/;

const bypass = [];
const found = {};
for (const file of listFiles(ROOTS, { exts: ['.ts'], exclude: EXCLUDE })) {
  const lines = splitLines(readFileSync(join(REPO_ROOT, file), 'utf8'));
  const hits = [];
  lines.forEach((l, i) => {
    if (file !== DOOR && SEND.test(l.code)) bypass.push(`${file}:${i + 1}: ${l.raw.trim().slice(0, 140)}`);
    // Объявление самой обёртки — не вызов.
    if (POST_TX_WAIT.test(l.code) && !/\bfunction\s+waitAfterTransactBeforeChainTableRead\b/.test(l.code)) {
      hits.push({ line: i + 1, text: l.raw });
    }
  });
  found[file] = hits;
}

console.log('гейт «транзакция мимо факта»');
let code = 0;
if (bypass.length) {
  console.log(`  ✖ отправка в цепь мимо ${DOOR}:`);
  bypass.forEach((b) => console.log(`      ${b}`));
  console.log('    Транзакция уходит только через BlockchainService.transact — он ждёт разбора блока.');
  code = 1;
}
code |= verdict({
  title: 'транзакция мимо факта',
  baselinePath: join(REPO_ROOT, 'scripts/lib/transact-fact-baseline.json'),
  found,
  note:
    'Вызовы пауз после транзакции по файлам (scripts/check-transact-fact.mjs). transact уже дождался разбора блока — тронул файл, убери паузу; долг только снижается.',
  hint: 'transact возвращается после разбора блока — чтение таблиц цепи сразу после него уже видит изменения. Паузу уберите.',
});
process.exit(code);
