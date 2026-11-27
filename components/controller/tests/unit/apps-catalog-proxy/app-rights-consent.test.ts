/**
 * Согласие председателя на права ядра приложения каталога (487-37).
 *
 * Ключ приложению ядро выдаёт только в пределах согласия. Версия, которая
 * просит больше, ключа не получает: запрос новых прав записывается и ждёт
 * ответа, прежняя версия работает. Переключатель «Принимать новые права»
 * снимает вопрос для издателя, которому председатель доверяет.
 */
import { AppRightsConsentService, AUTO_CONSENT } from '~/extensions/apps-catalog-proxy/application/services/app-rights-consent.service';
import { NodeAppsService } from '~/extensions/apps-catalog-proxy/application/services/node-apps.service';
import { AppRightsConsentRecord } from '~/extensions/apps-catalog-proxy/infrastructure/records/app-rights-consent.record';
import { configurePlatformSettings } from '@coopenomics/extension-kit';

configurePlatformSettings({ coopname: 'romashka', blockchain: {} } as any);

const PKG = '@voskhod/exampleapp';

function memoryStore() {
  const rows = new Map<string, AppRightsConsentRecord>();
  const match = (row: AppRightsConsentRecord, where: Partial<AppRightsConsentRecord>) =>
    Object.entries(where).every(([k, v]) => (row as any)[k] === v);
  return {
    rows,
    find: jest.fn(async (where: Partial<AppRightsConsentRecord>) => [...rows.values()].filter((r) => match(r, where))),
    findOne: jest.fn(async (where: Partial<AppRightsConsentRecord>) => [...rows.values()].find((r) => match(r, where)) ?? null),
    insert: jest.fn(async (fields: AppRightsConsentRecord) => {
      rows.set(fields.packageId, { ...fields });
      return { ...fields };
    }),
    update: jest.fn(async (where: Partial<AppRightsConsentRecord>, patch: Partial<AppRightsConsentRecord>) => {
      for (const row of rows.values()) if (match(row, where)) Object.assign(row, patch);
      return 1;
    }),
    delete: jest.fn(async (where: Partial<AppRightsConsentRecord>) => {
      for (const [key, row] of rows) if (match(row, where)) rows.delete(key);
      return 1;
    }),
  };
}

function harness() {
  const store = memoryStore();
  return { store, consents: new AppRightsConsentService(store as any) };
}

const RIGHTS = { ports: ['document', 'accessToken'], chainActions: ['eosio::refund'] };

describe('согласие на права ядра приложения', () => {
  it('happy: председатель согласился — версия с этими правами допущена, запроса новых прав нет', async () => {
    const { consents } = harness();
    await consents.grant(PKG, RIGHTS, 'ant');
    expect(await consents.admit(PKG, RIGHTS, '0.1.0')).toBe(true);
    expect(await consents.byPackage(PKG)).toEqual(
      expect.objectContaining({ ports: ['accessToken', 'document'], chainActions: ['eosio::refund'], consentedBy: 'ant', pendingVersion: null }),
    );
  });

  it('happy: приложение прав не просит — допущено без согласия и без записи', async () => {
    const { consents, store } = harness();
    expect(await consents.admit(PKG, { ports: [], chainActions: [] }, '0.1.0')).toBe(true);
    expect(store.rows.size).toBe(0);
  });

  it('side: версия просит меньше согласованного — допущена; новые методы и правки кода согласия не требуют', async () => {
    const { consents } = harness();
    await consents.grant(PKG, RIGHTS, 'ant');
    expect(await consents.admit(PKG, { ports: ['document'], chainActions: [] }, '0.1.1')).toBe(true);
  });

  it('break: согласия нет — версия не допущена, запрос записан целиком', async () => {
    const { consents } = harness();
    expect(await consents.admit(PKG, RIGHTS, '0.1.0')).toBe(false);
    expect(await consents.byPackage(PKG)).toEqual(
      expect.objectContaining({
        ports: [],
        chainActions: [],
        pendingPorts: ['accessToken', 'document'],
        pendingChainActions: ['eosio::refund'],
        pendingVersion: '0.1.0',
      }),
    );
    expect(await consents.pendingPackageIds()).toEqual(new Set([PKG]));
  });

  it('break: обновление просит новый порт и новое действие цепи — в запросе только новое, согласованное не трогается', async () => {
    const { consents } = harness();
    await consents.grant(PKG, { ports: ['document'], chainActions: [] }, 'ant');
    expect(await consents.admit(PKG, { ports: ['document', 'chain'], chainActions: ['eosio::refund'] }, '0.2.0')).toBe(false);
    expect(await consents.byPackage(PKG)).toEqual(
      expect.objectContaining({ ports: ['document'], pendingPorts: ['chain'], pendingChainActions: ['eosio::refund'], pendingVersion: '0.2.0' }),
    );
  });

  it('happy: согласие на запрос — запрос закрыт, та же версия допущена', async () => {
    const { consents } = harness();
    await consents.grant(PKG, { ports: ['document'], chainActions: [] }, 'ant');
    await consents.admit(PKG, { ports: ['document', 'chain'], chainActions: [] }, '0.2.0');
    const row = await consents.grant(PKG, { ports: ['chain'], chainActions: [] }, 'ant');
    expect(row).toEqual(expect.objectContaining({ ports: ['chain', 'document'], pendingVersion: null, pendingPorts: [] }));
    expect(await consents.admit(PKG, { ports: ['document', 'chain'], chainActions: [] }, '0.2.0')).toBe(true);
    expect(await consents.pendingPackageIds()).toEqual(new Set());
  });

  it('side: согласие на часть запроса — остаток запроса ждёт, версия не допущена', async () => {
    const { consents } = harness();
    await consents.admit(PKG, RIGHTS, '0.1.0');
    const row = await consents.grant(PKG, { ports: ['document'], chainActions: [] }, 'ant');
    expect(row).toEqual(expect.objectContaining({ ports: ['document'], pendingPorts: ['accessToken'], pendingVersion: '0.1.0' }));
    expect(await consents.admit(PKG, RIGHTS, '0.1.0')).toBe(false);
  });

  it('side: издатель выпустил версию без новых прав, пока запрос ждал — запрос устарел и снят', async () => {
    const { consents } = harness();
    await consents.grant(PKG, { ports: ['document'], chainActions: [] }, 'ant');
    await consents.admit(PKG, { ports: ['document', 'chain'], chainActions: [] }, '0.2.0');
    expect(await consents.admit(PKG, { ports: ['document'], chainActions: [] }, '0.2.1')).toBe(true);
    expect(await consents.byPackage(PKG)).toEqual(expect.objectContaining({ pendingVersion: null, pendingPorts: [] }));
  });

  it('break: неизвестный порт и действие в неверной записи в согласие не попадают', async () => {
    const { consents } = harness();
    const row = await consents.grant(PKG, { ports: ['document', 'vault'], chainActions: ['eosio::refund', 'DROP TABLE'] }, 'ant');
    expect(row).toEqual(expect.objectContaining({ ports: ['document'], chainActions: ['eosio::refund'] }));
  });

  it('side: повторный запрос той же версии время запроса не сдвигает', async () => {
    const { consents } = harness();
    await consents.admit(PKG, RIGHTS, '0.1.0');
    const first = (await consents.byPackage(PKG))?.pendingAt;
    await consents.admit(PKG, RIGHTS, '0.1.0');
    expect((await consents.byPackage(PKG))?.pendingAt).toBe(first);
  });

  it('side: отмена подписки стирает согласие — прежние права по новой подписке не действуют', async () => {
    const { consents } = harness();
    await consents.grant(PKG, RIGHTS, 'ant');
    await consents.forget(PKG);
    expect(await consents.byPackage(PKG)).toBeNull();
    expect(await consents.admit(PKG, RIGHTS, '0.1.0')).toBe(false);
  });
});

describe('переключатель «Принимать новые права»', () => {
  it('happy: переключатель включён — обновление с новым правом допущено, согласие отмечено переключателем', async () => {
    const { consents } = harness();
    await consents.grant(PKG, { ports: ['document'], chainActions: [] }, 'ant');
    await consents.setAutoAccept(PKG, true, 'ant');
    expect(await consents.admit(PKG, { ports: ['document', 'chain'], chainActions: ['eosio::refund'] }, '0.2.0')).toBe(true);
    expect(await consents.byPackage(PKG)).toEqual(
      expect.objectContaining({ ports: ['chain', 'document'], chainActions: ['eosio::refund'], consentedBy: AUTO_CONSENT, pendingVersion: null }),
    );
  });

  it('happy: включение при запросе, который ждёт, — запрос принят сразу от имени председателя', async () => {
    const { consents } = harness();
    await consents.admit(PKG, RIGHTS, '0.1.0');
    const row = await consents.setAutoAccept(PKG, true, 'ant');
    expect(row).toEqual(expect.objectContaining({ autoAccept: true, ports: ['accessToken', 'document'], consentedBy: 'ant', pendingVersion: null }));
  });

  it('break: переключатель выключен обратно — следующее новое право снова ждёт согласия', async () => {
    const { consents } = harness();
    await consents.setAutoAccept(PKG, true, 'ant');
    await consents.setAutoAccept(PKG, false, 'ant');
    expect(await consents.admit(PKG, RIGHTS, '0.1.0')).toBe(false);
  });
});

describe('права приложения для стола', () => {
  function appsHarness(requested: { version: string | null; ports: string[]; chainActions: string[] } | null) {
    const { consents } = harness();
    const catalog = { fetchAppRights: jest.fn(async () => requested), recheckApp: jest.fn(async () => undefined) };
    const service = new NodeAppsService(catalog as any, {} as any, consents, {} as any, undefined);
    return { service, consents, catalog };
  }

  it('happy: стол получает, что просит версия, что разрешено и что ждёт согласия', async () => {
    const h = appsHarness({ version: '0.2.0', ports: ['document', 'chain'], chainActions: [] });
    await h.consents.grant(PKG, { ports: ['document'], chainActions: [] }, 'ant');
    await h.consents.admit(PKG, { ports: ['document', 'chain'], chainActions: [] }, '0.2.0');
    expect(await h.service.rights(PKG)).toEqual(
      expect.objectContaining({
        packageId: PKG,
        version: '0.2.0',
        requested: { ports: ['document', 'chain'], chainActions: [] },
        granted: { ports: ['document'], chainActions: [] },
        pending: { ports: ['chain'], chainActions: [] },
        pendingVersion: '0.2.0',
        autoAccept: false,
        consentedBy: 'ant',
      }),
    );
  });

  it('side: оркестратор недоступен — перечень запрошенных прав пуст, согласие отдаётся', async () => {
    const h = appsHarness(null);
    await h.consents.grant(PKG, { ports: ['document'], chainActions: [] }, 'ant');
    expect(await h.service.rights(PKG)).toEqual(
      expect.objectContaining({ version: null, requested: null, granted: { ports: ['document'], chainActions: [] }, pending: null }),
    );
  });

  it('happy: согласие председателя просит оркестратор повторить установку', async () => {
    const h = appsHarness({ version: '0.1.0', ports: ['document'], chainActions: [] });
    const out = await h.service.grantRights(PKG, { ports: ['document'], chainActions: [] }, 'ant');
    expect(out.granted).toEqual({ ports: ['document'], chainActions: [] });
    expect(h.catalog.recheckApp).toHaveBeenCalledWith(PKG);
  });

  it('side: включение переключателя просит повторить установку, выключение — нет', async () => {
    const h = appsHarness({ version: '0.1.0', ports: [], chainActions: [] });
    await h.service.setRightsAutoAccept(PKG, true, 'ant');
    expect(h.catalog.recheckApp).toHaveBeenCalledTimes(1);
    await h.service.setRightsAutoAccept(PKG, false, 'ant');
    expect(h.catalog.recheckApp).toHaveBeenCalledTimes(1);
  });
});
