/**
 * Уведомление «заказ готов к получению» называет режим работы пункта выдачи
 * (решение владельца 19.11.2026): пайщик узнаёт, когда участок выдаёт заказы,
 * не открывая стол.
 *
 * Покрывают:
 *   - режим задан → в уведомлении строка с днями, объединёнными по одинаковому
 *     времени, по местному времени участка без пересчёта пояса;
 *   - режим не задан или деталей участка нет → строка пустая, уведомление отправляется;
 *   - хранилище деталей отказало → уведомление отправляется без строки режима.
 */
import { Workflows } from '@coopenomics/notifications';

import { MarketplaceNotificationService } from '~/extensions/marketplace/application/services/marketplace-notification.service';

const COOP = 'voskhod';
const ORDERER = 'alice';
const BRANCH = 'krg';
const work = { open: '09:00', close: '18:00', breaks: [] };

function makeService(findByCoreBraname: jest.Mock) {
  const notifyUser = jest.fn().mockResolvedValue(undefined);
  const accountPort = { getDisplayName: jest.fn(async (u: string) => (u === BRANCH ? 'КУ «Петрушка»' : 'Петрова Мария')) } as never;
  const logger = { setContext: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as never;
  const verificationPort = { checkRequired: jest.fn(async () => ({ passed: true, missing: [] })) } as never;
  const service = new MarketplaceNotificationService(
    { notifyUser } as never,
    accountPort,
    {} as never,
    verificationPort,
    logger,
    {} as never,
    { findByCoreBraname } as never,
  );
  return { service, notifyUser };
}

const event = { coopname: COOP, order_id: 'order-1', orderer_account: ORDERER, braname: BRANCH, product_name: 'Мёд цветочный' } as never;

function payloadOf(notifyUser: jest.Mock): Workflows.MarketplaceOrderReady.IPayload {
  expect(notifyUser).toHaveBeenCalledTimes(1);
  const [username, workflowId, payload] = notifyUser.mock.calls[0];
  expect(username).toBe(ORDERER);
  expect(workflowId).toBe(Workflows.MarketplaceOrderReady.id);
  return payload;
}

describe('Уведомление о готовности заказа: режим работы пункта выдачи', () => {
  it('дни с одинаковым режимом объединены, время — как ввёл председатель', async () => {
    const find = jest.fn(async () => ({ workingHours: { mon: work, tue: work, wed: work, thu: work, fri: work } }));
    const { service, notifyUser } = makeService(find);
    await service.handleOrderReadyToReceive(event);
    expect(find).toHaveBeenCalledWith(COOP, BRANCH);
    expect(payloadOf(notifyUser).workingHoursNote).toBe(' Режим работы участка: Пн–Пт 09:00–18:00; Сб–Вс выходной.');
  });

  it('режим не задан или деталей участка нет — строка пустая, уведомление отправляется', async () => {
    for (const details of [{ workingHours: {} }, null]) {
      const { service, notifyUser } = makeService(jest.fn(async () => details));
      await service.handleOrderReadyToReceive(event);
      expect(payloadOf(notifyUser).workingHoursNote).toBe('');
    }
  });

  it('хранилище деталей отказало — уведомление отправляется без строки режима', async () => {
    const { service, notifyUser } = makeService(jest.fn(async () => Promise.reject(new Error('база недоступна'))));
    await service.handleOrderReadyToReceive(event);
    expect(payloadOf(notifyUser).workingHoursNote).toBe('');
  });
});

describe('Уведомление о готовности: имущество и ссылка', () => {
  it('называет имущество позиции и ведёт на страницу заказа (замечание владельца 20.11.2026)', async () => {
    const { service, notifyUser } = makeService(jest.fn(async () => null));
    await service.handleOrderReadyToReceive(event);
    const payload = payloadOf(notifyUser);
    expect(payload.productName).toBe('Мёд цветочный');
    expect(payload.deepLinkUrl).toMatch(new RegExp(`/${COOP}/market/orders/order-1$`));
  });
});
