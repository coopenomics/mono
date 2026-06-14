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
  manifest?: { account: string; active_keys: string[]; cached_at: string } | null;
  /** Полный get_info (для проверки финализации, Story 9.6). */
  info?: Record<string, unknown>;
  /** last_updated active-permission (Story 9.6). */
  accountLastUpdated?: string;
  /** Результат кворумного чтения ключей (Story 9.7). */
  quorum?: { agreed: boolean; keys: string[]; samples: Array<{ url: string; keys: string[] }> };
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
      : jest.fn().mockResolvedValue(overrides.info ?? { head_block_time: overrides.headBlockTime ?? TS }),
    getAccount: overrides.getAccountThrows
      ? jest.fn().mockRejectedValue(new Error('down'))
      : jest.fn().mockResolvedValue({
          account_name: ACCOUNT,
          permissions: [
            {
              perm_name: 'active',
              required_auth: { keys: [{ key: PUB, weight: 1 }] },
              ...(overrides.accountLastUpdated ? { last_updated: overrides.accountLastUpdated } : {}),
            },
          ],
        }),
    hasActiveKey: jest.fn().mockReturnValue(overrides.hasActiveKey ?? true),
    // настоящий recover — зеркало BlockchainService.recoverPublicKey
    recoverPublicKey: jest.fn((message: string, signature: string) =>
      Signature.from(signature).recoverMessage(Bytes.fromString(message, 'utf8')).toString(),
    ),
    readActiveKeysQuorum: jest
      .fn()
      .mockResolvedValue(overrides.quorum ?? { agreed: true, keys: [PUB], samples: [{ url: 'rpc-1', keys: [PUB] }] }),
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
  const deviceTracking = { recordLogin: jest.fn().mockResolvedValue({ isNewDevice: false, fingerprint: 'fp' }) };
  const sessionMetadata = { record: jest.fn().mockResolvedValue(undefined), get: jest.fn(), delete: jest.fn() };
  const chainManifests = {
    get: jest.fn().mockResolvedValue(overrides.manifest ?? null),
    put: jest.fn().mockResolvedValue(undefined),
  };
  const service = new VerifyTimestampService(
    redis as any,
    blockchain as any,
    user as any,
    tokens as any,
    audit as any,
    certificate as any,
    deviceTracking as any,
    sessionMetadata as any,
    chainManifests as any,
  );
  return { service, redis, blockchain, user, tokens, audit, certificate, deviceTracking, sessionMetadata, chainManifests };
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

  it('успех → device tracking вызван с subjectId/ip/UA (Story 3.8)', async () => {
    const { service, deviceTracking } = makeService({ hasActiveKey: true });
    const token = await makeToken(ACCOUNT, 'jti-dev');
    const signature = signCanonical(TS, 'jti-dev', ACCOUNT);

    await service.verify({
      signature,
      timestamp: TS,
      bindingToken: token,
      ip: '1.2.3.4',
      userAgent: 'UA/1',
      acceptLanguage: 'ru',
    });

    expect(deviceTracking.recordLogin).toHaveBeenCalledWith({
      subjectId: 'user-uuid-1',
      username: ACCOUNT,
      ip: '1.2.3.4',
      userAgent: 'UA/1',
      acceptLanguage: 'ru',
    });
  });

  it('успех → метаданные сессии записаны на refresh-токен с ip/UA (Story 3.7)', async () => {
    const { service, sessionMetadata } = makeService({ hasActiveKey: true });
    const token = await makeToken(ACCOUNT, 'jti-sess');
    const signature = signCanonical(TS, 'jti-sess', ACCOUNT);

    await service.verify({ signature, timestamp: TS, bindingToken: token, ip: '9.9.9.9', userAgent: 'UA/2' });

    expect(sessionMetadata.record).toHaveBeenCalledWith('refresh-jwt', expect.objectContaining({ ip: '9.9.9.9', device: 'UA/2' }));
  });

  it('сбой записи метаданных сессии best-effort: вход завершается токенами (Story 3.7)', async () => {
    const { service, sessionMetadata } = makeService({ hasActiveKey: true });
    sessionMetadata.record.mockRejectedValue(new Error('redis down'));
    const token = await makeToken(ACCOUNT, 'jti-sessfail');
    const signature = signCanonical(TS, 'jti-sessfail', ACCOUNT);

    const res = await service.verify({ signature, timestamp: TS, bindingToken: token });

    expect(res.access_token).toBe('access-jwt');
  });

  it('сбой device tracking best-effort: вход всё равно завершается токенами', async () => {
    const { service, deviceTracking } = makeService({ hasActiveKey: true });
    deviceTracking.recordLogin.mockRejectedValue(new Error('redis down'));
    const token = await makeToken(ACCOUNT, 'jti-devfail');
    const signature = signCanonical(TS, 'jti-devfail', ACCOUNT);

    const res = await service.verify({ signature, timestamp: TS, bindingToken: token });

    expect(res.access_token).toBe('access-jwt');
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

  it('живой вход → снимок активных ключей кладётся в chain_manifests_cache (Story 4.5)', async () => {
    const { service, chainManifests } = makeService({ hasActiveKey: true });
    const token = await makeToken(ACCOUNT, 'jti-cache');
    const signature = signCanonical(TS, 'jti-cache', ACCOUNT);

    await service.verify({ signature, timestamp: TS, bindingToken: token });

    expect(chainManifests.put).toHaveBeenCalledWith(ACCOUNT, [PUB]);
  });

  it('getAccount недоступен, ключ есть в кэше → degraded-вход + audit degraded (Story 4.5)', async () => {
    const { service, audit, blockchain } = makeService({
      getAccountThrows: true,
      manifest: { account: ACCOUNT, active_keys: [PUB], cached_at: '2026-06-11T00:00:00.000Z' },
    });
    // сверка ключа против псевдо-аккаунта из кэша даёт совпадение только для PUB.
    blockchain.hasActiveKey.mockImplementation((_acc: unknown, key: string) => key === PUB);
    const token = await makeToken(ACCOUNT, 'jti-degraded');
    const signature = signCanonical(TS, 'jti-degraded', ACCOUNT);

    const res = await service.verify({ signature, timestamp: TS, bindingToken: token });

    expect(res.access_token).toBe('access-jwt');
    expect(res.degraded).toBe(true);
    expect(res.degraded_reason).toBe('rpc_unavailable');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'coopid.auth.degraded', result: 'degraded', context: { reason: 'rpc_unavailable' } }),
    );
  });

  it('getAccount недоступен, кэша нет → CooposDegraded (fail-closed, Story 4.5)', async () => {
    const { service } = makeService({ getAccountThrows: true, manifest: null });
    const token = await makeToken(ACCOUNT, 'jti-nocache');
    const signature = signCanonical(TS, 'jti-nocache', ACCOUNT);

    await expect(service.verify({ signature, timestamp: TS, bindingToken: token })).rejects.toMatchObject({
      code: AuthV2ErrorCode.CooposDegraded,
    });
  });

  it('getAccount недоступен, кэш есть, но ключ не совпал → CooposDegraded (Story 4.5)', async () => {
    const { service, blockchain } = makeService({
      getAccountThrows: true,
      manifest: { account: ACCOUNT, active_keys: ['PUB_K1_otherkey'], cached_at: '2026-06-11T00:00:00.000Z' },
    });
    blockchain.hasActiveKey.mockReturnValue(false); // кэшированный ключ не совпадает
    const token = await makeToken(ACCOUNT, 'jti-cachemiss');
    const signature = signCanonical(TS, 'jti-cachemiss', ACCOUNT);

    await expect(service.verify({ signature, timestamp: TS, bindingToken: token })).rejects.toMatchObject({
      code: AuthV2ErrorCode.CooposDegraded,
    });
  });

  // LIB отстаёт на 100 блоков → граница финализации ≈ TS − 50с; last_updated=TS реверсивен.
  const INFO_LIB = { head_block_num: 1000, head_block_time: TS, last_irreversible_block_num: 900 };

  it('ключ не финализирован (last_updated новее LIB), кэш совпал → degraded key_not_finalized (Story 9.6)', async () => {
    const { service, audit, chainManifests } = makeService({
      info: INFO_LIB,
      accountLastUpdated: TS, // смена ключа в реверсивном окне
      manifest: { account: ACCOUNT, active_keys: [PUB], cached_at: '2026-06-11T00:00:00.000Z' },
    });
    const token = await makeToken(ACCOUNT, 'jti-notfinal');
    const signature = signCanonical(TS, 'jti-notfinal', ACCOUNT);

    const res = await service.verify({ signature, timestamp: TS, bindingToken: token });

    expect(res.access_token).toBe('access-jwt');
    expect(res.degraded).toBe(true);
    expect(res.degraded_reason).toBe('key_not_finalized');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'coopid.auth.degraded', result: 'degraded', context: { reason: 'key_not_finalized' } }),
    );
    // не-финализированный head-снимок в кэш не пишем
    expect(chainManifests.put).not.toHaveBeenCalled();
  });

  it('ключ не финализирован и кэша нет → CooposDegraded (fail-closed, Story 9.6)', async () => {
    const { service } = makeService({ info: INFO_LIB, accountLastUpdated: TS, manifest: null });
    const token = await makeToken(ACCOUNT, 'jti-notfinal-nocache');
    const signature = signCanonical(TS, 'jti-notfinal-nocache', ACCOUNT);

    await expect(service.verify({ signature, timestamp: TS, bindingToken: token })).rejects.toMatchObject({
      code: AuthV2ErrorCode.CooposDegraded,
    });
  });

  it('финализированный ключ (last_updated старше LIB) → нормальный вход + обновление кэша (Story 9.6)', async () => {
    const { service, chainManifests } = makeService({
      info: INFO_LIB,
      accountLastUpdated: '2026-06-10T11:00:00.000Z', // задолго до LIB
    });
    const token = await makeToken(ACCOUNT, 'jti-final');
    const signature = signCanonical(TS, 'jti-final', ACCOUNT);

    const res = await service.verify({ signature, timestamp: TS, bindingToken: token });

    expect(res.degraded).toBeUndefined();
    expect(chainManifests.put).toHaveBeenCalledWith(ACCOUNT, [PUB]);
  });

  it('RPC-ответы расходятся при обновлении кэша → инцидент divergent_rpc, кэш не трогаем, вход выдан (Story 9.7)', async () => {
    const { service, audit, chainManifests } = makeService({
      quorum: {
        agreed: false,
        keys: [PUB],
        samples: [
          { url: 'rpc-1', keys: [PUB] },
          { url: 'rpc-2', keys: ['PUB_K1_fake'] },
        ],
      },
    });
    const token = await makeToken(ACCOUNT, 'jti-divergent');
    const signature = signCanonical(TS, 'jti-divergent', ACCOUNT);

    const res = await service.verify({ signature, timestamp: TS, bindingToken: token });

    expect(res.access_token).toBe('access-jwt'); // вход уже проверен против живого узла — не валим
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'coopid.chain.divergent_rpc', result: 'failure' }),
    );
    expect(chainManifests.put).not.toHaveBeenCalled();
  });
});
