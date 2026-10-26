/**
 * Приложения каталога на узле (26.10.2026): витрина сводит каталог,
 * провайдера, оркестратор и состояние узла; подписку и отмену узел оформляет
 * сам через PROVIDER_APPS_PORT; сводка подписок и кошелёк — для показа.
 */
import { configurePlatformSettings } from '@coopenomics/extension-kit';
import { InnerAppSubscriptionStatus, type IProviderAppsPort } from '@coopenomics/innercoop';
import { NodeAppsService } from '~/extensions/apps-catalog-proxy/application/services/node-apps.service';
import {
  SubscribePackageStatus,
  SubscriptionStateEnum,
} from '~/extensions/apps-catalog-proxy/application/dto/subscribe-package-result.dto';
import { UnsubscribePackageStatus } from '~/extensions/apps-catalog-proxy/application/dto/catalog-app-input.dto';

configurePlatformSettings({ coopname: 'romashka', blockchain: {} } as any);

const PKG = '@voskhod/demoapp';
const SUB = {
  package_id: PKG,
  status: InnerAppSubscriptionStatus.ACTIVE,
  amount_per_period: 360,
  started_at: '2026-10-23T00:00:00.000Z',
  expires_at: '2026-11-23T00:00:00.000Z',
  is_trial: false,
  trial_ends_at: null,
  next_payment_due: '2026-11-23T00:00:00.000Z',
};
const TRIAL_SUB = {
  ...SUB,
  status: InnerAppSubscriptionStatus.TRIAL,
  is_trial: true,
  trial_ends_at: '2026-11-06T00:00:00.000Z',
  expires_at: '2026-11-06T00:00:00.000Z',
};
const PUBLIC_PKG = { packageId: PKG, publisher: 'voskhod', compatibleSubnets: [], lastActiveVersion: '0.1.2' };

function harness(opts: { port?: Partial<IProviderAppsPort> | null; installed?: string[]; disabled?: string[] } = {}) {
  const catalog = {
    listPublicPackages: jest.fn(async () => [PUBLIC_PKG]),
    listInstalledFrontends: jest.fn(async () => (opts.installed ?? [PKG]).map((packageId) => ({ packageId }))),
  };
  const state = {
    disabledPackageIds: jest.fn(async () => new Set(opts.disabled ?? [])),
    markSubscribed: jest.fn(async (packageId: string) => ({ packageId, enabled: true, config: {}, updatedAt: new Date() })),
    setEnabled: jest.fn(async (packageId: string, enabled: boolean) => ({ packageId, enabled, config: {}, updatedAt: new Date() })),
  };
  const chain = {
    getSingleRow: jest.fn(async () => ({ parent_username: 'voskhod' })),
    getAllRows: jest.fn(async () => [
      { username: 'other', wallet_name: 'w.wal.bill', available: '9.0000 RUB' },
      { username: 'romashka', wallet_name: 'w.wal.bill', available: '1500.0000 RUB' },
    ]),
  };
  const accounts = { getChainAccount: jest.fn(async () => ({ core_liquid_balance: '144.0000 AXON' })) };
  const port = opts.port === null ? undefined : ({
    listOffers: jest.fn(async () => [{ package_id: PKG, price: 360, period_days: 30, trial_days: 14 }]),
    listAppSubscriptions: jest.fn(async () => [SUB]),
    subscribe: jest.fn(async () => ({ status: 'subscribed' as const, created: true, subscription: SUB })),
    cancel: jest.fn(async () => ({ status: 'cancelled' as const, subscription: SUB })),
    listSubscriptions: jest.fn(async () => []),
    billingSummary: jest.fn(async () => null),
    ...(opts.port ?? {}),
  } as IProviderAppsPort);
  const service = new NodeAppsService(catalog as any, state as any, chain as any, accounts as any, port);
  return { service, catalog, state, chain, accounts, port };
}

describe('subscribePackage → провайдер', () => {
  it('happy: подписка оформлена у провайдера для кооператива узла — activated с датами, приложение включено', async () => {
    const { service, port, state } = harness();
    const r = await service.subscribe(PKG);
    expect(port!.subscribe).toHaveBeenCalledWith('romashka', PKG);
    expect(state.markSubscribed).toHaveBeenCalledWith(PKG);
    expect(r).toEqual(expect.objectContaining({
      status: SubscribePackageStatus.ACTIVATED,
      state: SubscriptionStateEnum.ACTIVE,
      packageId: PKG,
      startAt: SUB.started_at,
      endAt: SUB.expires_at,
    }));
  });

  it('happy: пробный срок из публикации — activated со state=trial', async () => {
    const subscribe = jest.fn(async () => ({ status: 'subscribed' as const, created: true, subscription: TRIAL_SUB }));
    const r = await harness({ port: { subscribe } }).service.subscribe(PKG);
    expect(r.state).toBe(SubscriptionStateEnum.TRIAL);
    expect(r.endAt).toBe(TRIAL_SUB.expires_at);
  });

  it('side: действующая подписка уже есть — alreadyActive, новой строки счёта нет', async () => {
    const subscribe = jest.fn(async () => ({ status: 'subscribed' as const, created: false, subscription: SUB }));
    const r = await harness({ port: { subscribe } }).service.subscribe(PKG);
    expect(r.status).toBe(SubscribePackageStatus.ALREADY_ACTIVE);
  });

  it('break: пакет не предлагается каталогом — failed с причиной', async () => {
    const subscribe = jest.fn(async () => ({ status: 'notOffered' as const, error: 'не предлагается' }));
    const r = await harness({ port: { subscribe } }).service.subscribe(PKG);
    expect(r).toEqual(expect.objectContaining({ status: SubscribePackageStatus.FAILED, error: 'не предлагается' }));
  });

  it('break: провайдер не подключён или не ответил — unavailable с причиной, без отсылки куда-либо', async () => {
    const none = await harness({ port: null }).service.subscribe(PKG);
    expect(none.status).toBe(SubscribePackageStatus.UNAVAILABLE);
    expect(none.error).toMatch(/Провайдер подключения не ответил/);
    const subscribe = jest.fn(async () => ({ status: 'unavailable' as const }));
    const r = await harness({ port: { subscribe } }).service.subscribe(PKG);
    expect(r.status).toBe(SubscribePackageStatus.UNAVAILABLE);
  });
});

describe('unsubscribePackage и переключатель', () => {
  it('happy: отмена у провайдера — cancelled; подписки не было — notSubscribed', async () => {
    const { service, port } = harness();
    expect((await service.unsubscribe(PKG)).status).toBe(UnsubscribePackageStatus.CANCELLED);
    expect(port!.cancel).toHaveBeenCalledWith('romashka', PKG);
    const cancel = jest.fn(async () => ({ status: 'notSubscribed' as const }));
    expect((await harness({ port: { cancel } }).service.unsubscribe(PKG)).status).toBe(UnsubscribePackageStatus.NOT_SUBSCRIBED);
  });

  it('break: провайдер не подключён — unavailable', async () => {
    expect((await harness({ port: null }).service.unsubscribe(PKG)).status).toBe(UnsubscribePackageStatus.UNAVAILABLE);
  });

  it('happy: выключение и включение пишутся в состояние узла, подписка не трогается', async () => {
    const { service, state, port } = harness();
    expect(await service.setEnabled(PKG, false)).toBe(false);
    expect(state.setEnabled).toHaveBeenCalledWith(PKG, false);
    expect(port!.cancel).not.toHaveBeenCalled();
  });
});

describe('витрина приложений: цена и состояние', () => {
  it('happy: цена месяца и пробный срок — из предложения провайдера, подписка, фронт и переключатель — в строке', async () => {
    const { service, port } = harness();
    const [item] = await service.listCatalogApps(1, 50);
    expect(port!.listOffers).toHaveBeenCalledWith('romashka');
    expect(item).toEqual(expect.objectContaining({
      title: 'Demoapp',
      rubPerMonth: 360,
      trialDays: 14,
      installed: true,
      enabled: true,
    }));
    expect(item.subscription).toEqual(expect.objectContaining({
      status: InnerAppSubscriptionStatus.ACTIVE,
      isTrial: false,
      nextPaymentDue: SUB.next_payment_due,
      amountPerPeriod: 360,
    }));
    expect(item.description).not.toContain('voskhod');
  });

  it('happy: пробная подписка отдаётся с датой окончания пробного срока', async () => {
    const listAppSubscriptions = jest.fn(async () => [TRIAL_SUB]);
    const [item] = await harness({ port: { listAppSubscriptions } }).service.listCatalogApps(1, 50);
    expect(item.subscription).toEqual(expect.objectContaining({ isTrial: true, trialEndsAt: TRIAL_SUB.trial_ends_at }));
  });

  it('side: выключенное на узле приложение и пакет без фронта в кэше помечены так', async () => {
    const [item] = await harness({ installed: [], disabled: [PKG] }).service.listCatalogApps(1, 50);
    expect(item.installed).toBe(false);
    expect(item.enabled).toBe(false);
  });

  it('break: провайдер не ответил или не подключён — ошибка, витрина без цен не отдаётся', async () => {
    await expect(harness({ port: null }).service.listCatalogApps(1, 50)).rejects.toThrow(/Провайдер подключения не ответил/);
    await expect(
      harness({ port: { listOffers: async () => null } }).service.listCatalogApps(1, 50),
    ).rejects.toThrow(/Провайдер подключения не ответил/);
  });

  it('side: пакет, который провайдер кооперативу не предлагает, в витрину не попадает', async () => {
    const items = await harness({ port: { listOffers: async () => [] } }).service.listCatalogApps(1, 50);
    expect(items).toEqual([]);
  });
});

describe('подписки и кошелёк узла у провайдера', () => {
  it('break: узел без провайдера — available=false, пусто', async () => {
    expect(await harness({ port: null }).service.nodeBilling()).toEqual(expect.objectContaining({ available: false, subscriptions: [] }));
  });

  it('happy: подписки без отменённых, итог в месяц, долг по наступившим позициям, оператор и кошелёк из цепи', async () => {
    const rows = [
      { id: 1, name: 'Хостинг', code: 'hosting', kind: 'time', package_id: null, status: InnerAppSubscriptionStatus.EXPIRED, is_trial: false, price: 3500, period_days: 30, started_at: 's', expires_at: 'e', next_payment_due: null },
      { id: 2, name: '@voskhod/demoapp', code: 'catalog:@voskhod/demoapp', kind: 'time', package_id: PKG, status: InnerAppSubscriptionStatus.TRIAL, is_trial: true, price: 360, period_days: 30, started_at: 's', expires_at: 'e', next_payment_due: 'n' },
      { id: 3, name: 'Старое', code: 'x', kind: 'time', package_id: null, status: InnerAppSubscriptionStatus.CANCELLED, is_trial: false, price: 100, period_days: 30, started_at: 's', expires_at: 'e', next_payment_due: null },
    ];
    const summary = {
      total_amount: 3860,
      currency: 'RUB',
      next_payment_due: '2026-11-06T00:00:00.000Z',
      items: [
        { subscription_id: 1, name: 'Хостинг', status: InnerAppSubscriptionStatus.EXPIRED, amount: 3500, is_due: true },
        { subscription_id: 2, name: 'demoapp', status: InnerAppSubscriptionStatus.TRIAL, amount: 360, is_due: false },
      ],
    };
    const { service, chain } = harness({ port: { listSubscriptions: async () => rows, billingSummary: async () => summary } });
    const billing = await service.nodeBilling();
    expect(billing.available).toBe(true);
    expect(billing.subscriptions.map((s) => s.id)).toEqual([1, 2]);
    expect(billing.subscriptions[1]).toEqual(expect.objectContaining({ name: 'Demoapp', packageId: PKG, isTrial: true }));
    expect(billing.monthlyTotal).toBe(3860);
    expect(billing.dueAmount).toBe(3500);
    expect(billing.nextPaymentDue).toBe(summary.next_payment_due);
    expect(billing.operator).toBe('voskhod');
    expect(chain.getAllRows).toHaveBeenCalledWith('ledger2', 'voskhod', 'userwallets');
    expect(billing.wallet).toEqual({ membershipAvailable: '1500.0000 RUB', axonAvailable: '144.0000 AXON' });
  });

  it('side: цепь не ответила — подписки есть, кошелька нет', async () => {
    const { service, chain } = harness({ port: { listSubscriptions: async () => [] } });
    chain.getAllRows.mockRejectedValueOnce(new Error('node down'));
    const billing = await service.nodeBilling();
    expect(billing.available).toBe(true);
    expect(billing.wallet).toBeNull();
  });
});
