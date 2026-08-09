import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import { decodeProtectedHeader, jwtVerify } from 'jose';
import config from '~/config/config';
import { AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import { UserCertificateDomainService } from '~/domain/user/services/user-certificate-domain.service';
import { CertificateService } from './certificate.service';

const COOPNAME = config.coopname;
// Цепь заверения: якорь (АНО) → сам кооператив. Имя кооператива берём из настроек,
// а не из списка: раньше оно было вшито в код и на другом кооперативе цепь указывала
// бы на чужой. Подписывает последнее звено — кооператив, его ключ и стоит в `kid`.
const COOP_KEY = 'PUB_K1_voskhodcertkey0000000000000000000000000000000000';
const CHAIN: Record<string, string> = {
  ano: 'PUB_K1_anocertkey0000000000000000000000000000000000000000',
  [COOPNAME]: COOP_KEY,
};

let pubKey: KeyObject;
let pemPriv: string;

beforeAll(() => {
  const kp = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
  pemPriv = kp.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
  pubKey = kp.publicKey;
});

const BASELINE_ENTRY = {
  type: 'coop_baseline',
  status: 'verified',
  source: 'cooperative_decision',
  verified_at: '2026-01-01T00:00:00.000Z',
};

function makeService(opts: {
  certKey?: string;
  identification?: any;
  certKeyFor?: (acc: string) => string | null;
  verificationTypes?: any[];
  ttl?: number;
} = {}) {
  jest.spyOn(config.authV2, 'certKey', 'get').mockReturnValue(opts.certKey ?? pemPriv);
  const blockchain = {
    getCertPublicKey: jest.fn(async (acc: string) => (opts.certKeyFor ? opts.certKeyFor(acc) : CHAIN[acc])),
  };
  const user = { getUserByUsername: jest.fn().mockResolvedValue({ id: 'uuid-participant-1', username: 'ant' }) };
  const account = {
    getPrivateAccount: jest.fn().mockResolvedValue(
      'identification' in opts
        ? opts.identification
        : { username: 'ant', first_name: 'Иван', last_name: 'Петров', middle_name: 'Сергеевич' },
    ),
  };
  const certDomain = new UserCertificateDomainService();
  const verification = {
    resolveForUsername: jest.fn().mockResolvedValue(opts.verificationTypes ?? [BASELINE_ENTRY]),
  };
  const certSettings = {
    getCertTtlSeconds: jest.fn().mockResolvedValue(opts.ttl ?? 3600),
  };
  const service = new CertificateService(blockchain as any, user as any, account as any, certDomain as any, verification as any, certSettings as any);
  return { service, blockchain, user, account, verification, certSettings };
}

afterEach(() => jest.restoreAllMocks());

describe('CertificateService.issueForUsername', () => {
  it('выпускает compact JWS ES256K, верифицируемый ключом подписи, со всеми обязательными claims', async () => {
    const { service } = makeService();
    const jws = await service.issueForUsername('ant');

    expect(jws.split('.')).toHaveLength(3);

    const header = decodeProtectedHeader(jws);
    expect(header.alg).toBe('ES256K');
    expect(header.kid).toBe(COOP_KEY);

    const { payload } = await jwtVerify(jws, pubKey, { algorithms: ['ES256K'] });
    expect(payload.iss).toBe(`https://${COOPNAME}.coop`);
    expect(payload.sub).toBe('uuid-participant-1');
    expect(payload.jti).toMatch(/^[0-9a-f-]{36}$/); // серийный номер (UUID)
    expect(payload.coopname).toBe(COOPNAME);
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeGreaterThan(payload.iat as number);
    expect(payload.claim_schema_version).toBe('1');
    // Структурная форма claim (Story 4.3): {type, verified_at, source} без status.
    expect(payload.verification_types).toEqual([
      { type: 'coop_baseline', verified_at: '2026-01-01T00:00:00.000Z', source: 'cooperative_decision' },
    ]);
    expect(payload.coop_chain).toEqual([
      { account: 'ano', public_key: CHAIN.ano },
      { account: COOPNAME, public_key: COOP_KEY },
    ]);
    expect(payload.identification).toMatchObject({ type: 'individual', username: 'ant', first_name: 'Иван' });
  });

  it('exp = iat + cert_ttl_seconds (дефолт 3600 = 1ч, Story 4.6)', async () => {
    const { service } = makeService();
    const { payload } = await jwtVerify(await service.issueForUsername('ant'), pubKey, { algorithms: ['ES256K'] });
    expect((payload.exp as number) - (payload.iat as number)).toBe(3600);
  });

  it('exp следует конфигурируемому TTL кооператива (Story 4.6)', async () => {
    const { service, certSettings } = makeService({ ttl: 1800 });
    const { payload } = await jwtVerify(await service.issueForUsername('ant'), pubKey, { algorithms: ['ES256K'] });
    expect(certSettings.getCertTtlSeconds).toHaveBeenCalled();
    expect((payload.exp as number) - (payload.iat as number)).toBe(1800);
  });

  it('retention-claims: erase_on_exclusion + дедлайн iat + 30 дней (Story 4.8)', async () => {
    const { service } = makeService();
    const { payload } = await jwtVerify(await service.issueForUsername('ant'), pubKey, { algorithms: ['ES256K'] });
    expect(payload.data_retention_contract).toBe('erase_on_exclusion');
    expect(payload.retention_deadline_ts).toBe((payload.iat as number) + 30 * 24 * 60 * 60);
  });

  it('verification_types берётся из резолвера: не-член → claim пустой (Story 4.1)', async () => {
    const { service, verification } = makeService({ verificationTypes: [] });
    const jws = await service.issueForUsername('ant');
    const { payload } = await jwtVerify(jws, pubKey, { algorithms: ['ES256K'] });
    expect(verification.resolveForUsername).toHaveBeenCalledWith('ant', COOPNAME);
    expect(payload.verification_types).toEqual([]);
  });

  it('размер JWS ≤ 5 КБ (Vision/MIFARE)', async () => {
    const { service } = makeService();
    const jws = await service.issueForUsername('ant');
    expect(Buffer.byteLength(jws, 'utf8')).toBeLessThanOrEqual(5 * 1024);
  });

  it('identification = null при отсутствии приватных данных аккаунта', async () => {
    const { service } = makeService({ identification: null });
    const jws = await service.issueForUsername('ant');
    const { payload } = await jwtVerify(jws, pubKey, { algorithms: ['ES256K'] });
    expect(payload.identification).toBeNull();
  });

  it('маппит organization identification из доменных данных', async () => {
    const org = {
      username: 'cooporg',
      short_name: 'ООО Ромашка',
      full_name: 'Общество с ограниченной ответственностью «Ромашка»',
      details: { inn: '7700000000', ogrn: '1027700000000' },
      represented_by: { first_name: 'Анна', last_name: 'Иванова', middle_name: 'П', position: 'Директор' },
    };
    const { service } = makeService({ identification: org });
    const { payload } = await jwtVerify(await service.issueForUsername('cooporg'), pubKey, { algorithms: ['ES256K'] });
    expect(payload.identification).toMatchObject({ type: 'organization', inn: '7700000000', ogrn: '1027700000000' });
  });

  it('нет cert-ключа в конфиге → ошибка конфигурации', async () => {
    const { service } = makeService({ certKey: '' });
    await expect(service.issueForUsername('ant')).rejects.toThrow(/COOP_CERT_KEY/);
  });

  it('у кооператива нет права заверения → ChainVerificationFailed', async () => {
    const { service } = makeService({ certKeyFor: (acc) => (acc === COOPNAME ? null : CHAIN[acc]) });
    await expect(service.issueForUsername('ant')).rejects.toMatchObject({
      code: AuthV2ErrorCode.ChainVerificationFailed,
    });
  });

  it('якоря ещё нет в цепи → выпускаем с цепью из одного звена, а не отказываем', async () => {
    const { service } = makeService({ certKeyFor: (acc) => (acc === 'ano' ? null : CHAIN[acc]) });
    const { payload } = await jwtVerify(await service.issueForUsername('ant'), pubKey, { algorithms: ['ES256K'] });
    expect(payload.coop_chain).toEqual([{ account: COOPNAME, public_key: COOP_KEY }]);
  });
});
