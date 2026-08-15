/**
 * Story 4.3 contract guard: каждая TypeORM-entity, наследующая `BaseTypeormEntity`
 * (т.е. имеющая блокчейн-колонку `block_num`), должна иметь репозиторий, наследующий
 * `BaseBlockchainRepository`. Иначе:
 *   - на UPDATE-пути не сработает `entityVersioningService.saveVersionBeforeUpdate`,
 *     и `entity_versions` останется пустым;
 *   - на форке `AbstractEntitySyncService.handleFork` сделает `delete WHERE block_num > N`,
 *     но `restoreFromVersions(N)` не сможет восстановить ничего — форк превратится в
 *     безвозвратный hard delete (анти-паттерн из CLAUDE.md «Silent data loss»).
 *
 * Тест сканирует `src/` на entity-классы, для каждой ищет соответствующий
 * `*.typeorm-repository.ts` extends `BaseBlockchainRepository`. Allow-list ведёт 5
 * off-chain артефактов, где `block_num` vestigial (наследовано от base, но не
 * заполняется и не должно откатываться форком). Долгосрочно — отделить базу
 * (см. Epic 9, audit-report-4-3.md).
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const SRC_ROOT = path.resolve(__dirname, '../../../src');

const OFF_CHAIN_BASE_ENTITIES = new Set([
  'comment',
  'cycle',
  'issue',
  'story',
  'time-entry',
  // Метрики и меры результата (кооператив ведёт их у себя): создаются с
  // `block_num: 0`, действия контракта под них нет, delta-маппера и синкера
  // тоже — из цепи они не приезжают, откатывать форком нечего. `block_num`
  // унаследован от базы вместе с остальными служебными полями.
  'component-metric',
  'metric-contribution',
  'issue-metric-binding',
  'measure',
  'timer-session',
]);

function extractEntityClassName(filePath: string): string | null {
  const content = fs.readFileSync(filePath, 'utf-8');
  const m = content.match(/export\s+class\s+(\w+)\s+extends\s+BaseTypeormEntity\b/);
  return m ? m[1] : null;
}

function entityKindFromFileName(filePath: string): string {
  // Нормализация: убираем суффикс файла + опциональный '-typeorm' в основе имени.
  // Это нужно потому что в репозитории `approval-typeorm.entity.ts` имя основы — `approval-typeorm`,
  // а соответствующий repo называется `approval.typeorm-repository.ts` (основа = `approval`).
  return path
    .basename(filePath)
    .replace(/\.typeorm-entity\.ts$|\.entity\.ts$/, '')
    .replace(/-typeorm$/, '');
}

describe('Story 4.3: BaseBlockchainRepository contract', () => {
  it('каждая entity extends BaseTypeormEntity имеет repo extends BaseBlockchainRepository (либо в OFF_CHAIN_BASE_ENTITIES allowlist)', () => {
    // Найти все TS-файлы с «extends BaseTypeormEntity»
    const entityFiles = execSync(
      `grep -rEln "extends BaseTypeormEntity" --include="*.ts" ${SRC_ROOT}`,
      { encoding: 'utf-8' }
    )
      .split('\n')
      .filter(Boolean);

    // Найти все TS-файлы с «extends BaseBlockchainRepository»
    const repoFiles = execSync(
      `grep -rEln "extends BaseBlockchainRepository" --include="*.ts" ${SRC_ROOT}`,
      { encoding: 'utf-8' }
    )
      .split('\n')
      .filter(Boolean);

    const repoEntityKinds = new Set(
      repoFiles.map((f) =>
        path
          .basename(f)
          .replace(/\.typeorm-repository\.ts$|\.repository\.ts$/, '')
      )
    );

    const violations: string[] = [];

    for (const entityFile of entityFiles) {
      const kind = entityKindFromFileName(entityFile);
      const className = extractEntityClassName(entityFile);
      if (!className) continue;
      if (OFF_CHAIN_BASE_ENTITIES.has(kind)) continue;
      if (!repoEntityKinds.has(kind)) {
        violations.push(`${kind} (${className}) at ${path.relative(SRC_ROOT, entityFile)}`);
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Story 4.3 contract violation: следующие entity наследуют BaseTypeormEntity (имеют block_num колонку), но их репозитории НЕ наследуют BaseBlockchainRepository:\n` +
          violations.map((v) => `  - ${v}`).join('\n') +
          `\n\nЛибо отнаследуйте repo от BaseBlockchainRepository (чтобы entity_versions писались автоматически), либо добавьте entity-kind в OFF_CHAIN_BASE_ENTITIES allowlist с обоснованием.`
      );
    }
  });

  it('OFF_CHAIN_BASE_ENTITIES allowlist синхронизирован с реальностью (нет фантомных allow-list-имён)', () => {
    // Защита от устаревания allow-list'а: каждое имя в OFF_CHAIN_BASE_ENTITIES должно
    // реально существовать как файл *.typeorm-entity.ts или *.entity.ts в src/.
    const allFiles = execSync(
      `find ${SRC_ROOT} \\( -name "*.typeorm-entity.ts" -o -name "*.entity.ts" \\)`,
      { encoding: 'utf-8' }
    )
      .split('\n')
      .filter(Boolean);

    const allKinds = new Set(allFiles.map(entityKindFromFileName));
    const stale: string[] = [];
    for (const kind of OFF_CHAIN_BASE_ENTITIES) {
      if (!allKinds.has(kind)) stale.push(kind);
    }

    if (stale.length > 0) {
      throw new Error(
        `OFF_CHAIN_BASE_ENTITIES содержит имена, которых больше нет в src/: ${stale.join(', ')}. Уберите их из allowlist'а.`
      );
    }
  });
});
