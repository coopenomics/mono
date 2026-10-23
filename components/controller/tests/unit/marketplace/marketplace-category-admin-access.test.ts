/**
 * Управление категориями кооператива — только председателю.
 *
 * Категории определяют, что вообще можно опубликовать в каталоге, поэтому
 * реестр и белый список закрыты правом `Whitelist:manage` таблицы прав Стола
 * заказов: оно есть только у председателя (роль `admin`). До 04.10.2026 эти
 * операции стояли под ролью председателя мимо таблицы (C28-87).
 *
 * Проверка структурная: тест читает исходник резолвера и требует, чтобы
 * требований права было ровно столько же, сколько операций. Новая мутация,
 * добавленная без декоратора, guard'ом не отбивается — гард без требования
 * пропускает любого пайщика Стола заказов, и управление категориями
 * открылось бы всему кооперативу.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canAccess } from '~/extensions/marketplace/application/access/marketplace-access-matrix';
import type { MarketplaceRole } from '~/extensions/marketplace/application/membership/marketplace-roles.mapper';

const RESOLVER = join(
  __dirname,
  '../../../src/extensions/marketplace/application/resolvers/available-category-admin.resolver.ts'
);

function source(): string {
  return readFileSync(RESOLVER, 'utf8');
}

/** Считаем только настоящие декораторы: упоминание в комментарии не в счёт. */
function countOperations(src: string): number {
  return [...src.matchAll(/^[ \t]*@(?:Query|Mutation)\(/gm)].length;
}

function countWhitelistRights(src: string): number {
  return [...src.matchAll(/^[ \t]*@RequireRight\('Whitelist', 'manage'\)/gm)].length;
}

describe('резолвер категорий: каждая операция требует право председателя', () => {
  it('файл резолвера на месте', () => {
    expect(existsSync(RESOLVER)).toBe(true);
  });

  it('число операций совпадает с числом требований права', () => {
    const src = source();
    const operations = countOperations(src);
    expect(operations).toBeGreaterThan(0);
    expect(countWhitelistRights(src)).toBe(operations);
  });

  it('каждая операция стоит под гардом прав Стола заказов', () => {
    // Требование права без guard'а — пустая декларация: читать метаданные
    // будет некому, и операция останется открытой.
    const src = source();
    const guards = [...src.matchAll(/^[ \t]*@UseGuards\([^)]*RightsGuard[^)]*\)/gm)].length;
    expect(guards).toBe(countOperations(src));
  });

  it('право Whitelist:manage есть только у председателя', () => {
    expect(canAccess(['admin'], 'Whitelist', 'manage')).toBe(true);
    for (const role of ['orderer', 'offerer', 'operator', 'board_readonly'] as MarketplaceRole[]) {
      expect(canAccess([role], 'Whitelist', 'manage')).toBe(false);
    }
  });
});
