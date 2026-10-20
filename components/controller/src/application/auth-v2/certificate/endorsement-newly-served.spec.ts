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
  const blockchainPort = {
    getEndorsement: jest.fn(async (who: string) =>
      who === config.coopname && opts.operatorEndorsed ? { cert_key: 'OPKEY', expires_at: future } : null,
    ),
    getCertPublicKey: jest.fn(async (who: string) => (who === config.coopname ? 'OPKEY' : opts.coopKey)),
    getServedCooperatives: jest.fn(async () => [{ username: 'newcoop', status: 'active' }]),
    getInfo: jest.fn(async () => ({ chain_id: 'CHAIN' })),
    publishEndorsement: jest.fn(async () => undefined),
  };
  const certKeyService = { getSigningKeyFor: jest.fn(async () => privateKey) };
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
  return { service, blockchainPort, logger };
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
