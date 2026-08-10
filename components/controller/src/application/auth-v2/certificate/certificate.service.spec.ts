import { createPrivateKey, generateKeyPairSync, type KeyObject } from 'node:crypto';
import { decodeProtectedHeader, jwtVerify } from 'jose';
import config from '~/config/config';
import { UserCertificateDomainService } from '~/domain/user/services/user-certificate-domain.service';
import { CertificateService } from './certificate.service';

const COOPNAME = config.coopname;
const COOP_KEY = 'PUB_K1_voskhodcertkey0000000000000000000000000000000000';

/**
 * Заверения в цепи. Подпись здесь не настоящая: сервис их не проверяет и не может —
 * он их только переносит в удостоверение. Проверка подписи живёт в `verifyOffline`,
 * и там для неё свои тесты с настоящими ключами.
 */
const ENDORSEMENT_ANO_COOP = 'header.anoEndorsesCoop.signature';
const ENDORSEMENT_OPERATOR_COOP = 'header.operatorEndorsesCoop.signature';
const ENDORSEMENT_ANO_OPERATOR = 'header.anoEndorsesOperator.signature';

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
  /** Заверение субъекта в цепи; `null` — не заверен. */
  endorsementOf?: (subject: string) => { issuer: string; credential: string } | null;
  verificationTypes?: any[];
  ttl?: number;
} = {}) {
  jest.spyOn(config.authV2, 'certKey', 'get').mockReturnValue(opts.certKey ?? pemPriv);
  const endorsementOf =
    opts.endorsementOf ??
    ((subject: string) => (subject === COOPNAME ? { issuer: 'ano', credential: ENDORSEMENT_ANO_COOP } : null));
  const blockchain = {
    getEndorsement: jest.fn(async (subject: string) => endorsementOf(subject)),
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
  const certKeyService = {
    getSigningKey: jest.fn(async () => {
      if (!(opts.certKey ?? pemPriv)) throw new Error('Ключ заверения не найден');
      return createPrivateKey(opts.certKey ?? pemPriv);
    }),
    publicKey: jest.fn(async () => COOP_KEY),
  };
  const service = new CertificateService(
    blockchain as any,
    user as any,
    account as any,
    certDomain as any,
    verification as any,
    certSettings as any,
    certKeyService as any,
  );
  return { service, blockchain, user, account, verification, certSettings, certKeyService };
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
    expect(payload.trust_chain).toEqual([ENDORSEMENT_ANO_COOP]);
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

  it('нет ключа заверения → удостоверение не выпускается', async () => {
    const { service } = makeService({ certKey: '' });
    await expect(service.issueForUsername('ant')).rejects.toThrow(/Ключ заверения/);
  });

  // Кооператив, которого никто не заверил, удостоверения всё равно выпускает: пайщик
  // не виноват, что кооператив выпал из цепочки. Проверку такое не пройдёт, и это
  // видно и пайщику, и проверяющему.
  it('кооператив не заверен → цепочка пустая, но удостоверение выпускается', async () => {
    const { service } = makeService({ endorsementOf: () => null });
    const { payload } = await jwtVerify(await service.issueForUsername('ant'), pubKey, { algorithms: ['ES256K'] });
    expect(payload.trust_chain).toEqual([]);
  });

  // Кооператив на чужой установке: его заверил оператор, оператора — корень.
  // Проверяющему цепочка нужна от корня, поэтому порядок обратен обходу.
  it('цепочка из двух звеньев отдаётся от корня, а не от кооператива', async () => {
    const { service } = makeService({
      endorsementOf: (subject) => {
        if (subject === COOPNAME) return { issuer: 'operator', credential: ENDORSEMENT_OPERATOR_COOP };
        if (subject === 'operator') return { issuer: 'ano', credential: ENDORSEMENT_ANO_OPERATOR };
        return null;
      },
    });
    const { payload } = await jwtVerify(await service.issueForUsername('ant'), pubKey, { algorithms: ['ES256K'] });
    expect(payload.trust_chain).toEqual([ENDORSEMENT_ANO_OPERATOR, ENDORSEMENT_OPERATOR_COOP]);
  });

  // Замкнутый круг в записях не должен вешать выпуск удостоверения.
  it('круг в заверениях обрывается пределом длины', async () => {
    const { service } = makeService({
      endorsementOf: (subject) => ({ issuer: subject === COOPNAME ? 'other' : COOPNAME, credential: 'x' }),
    });
    const { payload } = await jwtVerify(await service.issueForUsername('ant'), pubKey, { algorithms: ['ES256K'] });
    expect((payload.trust_chain as string[]).length).toBeLessThanOrEqual(5);
  });
});
