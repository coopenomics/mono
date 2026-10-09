/**
 * Реестр назначаемых ролей (C28-90, случаи access.roles.* в
 * test-registry/platform.access-roles.yaml).
 *
 * Роли объявляют приложения; ядро хранит связь «роль — пайщик». Ключ роли
 * уникален среди всех приложений: повтор останавливает запуск узла.
 */
import { RoleAssignmentsRegistry } from '~/application/access-roles/role-assignments.registry';

const CASHIER = { key: 'cashier', title: 'Кассир', description: 'Видит реестр платежей', permissions: [{ title: 'Реестр платежей', access: 'read' as const, rights: ['Payment:read:all'] }] };
const STOREKEEPER = { key: 'storekeeper', title: 'Кладовщик', description: 'Ведёт склад', permissions: [] };

function makeRegistry(active: { username: string; role: string }[] = []) {
  const repository = {
    findActiveByUser: jest.fn(async (_coopname: string, username: string) => active.filter((row) => row.username === username)),
  };
  return { registry: new RoleAssignmentsRegistry(repository as any), repository };
}

describe('объявление ролей', () => {
  // access.roles.happy.01
  it('роли разных приложений складываются в один перечень с именем приложения', () => {
    const { registry } = makeRegistry();
    registry.declare('soviet', [CASHIER]);
    registry.declare('market', [STOREKEEPER]);
    expect(registry.list()).toEqual([
      { ...CASHIER, extensionName: 'soviet' },
      { ...STOREKEEPER, extensionName: 'market' },
    ]);
    expect(registry.find('storekeeper')?.extensionName).toBe('market');
    expect(registry.find('unknown')).toBeUndefined();
  });

  // access.roles.break.01
  it('повтор ключа у другого приложения останавливает запуск и называет оба приложения', () => {
    const { registry } = makeRegistry();
    registry.declare('soviet', [CASHIER]);
    expect(() => registry.declare('market', [{ ...STOREKEEPER, key: 'cashier' }])).toThrow(/cashier.*soviet.*market/);
  });

  // access.roles.break.06
  it.each(['chairman', 'council', 'participant', 'member'])('ключ роли узла «%s» объявить назначаемой ролью нельзя', (key) => {
    const { registry } = makeRegistry();
    expect(() => registry.declare('market', [{ ...STOREKEEPER, key }])).toThrow(/занят ролью узла/);
  });

  // access.roles.break.02
  it('повтор ключа внутри одного приложения тоже отказ', () => {
    const { registry } = makeRegistry();
    expect(() => registry.declare('soviet', [CASHIER, CASHIER])).toThrow(/cashier/);
  });
});

describe('роли пайщика', () => {
  // access.roles.happy.02
  it('приложение получает только свои назначенные роли', async () => {
    const { registry } = makeRegistry([
      { username: 'ivan', role: 'cashier' },
      { username: 'ivan', role: 'storekeeper' },
      { username: 'petr', role: 'storekeeper' },
    ]);
    registry.declare('soviet', [CASHIER]);
    registry.declare('market', [STOREKEEPER]);
    expect(await registry.rolesOf('soviet', 'ivan')).toEqual(['cashier']);
    expect(await registry.rolesOf('market', 'ivan')).toEqual(['storekeeper']);
    expect(await registry.rolesOf('soviet', 'petr')).toEqual([]);
  });

  // access.roles.side.01
  it('назначение роли, которую больше никто не объявляет, прав не даёт', async () => {
    const { registry } = makeRegistry([{ username: 'ivan', role: 'retired' }]);
    registry.declare('soviet', [CASHIER]);
    expect(await registry.rolesOf('soviet', 'ivan')).toEqual([]);
  });

  // access.roles.side.02
  it('приложение без объявленных ролей базу не читает', async () => {
    const { registry, repository } = makeRegistry([{ username: 'ivan', role: 'cashier' }]);
    registry.declare('soviet', [CASHIER]);
    expect(await registry.rolesOf('capital', 'ivan')).toEqual([]);
    expect(repository.findActiveByUser).not.toHaveBeenCalled();
  });
});
