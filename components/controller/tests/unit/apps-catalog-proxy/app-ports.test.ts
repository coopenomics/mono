/**
 * Порты ядра для приложений каталога в своих контейнерах (25.11.2026, 487-17).
 *
 * Приложение — чужой код на узле кооператива. Ядро открывает ему только
 * заявленные порты из белого списка, подписывает только заявленные действия
 * цепи и узнаёт пакет по токену, который стирается вместе с заявкой.
 */
import { DomainError } from '@coopenomics/extension-kit';
import {
  AppPortGrantsService,
  hashAppToken,
} from '~/extensions/apps-catalog-proxy/application/services/app-port-grants.service';
import { RemotePortsService } from '~/extensions/apps-catalog-proxy/application/services/remote-ports.service';
import {
  AppPortGrantsController,
  AppPortsController,
} from '~/extensions/apps-catalog-proxy/application/controllers/app-ports.controller';
import { AppPortGrantRecord } from '~/extensions/apps-catalog-proxy/infrastructure/records/app-port-grant.record';
import { configurePlatformSettings } from '@coopenomics/extension-kit';

configurePlatformSettings({ coopname: 'romashka', blockchain: {} } as any);

const PKG = '@voskhod/exampleapp';

/** Хранилище заявок в памяти: те же операции, что у TableStore. */
function memoryStore() {
  const rows = new Map<string, AppPortGrantRecord>();
  const match = (row: AppPortGrantRecord, where: Partial<AppPortGrantRecord>) =>
    Object.entries(where).every(([k, v]) => (row as any)[k] === v);
  return {
    rows,
    exists: jest.fn(async (where: Partial<AppPortGrantRecord>) => [...rows.values()].some((r) => match(r, where))),
    findOne: jest.fn(async (where: Partial<AppPortGrantRecord>) => [...rows.values()].find((r) => match(r, where)) ?? null),
    insert: jest.fn(async (fields: AppPortGrantRecord) => {
      rows.set(fields.packageId, { ...fields });
      return fields;
    }),
    update: jest.fn(async (where: Partial<AppPortGrantRecord>, patch: Partial<AppPortGrantRecord>) => {
      for (const row of rows.values()) if (match(row, where)) Object.assign(row, patch);
      return 1;
    }),
    delete: jest.fn(async (where: Partial<AppPortGrantRecord>) => {
      for (const [key, row] of rows) if (match(row, where)) rows.delete(key);
      return 1;
    }),
  };
}

function grantsHarness() {
  const store = memoryStore();
  return { store, grants: new AppPortGrantsService(store as any) };
}

function portsHarness(wif: string | null = '5Kwif') {
  const document = { generate: jest.fn(async () => ({ hash: 'H' })), saveData: jest.fn() };
  const cooperativeVars = { get: jest.fn(async () => ({ coopname: 'romashka', name: 'Ромашка', shortAbbr: 'ПК' })) };
  const accessToken = { identify: jest.fn(async () => ({ username: 'ant', role: 'chairman', status: 'active' })) };
  const account = { getDisplayName: jest.fn(async () => 'Иванов И. И.') };
  const chain = {
    initialize: jest.fn(),
    transact: jest.fn(async () => ({ signatures: ['SIG_K1_x'] })),
    getSingleRow: jest.fn(async () => ({ username: 'romashka' })),
    queryRows: jest.fn(async () => []),
  };
  const vault = { getWif: jest.fn(async () => wif) };
  const ports = new RemotePortsService(
    document as any,
    cooperativeVars as any,
    accessToken as any,
    account as any,
    chain as any,
    vault as any,
    // Токены приложений проверяет свой тест (app-session.test.ts).
    { verify: jest.fn(() => null) } as any,
  );
  return { ports, document, cooperativeVars, accessToken, account, chain, vault };
}

const grant = (over: Partial<AppPortGrantRecord> = {}): AppPortGrantRecord => ({
  packageId: PKG,
  tokenHash: 'h',
  ports: ['document', 'cooperativeVars', 'chain'],
  chainActions: ['soviet::createagenda'],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

const code = async (run: () => Promise<unknown>): Promise<string> => {
  try {
    await run();
  } catch (e) {
    return e instanceof DomainError ? e.code : `не DomainError: ${String(e)}`;
  }
  return 'отказа нет';
};

describe('заявка приложения на порты ядра', () => {
  it('happy: выдача заводит заявку и отдаёт токен; в базе лежит только его хэш', async () => {
    const { grants, store } = grantsHarness();
    const issued = await grants.issue(PKG, { ports: ['document'], chainActions: ['soviet::createagenda'] });
    expect(issued.token).toMatch(/^apt_[0-9a-f]{64}$/);
    const row = store.rows.get(PKG)!;
    expect(row.tokenHash).toBe(hashAppToken(issued.token));
    expect(JSON.stringify(row)).not.toContain(issued.token);
    expect(row.ports).toEqual(['document']);
    expect(row.chainActions).toEqual(['soviet::createagenda']);
  });

  it('break: неизвестный порт и действие в неверной записи в заявку не попадают — опечатка манифеста не становится доступом', async () => {
    const { grants } = grantsHarness();
    const issued = await grants.issue(PKG, {
      ports: ['document', 'vault', 'нет-такого', 'document'],
      chainActions: ['soviet::createagenda', 'eosio', 'Soviet::Vote', 'a::b::c'],
    });
    expect(issued.ports).toEqual(['document']);
    expect(issued.chainActions).toEqual(['soviet::createagenda']);
  });

  it('happy: по токену находится заявка пакета', async () => {
    const { grants } = grantsHarness();
    const { token } = await grants.issue(PKG, { ports: ['document'], chainActions: [] });
    expect((await grants.byToken(token))?.packageId).toBe(PKG);
  });

  it('break: чужой токен и токен не того вида заявку не находят', async () => {
    const { grants, store } = grantsHarness();
    await grants.issue(PKG, { ports: ['document'], chainActions: [] });
    expect(await grants.byToken(`apt_${'0'.repeat(64)}`)).toBeNull();
    // Токен пайщика (JWT) в базе даже не ищется.
    store.findOne.mockClear();
    expect(await grants.byToken('eyJhbGciOiJIUzI1NiJ9.e30.x')).toBeNull();
    expect(store.findOne).not.toHaveBeenCalled();
  });

  it('side: повторная выдача тому же пакету заменяет токен — прежний перестаёт действовать', async () => {
    const { grants, store } = grantsHarness();
    const first = await grants.issue(PKG, { ports: ['document'], chainActions: [] });
    const second = await grants.issue(PKG, { ports: ['document', 'chain'], chainActions: [] });
    expect(second.token).not.toBe(first.token);
    expect(store.rows.size).toBe(1);
    expect(await grants.byToken(first.token)).toBeNull();
    expect((await grants.byToken(second.token))?.ports).toEqual(['chain', 'document']);
  });

  it('break: после снятия приложения его токен не принимается', async () => {
    const { grants } = grantsHarness();
    const { token } = await grants.issue(PKG, { ports: ['document'], chainActions: [] });
    await grants.revoke(PKG);
    expect(await grants.byToken(token)).toBeNull();
  });
});

describe('вызов порта от имени приложения', () => {
  it('happy: заявленный порт — вызов доходит до реализации ядра с теми же аргументами', async () => {
    const h = portsHarness();
    const request = { data: { registry_id: 1, coopname: 'romashka', username: 'ant' } };
    expect(await h.ports.call(grant(), 'romashka', 'document', 'generate', [request])).toEqual({ hash: 'H' });
    expect(h.document.generate).toHaveBeenCalledWith(request);
    expect(await h.ports.call(grant(), 'romashka', 'cooperativeVars', 'get', [])).toEqual(
      expect.objectContaining({ coopname: 'romashka' }),
    );
  });

  it('break: порт не заявлен пакетом — отказ APPS_CATALOG_PROXY_APP_PORT_NOT_GRANTED, реализация не вызвана', async () => {
    const h = portsHarness();
    expect(await code(() => h.ports.call(grant(), 'romashka', 'account', 'getDisplayName', ['ant']))).toBe('APPS_CATALOG_PROXY_APP_PORT_NOT_GRANTED');
    expect(h.account.getDisplayName).not.toHaveBeenCalled();
  });

  it('break: метод порта вне белого списка — отказ APPS_CATALOG_PROXY_APP_PORT_UNKNOWN, даже если у реализации он есть', async () => {
    const h = portsHarness();
    // saveData у реализации есть, но приложениям не открыт.
    expect(await code(() => h.ports.call(grant(), 'romashka', 'document', 'saveData', [{}, 1]))).toBe('APPS_CATALOG_PROXY_APP_PORT_UNKNOWN');
    expect(h.document.saveData).not.toHaveBeenCalled();
    expect(await code(() => h.ports.call(grant(), 'romashka', 'vault', 'getWif', ['romashka']))).toBe('APPS_CATALOG_PROXY_APP_PORT_UNKNOWN');
    // Свойства объекта (constructor, toString) методами порта не считаются.
    expect(await code(() => h.ports.call(grant(), 'romashka', 'document', 'constructor', []))).toBe('APPS_CATALOG_PROXY_APP_PORT_UNKNOWN');
  });

  it('break: chain.initialize по сети не вызывается — ключ приложение не назначает', async () => {
    const h = portsHarness();
    expect(await code(() => h.ports.call(grant(), 'romashka', 'chain', 'initialize', ['romashka', '5Kwif']))).toBe('APPS_CATALOG_PROXY_APP_PORT_UNKNOWN');
    expect(h.chain.initialize).not.toHaveBeenCalled();
  });
});

describe('действия цепи по просьбе приложения', () => {
  const action = (account: string, name: string) => ({
    account,
    name,
    authorization: [{ actor: 'intruder', permission: 'owner' }],
    data: { coopname: 'romashka' },
  });

  it('happy: заявленное действие — ядро берёт ключ из хранилища, ставит подписантом кооператив и проводит', async () => {
    const h = portsHarness();
    await h.ports.call(grant(), 'romashka', 'chain', 'transact', [action('soviet', 'createagenda')]);
    expect(h.vault.getWif).toHaveBeenCalledWith('romashka');
    expect(h.chain.initialize).toHaveBeenCalledWith('romashka', '5Kwif');
    expect(h.chain.transact).toHaveBeenCalledWith(
      [
        {
          account: 'soviet',
          name: 'createagenda',
          // Подписанта из запроса приложения ядро не принимает.
          authorization: [{ actor: 'romashka', permission: 'active' }],
          data: { coopname: 'romashka' },
        },
      ],
      true,
    );
  });

  it('side: broadcast=false доходит до цепи — транзакция подписана, но не отправлена', async () => {
    const h = portsHarness();
    await h.ports.call(grant(), 'romashka', 'chain', 'transact', [action('soviet', 'createagenda'), false]);
    expect(h.chain.transact).toHaveBeenCalledWith(expect.any(Array), false);
  });

  it('break: действие не заявлено — отказ APPS_CATALOG_PROXY_APP_CHAIN_ACTION_NOT_GRANTED, ключ не достаётся, в цепь ничего не идёт', async () => {
    const h = portsHarness();
    expect(await code(() => h.ports.call(grant(), 'romashka', 'chain', 'transact', [action('eosio', 'updateauth')]))).toBe(
      'APPS_CATALOG_PROXY_APP_CHAIN_ACTION_NOT_GRANTED',
    );
    expect(h.vault.getWif).not.toHaveBeenCalled();
    expect(h.chain.transact).not.toHaveBeenCalled();
  });

  it('break: в пачке одно действие не заявлено — отклонена вся пачка', async () => {
    const h = portsHarness();
    const batch = [action('soviet', 'createagenda'), action('eosio.token', 'transfer')];
    expect(await code(() => h.ports.call(grant(), 'romashka', 'chain', 'transact', [batch]))).toBe('APPS_CATALOG_PROXY_APP_CHAIN_ACTION_NOT_GRANTED');
    expect(h.chain.transact).not.toHaveBeenCalled();
  });

  it('break: пустой список действий — отказ APPS_CATALOG_PROXY_APP_CHAIN_ACTIONS_EMPTY', async () => {
    const h = portsHarness();
    expect(await code(() => h.ports.call(grant(), 'romashka', 'chain', 'transact', [[]]))).toBe('APPS_CATALOG_PROXY_APP_CHAIN_ACTIONS_EMPTY');
  });

  it('side: ключа кооператива в хранилище нет — отказ APPS_CATALOG_PROXY_APP_COOP_KEY_NOT_FOUND, действие не проводится', async () => {
    const h = portsHarness(null);
    expect(await code(() => h.ports.call(grant(), 'romashka', 'chain', 'transact', [action('soviet', 'createagenda')]))).toBe(
      'APPS_CATALOG_PROXY_APP_COOP_KEY_NOT_FOUND',
    );
    expect(h.chain.transact).not.toHaveBeenCalled();
  });

  it('happy: чтение таблицы цепи заявки на действия не требует', async () => {
    const h = portsHarness();
    const g = grant({ chainActions: [] });
    expect(await h.ports.call(g, 'romashka', 'chain', 'getSingleRow', ['registrator', 'registrator', 'coops', 'romashka'])).toEqual({
      username: 'romashka',
    });
  });
});

describe('маршруты входа портов', () => {
  function controllers(secret: string | undefined = 'node-secret') {
    const { grants } = grantsHarness();
    const h = portsHarness();
    const config = { get: (k: string) => (k === 'SERVER_SECRET' ? secret : undefined) };
    return {
      grants,
      h,
      ports: new AppPortsController(grants, h.ports),
      admin: new AppPortGrantsController(grants, config as any),
    };
  }

  it('happy: оркестратор заводит заявку секретом узла, приложение вызывает порт своим токеном', async () => {
    const c = controllers();
    const issued = await c.admin.issue('node-secret', 'voskhod', 'exampleapp', { ports: ['cooperativeVars'], chain_actions: [] });
    expect(issued.ports).toEqual(['cooperativeVars']);
    const res = await c.ports.call(`Bearer ${issued.token}`, 'cooperativeVars', 'get', { args: [] });
    expect(res).toEqual({ result: expect.objectContaining({ coopname: 'romashka' }) });
  });

  it('break: без токена приложения и с неизвестным токеном — APPS_CATALOG_PROXY_APP_PORT_TOKEN_INVALID', async () => {
    const c = controllers();
    expect(await code(() => c.ports.call(undefined, 'cooperativeVars', 'get', { args: [] }))).toBe('APPS_CATALOG_PROXY_APP_PORT_TOKEN_INVALID');
    expect(await code(() => c.ports.call(`Bearer apt_${'1'.repeat(64)}`, 'cooperativeVars', 'get', { args: [] }))).toBe(
      'APPS_CATALOG_PROXY_APP_PORT_TOKEN_INVALID',
    );
  });

  it('break: заявку без секрета узла, с чужим секретом или при незаданном секрете завести нельзя', async () => {
    const c = controllers();
    expect(await code(() => c.admin.issue(undefined, 'voskhod', 'exampleapp', {}))).toBe('APPS_CATALOG_PROXY_APP_GRANT_SERVICE_ONLY');
    expect(await code(() => c.admin.issue('чужой', 'voskhod', 'exampleapp', {}))).toBe('APPS_CATALOG_PROXY_APP_GRANT_SERVICE_ONLY');
    expect(await code(() => c.admin.revoke('чужой', 'voskhod', 'exampleapp'))).toBe('APPS_CATALOG_PROXY_APP_GRANT_SERVICE_ONLY');
    // Секрет узла не задан — пустая строка в заголовке входом не считается.
    const open = controllers(undefined);
    expect(await code(() => open.admin.issue('', 'voskhod', 'exampleapp', {}))).toBe('APPS_CATALOG_PROXY_APP_GRANT_SERVICE_ONLY');
  });

  it('side: порт вернул undefined — клиент получает явный null', async () => {
    const c = controllers();
    c.h.cooperativeVars.get.mockResolvedValueOnce(undefined as any);
    const issued = await c.admin.issue('node-secret', 'voskhod', 'exampleapp', { ports: ['cooperativeVars'] });
    expect(await c.ports.call(`Bearer ${issued.token}`, 'cooperativeVars', 'get', undefined)).toEqual({ result: null });
  });

  it('happy: снятие стирает заявку — тот же токен больше не принимается', async () => {
    const c = controllers();
    const issued = await c.admin.issue('node-secret', '@voskhod', 'exampleapp', { ports: ['cooperativeVars'] });
    await c.admin.revoke('node-secret', 'voskhod', 'exampleapp');
    expect(await code(() => c.ports.call(`Bearer ${issued.token}`, 'cooperativeVars', 'get', { args: [] }))).toBe(
      'APPS_CATALOG_PROXY_APP_PORT_TOKEN_INVALID',
    );
  });
});
