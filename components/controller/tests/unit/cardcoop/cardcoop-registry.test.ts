import { CardcoopConnectService } from '~/extensions/cardcoop/registry/connect.service';
import { CardcoopOperatorAnnounceService } from '~/extensions/cardcoop/registry/operator-announce.service';
import { CardcoopRegistryDocumentType } from '~/extensions/cardcoop/registry/registry.types';

jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({
    coopname: 'voskhod',
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

  const build = (settings: unknown = clientSettings) => {
    const integrations = { get: jest.fn(() => settings) };
    return new CardcoopConnectService(
      stateRepo() as any,
      attestationService,
      integrations as any,
      logger as any
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

  it('без реквизитов клиента подключение честно пропускается, а не шлёт пустой секрет', async () => {
    await build(null).connectIfChanged('https://card.coop');

    expect(deliverDocument).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('неизменившийся состав повторно не отправляется — рестарт не стучится в сеть', async () => {
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

  it('без флага оператора установка молчит — событие цепи видят все, объявляет один', async () => {
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
    expect(deliverDocument).toHaveBeenCalledTimes(2);
    expect(announcementRows.get('zarya')?.delivered).toBe(true);
  });

  it('непрочитанная запись цепи не задерживает допуск: объявление уходит с именем аккаунта', async () => {
    chain.getSingleRow = jest.fn(async () => {
      throw new Error('цепь недоступна');
    });

    await build(true).handleCoopStatus(activation());

    expect(deliverDocument.mock.calls[0][1].payload.display_name).toBe('zarya');
  });
});
