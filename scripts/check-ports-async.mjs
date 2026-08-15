#!/usr/bin/env node
/**
 * Порт переживёт вынос расширения за границу процесса — но только тот порт,
 * который эту границу пересечёт (ADR-18).
 *
 * Требовать асинхронности от всех портов подряд смысла нет: расширение,
 * которое остаётся в монолите, зовёт ядро внутри процесса, и синхронный метод
 * там будет работать всегда. Проверяются порты, заявленные расширениями из
 * `PORTABLE` — теми, что планируются к выносу.
 *
 * Проверок две, и вторая важнее:
 *
 *  1. **Синхронная сигнатура.** Сетевой адаптер не вернёт значение синхронно.
 *     Чинится сменой типа на `Promise<…>` — механическая работа, её можно
 *     делать в момент выноса, ничего не теряя.
 *
 *  2. **Объект с методами в сигнатуре.** По сети его не передать: ядро не
 *     может держать у себя обработчик, живущий в чужом процессе. Сменой
 *     сигнатуры это не лечится — меняется сам приём, поэтому такие места
 *     разбираются заранее (FC1-22), а не на переезде.
 *
 * Запуск: node scripts/check-ports-async.mjs
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SECTIONS = ['core-ports', 'cross-plugin-ports', 'hooks'];

/**
 * Расширения, которые планируются к выносу из монолита.
 *
 * Пока это Стол заказов — под него и заведён каталог приложений. Список
 * ведётся руками: признака «выносимое» в реестре расширений нет, и появится он
 * не раньше, чем каталог приложений определится с транспортом (487-17).
 * Добавили расширение сюда — гейт сразу покажет, что у него не переживёт вынос.
 */
const PORTABLE = ['marketplace'];

/**
 * Порты, которые пересекать границу не будут даже у выносимого расширения.
 * Не «долг», а решение: у вынесенного приложения эта служба своя.
 */
const STAYS_LOCAL = {
  LOGGER_PORT: 'у вынесенного расширения свой логгер, по сети он не ходит',
};

/** Синхронные методы портов, которые границу пересекут. Долг FC1-22. */
const KNOWN_SYNC = {
  'IAgreementCatalogPort.getAgreementById': 'чтение справочника соглашений',
  'IExtensionDatabasePort.getConnection': 'соединение с БД; после выноса БД у расширения своя, порт скорее исчезнет',
  'IOnboardingStepRegistryPort.registerStep': 'реестр шагов онбординга, передаются данные',
  'IOnboardingStepRegistryPort.unregisterStepsByExtension': 'реестр шагов онбординга',
  'IRegistrationRegistryPort.registerAgreement': 'реестр оферт вступления, передаются данные',
  'IRegistrationRegistryPort.unregisterAgreement': 'реестр оферт вступления',
  'IRegistrationRegistryPort.registerProgram': 'реестр программ вступления, передаются данные',
  'IRegistrationRegistryPort.unregisterProgram': 'реестр программ вступления',
  'IChainPort.initialize': 'передача ключа подписи; по сети ключ не отдаём — приём меняется целиком',
  'IDesktopGrantsRegistryPort.register': 'см. долг по объектам с методами',
  'IRegistrationDocumentParametersRegistryPort.registerProgramHook': 'см. долг по объектам с методами',
  'IRegistrationDocumentParametersRegistryPort.registerMarketplaceHook': 'см. долг по объектам с методами',
  'IFileStoragePort.getBucket': 'см. долг по объектам с методами',
};

/** Сигнатуры, передающие объект с методами. Настоящий предмет FC1-22. */
const KNOWN_HANDLE_OBJECTS = {
  'IDesktopGrantsRegistryPort.register': 'кладёт в реестр ядра объект прав расширения',
  'IRegistrationDocumentParametersRegistryPort.registerProgramHook': 'кладёт в реестр ядра хук параметров оферт',
  'IRegistrationDocumentParametersRegistryPort.registerMarketplaceHook': 'кладёт в реестр ядра хук параметров оферт',
  'IFileStoragePort.getBucket': 'отдаёт расширению объект бакета с методами',
};

function readSources() {
  const files = [];
  for (const section of SECTIONS) {
    const dir = join(REPO_ROOT, 'components/innercoop/src', section);
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.ts') || file === 'index.ts') continue;
      files.push({ path: join(dir, file), rel: `${section}/${file}`, src: readFileSync(join(dir, file), 'utf8') });
    }
  }
  return files;
}

/** Порты, заявленные выносимыми расширениями. */
function portsOfPortableExtensions() {
  const ports = new Set();
  const extRoot = join(REPO_ROOT, 'components/controller/src/extensions');
  for (const name of PORTABLE) {
    const file = join(extRoot, name, `${name}.ports.ts`);
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/^ {4}([A-Z][A-Z0-9_]+),$/gm)) ports.add(m[1]);
  }
  return ports;
}

/** Интерфейсы пакета, у которых есть методы — такой тип по сети не передать. */
function interfacesWithMethods(files) {
  const withMethods = new Set();
  for (const { src } of files) {
    for (const m of src.matchAll(/export interface (\w+)\s*\{([\s\S]*?)\n\}/g)) {
      const [, name, body] = m;
      if (/^ {2}\w+\s*\([^)]*\)\s*:/m.test(body)) withMethods.add(name);
    }
  }
  return withMethods;
}

const files = readSources();
const portable = portsOfPortableExtensions();
const handleTypes = interfacesWithMethods(files);

const syncFound = [];
const handleFound = [];

for (const { rel, src } of files) {
  // токены порта, объявленные в этом файле
  const tokens = [...src.matchAll(/export const ([A-Z][A-Z0-9_]+) = Symbol\.for\(/g)].map((m) => m[1]);
  const crossesBoundary = tokens.some((t) => portable.has(t) && !(t in STAYS_LOCAL));
  if (!crossesBoundary) continue;

  for (const iface of src.matchAll(/export interface (I\w+)\s*\{([\s\S]*?)\n\}/g)) {
    const [, name, body] = iface;
    for (const method of body.matchAll(/^ {2}(\w+)\s*\(([^)]*)\)\s*:\s*([^;]+);/gm)) {
      const [, methodName, params, returns] = method;
      const key = `${name}.${methodName}`;

      if (!/Promise<|Observable</.test(returns)) syncFound.push({ key, rel, returns: returns.trim() });

      const mentioned = [...`${params} ${returns}`.matchAll(/\b(I[A-Z]\w+|Inner[A-Z]\w+)\b/g)].map((m) => m[1]);
      if (mentioned.some((t) => handleTypes.has(t))) {
        handleFound.push({ key, rel, types: mentioned.filter((t) => handleTypes.has(t)).join(', ') });
      }
    }
  }
}

let failed = false;

function report(found, known, title, hint) {
  const foundKeys = new Set(found.map((f) => f.key));
  const unexpected = found.filter((f) => !(f.key in known));
  const resolved = Object.keys(known).filter((k) => !foundKeys.has(k));

  if (unexpected.length) {
    failed = true;
    console.error(`  ${title}`);
    for (const f of unexpected) console.error(`    ${f.key}   (${f.rel})${f.returns ? ` -> ${f.returns}` : ''}${f.types ? ` — ${f.types}` : ''}`);
    console.error(`\n  ${hint}\n`);
  }
  if (resolved.length) {
    failed = true;
    console.error(`  Разобрано — уберите из списка в scripts/check-ports-async.mjs:`);
    for (const k of resolved) console.error(`    ${k}`);
  }
}

report(
  syncFound,
  KNOWN_SYNC,
  'Синхронный метод порта, который пересечёт границу процесса (ADR-18):',
  'Верните `Promise<…>` либо впишите метод в KNOWN_SYNC с причиной.'
);

report(
  handleFound,
  KNOWN_HANDLE_OBJECTS,
  'Порт передаёт объект с методами — по сети его не отдать (ADR-18):',
  'Приём меняется целиком: ядро должно звать расширение, а не хранить его объект. Осознанное исключение — в KNOWN_HANDLE_OBJECTS.'
);

if (failed) process.exit(1);

console.log(
  `  порты выносимых расширений (${PORTABLE.join(', ')}): ` +
    `${syncFound.length} синхронных, ${handleFound.length} с объектом-обработчиком — известные, долг FC1-22`
);
