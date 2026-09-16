import { createPublicKey } from 'node:crypto';
import { PrivateKey, PublicKey, KeyType } from '@wharfkit/antelope';
import canonicalize from 'canonicalize';
import { Signature } from '@wharfkit/antelope';
import { InnerAccountType } from '@coopenomics/innercoop';
import { CardcoopAttestationService } from '~/extensions/cardcoop/attestation/attestation.service';
import { CardcoopDisclosureService } from '~/extensions/cardcoop/disclosure/disclosure.service';
import { CardcoopGrantRejected, CardcoopGrantVerifier } from '~/extensions/cardcoop/disclosure/grant-verifier.service';
import { CardcoopDisclosureType } from '~/extensions/cardcoop/disclosure/disclosure.types';
import { CardcoopDisclosureController } from '~/extensions/cardcoop/application/disclosure.controller';
import { ForbiddenException } from '@nestjs/common';

jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({ coopname: 'voskhod' }),
}));

/**
 * Выдача анкеты по гранту card.coop (story 7.8, FR-F3).
 *
 * Здесь проверяется не «работает ли выдача», а то, чем она обязана НЕ быть: доступом к анкете
 * по предъявлению чего угодно. Грант — разрешение на один обмен, выданное нам, на сейчас и по
 * согласию конкретного человека; каждое из этих четырёх слов проверяется отдельным случаем.
 */

/** Ключ, которым card.coop подписывает гранты. */
const networkKey = PrivateKey.generate(KeyType.K1);

/** Ключ заверения нашего кооператива. */
const coopKey = PrivateKey.generate(KeyType.K1);

const API_URL = 'https://card.coop';
const CARD_ID = '11111111-1111-4111-8111-111111111111';

/** Префикс DER для SPKI-обёртки открытого ключа secp256k1 — до самой точки кривой. */
const SPKI_PREFIX = Buffer.from('3036301006072a8648ce3d020106052b8104000a032200', 'hex');

/** Открытый ключ контура в форме JWK — так его публикует card.coop. */
const jwkOf = (key: PrivateKey) => {
  const compressed = Buffer.from(PublicKey.from(key.toPublic()).data.array);
  const jwk = createPublicKey({ key: Buffer.concat([SPKI_PREFIX, compressed]), format: 'der', type: 'spki' }).export({
    format: 'jwk',
  });
  return { kty: 'EC', crv: 'secp256k1', x: jwk.x, y: jwk.y, alg: 'ES256K', use: 'sig', kid: 'key-1' };
};

const base64url = (value: object) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');

/** Выпускает грант так же, как это делает card.coop. */
const issueGrant = (
  overrides: Record<string, unknown> = {},
  options: { key?: PrivateKey; typ?: string; kid?: string } = {}
) => {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: 'card.coop',
    sub: CARD_ID,
    aud: 'zakat',
    from: 'voskhod',
    jti: 'grant-1',
    iat: now,
    exp: now + 300,
    ...overrides,
  };

  const head = base64url({ kid: options.kid ?? 'key-1', alg: 'ES256K', typ: options.typ ?? 'cardcoop-grant+jws' });
  const body = base64url(claims);
  const signingInput = Buffer.from(`${head}.${body}`, 'utf8');
  const signature = Buffer.from((options.key ?? networkKey).signMessage(signingInput).data.array);

  return `${head}.${body}.${signature.subarray(signature.length - 64).toString('base64url')}`;
};

const individual = {
  username: 'ant',
  last_name: 'Муравьёв',
  first_name: 'Пётр',
  middle_name: 'Иванович',
  birthdate: '1980-05-01',
};

const logger = {
  setContext: () => undefined,
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  log: () => undefined,
};

const credential = {
  signWithCertKey: async (message: Uint8Array) => coopKey.signMessage(message).toString(),
  getTrustChain: async () => ['jws.anchor.operator', 'jws.operator.coop'],
  getChainId: async () => 'chain-id-1',
};

/** Что ушло на card.coop отметкой о передаче. */
let delivered: any[] = [];

/** Сколько раз читали JWKS: кэш — часть поведения, а не деталь. */
let jwksReads = 0;

const mockNetwork = (keys: unknown[]) => {
  jwksReads = 0;
  jest.spyOn(global, 'fetch').mockImplementation(async (input: any, init?: any) => {
    const url = String(input);

    if (url.endsWith('/v1/disclosures/jwks')) {
      jwksReads += 1;
      return { ok: true, status: 200, json: async () => ({ keys }) } as any;
    }

    delivered.push(JSON.parse(String(init?.body)));
    return { ok: true, status: 200, text: async () => '' } as any;
  });
};

const buildService = (options: { attestation?: unknown } = {}) => {
  const spent = new Set<string>();
  const usedGrants = {
    insert: jest.fn(async (record: { grantJti: string }) => {
      if (spent.has(record.grantJti)) throw new Error('duplicate key');
      spent.add(record.grantJti);
    }),
  };

  const attestations = {
    findOne: jest.fn(async () =>
      options.attestation === undefined ? { username: 'ant', cardId: CARD_ID } : options.attestation
    ),
  };

  const identity = { profile: async () => ({ kind: InnerAccountType.individual, data: { ...individual } }) };
  const attestationService = new CardcoopAttestationService(credential as any, logger as any, identity as any);

  const service = new CardcoopDisclosureService(
    attestations as any,
    usedGrants as any,
    new CardcoopGrantVerifier(logger as any),
    identity as any,
    attestationService,
    credential as any,
    logger as any
  );

  return { service, usedGrants, attestations };
};

/** Отметка о передаче уходит в фоне — даём микрозадачам отработать. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

describe('Выдача анкеты пайщика по гранту card.coop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delivered = [];
    mockNetwork([jwkOf(networkKey)]);
  });

  afterEach(() => jest.restoreAllMocks());

  it('по действительному гранту анкета выдаётся и подписана ключом кооператива', async () => {
    const { service } = buildService();

    const envelope = await service.disclose(API_URL, issueGrant());

    expect(envelope.payload.type).toBe(CardcoopDisclosureType.Profile);
    expect(envelope.payload.card_id).toBe(CARD_ID);
    expect(envelope.payload.to_coopname).toBe('zakat');
    expect(envelope.payload.grant_jti).toBe('grant-1');
    expect(envelope.payload.subject_type).toBe(InnerAccountType.individual);
    expect(envelope.payload.profile.birthdate).toBe('1980-05-01');
    expect(envelope.chain).toEqual(['jws.anchor.operator', 'jws.operator.coop']);

    // Получатель проверяет анкету по ключу кооператива из реестра — без обращения к нам и к сети.
    const canonical = canonicalize(envelope.payload) as string;
    expect(
      Signature.from(envelope.signature).verifyMessage(Buffer.from(canonical, 'utf8'), coopKey.toPublic())
    ).toBe(true);
  });

  it('выдача отмечается на card.coop как переданная — держатель видит, чем кончилось его «разрешаю»', async () => {
    const { service } = buildService();

    await service.disclose(API_URL, issueGrant());
    await settle();

    const mark = delivered.find((item) => item.payload?.type === CardcoopDisclosureType.Delivered);
    expect(mark).toBeDefined();
    expect(mark.payload.grant_jti).toBe('grant-1');
    expect(mark.payload.coopname).toBe('voskhod');
    expect(mark.chain.length).toBe(2);
  });

  it('просроченный грант отклоняется', async () => {
    const { service } = buildService();
    const expired = issueGrant({ iat: Math.floor(Date.now() / 1000) - 3600, exp: Math.floor(Date.now() / 1000) - 600 });

    await expect(service.disclose(API_URL, expired)).rejects.toThrow(CardcoopGrantRejected);
  });

  it('грант на анкету другого кооператива отклоняется — мы не его источник', async () => {
    const { service } = buildService();

    await expect(service.disclose(API_URL, issueGrant({ from: 'zakat' }))).rejects.toThrow(CardcoopGrantRejected);
  });

  it('повторное предъявление того же гранта отклоняется — согласие даётся на один обмен', async () => {
    const { service } = buildService();
    const grant = issueGrant();

    await expect(service.disclose(API_URL, grant)).resolves.toBeDefined();
    await expect(service.disclose(API_URL, grant)).rejects.toThrow(CardcoopGrantRejected);
  });

  it('грант на пайщика без действующего членства отклоняется', async () => {
    const { service, usedGrants } = buildService({ attestation: null });

    await expect(service.disclose(API_URL, issueGrant())).rejects.toThrow(CardcoopGrantRejected);
    // Согласие при этом не сжигается: держатель ни при чём, и переспрашивать его незачем.
    expect(usedGrants.insert).not.toHaveBeenCalled();
  });

  it('грант, подписанный чужим ключом, отклоняется', async () => {
    const { service } = buildService();
    const stranger = PrivateKey.generate(KeyType.K1);

    await expect(service.disclose(API_URL, issueGrant({}, { key: stranger }))).rejects.toThrow(CardcoopGrantRejected);
  });

  it('подменённое тело гранта не сходится с подписью', async () => {
    const { service } = buildService();
    const [head, , signature] = issueGrant().split('.');
    const forged = `${head}.${base64url({
      iss: 'card.coop',
      sub: CARD_ID,
      aud: 'zakat',
      from: 'voskhod',
      jti: 'grant-подменённый',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
    })}.${signature}`;

    await expect(service.disclose(API_URL, forged)).rejects.toThrow(CardcoopGrantRejected);
  });

  it('заверение цепи доверия вместо гранта не принимается — у бумаг разное назначение', async () => {
    const { service } = buildService();

    await expect(service.disclose(API_URL, issueGrant({}, { typ: 'cardcoop-endorsement+jws' }))).rejects.toThrow(
      CardcoopGrantRejected
    );
  });

  it('недоступный JWKS означает отказ, а не выдачу без проверки', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('сеть недоступна'));
    const { service } = buildService();

    await expect(service.disclose(API_URL, issueGrant())).rejects.toThrow(CardcoopGrantRejected);
  });

  it('ключ сети читается один раз и живёт в кэше — card.coop не в критическом пути обмена', async () => {
    const { service } = buildService();

    await service.disclose(API_URL, issueGrant({ jti: 'grant-1' }));
    await service.disclose(API_URL, issueGrant({ jti: 'grant-2' }));

    expect(jwksReads).toBe(1);
  });

  it('ротация ключа сети подхватывается перечиткой JWKS, без простоя и перенастройки', async () => {
    const rotated = PrivateKey.generate(KeyType.K1);
    // В кэше осядет прежний ключ, а грант придёт подписанный новым: незнакомый отпечаток
    // обязан отправить нас за свежим набором, а не привести к отказу.
    mockNetwork([jwkOf(networkKey)]);
    const { service } = buildService();
    await service.disclose(API_URL, issueGrant({ jti: 'grant-1' }));

    const fresh = { ...jwkOf(rotated), kid: 'key-2' };
    jest.spyOn(global, 'fetch').mockImplementation(async (input: any, init?: any) => {
      const url = String(input);
      if (url.endsWith('/v1/disclosures/jwks')) return { ok: true, status: 200, json: async () => ({ keys: [fresh] }) } as any;
      delivered.push(JSON.parse(String(init?.body)));
      return { ok: true, status: 200, text: async () => '' } as any;
    });

    await expect(
      service.disclose(API_URL, issueGrant({ jti: 'grant-2' }, { key: rotated, kid: 'key-2' }))
    ).resolves.toBeDefined();
  });
});

/**
 * Дверь наружу (story 7.8).
 *
 * Отдельно от выдачи проверяется одно свойство: по ответу нельзя узнать, почему отказали.
 * Различать «грант просрочен», «такого пайщика у нас нет» и «по этому согласию уже отдавали»
 * значило бы отвечать чужому на вопрос о членстве человека (архитектура §8).
 */
describe('Ответ выдающей стороны на запрос анкеты', () => {
  const buildController = (disclose: jest.Mock) =>
    new CardcoopDisclosureController(
      { config: { api_url: API_URL } } as any,
      { disclose } as any,
      logger as any
    );

  beforeEach(() => jest.clearAllMocks());

  it('анкета отдаётся тем же конвертом, каким её собрал кооператив', async () => {
    const envelope = { payload: { type: CardcoopDisclosureType.Profile }, signature: 'SIG_K1_x', chain: [] };
    const disclose = jest.fn(async () => envelope);

    await expect(buildController(disclose).disclose({ grant: 'grant' })).resolves.toBe(envelope);
    expect(disclose).toHaveBeenCalledWith(API_URL, 'grant');
  });

  it('любая причина отказа выглядит снаружи одинаково', async () => {
    const reasons = [
      new CardcoopGrantRejected('грант просрочен'),
      new CardcoopGrantRejected('по карте нет действующего подтверждения членства'),
      new CardcoopGrantRejected('по согласию анкета уже выдана'),
      new Error('база данных недоступна'),
    ];

    const messages: string[] = [];
    for (const reason of reasons) {
      const controller = buildController(jest.fn(async () => { throw reason; }));
      await controller.disclose({ grant: 'grant' }).catch((error: Error) => messages.push(error.message));
    }

    expect(new Set(messages).size).toBe(1);
    expect(messages).toHaveLength(reasons.length);
  });

  it('запрос без гранта отклоняется тем же ответом и до всякой работы', async () => {
    const disclose = jest.fn();

    await expect(buildController(disclose).disclose({})).rejects.toThrow(ForbiddenException);
    expect(disclose).not.toHaveBeenCalled();
  });
});
