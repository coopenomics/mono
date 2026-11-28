/**
 * Согласие председателя на права ядра приложения каталога (487-37).
 *
 * Ключ приложению ядро выдаёт только в пределах согласия. Версия, которая
 * просит больше, ключа не получает: запрос новых прав записывается и ждёт
 * ответа, прежняя версия работает. Переключатель «Принимать новые права»
 * снимает вопрос для издателя, которому председатель доверяет.
 */
import { AppRightsConsentService, AUTO_CONSENT } from '~/extensions/apps-catalog-proxy/application/services/app-rights-consent.service';
import { AppRightsNotifierService } from '~/extensions/apps-catalog-proxy/application/services/app-rights-notifier.service';
import { NodeAppsService } from '~/extensions/apps-catalog-proxy/application/services/node-apps.service';
import { AppRightsConsentRecord } from '~/extensions/apps-catalog-proxy/infrastructure/records/app-rights-consent.record';
import { configurePlatformSettings } from '@coopenomics/extension-kit';

configurePlatformSettings({ coopname: 'romashka', frontendUrl: 'https://romashka.coop', blockchain: {} } as any);

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

  it('break: приём новых прав выключен, обновление просит новый порт и новое действие цепи — в запросе только новое, согласованное не трогается', async () => {
    const { consents } = harness();
    await consents.grant(PKG, { ports: ['document'], chainActions: [] }, 'ant');
    await consents.setAutoAccept(PKG, false, 'ant');
    expect(await consents.admit(PKG, { ports: ['document', 'chain'], chainActions: ['eosio::refund'] }, '0.2.0')).toBe(false);
    expect(await consents.byPackage(PKG)).toEqual(
      expect.objectContaining({ ports: ['document'], pendingPorts: ['chain'], pendingChainActions: ['eosio::refund'], pendingVersion: '0.2.0' }),
    );
  });

  it('happy: приём новых прав выключен, согласие на запрос — запрос закрыт, та же версия допущена', async () => {
    const { consents } = harness();
    await consents.grant(PKG, { ports: ['document'], chainActions: [] }, 'ant');
    await consents.setAutoAccept(PKG, false, 'ant');
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
    await consents.setAutoAccept(PKG, false, 'ant');
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

  // 487-37, слово владельца 28.11.2026: новые права принимаются без
  // подтверждения председателя — признак включён всем, переключатель скрыт.
  it('happy: после согласия председателя обновление с новым портом и действием цепи допущено само', async () => {
    const { consents } = harness();
    const first = await consents.grant(PKG, { ports: ['document'], chainActions: [] }, 'ant');
    expect(first.autoAccept).toBe(true);
    expect(await consents.admit(PKG, { ports: ['document', 'chain'], chainActions: ['eosio::refund'] }, '0.2.0')).toBe(true);
    expect(await consents.byPackage(PKG)).toEqual(
      expect.objectContaining({ ports: ['chain', 'document'], chainActions: ['eosio::refund'], pendingVersion: null }),
    );
  });

  it('break: первая установка без согласия председателя сама не принимается и на повторе', async () => {
    const { consents } = harness();
    expect(await consents.admit(PKG, RIGHTS, '0.1.0')).toBe(false);
    expect(await consents.admit(PKG, RIGHTS, '0.1.0')).toBe(false);
    expect(await consents.byPackage(PKG)).toEqual(expect.objectContaining({ autoAccept: false, consentedBy: null, pendingVersion: '0.1.0' }));
  });

  it('happy: председатель согласился на запрос первой установки — приём новых прав включается', async () => {
    const { consents } = harness();
    await consents.admit(PKG, RIGHTS, '0.1.0');
    const row = await consents.grant(PKG, RIGHTS, 'ant');
    expect(row).toEqual(expect.objectContaining({ autoAccept: true, consentedBy: 'ant', pendingVersion: null }));
    expect(await consents.admit(PKG, { ports: [...RIGHTS.ports, 'chain'], chainActions: RIGHTS.chainActions }, '0.2.0')).toBe(true);
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
    const catalog = {
      fetchAppRights: jest.fn(async () => requested),
      // До подписки права отдаёт каталог (28.11.2026); в этом наборе он не отвечает.
      fetchCatalogRights: jest.fn(async () => null),
      recheckApp: jest.fn(async () => undefined),
    };
    const service = new NodeAppsService(catalog as any, {} as any, consents, {} as any, undefined);
    return { service, consents, catalog };
  }

  it('happy: стол получает, что просит версия, что разрешено и что ждёт согласия', async () => {
    const h = appsHarness({ version: '0.2.0', ports: ['document', 'chain'], chainActions: [] });
    await h.consents.grant(PKG, { ports: ['document'], chainActions: [] }, 'ant');
    await h.consents.setAutoAccept(PKG, false, 'ant');
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

  it('side: оркестратор и каталог недоступны — перечень запрошенных прав пуст, согласие отдаётся', async () => {
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

describe('уведомление председателю о запросе новых прав', () => {
  function notifiedHarness() {
    const store = memoryStore();
    const notifier = { requestRaised: jest.fn(async () => undefined) };
    return { notifier, consents: new AppRightsConsentService(store as any, notifier as any) };
  }

  it('happy: новый запрос прав — одно уведомление; повтор той же версии председателя не беспокоит', async () => {
    const { consents, notifier } = notifiedHarness();
    await consents.admit(PKG, RIGHTS, '0.2.0');
    await consents.admit(PKG, RIGHTS, '0.2.0');
    await consents.admit(PKG, RIGHTS, '0.2.0');
    expect(notifier.requestRaised).toHaveBeenCalledTimes(1);
    expect(notifier.requestRaised).toHaveBeenCalledWith(PKG);
  });

  it('side: следующая версия снова просит права — новое уведомление', async () => {
    const { consents, notifier } = notifiedHarness();
    await consents.admit(PKG, RIGHTS, '0.2.0');
    await consents.admit(PKG, RIGHTS, '0.3.0');
    expect(notifier.requestRaised).toHaveBeenCalledTimes(2);
  });

  it('side: версия в пределах согласия и приём переключателем уведомление о запросе не шлют', async () => {
    const { consents, notifier } = notifiedHarness();
    await consents.grant(PKG, RIGHTS, 'ant');
    await consents.admit(PKG, RIGHTS, '0.1.0');
    await consents.setAutoAccept(PKG, true, 'ant');
    await consents.admit(PKG, { ports: ['document', 'chain'], chainActions: [] }, '0.2.0');
    expect(notifier.requestRaised).not.toHaveBeenCalled();
  });

  function notifierHarness(opts: { chairman?: string | null; fail?: boolean } = {}) {
    const account = {
      getAccounts: jest.fn(async () => ({ items: opts.chairman === null ? [] : [{ username: opts.chairman ?? 'ant' }] })),
      getDisplayName: jest.fn(async () => 'ПК «Ромашка»'),
    };
    const notifications = {
      notifyUser: jest.fn(async () => {
        if (opts.fail) throw new Error('у пайщика нет идентификатора подписчика');
        return {};
      }),
    };
    return { account, notifications, notifier: new AppRightsNotifierService(account as any, notifications as any) };
  }

  it('happy: уведомление адресовано председателю и ведёт на страницу приложения', async () => {
    const h = notifierHarness();
    await h.notifier.requestRaised(PKG);
    expect(h.account.getAccounts).toHaveBeenCalledWith({ role: 'chairman' }, expect.objectContaining({ limit: 1 }));
    expect(h.notifications.notifyUser).toHaveBeenCalledWith('ant', 'prilozhenie-prosit-novye-prava-yadra', {
      coopShortName: 'ПК «Ромашка»',
      appTitle: 'Exampleapp',
      appUrl: 'https://romashka.coop/romashka/apps/app/%40voskhod%2Fexampleapp',
    });
  });

  it('break: председателя нет либо отправка упала — запрос прав не роняется', async () => {
    const none = notifierHarness({ chairman: null });
    await expect(none.notifier.requestRaised(PKG)).resolves.toBeUndefined();
    expect(none.notifications.notifyUser).not.toHaveBeenCalled();
    const failing = notifierHarness({ fail: true });
    await expect(failing.notifier.requestRaised(PKG)).resolves.toBeUndefined();
  });
});
