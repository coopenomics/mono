/**
 * Гарантия против рецидива: каждый грант, который требует маршрут Стола
 * заказов, обязан выдаваться хотя бы одной роли матрицы доступа.
 *
 * Зачем этот тест существует. Маршрут `market-admin/category-whitelist`
 * объявлял `requires: 'Whitelist:manage'`, а такого токена не выдавала ни одна
 * роль — страница была недостижима вообще ни для кого, хотя резолверы за ней
 * живы и защищены ролью председателя. Дефект не ловился ничем: обе стороны
 * по отдельности выглядели корректно, расходились только вместе.
 *
 * Тест читает объявления маршрутов расширения desktop и сверяет их требования
 * с полным набором грантов, который матрица выдаёт всем ролям вместе.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { marketplaceAccessMatrix } from '~/extensions/marketplace/application/access/marketplace-access-matrix';
import { expandGrantsForRoles } from '~/extensions/marketplace/application/access/marketplace-grants';
import type { MarketplaceRole } from '~/extensions/marketplace/application/membership/marketplace-roles.mapper';

// Путь от tests/unit/marketplace/ до расширения desktop в монорепе.
const INSTALL_TS = join(__dirname, '../../../../desktop/extensions/market/install.ts');

/** Гранты-маркеры онбординга выдаются вне матрицы — гейтами провайдера. */
const GRANTS_OUTSIDE_MATRIX = ['Onboarding:orderer', 'Onboarding:offerer'];

function routeGrants(): string[] {
  const src = readFileSync(INSTALL_TS, 'utf8');
  const found = new Set<string>();
  for (const m of src.matchAll(/requires:\s*'([^']+)'/g)) found.add(m[1]);
  return [...found];
}

describe('гранты маршрутов Стола заказов покрыты матрицей доступа', () => {
  it('файл объявления маршрутов расширения на месте', () => {
    // Тест бессмыслен без источника маршрутов: молча пройти здесь означало бы
    // потерять защиту при переезде файла.
    expect(existsSync(INSTALL_TS)).toBe(true);
  });

  it('каждое требование маршрута выдаётся хотя бы одной ролью', () => {
    const allRoles = Object.keys(marketplaceAccessMatrix) as MarketplaceRole[];
    const granted = new Set(expandGrantsForRoles(allRoles));
    for (const g of GRANTS_OUTSIDE_MATRIX) granted.add(g);

    const required = routeGrants();
    expect(required.length).toBeGreaterThan(0);

    const orphans = required.filter((token) => !granted.has(token));
    expect(orphans).toEqual([]);
  });

  it('требования маршрутов записаны в виде Ресурс:действие', () => {
    for (const token of routeGrants()) {
      expect(token).toMatch(/^[A-Z][A-Za-z]*:[a-z][a-zA-Z-]*(:[a-zA-Z-]+)?$/);
    }
  });
});
