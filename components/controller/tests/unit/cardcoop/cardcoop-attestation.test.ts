import { PrivateKey, KeyType, Signature, PublicKey } from '@wharfkit/antelope';
import canonicalize from 'canonicalize';
import { InnerAccountType } from '@coopenomics/innercoop';
import { CardcoopAttestationService, backoffMs } from '~/extensions/cardcoop/attestation/attestation.service';
import { CardcoopAttestationType } from '~/extensions/cardcoop/attestation/attestation.types';

jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({ coopname: 'voskhod' }),
}));

/**
 * Выпуск подтверждения членства (story 7.2).
 *
 * Главное здесь: подпись накрывает канонический образ документа, а не его
 * случайную сериализацию, — иначе принимающая сторона, собрав тот же документ в
 * другом порядке ключей, не сойдётся с подписью и отвергнет честное свидетельство.
 */
const key = PrivateKey.generate(KeyType.K1);

const identityBlock = {
  kind: InnerAccountType.individual,
  public: { last_name: 'Муравьёв', first_name: 'Пётр', middle_name: 'Иванович' },
  digests: { birthdate: 'a'.repeat(64) },
};

const credential = {
  signWithCertKey: async (message: Uint8Array) => key.signMessage(message).toString(),
  getTrustChain: async () => ['jws.anchor.operator', 'jws.operator.coop'],
  getChainId: async () => 'chain-id-1',
};

const logger = { setContext: () => undefined, info: () => undefined, warn: jest.fn(), error: jest.fn(), log: () => undefined };

const identity = { build: async () => identityBlock } as any;

const buildService = (overrides: Partial<typeof credential> = {}) =>
  new CardcoopAttestationService({ ...credential, ...overrides } as any, logger as any, identity);

const request = { username: 'ant', cardId: '11111111-1111-4111-8111-111111111111', memberSince: '2026-01-15' };

describe('Подтверждение членства для сети карт', () => {
  beforeEach(() => jest.restoreAllMocks());

  it('документ содержит кооператив, карту, дату вступления, сеть и реквизиты', async () => {
    const envelope = await buildService().buildMembership(request);
    const payload = envelope.payload as any;

    expect(payload.type).toBe(CardcoopAttestationType.Membership);
    expect(payload.coopname).toBe('voskhod');
    expect(payload.card_id).toBe(request.cardId);
    expect(payload.member_since).toBe('2026-01-15');
    expect(payload.chain_id).toBe('chain-id-1');
    expect(payload.identity).toEqual(identityBlock);
    expect(Date.parse(payload.issued_at)).not.toBeNaN();
  });

  it('подпись сходится с каноническим образом документа', async () => {
    const envelope = await buildService().buildMembership(request);
    const canonical = canonicalize(envelope.payload) as string;

    const recovered = Signature.from(envelope.signature).recoverMessage(Buffer.from(canonical, 'utf8'));
    expect(recovered.toString()).toBe(key.toPublic().toString());
  });

  it('порядок ключей в документе на подпись не влияет — канонизация одна на обе стороны', async () => {
    const envelope = await buildService().buildMembership(request);
    const reordered = Object.fromEntries(Object.entries(envelope.payload as any).reverse());

    expect(canonicalize(reordered)).toBe(canonicalize(envelope.payload));
  });

  it('цепочка признания едет вместе с документом', async () => {
    const envelope = await buildService().buildMembership(request);

    expect(envelope.chain).toEqual(['jws.anchor.operator', 'jws.operator.coop']);
  });

  it('непризнанный кооператив выпускает документ, но это попадает в журнал', async () => {
    logger.warn.mockClear();
    const envelope = await buildService({ getTrustChain: async () => [] }).buildMembership(request);

    expect(envelope.chain).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('не признан в сети'));
  });

  it('успешная доставка не повторяется', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 201 }) as any);

    const result = await buildService().issueMembership('https://card.coop/', request);

    expect(result).toEqual({ delivered: true, status: 201 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://card.coop/v1/attestations');
  });

  it('отказ с разбором документа не повторяется — документ не станет другим', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ message: 'неизвестные поля документа' }), { status: 422 }) as any);

    const result = await buildService().issueMembership('https://card.coop', request);

    expect(result.delivered).toBe(false);
    expect(result.status).toBe(422);
    expect(result.reason).toBe('неизвестные поля документа');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('серверная ошибка повторяется — сеть могла быть занята', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick'] });
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 503 }) as any)
      .mockResolvedValueOnce(new Response(null, { status: 200 }) as any);

    const promise = buildService().issueMembership('https://card.coop', request);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.delivered).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('отзыв подписывается отдельно и называет отзываемое подтверждение', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 200 }) as any);
    const attestationId = '22222222-2222-4222-8222-222222222222';

    await buildService().revoke('https://card.coop', attestationId);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(body.payload.type).toBe(CardcoopAttestationType.Revocation);
    expect(body.payload.attestation_id).toBe(attestationId);
    expect(fetchMock.mock.calls[0][0]).toBe(`https://card.coop/v1/attestations/${attestationId}/revoke`);

    const recovered = Signature.from(body.signature).recoverMessage(Buffer.from(canonicalize(body.payload) as string, 'utf8'));
    expect(recovered.toString()).toBe(key.toPublic().toString());
  });

  it('задержка перед повтором растёт и упирается в предел', () => {
    expect(backoffMs(1)).toBe(1_000);
    expect(backoffMs(2)).toBe(2_000);
    expect(backoffMs(3)).toBe(4_000);
    expect(backoffMs(20)).toBe(30_000);
  });
});
