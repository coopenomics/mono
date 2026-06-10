import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import { decodeProtectedHeader, jwtVerify } from 'jose';
import config from '~/config/config';
import { AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import { UserCertificateDomainService } from '~/domain/user/services/user-certificate-domain.service';
import { CertificateService } from './certificate.service';

const COOPNAME = config.coopname;
const VOSTOK_KEY = 'PUB_K1_vostokcertkey00000000000000000000000000000000000';
const CHAIN: Record<string, string> = {
  ano: 'PUB_K1_anocertkey0000000000000000000000000000000000000000',
  voskhod: 'PUB_K1_voskhodcertkey0000000000000000000000000000000000',
  vostok: VOSTOK_KEY,
};

let pubKey: KeyObject;
let pemPriv: string;

beforeAll(() => {
  const kp = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
  pemPriv = kp.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
  pubKey = kp.publicKey;
});

function makeService(opts: {
  certKey?: string;
  identification?: any;
  certKeyFor?: (acc: string) => string | null;
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
  const service = new CertificateService(blockchain as any, user as any, account as any, certDomain as any);
  return { service, blockchain, user, account };
}

afterEach(() => jest.restoreAllMocks());

describe('CertificateService.issueForUsername', () => {
  it('выпускает compact JWS ES256K, верифицируемый ключом подписи, со всеми обязательными claims', async () => {
    const { service } = makeService();
    const jws = await service.issueForUsername('ant');

    expect(jws.split('.')).toHaveLength(3);

    const header = decodeProtectedHeader(jws);
    expect(header.alg).toBe('ES256K');
    expect(header.kid).toBe(VOSTOK_KEY);

    const { payload } = await jwtVerify(jws, pubKey, { algorithms: ['ES256K'] });
    expect(payload.iss).toBe(`https://${COOPNAME}.coop`);
    expect(payload.sub).toBe('uuid-participant-1');
    expect(payload.coopname).toBe(COOPNAME);
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeGreaterThan(payload.iat as number);
    expect(payload.claim_schema_version).toBe('1');
    expect(payload.verification_types).toEqual(['coop_baseline']);
    expect(payload.coop_chain).toEqual([
      { account: 'ano', public_key: CHAIN.ano },
      { account: 'voskhod', public_key: CHAIN.voskhod },
      { account: 'vostok', public_key: VOSTOK_KEY },
    ]);
    expect(payload.identification).toMatchObject({ type: 'individual', username: 'ant', first_name: 'Иван' });
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

  it('разрыв cert-цепи (нет ключа звена) → ChainVerificationFailed', async () => {
    const { service } = makeService({ certKeyFor: (acc) => (acc === 'voskhod' ? null : CHAIN[acc]) });
    await expect(service.issueForUsername('ant')).rejects.toMatchObject({
      code: AuthV2ErrorCode.ChainVerificationFailed,
    });
  });
});
