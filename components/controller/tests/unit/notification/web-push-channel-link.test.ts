/**
 * Нажатие на пуш открывает то, о чём уведомление (замечание владельца
 * 20.11.2026): канал передаёт в пуш ссылку сценария `deepLinkUrl`. Без неё
 * служебный обработчик пуша стола открывает главную.
 */
import { Workflows } from '@coopenomics/notifications';
import { WebPushChannelAdapter } from '~/application/notification-center/channels/web-push-channel.adapter';

const subscription = {
  id: 'sub-1',
  username: 'alice',
  endpoint: 'https://push.example/1',
  p256dhKey: 'p256',
  authKey: 'auth',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function build() {
  const sendNotification = jest.fn(async () => true);
  const adapter = new WebPushChannelAdapter(
    { sendNotification } as never,
    { getUserSubscriptions: jest.fn(async () => [subscription]), deactivateSubscription: jest.fn() } as never
  );
  return { adapter, sendNotification };
}

const message = (payload: Record<string, unknown>) => ({
  outboxId: 'o-1',
  coopname: 'voskhod',
  workflowId: Workflows.MarketplaceOrderReady.id,
  recipient: { subscriberId: 'alice', username: 'alice' },
  payload,
});

describe('пуш: ссылка перехода по нажатию', () => {
  it('ссылка сценария передаётся в пуш — нажатие открывает страницу заказа', async () => {
    const { adapter, sendNotification } = build();
    const url = 'https://coop.test/voskhod/market/orders/order-1';
    await adapter.send(message({ productName: 'Мёд', kuName: 'КУ «Ромашка»', deepLinkUrl: url }) as never);
    expect(sendNotification).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ url }), expect.any(Function));
  });

  it('сценарий без ссылки — адреса нет, пуш открывает главную', async () => {
    const { adapter, sendNotification } = build();
    await adapter.send(message({ productName: 'Мёд', kuName: 'КУ «Ромашка»' }) as never);
    const [, data] = (sendNotification.mock.calls[0] as unknown) as [unknown, { url?: string }];
    expect(data.url).toBeUndefined();
  });
});
