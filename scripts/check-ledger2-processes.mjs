#!/usr/bin/env node
// Гейт согласованности реестров имён процессов ledger2.
//
// Зачем. Имя нитки (`process_type`) эмитит контракт-инициатор, а `ledger2::apply`
// сверяет его с перечнем `processes::PROCESS_REGISTRY`. Дальше это же имя должно
// быть известно ещё двум местам: `cooptypes` (человеческое название для UI) и
// локатору бэкенда (где искать entity-hash процесса). Рассинхронизация любого
// из трёх мест обнаруживается поздно и по-разному:
//
//   - имя объявлено в processes.hpp, но забыто в PROCESS_REGISTRY
//       → транзакция падает на проде «Unknown process type»;
//   - имя есть в контракте, но нет в cooptypes
//       → в реестре процессов вместо названия виден технический код;
//   - имя есть в контракте, но нет в локаторе
//       → getProcess отдаёт 400 «локатор требует обновления».
//
// Ни одно из трёх не ловится ни компиляцией контракта, ни юнит-тестами
// бэкенда, поэтому проверка вынесена в гейт.
//
// Запуск: node scripts/check-ledger2-processes.mjs   (входит в `pnpm check`)

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const HPP = 'components/contracts/cpp/lib/core/ledger2/processes.hpp';
const TS = 'components/cooptypes/src/ledger2/processes.ts';
const LOCATOR = 'components/controller/src/domain/process-registry/config/process-hash-locator.ts';

function read(relPath) {
  try {
    return readFileSync(join(REPO_ROOT, relPath), 'utf8');
  } catch (error) {
    console.error(`✗ не читается ${relPath}: ${error.message}`);
    process.exit(2);
  }
}

/**
 * Вырезает комментарии C++.
 *
 * Без этого закомментированная строка реестра продолжает «числиться» в нём:
 * идентификаторы читаются из текста, а текст комментария никуда не делся.
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, '');
}

/**
 * Константы процессов из processes.hpp: `ns::CONST` → `p.x.y`.
 *
 * Namespace определяется последним встреченным `namespace <ns> {` — вложенность
 * в файле ровно одна (processes → contract), поэтому этого достаточно.
 */
function parseContractConstants(rawSource) {
  const source = stripComments(rawSource);
  const constants = new Map();
  let ns = null;
  for (const line of source.split('\n')) {
    const nsMatch = line.match(/^\s*namespace\s+([a-z_][a-z0-9_]*)\s*\{/i);
    if (nsMatch && nsMatch[1] !== 'processes') {
      ns = nsMatch[1];
      continue;
    }
    const constMatch = line.match(/inline\s+constexpr\s+eosio::name\s+([A-Z_][A-Z0-9_]*)\s*=\s*"(p\.[a-z0-9.]+)"_n\s*;/);
    if (constMatch && ns) {
      constants.set(`${ns}::${constMatch[1]}`, constMatch[2]);
    }
  }
  return constants;
}

/** Ссылки `ns::CONST`, перечисленные в массиве PROCESS_REGISTRY. */
function parseRegistryRefs(rawSource) {
  const source = stripComments(rawSource);
  const start = source.indexOf('PROCESS_REGISTRY[]');
  if (start < 0) return null;
  const open = source.indexOf('{', start);
  const close = source.indexOf('};', open);
  if (open < 0 || close < 0) return null;
  const body = source.slice(open + 1, close);
  return [...body.matchAll(/([a-z_][a-z0-9_]*)::([A-Z_][A-Z0-9_]*)/g)].map((m) => `${m[1]}::${m[2]}`);
}

/** Значения `type:` из LEDGER2_PROCESS_REGISTRY в cooptypes. */
function parseCooptypes(source) {
  return [...source.matchAll(/type:\s*'(p\.[a-z0-9.]+)'/g)].map((m) => m[1]);
}

/** Ключи объекта PROCESS_HASH_LOCATOR и значения BACKEND_OVERRIDES. */
function parseLocator(source) {
  const start = source.indexOf('PROCESS_HASH_LOCATOR');
  const open = source.indexOf('Object.freeze({', start);
  const close = source.indexOf('\n});', open);
  const body = source.slice(open, close);
  const keys = [...body.matchAll(/^\s*'(p\.[a-z0-9.]+)':/gm)].map((m) => m[1]);

  const ovStart = source.indexOf('BACKEND_OVERRIDES');
  const ovOpen = source.indexOf('Object.freeze({', ovStart);
  const ovClose = source.indexOf('});', ovOpen);
  const overrides = [...source.slice(ovOpen, ovClose).matchAll(/'(o\.[a-z0-9.]+)':\s*'(p\.[a-z0-9.]+)'/g)].map(
    (m) => m[2]
  );

  return { keys, overrides };
}

const problems = [];

const hppSource = read(HPP);
const constants = parseContractConstants(hppSource);
const refs = parseRegistryRefs(hppSource);

if (!constants.size) problems.push(`${HPP}: не найдено ни одной константы процесса — изменился формат объявления?`);
if (refs === null) {
  problems.push(`${HPP}: не найден массив PROCESS_REGISTRY — изменился формат объявления?`);
}

const registryNames = new Set();
for (const ref of refs ?? []) {
  const value = constants.get(ref);
  if (!value) {
    problems.push(`${HPP}: PROCESS_REGISTRY ссылается на ${ref}, но такой константы процесса нет.`);
    continue;
  }
  registryNames.add(value);
}

// (A) объявили имя, но не внесли в перечень → apply отвергнет его на проде.
for (const [ref, value] of constants) {
  if (!registryNames.has(value)) {
    problems.push(
      `${HPP}: ${ref} = '${value}' объявлен, но отсутствует в PROCESS_REGISTRY — ` +
        `ledger2::apply отвергнет это имя как неизвестное.`
    );
  }
}

const contractNames = new Set(constants.values());
const cooptypesNames = new Set(parseCooptypes(read(TS)));
const { keys, overrides } = parseLocator(read(LOCATOR));
const locatorKeys = new Set(keys);

// (B) контракт ↔ cooptypes: без человеческого названия UI покажет код.
for (const name of contractNames) {
  if (!cooptypesNames.has(name)) {
    problems.push(`${TS}: нет процесса '${name}' — реестр процессов покажет технический код вместо названия.`);
  }
}
for (const name of cooptypesNames) {
  if (!contractNames.has(name)) {
    problems.push(`${TS}: процесс '${name}' не объявлен в ${HPP} — контракт такое имя эмитить не может.`);
  }
}

// (C) контракт → локатор: иначе getProcess отдаст 400 на живом процессе.
for (const name of contractNames) {
  if (!locatorKeys.has(name)) {
    problems.push(`${LOCATOR}: PROCESS_HASH_LOCATOR не знает '${name}' — деталь процесса ответит 400.`);
  }
}
for (const name of overrides) {
  if (!locatorKeys.has(name)) {
    problems.push(`${LOCATOR}: BACKEND_OVERRIDES указывает на '${name}', которого нет в PROCESS_HASH_LOCATOR.`);
  }
}

if (problems.length > 0) {
  console.error('Реестры процессов ledger2 рассинхронизированы:\n');
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  console.error('');
  process.exit(1);
}

console.log(
  `  процессов в контракте: ${contractNames.size}; ` +
    `в cooptypes: ${cooptypesNames.size}; ключей локатора: ${locatorKeys.size} — согласовано`
);
