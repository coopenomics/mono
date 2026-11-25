/**
 * Хранилище пакетов выплаты поставщику (реестр marketplace.payouts).
 *
 * Состояние пакета узел получает из двух источников одного блока: дельты
 * таблицы `payouts` и действия кассира (`payconfirm` / `paydecline`). Порядок
 * их обработки не задан. Поэтому первое подтверждение и первый отказ узнаются
 * по записанным данным (время подтверждения, причина отказа), а не по
 * состоянию: иначе дельта, обработанная первой, оставила бы пакет без времени
 * подтверждения, транзакции и причины отказа.
 */
import { MarketplaceOutgoingPaymentRequestRepositoryAdapter } from '~/extensions/marketplace/infrastructure/adapters/marketplace-outgoing-payment-request-repository.adapter';
import { MarketplaceOutgoingPaymentRequestMapper } from '~/extensions/marketplace/infrastructure/mappers/marketplace-outgoing-payment-request.mapper';
import { MarketplaceOutgoingPaymentRequestStatuses as S } from '~/extensions/marketplace/domain/entities/marketplace-outgoing-payment-request.types';

const COOP = 'voskhod';
const HASH = 'batch-1';
const AT = new Date('2026-11-19T12:00:00Z');

function build(patch: Record<string, unknown> = {}) {
  const row: any = {
    id: 'pay-1',
    coopname: COOP,
    payment_hash: HASH,
    lines: [{ order_id: 'o1', order_hash: 'h-o1' }],
    payee_account: 'supp1',
    amount: '300.0000',
    symbol: 'RUB',
    purpose: 'Оплата по договору № 7',
    payout_destination: null,
    withheld_amount: '0',
    status: S.PENDING,
    completed_at: null,
    decline_reason: null,
    core_payment_id: null,
    payout_tx_hash: null,
    settled_at: null,
    created_at: AT,
    updated_at: AT,
    ...patch,
  };
  const store: any = {
    findOne: jest.fn(async () => row),
    findOneOrFail: jest.fn(async () => row),
    update: jest.fn(async (_where: unknown, changes: Record<string, unknown>) => void Object.assign(row, changes)),
  };
  const repo = new MarketplaceOutgoingPaymentRequestRepositoryAdapter(store, new MarketplaceOutgoingPaymentRequestMapper());
  return { repo, store, row };
}

describe('пакет выплаты: подтверждение и отказ кассира', () => {
  it('подтверждение ставит состояние, время и транзакцию', async () => {
    const { repo, row } = build();
    const res = await repo.applyCompletion(COOP, HASH, { completed_at: AT, payout_tx_hash: 'tx-1' });
    expect(row).toMatchObject({ status: S.COMPLETED, completed_at: AT, payout_tx_hash: 'tx-1' });
    expect(res?.is_completed).toBe(true);
  });

  it('дельта уже поставила COMPLETED — подтверждение дописывает время и транзакцию', async () => {
    const { repo, row } = build({ status: S.COMPLETED });
    await repo.applyCompletion(COOP, HASH, { completed_at: AT, payout_tx_hash: 'tx-1' });
    expect(row).toMatchObject({ status: S.COMPLETED, completed_at: AT, payout_tx_hash: 'tx-1' });
  });

  it('повтор подтверждения запись не меняет: время и транзакция первого подтверждения сохраняются', async () => {
    const { repo, store, row } = build({ status: S.COMPLETED, completed_at: AT, payout_tx_hash: 'tx-1' });
    await repo.applyCompletion(COOP, HASH, { completed_at: new Date('2026-11-20T00:00:00Z'), payout_tx_hash: 'tx-2' });
    expect(store.update).not.toHaveBeenCalled();
    expect(row).toMatchObject({ completed_at: AT, payout_tx_hash: 'tx-1' });
  });

  it('дельта уже поставила DECLINED — отказ дописывает причину', async () => {
    const { repo, row } = build({ status: S.DECLINED });
    await repo.applyDecline(COOP, HASH, 'Неверные реквизиты');
    expect(row).toMatchObject({ status: S.DECLINED, decline_reason: 'Неверные реквизиты' });
  });

  it('повтор отказа причину первого отказа не переписывает', async () => {
    const { repo, store, row } = build({ status: S.DECLINED, decline_reason: 'Неверные реквизиты' });
    await repo.applyDecline(COOP, HASH, 'Другая причина');
    expect(store.update).not.toHaveBeenCalled();
    expect(row.decline_reason).toBe('Неверные реквизиты');
  });

  it('пакета нет — null', async () => {
    const { repo, store } = build();
    store.findOne.mockResolvedValue(null);
    expect(await repo.applyCompletion(COOP, HASH, { completed_at: AT })).toBeNull();
    expect(await repo.applyDecline(COOP, HASH, 'причина')).toBeNull();
  });
});

describe('пакет выплаты: состояние из дельты цепи', () => {
  it('дельта ставит сумму, удержание и состояние', async () => {
    const { repo, row } = build({ status: S.OPEN, amount: '0' });
    await repo.applyChainState(COOP, HASH, { amount: '1500.0000', withheld_amount: '200.0000', status: S.PENDING });
    expect(row).toMatchObject({ amount: '1500.0000', withheld_amount: '200.0000', status: S.PENDING });
  });

  it('конечное состояние дельта не откатывает', async () => {
    const { repo, row } = build({ status: S.COMPLETED, completed_at: AT });
    await repo.applyChainState(COOP, HASH, { amount: '300.0000', withheld_amount: '0.0000', status: S.PENDING });
    expect(row.status).toBe(S.COMPLETED);
  });

  it('отметка закрытия ставится один раз', async () => {
    const { repo, store, row } = build({ status: S.COMPLETED, completed_at: AT });
    await repo.markSettled(COOP, HASH, AT);
    expect(row.settled_at).toBe(AT);
    await repo.markSettled(COOP, HASH, new Date('2026-11-21T00:00:00Z'));
    expect(store.update).toHaveBeenCalledTimes(1);
  });
});
