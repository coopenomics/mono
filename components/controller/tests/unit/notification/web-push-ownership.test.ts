/**
 * Подписки на уведомления личные: каждый управляет только своими.
 *
 * До 25.09.2026 член совета создавал подписку на имя любого пайщика, читал
 * чужие (с ключами устройства) и снимал их — то есть мог получать чужие
 * уведомления, — а сам пайщик не мог снять свою (нашёл внешний слой).
 */
import { SubscriptionResolver } from '~/application/notification/resolvers/web-push-subscription.resolver';
import { OWN, chairman, councilMember, makeGuard, requirementOf } from '../rights/core-rights.harness';

const RESOLVER = 'notification/resolvers/web-push-subscription.resolver.ts';

const user = (username: string, role = 'user') => ({ username, role }) as any;

function makeResolver() {
  const service = {
    createSubscription: jest.fn(async () => ({ success: true })),
    getUserSubscriptions: jest.fn(async (username: string) => (username === 'owner' ? [{ id: 'sub-own' }] : [])),
    deactivateSubscriptionById: jest.fn(async () => undefined),
  } as any;
  return { resolver: new SubscriptionResolver(service), service };
}

describe('подписки на уведомления — только свои', () => {
  it('член совета не создаёт и не читает подписки чужого пайщика', async () => {
    // Имя в запросе с вошедшим сверяет гард операции по таблице прав ядра.
    const { pass } = makeGuard();
    for (const operation of ['createWebPushSubscription', 'getUserWebPushSubscriptions']) {
      const requirement = requirementOf(RESOLVER, operation);
      await expect(pass(requirement, councilMember, { data: { username: 'owner' } })).rejects.toMatchObject(OWN);
      await expect(pass(requirement, chairman, { data: { username: 'owner' } })).rejects.toMatchObject(OWN);
      await expect(pass(requirement, councilMember, { data: { username: councilMember.username } })).resolves.toBe(true);
    }
  });

  it('пайщик снимает свою подписку', async () => {
    const { resolver, service } = makeResolver();
    await expect(resolver.deactivateWebPushSubscriptionById(user('owner'), { subscriptionId: 'sub-own' })).resolves.toBe(true);
    expect(service.deactivateSubscriptionById).toHaveBeenCalledWith('sub-own');
  });

  it('чужую подписку не снимает никто — ответ «не найдена», без признака существования', async () => {
    const { resolver, service } = makeResolver();
    await expect(resolver.deactivateWebPushSubscriptionById(user('petr', 'member'), { subscriptionId: 'sub-own' }))
      .rejects.toMatchObject({ code: 'NOTIFICATION_SUBSCRIPTION_NOT_FOUND' });
    expect(service.deactivateSubscriptionById).not.toHaveBeenCalled();
  });
});
