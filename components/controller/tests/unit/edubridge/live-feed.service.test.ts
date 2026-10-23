/**
 * Служебные сигналы образования идут администраторам, которых председатель
 * назначил на общей странице управления доступом (access.roles.happy.14).
 */
import { EdubridgeLiveFeedService } from '~/extensions/edubridge/application/services/edubridge-live-feed.service';

function make(holders: string[]) {
  const roleAssignments = { holdersOf: jest.fn(async () => holders) };
  const feed = { declareLocalTables: jest.fn(), setStaff: jest.fn() };
  return { service: new EdubridgeLiveFeedService(roleAssignments as any, feed as any), roleAssignments, feed };
}

describe('EdubridgeLiveFeedService', () => {
  // access.roles.happy.14
  it('состав персонала — держатели роли администратора образования', async () => {
    const { service, roleAssignments, feed } = make(['ivan', 'petr']);
    await service.refreshStaff();
    expect(roleAssignments.holdersOf).toHaveBeenCalledWith('edubridge', 'edu-admin');
    expect(feed.setStaff).toHaveBeenCalledWith('edubridge', ['ivan', 'petr']);
  });

  // access.roles.happy.14
  it('смена держателей роли образования перечитывает состав; чужая роль — нет', async () => {
    const { service, feed } = make(['ivan']);
    await service.onRoleAssignmentChanged({ extensionName: 'soviet', role: 'cashier', username: 'ivan' });
    expect(feed.setStaff).not.toHaveBeenCalled();
    await service.onRoleAssignmentChanged({ extensionName: 'edubridge', role: 'edu-admin', username: 'ivan' });
    expect(feed.setStaff).toHaveBeenCalledWith('edubridge', ['ivan']);
  });
});
