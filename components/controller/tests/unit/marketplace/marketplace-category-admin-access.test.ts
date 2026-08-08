/**
 * Управление категориями кооператива — только председателю.
 *
 * Категории определяют, что вообще можно опубликовать в каталоге, поэтому
 * реестр и белый список закрыты ролью председателя (`@AuthRoles(['chairman'])`
 * поверх `RolesGuard`) — в отличие от модерации, которая ходит через матрицу
 * доступа расширения.
 *
 * Проверка структурная: тест читает исходник резолвера и требует, чтобы
 * требований роли было ровно столько же, сколько операций. Новая мутация,
 * добавленная без декоратора, guard'ом не отбивается — `RolesGuard` без
 * `@AuthRoles` пропускает любого авторизованного пайщика, и управление
 * категориями открылось бы всему кооперативу.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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

function countChairmanGuards(src: string): number {
  return [...src.matchAll(/^[ \t]*@AuthRoles\(\['chairman'\]\)/gm)].length;
}

describe('резолвер категорий: каждая операция требует роль председателя', () => {
  it('файл резолвера на месте', () => {
    expect(existsSync(RESOLVER)).toBe(true);
  });

  it('число операций совпадает с числом требований роли', () => {
    const src = source();
    const operations = countOperations(src);

    expect(operations).toBeGreaterThan(0);
    expect(countChairmanGuards(src)).toBe(operations);
  });

  it('каждая операция стоит под RolesGuard', () => {
    // Декоратор роли без guard'а — пустая декларация: читать метаданные
    // будет некому, и операция останется открытой.
    const src = source();
    const guards = [...src.matchAll(/^[ \t]*@UseGuards\([^)]*RolesGuard[^)]*\)/gm)].length;

    expect(guards).toBe(countOperations(src));
  });
});
