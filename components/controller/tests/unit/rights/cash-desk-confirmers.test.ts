/**
 * Задачи кассы: кто подтверждает платежи и как им уходит уведомление
 * (test-registry/cashier.desk.yaml, случаи cashier.notify.*).
 *
 * Председатель и пайщики с ролью «Кассир» получают «подтвердите платёж»;
 * ссылка ведёт в реестр платежей стола кассира. Уведомления заявок на
 * взносы шлёт ядро, выплаты Стола заказов — расширение через кассирский порт.
 */
import { cashDeskConfirmers, cashierPaymentsUrl, notifyCashDesk } from '~/application/rights/cash-desk-confirmers';
import { PaymentDeskInnercoopAdapter } from '~/infrastructure/innercoop/payment-desk-innercoop.adapter';
import { MarketplaceNotificationService } from '~/extensions/marketplace/application/services/marketplace-notification.service';

const accounts = (chairmen: string[], profiles: Record<string, { email?: string; subscriber_id?: string } | null> = {}) => ({
  getAccounts: jest.fn(async () => ({ items: chairmen.map((username) => ({ username })) })),
  getAccount: jest.fn(async (username: string) => ({ provider_account: profiles[username] ?? null })),
  getDisplayName: jest.fn(async (username: string) => `ФИО ${username}`),
});
const holders = (cashiers: string[]) => ({ holdersOf: jest.fn(async () => cashiers) });
const logger = () => ({ warn: jest.fn() });

describe('кто подтверждает платежи', () => {
  // cashier.notify.happy.02
  it('председатель и держатели роли «Кассир» стола кассира; председатель с ролью — один раз', async () => {
    const roles = holders(['kassa', 'ant']);
    expect(await cashDeskConfirmers(accounts(['ant']), roles)).toEqual(['ant', 'kassa']);
    expect(roles.holdersOf).toHaveBeenCalledWith('cashier', 'cashier');
  });

  it('кооператив без кассиров — задача председателю; без председателя и кассиров — никому', async () => {
    expect(await cashDeskConfirmers(accounts(['ant']), holders([]))).toEqual(['ant']);
    expect(await cashDeskConfirmers(accounts([]), holders([]))).toEqual([]);
  });

  it('кассирский порт отдаёт тот же перечень', async () => {
    const adapter = new PaymentDeskInnercoopAdapter({} as any, accounts(['ant']) as any, holders(['kassa']) as any);
    expect(await adapter.confirmers()).toEqual(['ant', 'kassa']);
  });

  it('ссылка задачи — реестр платежей стола кассира, с пайщиком — отфильтрованный по нему', () => {
    expect(cashierPaymentsUrl('https://coop.example', 'voskhod')).toBe('https://coop.example/voskhod/cashier/payments');
    expect(cashierPaymentsUrl('https://coop.example', 'voskhod', 'ivan')).toBe('https://coop.example/voskhod/cashier/payments/ivan');
  });
});

describe('рассылка задачи кассы (заявки на взносы)', () => {
  const profiles = {
    ant: { email: 'ant@coop', subscriber_id: 'sub-ant' },
    kassa: { email: 'kassa@coop', subscriber_id: ' sub-kassa ' },
    nomail: { subscriber_id: 'sub-x' },
  };

  // cashier.notify.happy.03
  it('каждому подтверждающему — своё обращение по ФИО, почта и подписка из его учётной записи', async () => {
    const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
    const sent = await notifyCashDesk(
      { accounts: accounts(['ant'], profiles), roles: holders(['kassa']), notifications, logger: logger() },
      { coopname: 'voskhod', workflowId: 'wf', payloadFor: (name) => ({ chairmanName: name }) }
    );
    expect(sent).toBe(2);
    expect(notifications.notify.mock.calls.map(([input]) => input)).toEqual([
      { coopname: 'voskhod', workflowId: 'wf', to: { subscriberId: 'sub-ant', email: 'ant@coop', username: 'ant' }, payload: { chairmanName: 'ФИО ant' } },
      { coopname: 'voskhod', workflowId: 'wf', to: { subscriberId: 'sub-kassa', email: 'kassa@coop', username: 'kassa' }, payload: { chairmanName: 'ФИО kassa' } },
    ]);
  });

  // cashier.notify.side.02
  it('получатель без почты или подписки пропускается с предупреждением, остальные получают задачу', async () => {
    const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
    const log = logger();
    const sent = await notifyCashDesk(
      { accounts: accounts(['ant'], profiles), roles: holders(['nomail', 'ghost']), notifications, logger: log },
      { coopname: 'voskhod', workflowId: 'wf', payloadFor: () => ({}) }
    );
    expect(sent).toBe(1);
    expect(log.warn).toHaveBeenCalledTimes(2);
  });

  it('некому слать — предупреждение, ни одной отправки', async () => {
    const notifications = { notify: jest.fn() };
    const log = logger();
    expect(await notifyCashDesk({ accounts: accounts([]), roles: holders([]), notifications, logger: log }, { coopname: 'v', workflowId: 'wf', payloadFor: () => ({}) })).toBe(0);
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledTimes(1);
  });
});

describe('выплата поставщику Стола заказов', () => {
  function service(confirmers: string[], failFor: string[] = []) {
    const notifyUser = jest.fn(async (username: string) => {
      if (failFor.includes(username)) throw new Error('недоставлено');
    });
    const accountPort = { getDisplayName: jest.fn(async (u: string) => `ФИО ${u}`) };
    const log = { setContext: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() };
    const desk = { confirmers: jest.fn(async () => confirmers) };
    const svc = new MarketplaceNotificationService({ notifyUser } as any, accountPort as any, {} as any, {} as any, log as any, desk as any);
    return { svc, notifyUser, log };
  }
  const event = { coopname: 'voskhod', supplier_account: 'supplier1', amount: '500.0000 RUB', apl_reception_id: 7, payment_request_id: 'p1' } as any;

  // cashier.notify.happy.04
  it('задача уходит председателю и каждому кассиру, ссылка — реестр стола кассира по поставщику', async () => {
    const { svc, notifyUser } = service(['ant', 'kassa']);
    await svc.handleCashierNewPayment(event);
    expect(notifyUser.mock.calls.map(([username]) => username)).toEqual(['ant', 'kassa']);
    for (const [username, , payload] of notifyUser.mock.calls as any[]) {
      expect(payload.cashierName).toBe(`ФИО ${username}`);
      expect(payload.deepLinkUrl).toMatch(/\/voskhod\/cashier\/payments\/supplier1$/);
    }
  });

  // cashier.notify.side.03
  it('сбой доставки одному не мешает остальным; некому слать — пропуск с предупреждением', async () => {
    const failing = service(['ant', 'kassa'], ['ant']);
    await failing.svc.handleCashierNewPayment(event);
    expect(failing.notifyUser).toHaveBeenCalledTimes(2);
    const empty = service([]);
    await empty.svc.handleCashierNewPayment(event);
    expect(empty.notifyUser).not.toHaveBeenCalled();
    expect(empty.log.warn).toHaveBeenCalled();
  });
});
