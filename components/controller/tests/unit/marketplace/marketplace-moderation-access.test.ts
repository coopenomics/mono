/**
 * Модерация предложений доступна только председателю.
 *
 * Гарантия двусторонняя, и обе стороны нужны вместе:
 *
 *  1) каждая операция резолвера модерации объявляет требование доступа —
 *     операция без декоратора проходит guard молча (см. сам guard: «ни одного
 *     декоратора → разрешаю»), то есть новая мутация, добавленная без
 *     `@RequireMarketplaceAccess`, открылась бы любому пайщику;
 *  2) право `Offer:moderate` в матрице есть только у роли председателя —
 *     иначе декоратор на месте, но пропускает кого не надо.
 *
 * Проверка первой стороны структурная: тест читает исходник резолвера и
 * сверяет число операций с числом требований доступа.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { marketplaceAccessMatrix } from '~/extensions/marketplace/application/access/marketplace-access-matrix';
import { canAccess } from '~/extensions/marketplace/application/access/marketplace-access-matrix';
import type { MarketplaceRole } from '~/extensions/marketplace/application/membership/marketplace-roles.mapper';

const RESOLVER = join(
  __dirname,
  '../../../src/extensions/marketplace/application/resolvers/marketplace-moderation.resolver.ts'
);

function resolverSource(): string {
  return readFileSync(RESOLVER, 'utf8');
}

describe('резолвер модерации: каждая операция закрыта требованием доступа', () => {
  it('файл резолвера на месте', () => {
    expect(existsSync(RESOLVER)).toBe(true);
  });

  it('число операций совпадает с числом требований Offer:moderate', () => {
    const src = resolverSource();
    // Считаем только настоящие декораторы — вхождение в шапке файла (там
    // требование упомянуто прозой) не должно попадать в счёт, иначе тест
    // «сходится» за счёт комментария.
    const operations = [...src.matchAll(/^[ \t]*@(?:Query|Mutation)\(/gm)].length;
    const guarded = [...src.matchAll(/^[ \t]*@RequireMarketplaceAccess\('Offer', 'moderate'\)/gm)].length;

    expect(operations).toBeGreaterThan(0);
    expect(guarded).toBe(operations);
  });
});

describe('право модерации выдаётся только председателю', () => {
  const rolesWithModerate = (Object.keys(marketplaceAccessMatrix) as MarketplaceRole[]).filter(
    (role) => canAccess([role], 'Offer', 'moderate')
  );

  it('единственная роль с правом модерации — admin', () => {
    expect(rolesWithModerate).toEqual(['admin']);
  });

  it.each(['orderer', 'offerer', 'operator', 'board_readonly', 'board'] as MarketplaceRole[])(
    'роль %s модерировать не может',
    (role) => {
      expect(canAccess([role], 'Offer', 'moderate')).toBe(false);
    }
  );

  it('чтение предложений роли не даёт права модерации', () => {
    // Совет видит все предложения (`Offer:read:all`), но решение по заявке
    // принимает председатель — широкое чтение не должно затекать в moderate.
    expect(canAccess(['board_readonly'], 'Offer', 'read:all')).toBe(true);
    expect(canAccess(['board_readonly'], 'Offer', 'moderate')).toBe(false);
  });
});
