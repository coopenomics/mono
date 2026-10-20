import { generateKeyPairSync } from 'node:crypto';
import config from '~/config/config';
import { EndorsementService } from './endorsement.service';

/**
 * Тестнет, 20.10.2026: оператор заверял обслуживаемые кооперативы только ночным
 * проходом, и новый кооператив до 01:00 оставался с «Удостоверение не утверждено».
 * Частый проход заверяет его, как только ключ опубликован, и молчит на узлах без
 * своего заверения — предупреждает об этом только ночной.
 */
function makeService(opts: { operatorEndorsed: boolean; coopKey: string | null }) {
  const future = new Date(Date.now() + 365 * 86400 * 1000).toISOString().slice(0, 19);
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
  const cooperatives: Record<string, any> = {
    newcoop: { username: 'newcoop', parent_username: config.coopname, status: 'active', announce: '' },
    stranger: { username: 'stranger', parent_username: 'otherop', status: 'active', announce: '' },
  };
  const blockchainPort = {
    getCooperative: jest.fn(async (who: string) => cooperatives[who] ?? null),
    assignOperator: jest.fn(async () => undefined),
    getEndorsement: jest.fn(async (who: string) =>
      who === config.coopname && opts.operatorEndorsed ? { cert_key: 'OPKEY', expires_at: future } : null,
    ),
    getCertPublicKey: jest.fn(async (who: string) => (who === config.coopname ? 'OPKEY' : opts.coopKey)),
    getServedCooperatives: jest.fn(async () => [{ username: 'newcoop', status: 'active' }]),
    getInfo: jest.fn(async () => ({ chain_id: 'CHAIN' })),
    publishEndorsement: jest.fn(async () => undefined),
  };
  const certKeyService = { getSigningKeyFor: jest.fn(async () => privateKey), publishSafely: jest.fn(async () => undefined) };
  const crypto = { normalizePublicKey: jest.fn((k: string) => k) };
  const logger = { log: jest.fn(), warn: jest.fn() };
  const service = new EndorsementService(
    blockchainPort as any,
    certKeyService as any,
    crypto as any,
    {} as any,
    {} as any,
    logger as any,
  );
  return { service, blockchainPort, logger, certKeyService, cooperatives };
}

describe('EndorsementService — заверение новых кооперативов', () => {
  it('частый проход заверяет кооператив, опубликовавший ключ, не дожидаясь ночи', async () => {
    const { service, blockchainPort } = makeService({ operatorEndorsed: true, coopKey: 'COOPKEY' });

    await expect(service.endorseNewlyServed()).resolves.toEqual({ renewed: ['newcoop'] });
    expect(blockchainPort.publishEndorsement).toHaveBeenCalledTimes(1);
    expect((blockchainPort.publishEndorsement.mock.calls[0] as any[])[0]).toMatchObject({
      issuer: config.coopname,
      subject: 'newcoop',
      cert_key: 'COOPKEY',
    });
  });

  it('ключ кооператива ещё не опубликован — заверять нечего, в цепь не пишем', async () => {
    const { service, blockchainPort } = makeService({ operatorEndorsed: true, coopKey: null });

    await expect(service.endorseNewlyServed()).resolves.toEqual({ renewed: [] });
    expect(blockchainPort.publishEndorsement).not.toHaveBeenCalled();
  });

  it('у узла нет своего заверения — частый проход молчит, ночной предупреждает', async () => {
    const quiet = makeService({ operatorEndorsed: false, coopKey: 'COOPKEY' });
    await quiet.service.endorseNewlyServed();
    expect(quiet.logger.warn).not.toHaveBeenCalled();
    expect(quiet.blockchainPort.publishEndorsement).not.toHaveBeenCalled();

    const nightly = makeService({ operatorEndorsed: false, coopKey: 'COOPKEY' });
    await nightly.service.renewServedEndorsements();
    expect(nightly.logger.warn).toHaveBeenCalledTimes(1);
  });
});

describe('EndorsementService — заверение по запросу кооператива', () => {
  it('оператор заверяет свой действующий кооператив с опубликованным ключом сразу по запросу', async () => {
    const { service, blockchainPort } = makeService({ operatorEndorsed: true, coopKey: 'COOPKEY' });

    await expect(service.endorseOnRequest('newcoop')).resolves.toEqual({ endorsed: true });
    expect(blockchainPort.publishEndorsement).toHaveBeenCalledTimes(1);
  });

  it('кооператив другого оператора по запросу не заверяется', async () => {
    const { service, blockchainPort } = makeService({ operatorEndorsed: true, coopKey: 'COOPKEY' });

    await expect(service.endorseOnRequest('stranger')).resolves.toEqual({ endorsed: false });
    expect(blockchainPort.publishEndorsement).not.toHaveBeenCalled();
  });

  it('узел после ввода ключа публикует право заверения и спрашивает своего оператора по адресу из реестра', async () => {
    const { service, certKeyService, cooperatives } = makeService({ operatorEndorsed: true, coopKey: 'COOPKEY' });
    cooperatives[config.coopname] = { username: config.coopname, parent_username: 'operatorx', announce: '' };
    cooperatives.operatorx = { username: 'operatorx', parent_username: '', announce: 'https://hub.example.org/' };
    const fetchMock = jest.fn(async () => ({ status: 200, json: async () => ({ data: { requestCooperativeEndorsement: true } }) }));
    const original = global.fetch;
    global.fetch = fetchMock as any;
    try {
      await service.onCoopKeyInstalled();
    } finally {
      global.fetch = original;
    }
    expect(certKeyService.publishSafely).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    expect(url).toBe('https://hub.example.org/backend/v1/graphql');
    expect(JSON.parse(init.body).variables).toEqual({ d: { coopname: config.coopname } });
  });
});

// Тестнет, 20.10.2026: оператора проставлял только migrate при выкатке контрактов,
// и кооператив, подключённый между выкатками, не попадал в обход заверений.
describe('EndorsementService — активация кооператива на узле провайдера', () => {
  const activated = (coopname: string) => ({ data: { coopname, administrator: 'voskhod', status: 'active' } });
  let original: string;
  beforeEach(() => {
    original = config.coopname;
    (config as any).coopname = 'voskhod';
  });
  afterEach(() => {
    (config as any).coopname = original;
  });

  it('у кооператива нет оператора — провайдер назначает себя и пробует заверить', async () => {
    const { service, blockchainPort, cooperatives } = makeService({ operatorEndorsed: true, coopKey: null });
    cooperatives.fresh = { username: 'fresh', parent_username: '', status: 'active' };

    await service.onCoopActivated(activated('fresh'));

    expect(blockchainPort.assignOperator).toHaveBeenCalledWith('fresh', 'voskhod');
    expect(blockchainPort.getCooperative).toHaveBeenCalledWith('fresh');
  });

  it('оператор уже назначен — не переназначаем', async () => {
    const { service, blockchainPort, cooperatives } = makeService({ operatorEndorsed: true, coopKey: null });
    cooperatives.fresh = { username: 'fresh', parent_username: 'otherop', status: 'active' };

    await service.onCoopActivated(activated('fresh'));

    expect(blockchainPort.assignOperator).not.toHaveBeenCalled();
  });

  it('узел не провайдер платформы — событие пропускается', async () => {
    (config as any).coopname = 'partnercoop';
    const { service, blockchainPort } = makeService({ operatorEndorsed: true, coopKey: null });

    await service.onCoopActivated(activated('fresh'));

    expect(blockchainPort.getCooperative).not.toHaveBeenCalled();
    expect(blockchainPort.assignOperator).not.toHaveBeenCalled();
  });

  it('блокировка кооператива оператора не назначает', async () => {
    const { service, blockchainPort } = makeService({ operatorEndorsed: true, coopKey: null });

    await service.onCoopActivated({ data: { coopname: 'fresh', status: 'blocked' } });

    expect(blockchainPort.assignOperator).not.toHaveBeenCalled();
  });
});
