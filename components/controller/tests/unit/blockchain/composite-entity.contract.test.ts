/**
 * Story 6.1 contract test (Epic 6, ADR-008 composite-entity).
 *
 * Заперт `Object.assign(this, blockchainData)` в `*.entity.ts` для новых сущностей.
 * Замена — типизированный whitelist через `replaceBc(this, blockchainData, keys)` из
 * `~/shared/sync/entities/base-domain.entity`. Эталон миграции: project.entity.ts.
 *
 * Legacy сущности (22) — в allowlist'е, миграция тречится Epic 9 (Story 9-5
 * «Миграция legacy composite-entity на namespace»). При попытке завести новую
 * сущность с `Object.assign(this, ...)` тест падает — это намеренный guard.
 *
 * Эвристика: при чтении кода игнорируем строки внутри JSDoc/однострочных комментов,
 * чтобы упоминания «Object.assign(this, ...)» в спецификациях/предупреждениях не
 * срабатывали как ложные срабатывания.
 */

import fs from 'fs';
import path from 'path';

const ROOT_DIR = path.resolve(__dirname, '../../..', 'src');

// 22 legacy entity, мигрируются в Epic 9.5
const LEGACY_ALLOWLIST: ReadonlySet<string> = new Set(
  [
    'domain/account/entities/account-domain.entity.ts',
    'domain/branch/entities/project-free-decision.entity.ts',
    'domain/meet/entities/meet-pre-domain.entity.ts',
    'domain/meet/entities/meet-processing-domain.entity.ts',
    'domain/system/entities/systeminfo-domain.entity.ts',
    'extensions/capital/domain/entities/commit.entity.ts',
    'extensions/capital/domain/entities/contributor.entity.ts',
    'extensions/capital/domain/entities/debt.entity.ts',
    'extensions/capital/domain/entities/expense.entity.ts',
    'extensions/capital/domain/entities/invest.entity.ts',
    'extensions/capital/domain/entities/program-property.entity.ts',
    'extensions/capital/domain/entities/program-wallet.entity.ts',
    'extensions/capital/domain/entities/program-withdraw.entity.ts',
    'extensions/capital/domain/entities/project-property.entity.ts',
    'extensions/capital/domain/entities/result.entity.ts',
    'extensions/capital/domain/entities/segment.entity.ts',
    'extensions/capital/domain/entities/state.entity.ts',
    'extensions/capital/domain/entities/vote.entity.ts',
    'extensions/chairman/domain/entities/approval.entity.ts',
    'infrastructure/database/typeorm/entities/ipn.entity.ts',
    'infrastructure/database/typeorm/entities/payment-state.entity.ts',
    'infrastructure/database/typeorm/entities/system-status.entity.ts',
  ].map((p) => p.split('/').join(path.sep))
);

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (e.isFile() && full.endsWith('.entity.ts') && !full.endsWith('.typeorm-entity.ts')) acc.push(full);
  }
  return acc;
}

function hasObjectAssignThis(source: string): boolean {
  // Эвристика: убираем блочные комментарии целиком, потом строчные `//`,
  // и в оставшемся коде ищем `Object.assign(this,`.
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
  return /Object\.assign\s*\(\s*this\s*,/.test(stripped);
}

describe('Composite-entity contract (Story 6.1)', () => {
  const ENTITY_FILES = walk(ROOT_DIR);

  it('найдены entity-файлы для проверки', () => {
    expect(ENTITY_FILES.length).toBeGreaterThan(20);
  });

  it.each(ENTITY_FILES)('%s: запрет Object.assign(this, ...) для новых entity', (file) => {
    const rel = path.relative(ROOT_DIR, file);
    const source = fs.readFileSync(file, 'utf8');
    const offends = hasObjectAssignThis(source);

    if (LEGACY_ALLOWLIST.has(rel)) {
      // Legacy: миграция Epic 9.5. Тест не падает, но фиксирует ожидание.
      // Если кто-то убрал Object.assign из legacy — снять из allowlist в этом файле.
      return;
    }

    expect(offends).toBe(false);
  });

  it('эталон Project: namespace bc применён', () => {
    const projectFile = path.join(ROOT_DIR, 'extensions/capital/domain/entities/project.entity.ts'.split('/').join(path.sep));
    const source = fs.readFileSync(projectFile, 'utf8');
    expect(hasObjectAssignThis(source)).toBe(false);
    expect(source).toContain('replaceBc(this, blockchainData,');
    expect(source).toContain('PROJECT_BC_KEYS');
  });

  it('allowlist не содержит несуществующих файлов', () => {
    for (const rel of LEGACY_ALLOWLIST) {
      const full = path.join(ROOT_DIR, rel);
      expect(fs.existsSync(full)).toBe(true);
    }
  });
});
