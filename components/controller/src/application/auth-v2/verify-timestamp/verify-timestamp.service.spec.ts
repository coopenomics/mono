import { Bytes, PrivateKey, Signature } from '@wharfkit/antelope';
import { SignJWT } from 'jose';
import config from '~/config/config';
import { AuthV2Error, AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import { canonicalTimestampMessage, VerifyTimestampService } from './verify-timestamp.service';

const KEY = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3';
const ACCOUNT = 'ant';
const SECRET = 'test-binding-secret-padding-0000000000';
const PUB = PrivateKey.from(KEY).toPublic().toString();
const TS = '2026-06-10T12:00:00.000Z';

async function makeToken(sub = ACCOUNT, jti = 'jti-1'): Promise<string> {
  return new SignJWT({ stage_completed: 'password' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime('2m')
    .sign(new TextEncoder().encode(SECRET));
}

/** Подпись метки клиентским ключом — зеркало SDK signTimestamp (Story 2.4). */
function signCanonical(ts: string, jti: string, sub: string): string {
  const message = canonicalTimestampMessage({ ts, binding_token_jti: jti, sub });
  return PrivateKey.from(KEY).signMessage(new TextEncoder().encode(message)).toString();
}

function makeService(overrides: {
  consume?: jest.Mock;
  headBlockTime?: string;
  getInfoThrows?: boolean;
  hasActiveKey?: boolean;
  getAccountThrows?: boolean;
}) {
  const redis = {
    consumeSingleUse: overrides.consume ?? jest.fn().mockResolvedValue(ACCOUNT),
    publish: jest.fn(),
    subscribe: jest.fn(),
    setSingleUse: jest.fn(),
  };
  const blockchain = {
    getInfo: overrides.getInfoThrows
      ? jest.fn().mockRejectedValue(new Error('down'))
      : jest.fn().mockResolvedValue({ head_block_time: overrides.headBlockTime ?? TS }),
    getAccount: overrides.getAccountThrows
      ? jest.fn().mockRejectedValue(new Error('down'))
      : jest.fn().mockResolvedValue({ account_name: ACCOUNT }),
    hasActiveKey: jest.fn().mockReturnValue(overrides.hasActiveKey ?? true),
    // настоящий recover — зеркало BlockchainService.recoverPublicKey
    recoverPublicKey: jest.fn((message: string, signature: string) =>
      Signature.from(signature).recoverMessage(Bytes.fromString(message, 'utf8')).toString(),
    ),
  };
  const user = { getUserByUsername: jest.fn().mockResolvedValue({ id: 'user-uuid-1' }) };
  const tokens = {
    generateAuthTokens: jest.fn().mockResolvedValue({
      access: { token: 'access-jwt', expires: new Date() },
      refresh: { token: 'refresh-jwt', expires: new Date() },
    }),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const certificate = { issueForUsername: jest.fn().mockResolvedValue('cert-jws') };
  const service = new VerifyTimestampService(
    redis as any,
    blockchain as any,
    user as any,
    tokens as any,
    audit as any,
    certificate as any,
  );
  return { service, redis, blockchain, user, tokens, audit, certificate };
}

beforeEach(() => {
  jest.spyOn(config.authV2, 'sessionBindingSecret', 'get').mockReturnValue(SECRET);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('canonicalTimestampMessage: зеркало SDK (golden-вектор)', () => {
  it('фиксированный алфавитный порядок ключей, байт-идентично SDK-тесту', () => {
    expect(canonicalTimestampMessage({ ts: 't', binding_token_jti: 'j', sub: 's' })).toBe(
      '{"binding_token_jti":"j","sub":"s","ts":"t"}',
    );
  });
});

describe('VerifyTimestampService.verify', () => {
  it('happy path: верная подпись → токены + audit success', async () => {
    const { service, redis, tokens, audit } = makeService({ hasActiveKey: true });
    const token = await makeToken(ACCOUNT, 'jti-1');
    const signature = signCanonical(TS, 'jti-1', ACCOUNT);

    const res = await service.verify({ signature, timestamp: TS, bindingToken: token });

    expect(res).toEqual({ access_token: 'access-jwt', refresh_token: 'refresh-jwt', participant_certificate: 'cert-jws' });
    expect(redis.consumeSingleUse).toHaveBeenCalledWith('coopid:binding:jti-1');
    expect(tokens.generateAuthTokens).toHaveBeenCalledWith('user-uuid-1');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ result: 'success' }));
  });

  it('сбой выпуска сертификата best-effort: токены выдаются без participant_certificate', async () => {
    const { service, certificate } = makeService({ hasActiveKey: true });
    certificate.issueForUsername.mockRejectedValue(new Error('cert key missing'));
    const token = await makeToken(ACCOUNT, 'jti-nocert');
    const signature = signCanonical(TS, 'jti-nocert', ACCOUNT);

    const res = await service.verify({ signature, timestamp: TS, bindingToken: token });

    expect(res.access_token).toBe('access-jwt');
    expect(res.participant_certificate).toBeUndefined();
  });

  it('recover round-trip: восстановленный pubkey передан в hasActiveKey', async () => {
    const { service, blockchain } = makeService({ hasActiveKey: true });
    const token = await makeToken(ACCOUNT, 'jti-rt');
    const signature = signCanonical(TS, 'jti-rt', ACCOUNT);

    await service.verify({ signature, timestamp: TS, bindingToken: token });

    expect(blockchain.hasActiveKey).toHaveBeenCalledWith(expect.anything(), PUB);
  });

  it('повторный jti (нет в Redis) → SessionBindingReused + audit failure', async () => {
    const { service, audit } = makeService({ consume: jest.fn().mockResolvedValue(null) });
    const token = await makeToken(ACCOUNT, 'jti-used');
    const signature = signCanonical(TS, 'jti-used', ACCOUNT);

    await expect(service.verify({ signature, timestamp: TS, bindingToken: token })).rejects.toMatchObject({
      code: AuthV2ErrorCode.SessionBindingReused,
    });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ result: 'failure' }));
  });

  it('метка вне окна 60s → TimestampTooOld', async () => {
    const { service } = makeService({ headBlockTime: '2026-06-10T12:05:00.000Z' });
    const token = await makeToken(ACCOUNT, 'jti-stale');
    const signature = signCanonical(TS, 'jti-stale', ACCOUNT);

    await expect(service.verify({ signature, timestamp: TS, bindingToken: token })).rejects.toMatchObject({
      code: AuthV2ErrorCode.TimestampTooOld,
    });
  });

  it('ключ не на аккаунте → ChainVerificationFailed', async () => {
    const { service } = makeService({ hasActiveKey: false });
    const token = await makeToken(ACCOUNT, 'jti-badkey');
    const signature = signCanonical(TS, 'jti-badkey', ACCOUNT);

    await expect(service.verify({ signature, timestamp: TS, bindingToken: token })).rejects.toMatchObject({
      code: AuthV2ErrorCode.ChainVerificationFailed,
    });
  });

  it('битый binding_token → SessionBindingExpired', async () => {
    const { service } = makeService({});
    const signature = signCanonical(TS, 'jti-x', ACCOUNT);

    await expect(service.verify({ signature, timestamp: TS, bindingToken: 'not-a-jwt' })).rejects.toMatchObject({
      code: AuthV2ErrorCode.SessionBindingExpired,
    });
  });

  it('подпись чужого сообщения не восстанавливает ключ аккаунта (integrity)', async () => {
    const { service, blockchain } = makeService({ hasActiveKey: true });
    const token = await makeToken(ACCOUNT, 'jti-int');
    // подпись над ДРУГИМ ts, чем тот, что отправлен в verify
    const signature = signCanonical('2026-01-01T00:00:00.000Z', 'jti-int', ACCOUNT);

    blockchain.hasActiveKey.mockImplementation((_acc: unknown, key: string) => key === PUB);

    await expect(service.verify({ signature, timestamp: TS, bindingToken: token })).rejects.toBeInstanceOf(AuthV2Error);
  });

  it('COOPOS недоступен (getInfo бросает) → CooposDegraded', async () => {
    const { service } = makeService({ getInfoThrows: true });
    const token = await makeToken(ACCOUNT, 'jti-down');
    const signature = signCanonical(TS, 'jti-down', ACCOUNT);

    await expect(service.verify({ signature, timestamp: TS, bindingToken: token })).rejects.toMatchObject({
      code: AuthV2ErrorCode.CooposDegraded,
    });
  });
});
