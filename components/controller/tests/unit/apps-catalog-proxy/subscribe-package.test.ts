/**
 * Подписка кооператива на приложение каталога (487-34): мутация
 * subscribePackage оформляет её у провайдера через PROVIDER_APPS_PORT —
 * подписка входит в общий счёт кооператива. Узел без провайдера (узел
 * партнёра) отвечает подсказкой оформить подписку на столе подключения.
 */
import { configurePlatformSettings } from '@coopenomics/extension-kit';
import { InnerAppSubscriptionStatus, type IProviderAppsPort } from '@coopenomics/innercoop';
import { AppsCatalogProxyResolver } from '~/extensions/apps-catalog-proxy/application/resolvers/apps-catalog-proxy.resolver';
import {
  SubscribePackageStatus,
  SubscriptionStateEnum,
} from '~/extensions/apps-catalog-proxy/application/dto/subscribe-package-result.dto';

configurePlatformSettings({ coopname: 'romashka', blockchain: {} } as any);

const PKG = '@voskhod/demoapp';
const SUB = {
  package_id: PKG,
  status: InnerAppSubscriptionStatus.ACTIVE,
  amount_per_period: 360,
  started_at: '2026-10-23T00:00:00.000Z',
  expires_at: '2026-11-23T00:00:00.000Z',
};

function resolverWith(port?: Partial<IProviderAppsPort>) {
  return new AppsCatalogProxyResolver({} as any, {} as any, port as IProviderAppsPort | undefined);
}

describe('subscribePackage → провайдер', () => {
  it('happy: подписка оформлена у провайдера для кооператива узла — activated с датами', async () => {
    const subscribe = jest.fn(async () => ({ status: 'subscribed' as const, created: true, subscription: SUB }));
    const r = await resolverWith({ subscribe }).subscribePackage({ packageId: PKG } as any);
    expect(subscribe).toHaveBeenCalledWith('romashka', PKG);
    expect(r).toEqual(expect.objectContaining({
      status: SubscribePackageStatus.ACTIVATED,
      state: SubscriptionStateEnum.ACTIVE,
      packageId: PKG,
      startAt: SUB.started_at,
      endAt: SUB.expires_at,
    }));
  });

  it('side: действующая подписка уже есть — alreadyActive, новой строки счёта нет', async () => {
    const subscribe = jest.fn(async () => ({ status: 'subscribed' as const, created: false, subscription: SUB }));
    const r = await resolverWith({ subscribe }).subscribePackage({ packageId: PKG } as any);
    expect(r.status).toBe(SubscribePackageStatus.ALREADY_ACTIVE);
  });

  it('break: пакет не предлагается каталогом — failed с причиной', async () => {
    const subscribe = jest.fn(async () => ({ status: 'notOffered' as const, error: 'не предлагается' }));
    const r = await resolverWith({ subscribe }).subscribePackage({ packageId: PKG } as any);
    expect(r).toEqual(expect.objectContaining({ status: SubscribePackageStatus.FAILED, error: 'не предлагается' }));
  });

  it('break: узел без провайдера (порт не подключён или unavailable) — подсказка про стол подключения', async () => {
    const none = await resolverWith(undefined).subscribePackage({ packageId: PKG } as any);
    expect(none.status).toBe(SubscribePackageStatus.UNAVAILABLE);
    expect(none.error).toMatch(/стол/);
    const subscribe = jest.fn(async () => ({ status: 'unavailable' as const }));
    const r = await resolverWith({ subscribe }).subscribePackage({ packageId: PKG } as any);
    expect(r.status).toBe(SubscribePackageStatus.UNAVAILABLE);
  });
});

describe('витрина приложений: цена от провайдера', () => {
  const pkg = { packageId: PKG, publisher: 'voskhod', compatibleSubnets: [], lastActiveVersion: '0.1.2' }
  const client = { listPublicPackages: jest.fn(async () => [pkg]) }

  it('happy: цена месяца — из предложения провайдера, название — из имени пакета', async () => {
    const listOffers = jest.fn(async () => [{ package_id: PKG, price: 360, period_days: 30 }])
    const r = new AppsCatalogProxyResolver(client as any, {} as any, { listOffers } as any)
    const [item] = await r.appsCatalogRemotePackages(1, 50)
    expect(listOffers).toHaveBeenCalledWith('romashka')
    expect(item.rubPerMonth).toBe(360)
    expect(item.title).toBe('Demoapp')
  })

  it('break: узел без провайдера — цена пуста, а не выдумана', async () => {
    const none = await new AppsCatalogProxyResolver(client as any, {} as any, undefined).appsCatalogRemotePackages(1, 50)
    expect(none[0].rubPerMonth).toBeNull()
    const unavailable = await new AppsCatalogProxyResolver(client as any, {} as any, { listOffers: async () => null } as any).appsCatalogRemotePackages(1, 50)
    expect(unavailable[0].rubPerMonth).toBeNull()
  })
})
