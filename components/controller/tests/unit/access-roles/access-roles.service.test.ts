/**
 * Управление доступом: назначение и снятие ролей (C28-90, случаи
 * access.roles.* в test-registry/platform.access-roles.yaml).
 */
import { Workflows } from '@coopenomics/notifications';
import { AccessRolesService } from '~/application/access-roles/access-roles.service';
import { RoleAssignmentsRegistry } from '~/application/access-roles/role-assignments.registry';

const CASHIER = { key: 'cashier', title: 'Кассир', description: 'Видит реестр платежей' };

interface Row {
  username: string;
  role: string;
  assigned_by: string;
  assigned_at: Date;
}

function makeService(options: { users?: Record<string, boolean>; notifyFails?: boolean } = {}) {
  const rows: Row[] = [];
  const repository = {
    findActiveByUser: jest.fn(async (_coop: string, username: string) => rows.filter((row) => row.username === username)),
    findActive: jest.fn(async () => [...rows]),
    assign: jest.fn(async (data: { username: string; role: string; assigned_by: string }) => {
      if (rows.some((row) => row.username === data.username && row.role === data.role)) return false;
      rows.push({ username: data.username, role: data.role, assigned_by: data.assigned_by, assigned_at: new Date(0) });
      return true;
    }),
    revoke: jest.fn(async (_coop: string, username: string, role: string) => {
      const index = rows.findIndex((row) => row.username === username && row.role === role);
      if (index < 0) return false;
      rows.splice(index, 1);
      return true;
    }),
  };
  const known = options.users ?? { ivan: true };
  const users = {
    findByUsername: jest.fn(async (username: string) =>
      username in known
        ? { username, email: `${username}@coop.test`, subscriber_id: `sub-${username}`, isActive: () => known[username] }
        : null
    ),
  };
  const accounts = { getDisplayName: jest.fn(async (username: string) => `Пайщик ${username}`) };
  const notifications = {
    notify: jest.fn(async () => {
      if (options.notifyFails) throw new Error('очередь недоступна');
      return { acknowledged: true, outboxIds: [] };
    }),
  };
  const logger = { setContext: jest.fn(), error: jest.fn() };
  const registry = new RoleAssignmentsRegistry(repository as any);
  registry.declare('soviet', [CASHIER]);
  const service = new AccessRolesService(registry, repository as any, users as any, accounts as any, notifications as any, logger as any);
  return { service, repository, notifications, logger, rows };
}

describe('назначение роли', () => {
  // access.roles.happy.03
  it('председатель назначает роль действующему пайщику: назначение записано, пайщик уведомлён, роль показывает держателя', async () => {
    const { service, repository, notifications } = makeService();
    const role = await service.assign('ant', { username: 'ivan', role: 'cashier' });
    expect(repository.assign).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'ivan', role: 'cashier', extension_name: 'soviet', assigned_by: 'ant' })
    );
    expect(role.assignments).toEqual([
      expect.objectContaining({ username: 'ivan', display_name: 'Пайщик ivan', assigned_by: 'ant' }),
    ]);
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: Workflows.AccessRoleAssigned.id,
        to: expect.objectContaining({ username: 'ivan', subscriberId: 'sub-ivan' }),
        payload: expect.objectContaining({ roleTitle: 'Кассир' }),
      })
    );
  });

  // access.roles.side.03
  it('повторное назначение ничего не меняет и пайщика второй раз не уведомляет', async () => {
    const { service, notifications, rows } = makeService();
    await service.assign('ant', { username: 'ivan', role: 'cashier' });
    const role = await service.assign('ant', { username: 'ivan', role: 'cashier' });
    expect(rows).toHaveLength(1);
    expect(role.assignments).toHaveLength(1);
    expect(notifications.notify).toHaveBeenCalledTimes(1);
  });

  // access.roles.break.03
  it('роль, которую не объявило ни одно приложение, назначить нельзя', async () => {
    const { service, repository } = makeService();
    await expect(service.assign('ant', { username: 'ivan', role: 'director' })).rejects.toMatchObject({ code: 'ACCESS_ROLE_UNKNOWN' });
    expect(repository.assign).not.toHaveBeenCalled();
  });

  // access.roles.break.04
  it('кандидату, вышедшему и несуществующему пайщику роль не назначается', async () => {
    const { service, repository } = makeService({ users: { cand: false } });
    await expect(service.assign('ant', { username: 'cand', role: 'cashier' })).rejects.toMatchObject({
      code: 'ACCESS_ROLE_PARTICIPANT_REQUIRED',
    });
    await expect(service.assign('ant', { username: 'ghost', role: 'cashier' })).rejects.toMatchObject({
      code: 'ACCESS_ROLE_PARTICIPANT_REQUIRED',
    });
    expect(repository.assign).not.toHaveBeenCalled();
  });

  // access.roles.break.05
  it('отказ доставки уведомления назначение не отменяет', async () => {
    const { service, rows, logger } = makeService({ notifyFails: true });
    const role = await service.assign('ant', { username: 'ivan', role: 'cashier' });
    expect(rows).toHaveLength(1);
    expect(role.assignments).toHaveLength(1);
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('снятие роли', () => {
  // access.roles.happy.04
  it('председатель снимает роль: держателей нет, пайщик уведомлён', async () => {
    const { service, notifications, repository } = makeService();
    await service.assign('ant', { username: 'ivan', role: 'cashier' });
    const role = await service.revoke('ant', { username: 'ivan', role: 'cashier' });
    expect(repository.revoke).toHaveBeenCalledWith(expect.any(String), 'ivan', 'cashier', 'ant');
    expect(role.assignments).toEqual([]);
    expect(notifications.notify).toHaveBeenLastCalledWith(expect.objectContaining({ workflowId: Workflows.AccessRoleRevoked.id }));
  });

  // access.roles.side.04
  it('снятие роли, которой у пайщика нет, проходит без уведомления', async () => {
    const { service, notifications } = makeService();
    const role = await service.revoke('ant', { username: 'ivan', role: 'cashier' });
    expect(role.assignments).toEqual([]);
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});

describe('перечень ролей', () => {
  // access.roles.happy.05
  it('показывает объявленные роли с приложением и держателями', async () => {
    const { service } = makeService({ users: { ivan: true, petr: true } });
    await service.assign('ant', { username: 'ivan', role: 'cashier' });
    await service.assign('ant', { username: 'petr', role: 'cashier' });
    const roles = await service.list();
    expect(roles).toHaveLength(1);
    expect(roles[0]).toMatchObject({ key: 'cashier', title: 'Кассир', extension_name: 'soviet' });
    expect(roles[0].assignments.map((row) => row.username)).toEqual(['ivan', 'petr']);
  });
});
