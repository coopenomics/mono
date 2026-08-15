#!/usr/bin/env node
/**
 * Порт обязан пережить вынос расширения за границу процесса (ADR-18).
 *
 * Это значит, что вызов порта — сетевой вызов, о котором расширение просто
 * ещё не знает. Синхронная сигнатура делает переход невозможным: адаптер,
 * уходящий по сети, не может вернуть значение синхронно, и заменить его
 * «на месте» не выйдет — придётся переписывать каждого потребителя.
 *
 * Скрипт находит методы портов, не возвращающие `Promise`. Известные —
 * перечислены в `KNOWN_SYNC` с причиной; это долг, заведённый задачей FC1-22.
 * Новый синхронный метод в списке отсутствует, и гейт падает: решение о том,
 * что порт остаётся синхронным, принимается осознанно и записывается сюда,
 * а не проскакивает в ревью.
 *
 * Запуск: node scripts/check-ports-async.mjs
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SECTIONS = ['core-ports', 'cross-plugin-ports', 'hooks'];

/**
 * Синхронные методы, известные на момент принятия ADR-18 (2026-08-15).
 *
 * Ключ — `<Интерфейс>.<метод>`. Значение — причина, по которой метод синхронен
 * сегодня, и что с ним будет при выносе. Ни одна строка отсюда не является
 * разрешением: список разбирается в FC1-22, и пустой список — цель.
 */
const KNOWN_SYNC = {
  // Саморегистрация расширения в реестрах ядра. После выноса это вызов через
  // границу процесса — станет асинхронным. У грантов, провайдеров платежей и
  // хуков оферт вдобавок передаётся объект с методами: по сети так не отдать,
  // ядру придётся звать расширение обратно. Это уже не сигнатура, а приём.
  'IOnboardingStepRegistryPort.registerStep': 'реестр шагов онбординга',
  'IOnboardingStepRegistryPort.unregisterStepsByExtension': 'реестр шагов онбординга',
  'IPaymentProviderRegistryPort.registerProvider': 'реестр провайдеров, передаётся объект с методами',
  'IRegistrationRegistryPort.registerAgreement': 'реестр оферт вступления',
  'IRegistrationRegistryPort.unregisterAgreement': 'реестр оферт вступления',
  'IRegistrationRegistryPort.registerProgram': 'реестр программ вступления',
  'IRegistrationRegistryPort.unregisterProgram': 'реестр программ вступления',
  'IDesktopGrantsRegistryPort.register': 'реестр прав стола, передаётся объект с методами',
  'IRegistrationDocumentParametersRegistryPort.registerProgramHook': 'реестр хуков оферт, передаётся объект с методами',
  'IRegistrationDocumentParametersRegistryPort.registerMarketplaceHook': 'реестр хуков оферт, передаётся объект с методами',

  // Синхронные чтения. Два последних отдают объект с методами — та же беда.
  'IAgreementCatalogPort.getAgreementById': 'чтение из локального справочника',
  'IExtensionDatabasePort.getConnection': 'соединение с БД расширения',
  'IPaymentProviderRegistryPort.getProvider': 'отдаёт объект с методами',
  'IFileStoragePort.getBucket': 'отдаёт объект с методами',

  // Логирование: после выноса у расширения свой логгер, по сети он не ходит.
  // Единственная группа, у которой синхронность может остаться навсегда.
  'ILoggerPort.setContext': 'логгер расширения локален и после выноса',
  'ILoggerPort.log': 'логгер расширения локален и после выноса',
  'ILoggerPort.info': 'логгер расширения локален и после выноса',
  'ILoggerPort.warn': 'логгер расширения локален и после выноса',
  'ILoggerPort.debug': 'логгер расширения локален и после выноса',
  'ILoggerPort.error': 'логгер расширения локален и после выноса',

  // Секреты и ключ кооператива. Отправлять их по сети — отдельное решение,
  // которое ADR-18 не принимает; разбирается вместе с транспортом.
  'ISecretCipherPort.encrypt': 'шифрование секрета расширения',
  'ISecretCipherPort.decrypt': 'расшифровка секрета расширения',
  'IChainPort.initialize': 'передача ключа подписи',
};

function collectSyncMethods() {
  const found = [];
  for (const section of SECTIONS) {
    const dir = join(REPO_ROOT, 'components/innercoop/src', section);
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.ts') || file === 'index.ts') continue;
      const src = readFileSync(join(dir, file), 'utf8');
      const ifaceRe = /export interface (I\w+)\s*\{([\s\S]*?)\n\}/g;
      let iface;
      while ((iface = ifaceRe.exec(src))) {
        const [, name, body] = iface;
        const methodRe = /^ {2}(\w+)\s*\(([^)]*)\)\s*:\s*([^;]+);/gm;
        let method;
        while ((method = methodRe.exec(body))) {
          const [, methodName, , returns] = method;
          if (/Promise<|Observable</.test(returns)) continue;
          found.push({
            key: `${name}.${methodName}`,
            file: `${section}/${file}`,
            returns: returns.trim(),
          });
        }
      }
    }
  }
  return found;
}

const found = collectSyncMethods();
const foundKeys = new Set(found.map((m) => m.key));

const unexpected = found.filter((m) => !(m.key in KNOWN_SYNC));
const resolved = Object.keys(KNOWN_SYNC).filter((key) => !foundKeys.has(key));

if (unexpected.length) {
  console.error('  Синхронный метод порта — вынос расширения его не переживёт (ADR-18):');
  for (const m of unexpected) {
    console.error(`    ${m.key} -> ${m.returns}   (${m.file})`);
  }
  console.error(
    '\n  Верните `Promise<…>` либо, если метод обязан остаться синхронным,\n' +
      '  впишите его в KNOWN_SYNC в scripts/check-ports-async.mjs с причиной.'
  );
  process.exit(1);
}

if (resolved.length) {
  console.error('  Эти методы стали асинхронными — уберите их из KNOWN_SYNC:');
  for (const key of resolved) console.error(`    ${key}`);
  process.exit(1);
}

console.log(`  порты асинхронны, кроме ${found.length} известных (долг FC1-22)`);
