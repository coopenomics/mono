import { CardcoopConnectService } from '~/extensions/cardcoop/registry/connect.service';
import { CardcoopOperatorAnnounceService } from '~/extensions/cardcoop/registry/operator-announce.service';
import { CardcoopRegistryDocumentType } from '~/extensions/cardcoop/registry/registry.types';
import { CardcoopWebhookKeyService } from '~/extensions/cardcoop/registry/webhook-key.service';

// Имя кооператива установки подменяется по тесту: оператор сети определяется именем.
let mockCoopname = 'voskhod';
jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({
    coopname: mockCoopname,
    backendUrl: 'https://voskhod.coop/backend/',
    blockchain: { chainId: 'chain-1' },
  }),
}));

/**
 * Подключение кооператива к сети карт (story 7.6, FR-E6).
 *
 * Проверяется разделение властей и живучесть. Оператор объявляет юридический факт и не несёт
 * технических параметров; кооператив доносит параметры сам и только когда они изменились.
 * Недоступность card.coop не роняет ни старт кооператива, ни активацию — недоставленное
 * повторяется.
 */
const logger = { setContext: () => undefined, info: jest.fn(), warn: jest.fn(), error: jest.fn(), log: () => undefined };

const clientSettings = {
  client_id: 'cardcoop',
  client_secret: 'секрет-клиента',
  issuer: 'https://voskhod.coop/id/application/o/cardcoop/',
};

describe('Самоподключение кооператива к сети карт', () => {
  let stateRows: Map<string, any>;
  let deliverDocument: jest.Mock;
  let attestationService: any;

  const stateRepo = () => ({
    findOne: jest.fn(async ({ where }: any) => stateRows.get(where.id) ?? null),
    create: (data: any) => ({ ...data }),
    save: jest.fn(async (row: any) => {
      stateRows.set(row.id, row);
      return row;
    }),
  });

  let accounts: { getDisplayName: jest.Mock };
  const build = (settings: unknown = clientSettings) => {
    const integrations = { get: jest.fn(() => settings) };
    return new CardcoopConnectService(
      stateRepo() as any,
      attestationService,
      integrations as any,
      logger as any,
      accounts as any
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    stateRows = new Map();
    deliverDocument = jest.fn(async () => ({ delivered: true, status: 200 }));
    attestationService = {
      signDocument: jest.fn(async (payload: any) => ({ payload, signature: 'SIG_K1_x', chain: ['a', 'b'] })),
      deliverDocument,
    };
    accounts = { getDisplayName: jest.fn(async () => 'ПК «Восход»') };
  });

  it('параметры установки уходят подписанным документом: issuer, клиент и адреса расширения', async () => {
    await build().connectIfChanged('https://card.coop');

    const [url, envelope] = deliverDocument.mock.calls[0];
    expect(url).toBe('https://card.coop/v1/coops/connect');
    expect(envelope.payload.type).toBe(CardcoopRegistryDocumentType.Connect);
    expect(envelope.payload.coopname).toBe('voskhod');
    expect(envelope.payload.oidc_client_secret).toBe('секрет-клиента');
    expect(envelope.payload.attestation_callback_url).toBe(
      'https://voskhod.coop/backend/v1/extensions/cardcoop/webhooks'
    );
    expect(envelope.payload.disclosure_url).toBe('https://voskhod.coop/backend/v1/extensions/cardcoop/disclosures');
    expect(envelope.payload.chain_id).toBe('chain-1');
  });

  it('наименование кооператива уезжает в документе — в цепи его нет, знает только установка', async () => {
    await build().connectIfChanged('https://card.coop');

    expect(deliverDocument.mock.calls[0][1].payload.display_name).toBe('ПК «Восход»');
  });

  it('пустое или техническое наименование не отправляется — сеть оставит имя, которое у неё есть', async () => {
    accounts.getDisplayName = jest.fn(async () => 'voskhod');
    await build().connectIfChanged('https://card.coop');

    expect(deliverDocument.mock.calls[0][1].payload).not.toHaveProperty('display_name');
  });

  it('подключение повторяется по расписанию, пока сеть его не приняла', async () => {
    jest.useFakeTimers();
    try {
      deliverDocument.mockResolvedValue({ delivered: false, status: null, reason: 'сеть недоступна' });
      const service = build();
      service.startRetries('https://card.coop');

      await jest.advanceTimersByTimeAsync(15 * 60 * 1000);
      await jest.advanceTimersByTimeAsync(15 * 60 * 1000);
      expect(deliverDocument).toHaveBeenCalledTimes(2);

      // Принятое подключение с реквизитами клиента повторно не уходит.
      deliverDocument.mockResolvedValue({
        delivered: true,
        status: 200,
        body: { rpClient: { clientId: 'c', clientSecret: 's', issuer: 'https://card.coop/application/o/coop-voskhod/' } },
      });
      await jest.advanceTimersByTimeAsync(15 * 60 * 1000);
      expect(deliverDocument).toHaveBeenCalledTimes(3);
      await jest.advanceTimersByTimeAsync(15 * 60 * 1000);
      expect(deliverDocument).toHaveBeenCalledTimes(3);
      service.onModuleDestroy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('без реквизитов клиента подключение честно пропускается, а не шлёт пустой секрет', async () => {
    await build(null).connectIfChanged('https://card.coop');

    expect(deliverDocument).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('неизменившийся состав повторно не отправляется — рестарт не стучится в сеть', async () => {
    // Принятым считается подключение, на которое сеть выдала реквизиты клиента (3B5-59):
    // без них следующий старт подключается заново даже при том же составе.
    deliverDocument.mockResolvedValue({
      delivered: true,
      status: 200,
      body: { rpClient: { clientId: 'c', clientSecret: 's', issuer: 'https://card.coop/application/o/coop-voskhod/' } },
    });
    const service = build();

    await service.connectIfChanged('https://card.coop');
    await service.connectIfChanged('https://card.coop');

    expect(deliverDocument).toHaveBeenCalledTimes(1);
  });

  it('изменившийся секрет уезжает сам — так и выглядит ротация без участия людей', async () => {
    const service = build();
    await service.connectIfChanged('https://card.coop');

    const rotated = build({ ...clientSettings, client_secret: 'новый-секрет' });
    // Состояние общее: подменяем репозиторий тем же хранилищем.
    (rotated as any).state = (service as any).state;
    await rotated.connectIfChanged('https://card.coop');

    expect(deliverDocument).toHaveBeenCalledTimes(2);
  });

  it('недоставка не запоминается как успех: следующий старт повторит', async () => {
    deliverDocument.mockResolvedValue({ delivered: false, status: null, reason: 'сеть недоступна' });
    const service = build();

    await service.connectIfChanged('https://card.coop');
    expect(stateRows.get('self')?.deliveredHash).toBeNull();
    expect(stateRows.get('self')?.lastError).toBe('сеть недоступна');

    deliverDocument.mockResolvedValue({ delivered: true, status: 200 });
    await service.connectIfChanged('https://card.coop');
    expect(deliverDocument).toHaveBeenCalledTimes(2);
    expect(stateRows.get('self')?.lastError).toBeNull();
  });
});

describe('Объявление допуска оператором сети', () => {
  let announcementRows: Map<string, any>;
  let deliverDocument: jest.Mock;
  let attestationService: any;
  let chain: { getSingleRow: jest.Mock };

  const build = (announceAsOperator: boolean) => {
    const repo = {
      findOne: jest.fn(async ({ where }: any) => announcementRows.get(where.coopname) ?? null),
      find: jest.fn(async () => [...announcementRows.values()].filter((row) => !row.delivered)),
      create: (data: any) => ({ ...data }),
      save: jest.fn(async (row: any) => {
        announcementRows.set(row.coopname, row);
        return row;
      }),
    };
    const extension = { config: { api_url: 'https://card.coop', announce_as_operator: announceAsOperator } };
    return new CardcoopOperatorAnnounceService(
      repo as any,
      extension as any,
      attestationService,
      chain as any,
      logger as any
    );
  };

  const activation = (coopname = 'zarya', status = 'active') => ({ data: { coopname, status } }) as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCoopname = 'voskhod';
    announcementRows = new Map();
    deliverDocument = jest.fn(async () => ({ delivered: true, status: 200 }));
    attestationService = {
      signDocument: jest.fn(async (payload: any) => ({ payload, signature: 'SIG_K1_x', chain: ['a', 'b'] })),
      deliverDocument,
    };
    chain = { getSingleRow: jest.fn(async () => ({ announce: 'ПО «Заря»' })) };
  });

  it('активация кооператива в цепи ведёт к подписанному объявлению с наименованием из цепи', async () => {
    await build(true).handleCoopStatus(activation());

    const [url, envelope] = deliverDocument.mock.calls[0];
    expect(url).toBe('https://card.coop/v1/registrar/announce');
    expect(envelope.payload.type).toBe(CardcoopRegistryDocumentType.Admission);
    expect(envelope.payload.coopname).toBe('voskhod');
    expect(envelope.payload.subject).toBe('zarya');
    expect(envelope.payload.display_name).toBe('ПО «Заря»');
    expect(announcementRows.get('zarya')?.delivered).toBe(true);
  });

  it('оператор определяется именем кооператива: флаг в настройках не нужен', async () => {
    // Поле скрыто (решение владельца 02.09.2026); установка voskhod объявляет допуски сама.
    await build(false).handleCoopStatus(activation());

    expect(deliverDocument).toHaveBeenCalledTimes(1);
    expect(deliverDocument.mock.calls[0][1].payload.coopname).toBe('voskhod');
  });

  it('без флага оператора установка молчит — событие цепи видят все, объявляет один', async () => {
    mockCoopname = 'zarya';
    await build(false).handleCoopStatus(activation());

    expect(deliverDocument).not.toHaveBeenCalled();
  });

  it('блокировка и ожидание допуска не объявляют: приостановка — рычаг оператора АНО', async () => {
    const service = build(true);

    await service.handleCoopStatus(activation('zarya', 'blocked'));
    await service.handleCoopStatus(activation('zarya', 'pending'));

    expect(deliverDocument).not.toHaveBeenCalled();
  });

  it('недоставленное объявление повторяется на старте — кооператив не зависает между цепью и сетью', async () => {
    deliverDocument.mockResolvedValueOnce({ delivered: false, status: null, reason: 'сеть недоступна' });
    const service = build(true);

    await service.handleCoopStatus(activation());
    expect(announcementRows.get('zarya')?.delivered).toBe(false);

    await service.resendUndelivered();
    const aboutZarya = deliverDocument.mock.calls.filter(([, envelope]) => envelope.payload.subject === 'zarya');
    expect(aboutZarya).toHaveLength(2);
    expect(announcementRows.get('zarya')?.delivered).toBe(true);
  });

  it('на старте оператор объявляет допуск самому себе — событие активации у него не наступает', async () => {
    const service = build(true);

    await service.resendUndelivered();

    const [url, envelope] = deliverDocument.mock.calls[0];
    expect(url).toBe('https://card.coop/v1/registrar/announce');
    expect(envelope.payload.subject).toBe('voskhod');
    expect(announcementRows.get('voskhod')?.delivered).toBe(true);

    // Доставленный допуск второй раз не объявляется.
    await service.resendUndelivered();
    expect(deliverDocument).toHaveBeenCalledTimes(1);
  });

  it('без флага оператора самодопуск не объявляется', async () => {
    mockCoopname = 'zarya';
    await build(false).resendUndelivered();

    expect(deliverDocument).not.toHaveBeenCalled();
  });

  it('непрочитанная запись цепи не задерживает допуск: объявление уходит с именем аккаунта', async () => {
    chain.getSingleRow = jest.fn(async () => {
      throw new Error('цепь недоступна');
    });

    await build(true).handleCoopStatus(activation());

    expect(deliverDocument.mock.calls[0][1].payload.display_name).toBe('zarya');
  });
});

describe('Публикация ключа уведомлений сети в цепи', () => {
  // Один и тот же ключ в двух написаниях: цепь отдаёт EOS…, сеть — PUB_K1_….
  const NETWORK_KEY = 'PUB_K1_8AmBWMxDSrMfdqJTZRwXujKJca3DMUxGaNrrj5LFTZF6pHnSNo';
  const NETWORK_KEY_LEGACY = 'EOS8AmBWMxDSrMfdqJTZRwXujKJca3DMUxGaNrrj5LFTZF6sYVJRj';
  const OTHER_KEY = 'PUB_K1_7ND3npXaNAcQ4RuxVjWoFAEZnjCKj8fYkjybMuZgkJVqMgWszg';
  let transact: jest.Mock;
  let fetchMock: jest.Mock;

  const build = (opts: { onChain?: string | null; announce?: boolean; wif?: string | null } = {}) => {
    transact = jest.fn(async () => ({}));
    const chain = { initialize: jest.fn(), transact };
    const credential = { getPermissionKey: jest.fn(async () => opts.onChain ?? null) };
    const vault = { getWif: jest.fn(async () => (opts.wif === undefined ? 'WIF' : opts.wif)) };
    const extension = { config: { api_url: 'https://card.coop', announce_as_operator: opts.announce ?? false } };
    return new CardcoopWebhookKeyService(extension as any, credential as any, chain as any, vault as any, logger as any);
  };
  const network = (status = 200, body: unknown = { publicKey: NETWORK_KEY }) => {
    fetchMock = jest.fn(async () => ({ ok: status < 400, status, json: async () => body }));
    (globalThis as any).fetch = fetchMock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCoopname = 'voskhod';
  });

  it('ключ сети расходится с цепью — оператор публикует его разрешением cardcoop у ano', async () => {
    network();
    await expect(build({ onChain: OTHER_KEY }).ensurePublished('https://card.coop')).resolves.toEqual({ published: true });

    const action = transact.mock.calls[0][0];
    expect(action.name).toBe('updateauth');
    expect(action.authorization).toEqual([{ actor: 'ano', permission: 'active' }]);
    expect(action.data).toMatchObject({ account: 'ano', permission: 'cardcoop', parent: 'active' });
    expect(action.data.auth.keys).toEqual([{ key: NETWORK_KEY, weight: 1 }]);
    expect(fetchMock.mock.calls[0][0]).toBe('https://card.coop/v1/webhooks/public-key');
  });

  it('в цепи ещё нет разрешения — публикуется', async () => {
    network();
    await expect(build({ onChain: null }).ensurePublished('https://card.coop')).resolves.toEqual({ published: true });
    expect(transact).toHaveBeenCalledTimes(1);
  });

  it('тот же ключ в другом написании — ничего не переписывается', async () => {
    network();
    await expect(build({ onChain: NETWORK_KEY_LEGACY }).ensurePublished('https://card.coop')).resolves.toEqual({ published: false });
    expect(transact).not.toHaveBeenCalled();
  });

  it('не оператор — в цепь не ходит и ключ у сети не спрашивает', async () => {
    network();
    mockCoopname = 'zarya';
    await expect(build({ onChain: null }).ensurePublished('https://card.coop')).resolves.toEqual({ published: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('сеть не ответила — старт не падает, публикация ждёт следующего раза', async () => {
    network(503, {});
    await expect(build({ onChain: null }).ensurePublished('https://card.coop')).resolves.toEqual({ published: false });
    expect(transact).not.toHaveBeenCalled();
  });

  it('без ключа оператора публиковать нечем — предупреждение, не сбой', async () => {
    network();
    await expect(build({ onChain: null, wif: null }).ensurePublished('https://card.coop')).resolves.toEqual({ published: false });
    expect(transact).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});
