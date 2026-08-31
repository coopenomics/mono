import { PrivateKey, KeyType } from '@wharfkit/antelope';
import canonicalize from 'canonicalize';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { CardcoopEntryService } from '~/extensions/cardcoop/entry/entry.service';
import { CardcoopDisclosureIntakeService } from '~/extensions/cardcoop/entry/disclosure-intake.service';
import {
  CardcoopEntryOutcome,
  CardcoopEntryStatus,
} from '~/extensions/cardcoop/infrastructure/entities/cardcoop-entry-session.typeorm-entity';

jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({
    coopname: 'zarya',
    backendUrl: 'https://zarya.coop/backend',
    frontendUrl: 'https://zarya.coop',
    blockchain: { chainId: 'chain-1' },
  }),
}));

/**
 * Вход по карте (story 9.2) и приём анкеты (story 9.3).
 *
 * Границы решения ant 31.08.2026: карта опознаёт, но не впускает — сессий стола по карте не
 * существует. Пайщика она приводит к его учётной записи, кандидата — в быструю регистрацию.
 * Анкета приезжает от кооператива-источника, проверяется ключом его заверения ИЗ ЦЕПИ и
 * читается ровно один раз.
 */
const CARD = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const API = 'https://card.coop';

const logger = { setContext: () => undefined, info: jest.fn(), warn: jest.fn(), error: jest.fn(), log: () => undefined };

const rpState = {
  id: 'self',
  rpClientId: 'cardcoop-coop-zarya',
  rpClientSecret: 'rp-секрет',
  rpIssuer: 'https://card.coop/application/o/coop-zarya/',
};

const b64 = (value: object) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');

const idToken = (overrides: Record<string, unknown> = {}) =>
  `${b64({ alg: 'RS256' })}.${b64({
    iss: rpState.rpIssuer,
    aud: rpState.rpClientId,
    sub: CARD,
    exp: Math.floor(Date.now() / 1000) + 300,
    card_number: '9689205327798678',
    memberships: [
      { coop: 'Кооператив ВОСХОД', coopname: 'voskhod', status: 'active', member_since: '2024-03-17' },
      { coop: 'ПО «Заря»', coopname: 'zarya', status: 'active', member_since: '2026-01-01' },
      { coop: 'Бывший', coopname: 'byvshiy', status: 'revoked', member_since: '2020-01-01' },
    ],
    ...overrides,
  })}.sig`;

const repos = () => {
  const sessions = new Map<string, any>();
  return {
    sessions,
    connectState: { findOne: jest.fn(async (): Promise<any> => rpState) },
    attestations: { findOne: jest.fn(async (): Promise<any> => null) },
    sessionsRepo: {
      delete: jest.fn(async () => ({ affected: 0 })),
      create: (data: any) => ({ ...data }),
      save: jest.fn(async (row: any) => {
        sessions.set(row.id, row);
        return row;
      }),
      findOne: jest.fn(async ({ where }: any) =>
        where.id
          ? sessions.get(where.id) ?? null
          : [...sessions.values()].find((row) => row.disclosureId === where.disclosureId) ?? null),
    },
  };
};

describe('Вход по карте пайщика', () => {
  beforeEach(() => jest.restoreAllMocks());

  const build = (deps = repos()) => ({
    deps,
    service: new CardcoopEntryService(
      deps.connectState as any,
      deps.attestations as any,
      deps.sessionsRepo as any,
      logger as any
    ),
  });

  it('начало входа уводит на card.coop с PKCE и нашим клиентом', async () => {
    const { service } = build();

    const url = new URL(await service.start(API));

    expect(url.origin + url.pathname).toBe('https://card.coop/application/o/authorize/');
    expect(url.searchParams.get('client_id')).toBe('cardcoop-coop-zarya');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toContain('cardcoop:memberships');
    expect(url.searchParams.get('redirect_uri')).toBe('https://zarya.coop/backend/v1/extensions/cardcoop/entry/callback');
  });

  it('без реквизитов от сети вход недоступен: кнопке некуда вести', async () => {
    const deps = repos();
    deps.connectState.findOne = jest.fn(async () => null);
    const { service } = build(deps);

    await expect(service.available()).resolves.toBe(false);
    await expect(service.start(API)).rejects.toThrow(NotFoundException);
  });

  it('пайщика карта опознаёт по НАШЕМУ журналу и не даёт сессии стола — только имя учётной записи', async () => {
    const deps = repos();
    deps.attestations.findOne = jest.fn(async () => ({ username: 'ant', cardId: CARD }));
    const { service } = build(deps);
    const state = new URL(await service.start(API)).searchParams.get('state') as string;
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ id_token: idToken() }) } as any);

    const session = await service.callback(API, state, 'code-1');

    expect(session.outcome).toBe(CardcoopEntryOutcome.Member);
    expect(session.username).toBe('ant');
    // Членства пайщику не нужны — источник анкеты выбирает только кандидат.
    expect(session.memberships).toEqual([]);
  });

  it('кандидату остаются только действующие членства ЧУЖИХ кооперативов — источник анкеты из них', async () => {
    const { service } = build();
    const state = new URL(await service.start(API)).searchParams.get('state') as string;
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ id_token: idToken() }) } as any);

    const session = await service.callback(API, state, 'code-1');

    expect(session.outcome).toBe(CardcoopEntryOutcome.Candidate);
    expect(session.memberships).toEqual([
      { coopname: 'voskhod', display_name: 'Кооператив ВОСХОД', member_since: '2024-03-17' },
    ]);
  });

  it('возврат без начатого входа отклоняется — state одноразовый', async () => {
    const { service } = build();
    const state = new URL(await service.start(API)).searchParams.get('state') as string;
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ id_token: idToken() }) } as any);

    await service.callback(API, state, 'code-1');

    await expect(service.callback(API, state, 'code-1')).rejects.toThrow(NotFoundException);
  });

  it('токен чужого издателя или чужого клиента не проходит', async () => {
    const { service } = build();
    const state = new URL(await service.start(API)).searchParams.get('state') as string;
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => ({ id_token: idToken({ iss: 'https://чужой/' }) }) } as any);

    await expect(service.callback(API, state, 'code-1')).rejects.toThrow(NotFoundException);
  });

  it('анкета читается ровно один раз: ссылка из истории браузера получает отказ', async () => {
    const deps = repos();
    deps.sessions.set('entry-1', {
      id: 'entry-1',
      outcome: CardcoopEntryOutcome.Candidate,
      status: CardcoopEntryStatus.ProfileReady,
      profileType: 'individual',
      profile: { last_name: 'Муравьёв' },
      profileTakenAt: null,
    });
    const { service } = build(deps);

    const first = await service.takeProfile('entry-1');
    expect(first.profile).toEqual({ last_name: 'Муравьёв' });

    await expect(service.takeProfile('entry-1')).rejects.toThrow(NotFoundException);
    expect(deps.sessions.get('entry-1').profile).toBeNull();
  });
});

describe('Приём анкеты от кооператива-источника', () => {
  const sourceKey = PrivateKey.generate(KeyType.K1);
  const certKey = sourceKey.toPublic().toString();

  const profilePayload = (overrides: Record<string, unknown> = {}) => ({
    type: 'disclosure_profile',
    coopname: 'voskhod',
    card_id: CARD,
    to_coopname: 'zarya',
    grant_jti: 'consent-1',
    issued_at: new Date().toISOString(),
    chain_id: 'chain-1',
    subject_type: 'individual',
    profile: { last_name: 'Муравьёв', first_name: 'Пётр' },
    ...overrides,
  });

  const signedEnvelope = (payload: Record<string, unknown>) => ({
    payload,
    signature: sourceKey.signMessage(Buffer.from(canonicalize(payload) as string, 'utf8')).toString(),
    chain: ['a', 'b'],
  });

  const candidate = () => ({
    id: 'entry-1',
    cardId: CARD,
    outcome: CardcoopEntryOutcome.Candidate,
    status: CardcoopEntryStatus.AwaitingConsent,
    memberships: [{ coopname: 'voskhod', display_name: 'Кооператив ВОСХОД', member_since: '2024-03-17' }],
    disclosureId: 'consent-1',
    profile: null,
    profileType: null,
    profileTakenAt: null,
  });

  let deps: ReturnType<typeof repos>;
  let attestationService: any;
  let chain: { getSingleRow: jest.Mock };

  const build = () =>
    new CardcoopDisclosureIntakeService(
      deps.sessionsRepo as any,
      attestationService,
      chain as any,
      logger as any
    );

  beforeEach(() => {
    jest.restoreAllMocks();
    deps = repos();
    deps.sessions.set('entry-1', candidate());
    attestationService = {
      signDocument: jest.fn(async (payload: any) => ({ payload, signature: 'SIG_K1_x', chain: ['a'] })),
      deliverDocument: jest.fn(async () => ({ delivered: true, status: 200, body: { id: 'consent-1' } })),
    };
    chain = {
      getSingleRow: jest.fn(async () => ({ subject: 'voskhod', cert_key: certKey, expires_at: '2030-01-01T00:00:00' })),
    };
  });

  it('запрос раскрытия подписан нами и называет источник из членств карты', async () => {
    deps.sessions.get('entry-1').status = CardcoopEntryStatus.Started;
    deps.sessions.get('entry-1').disclosureId = null;

    const session = await build().requestDisclosure(API, 'entry-1', 'voskhod');

    const [url] = attestationService.deliverDocument.mock.calls[0];
    expect(url).toBe('https://card.coop/v1/disclosures');
    const payload = attestationService.signDocument.mock.calls[0][0];
    expect(payload.type).toBe('disclosure_request');
    expect(payload.coopname).toBe('zarya');
    expect(payload.from_coopname).toBe('voskhod');
    expect(session.disclosureId).toBe('consent-1');
    expect(session.status).toBe(CardcoopEntryStatus.AwaitingConsent);
  });

  it('источник не из членств карты отклоняется — о нём человек нам не говорил', async () => {
    await expect(build().requestDisclosure(API, 'entry-1', 'chuzhoy')).rejects.toThrow(NotFoundException);
  });

  it('отказ сети (висящий запрос, недавнее «нет») отдаётся человеку, а не глотается', async () => {
    attestationService.deliverDocument = jest.fn(async () => ({
      delivered: false,
      status: 409,
      reason: 'запрос уже ждёт решения держателя',
    }));

    await expect(build().requestDisclosure(API, 'entry-1', 'voskhod')).rejects.toThrow(ConflictException);
  });

  it('по гранту анкета забирается у источника и проверяется ключом его заверения из цепи', async () => {
    const envelope = signedEnvelope(profilePayload());
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => envelope } as any);

    await build().handleGranted({
      disclosure_id: 'consent-1',
      grant: 'grant-jws',
      from_coopname: 'voskhod',
      from_disclosure_url: 'https://voskhod.coop/backend/v1/extensions/cardcoop/disclosures',
    });

    const session = deps.sessions.get('entry-1');
    expect(session.status).toBe(CardcoopEntryStatus.ProfileReady);
    expect(session.profile).toEqual({ last_name: 'Муравьёв', first_name: 'Пётр' });
    expect(chain.getSingleRow).toHaveBeenCalledWith('ano', 'ano', 'endorsements', 'voskhod');
  });

  it('подпись, не сходящаяся с заверением источника в цепи, анкетой не становится', async () => {
    const stranger = PrivateKey.generate(KeyType.K1);
    const payload = profilePayload();
    const forged = {
      payload,
      signature: stranger.signMessage(Buffer.from(canonicalize(payload) as string, 'utf8')).toString(),
      chain: [],
    };
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => forged } as any);

    await build().handleGranted({
      disclosure_id: 'consent-1',
      grant: 'grant-jws',
      from_coopname: 'voskhod',
      from_disclosure_url: 'https://voskhod.coop/x',
    });

    expect(deps.sessions.get('entry-1').status).toBe(CardcoopEntryStatus.AwaitingConsent);
    expect(deps.sessions.get('entry-1').profile).toBeNull();
  });

  it('анкета по чужому согласию или чужой карте отвергается', async () => {
    const envelope = signedEnvelope(profilePayload({ grant_jti: 'другое-согласие' }));
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => envelope } as any);

    await build().handleGranted({
      disclosure_id: 'consent-1',
      grant: 'grant-jws',
      from_coopname: 'voskhod',
      from_disclosure_url: 'https://voskhod.coop/x',
    });

    expect(deps.sessions.get('entry-1').status).toBe(CardcoopEntryStatus.AwaitingConsent);
  });

  it('отказ держателя переводит сессию в «руками» — регистрация не тупик', async () => {
    await build().handleDenied({ disclosure_id: 'consent-1' });

    expect(deps.sessions.get('entry-1').status).toBe(CardcoopEntryStatus.Denied);
  });

  it('уведомление о неизвестном согласии молчит: оно могло пережить сессию', async () => {
    await expect(build().handleDenied({ disclosure_id: 'неизвестное' })).resolves.toBeUndefined();
  });
});
