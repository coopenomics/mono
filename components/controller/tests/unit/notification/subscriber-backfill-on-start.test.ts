/**
 * Адрес получателя уведомлений дозаполняется при старте, а не только раз в
 * полчаса: аккаунты, заведённые мимо обычного потока (засев стенда, перенос),
 * до ближайшего прохода не получали ни одного уведомления (C28-80).
 */
import { NotificationSubscriberSyncService } from '~/domain/account/services/notification-subscriber-sync.service';

describe('адрес получателя уведомлений', () => {
  it('при старте приложения недостающие адреса дозаполняются', async () => {
    const users = {
      findUsersWithoutSubscriberId: jest.fn(async () => [{ username: 'ant' }]),
      generateSubscriberId: jest.fn(async () => 'voskhod:abc'),
      updateUserByUsername: jest.fn(async () => undefined),
    };
    const service = new NotificationSubscriberSyncService(users as any);

    service.onApplicationBootstrap();
    await new Promise((r) => setImmediate(r));

    expect(users.findUsersWithoutSubscriberId).toHaveBeenCalled();
    expect(users.updateUserByUsername).toHaveBeenCalledWith('ant', expect.objectContaining({ subscriber_id: 'voskhod:abc' }));
  });
});
