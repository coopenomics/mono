/**
 * Полномочия назначаемых ролей словами (C28-90, случай access.roles.happy.11
 * в test-registry/platform.access-roles.yaml).
 *
 * На странице управления доступом председатель читает, что роль видит и что
 * ведёт. Этот перечень объявляет приложение рядом с ролью, а права роли лежат
 * в его таблице прав. Тест держит их вместе: перечень называет все права роли
 * из таблицы и ничего сверх них.
 */
import { rightsByRole, type AppRights } from '@coopenomics/extension-kit';
import { ReportsRights } from '~/extensions/reports/application/access/reports-rights';
import { ExpensesRights } from '~/extensions/expenses/application/access/expenses-rights';
import { makeGuard } from '../rights/core-rights.harness';

const fakes = { register: jest.fn(), declare: jest.fn(), attach: jest.fn(), rolesOf: jest.fn(async () => []) } as any;

const APPS: [string, AppRights<any, any>][] = [
  ['ядро (стол совета)', makeGuard().rights],
  ['стол бухгалтера', new ReportsRights(fakes, fakes)],
  ['расходы', new ExpensesRights(fakes, fakes)],
];

describe.each(APPS)('полномочия ролей: %s', (_title, rights) => {
  // Собственные роли приложения и роли других приложений, которым оно даёт права.
  const roles = [...(rights.assignableRoles ?? []), ...(rights.attachedRoles ?? [])];

  it('приложение объявляет назначаемые роли либо дополняет чужие', () => {
    expect(roles.length).toBeGreaterThan(0);
  });

  it.each(roles.map((role) => [role.key, role] as const))('роль %s: перечень словами совпадает с правами таблицы', (_key, role) => {
    const byResource = rightsByRole(rights.table)[role.key] ?? {};
    const inTable = Object.entries(byResource).flatMap(([resource, actions]) => (actions as string[]).map((action) => `${resource}:${action}`));
    const named = role.permissions.flatMap((permission) => [...permission.rights]);
    expect([...named].sort()).toEqual([...new Set(inTable)].sort());
    expect(new Set(named).size).toBe(named.length);
  });

  it.each(roles.map((role) => [role.key, role] as const))('роль %s: у каждого полномочия есть название и вид доступа', (_key, role) => {
    for (const permission of role.permissions) {
      expect(permission.title.trim()).not.toBe('');
      expect(['read', 'write']).toContain(permission.access);
      expect(permission.rights.length).toBeGreaterThan(0);
    }
  });
});
