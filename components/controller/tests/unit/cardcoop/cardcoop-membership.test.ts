import { CardcoopMembershipService } from '~/extensions/cardcoop/membership/membership.service';
import { CardcoopAttestationState } from '~/extensions/cardcoop/infrastructure/entities/cardcoop-attestation.typeorm-entity';

/**
 * Журнал выданных подтверждений и отзыв при прекращении членства (story 7.3).
 *
 * Смысл журнала: отозвать подтверждение можно только по идентификатору, который
 * присваивает card.coop, а о прекращении членства кооператив узнаёт из цепи, где
 * ни карты, ни идентификатора нет. Без записи связать одно с другим нечем.
 */
const makeRepo = (rows: any[] = []) => {
  const store = [...rows];
  return {
    store,
    create: (data: any) => ({ ...data }),
    save: jest.fn(async (row: any) => {
      const index = store.findIndex((r) => r === row || (r.username === row.username && r.cardId === row.cardId));
      if (index >= 0) store[index] = row;
      else store.push(row);
      return row;
    }),
    findOne: jest.fn(async ({ where }: any) => store.find((r) => Object.entries(where).every(([k, v]) => r[k] === v)) ?? null),
    find: jest.fn(async ({ where }: any) => {
      const clauses = Array.isArray(where) ? where : [where];
      return store.filter((r) => clauses.some((c: any) => Object.entries(c).every(([k, v]) => r[k] === v)));
    }),
    delete: jest.fn(async (where: any) => {
      const index = store.findIndex((r) => Object.entries(where).every(([k, v]) => r[k] === v));
      if (index >= 0) store.splice(index, 1);
    }),
  };
};

const logger = { setContext: () => undefined, info: jest.fn(), warn: jest.fn(), error: jest.fn(), log: () => undefined };

/** Связки, ждущие приёма в пайщики (story 7.5): в этих сценариях их нет. */
const noPendingLinks = () => makeRepo();

const build = (attestations: any, exits: any, service: any, links: any = noPendingLinks()) =>
  new CardcoopMembershipService(attestations as any, exits as any, links as any, service as any, logger as any);

describe('Членство пайщика в сети карт', () => {
  beforeEach(() => jest.clearAllMocks());

  it('принятое подтверждение запоминается вместе с идентификатором — иначе отзывать будет нечем', async () => {
    const attestations = makeRepo();
    const issueMembership = jest.fn(async () => ({ delivered: true, status: 201, attestationId: 'att-1' }));

    await build(attestations, makeRepo(), { issueMembership }).issue('https://card.coop', 'ant', 'card-1', '2026-01-15');

    expect(attestations.store[0]).toMatchObject({
      username: 'ant',
      cardId: 'card-1',
      attestationId: 'att-1',
      state: CardcoopAttestationState.Active,
    });
  });

  it('повторное уведомление о той же связке не порождает второго свидетельства', async () => {
    const attestations = makeRepo([
      { username: 'ant', cardId: 'card-1', attestationId: 'att-1', state: CardcoopAttestationState.Active },
    ]);
    const issueMembership = jest.fn();

    await build(attestations, makeRepo(), { issueMembership }).issue('https://card.coop', 'ant', 'card-1', '2026-01-15');

    expect(issueMembership).not.toHaveBeenCalled();
    expect(attestations.store).toHaveLength(1);
  });

  it('недоставка остаётся ожиданием, отказ по существу — отдельным состоянием', async () => {
    const pending = makeRepo();
    await build(pending, makeRepo(), {
      issueMembership: async () => ({ delivered: false, status: null, reason: 'сеть недоступна' }),
    }).issue('https://card.coop', 'ant', 'card-1', '2026-01-15');
    expect(pending.store[0].state).toBe(CardcoopAttestationState.Pending);

    const rejected = makeRepo();
    await build(rejected, makeRepo(), {
      issueMembership: async () => ({ delivered: false, status: 422, reason: 'неизвестные поля' }),
    }).issue('https://card.coop', 'bob', 'card-2', '2026-01-15');
    expect(rejected.store[0].state).toBe(CardcoopAttestationState.Rejected);
    expect(rejected.store[0].lastError).toBe('неизвестные поля');
  });

  it('завершённый выход отзывает подтверждение того пайщика, чей это был выход', async () => {
    const attestations = makeRepo([
      { username: 'ant', cardId: 'card-1', attestationId: 'att-1', state: CardcoopAttestationState.Active },
    ]);
    const exits = makeRepo([{ exitHash: 'exit-1', username: 'ant', coopname: 'voskhod' }]);
    const revoke = jest.fn(async () => ({ delivered: true, status: 200 }));

    await build(attestations, exits, { revoke }).revokeByCompletedExit('https://card.coop', 'exit-1');

    expect(revoke).toHaveBeenCalledWith('https://card.coop', 'att-1');
    expect(attestations.store[0].state).toBe(CardcoopAttestationState.Revoked);
    expect(attestations.store[0].revokedAt).toBeInstanceOf(Date);
    expect(exits.store).toHaveLength(0);
  });

  it('выход неизвестного пайщика ничего не отзывает, но попадает в журнал', async () => {
    const revoke = jest.fn();

    await build(makeRepo(), makeRepo(), { revoke }).revokeByCompletedExit('https://card.coop', 'exit-unknown');

    expect(revoke).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('пайщик по нему неизвестен'));
  });

  it('подтверждение без идентификатора метится отозванным локально и это громко сообщается', async () => {
    const attestations = makeRepo([
      { username: 'ant', cardId: 'card-1', attestationId: null, state: CardcoopAttestationState.Active },
    ]);
    const exits = makeRepo([{ exitHash: 'exit-1', username: 'ant', coopname: 'voskhod' }]);
    const revoke = jest.fn();

    await build(attestations, exits, { revoke }).revokeByCompletedExit('https://card.coop', 'exit-1');

    expect(revoke).not.toHaveBeenCalled();
    expect(attestations.store[0].state).toBe(CardcoopAttestationState.Revoked);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('отозвать нечем'));
  });

  it('недоставленный отзыв оставляет подтверждение действующим — членство в сети ещё не прекращено', async () => {
    const attestations = makeRepo([
      { username: 'ant', cardId: 'card-1', attestationId: 'att-1', state: CardcoopAttestationState.Active },
    ]);
    const exits = makeRepo([{ exitHash: 'exit-1', username: 'ant', coopname: 'voskhod' }]);

    await build(attestations, exits, {
      revoke: async () => ({ delivered: false, status: 500, reason: 'сеть недоступна' }),
    }).revokeByCompletedExit('https://card.coop', 'exit-1');

    expect(attestations.store[0].state).toBe(CardcoopAttestationState.Active);
    expect(attestations.store[0].lastError).toBe('сеть недоступна');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('не доставлен'));
  });

  it('отклонённый советом выход просто забывается — членство сохраняется', async () => {
    const exits = makeRepo([{ exitHash: 'exit-1', username: 'ant', coopname: 'voskhod' }]);
    const attestations = makeRepo([
      { username: 'ant', cardId: 'card-1', attestationId: 'att-1', state: CardcoopAttestationState.Active },
    ]);

    await build(attestations, exits, {}).forgetExit('exit-1');

    expect(exits.store).toHaveLength(0);
    expect(attestations.store[0].state).toBe(CardcoopAttestationState.Active);
  });
});
