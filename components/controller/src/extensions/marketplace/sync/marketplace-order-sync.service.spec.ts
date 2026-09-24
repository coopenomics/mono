import { MarketplaceOrderSyncService } from './marketplace-order-sync.service';
import { MarketplaceOrderRepositoryAdapter } from '../infrastructure/adapters/marketplace-order-repository.adapter';
import type { MarketplaceOrderBlockchainData } from '../domain/entities/marketplace-order.entity';
import type { MarketplaceOrderDomainRepository } from '../domain/repositories/marketplace-order.repository';

/**
 * Дельта создания заказа приходит раньше строки create-flow: `transact` ждёт
 * слушателей своего блока (7DD-22), а `persistAfterBlock` пишет строку после.
 * Прежде такая дельта падала «out-of-band Order», и заказ жил без членского
 * взноса и без привязки к цепи до следующего действия по нему.
 */

const HASH = 'ab'.repeat(32);

function chainState(overrides: Partial<MarketplaceOrderBlockchainData> = {}): MarketplaceOrderBlockchainData {
  return {
    order_hash: HASH.toUpperCase(),
    on_chain_id: '7',
    status: 'ACTIVE',
    membership_fee: '720.0000',
    accepted_cost: null,
    payout_status: null,
    markdown_cost: null,
    ...overrides,
  } as unknown as MarketplaceOrderBlockchainData;
}

function domainOrder() {
  return {
    id: 'order-1',
    order_hash: HASH,
    status: 'ACTIVE',
    membership_fee: null as string | null,
    getBlockNum: () => null,
    updateFromBlockchain: jest.fn(function (this: any, data: MarketplaceOrderBlockchainData) {
      this.membership_fee = data.membership_fee;
    }),
  };
}

function logger() {
  return { setContext: jest.fn(), log: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

function adapterWith(order = domainOrder()) {
  const repo = {
    create: jest.fn((row: any) => row),
    save: jest.fn(async (row: any) => row),
    update: jest.fn(async () => undefined),
    findOneOrFail: jest.fn(async () => ({})),
  };
  const mapper = { toDomain: jest.fn(() => order) };
  const adapter = new MarketplaceOrderRepositoryAdapter(repo as any, mapper as any, { emit: jest.fn() } as any);
  return { adapter, repo, order };
}

const createInput = {
  coopname: 'voskhod',
  order_hash: HASH,
  orderer_account: 'ekaterina',
  offer_id: '00000000-0000-0000-0000-000000000001',
  offer_hash: 'cd'.repeat(32),
  supplier_account: 'sidorov',
  delivery_braname: 'krg',
  quantity: 4,
  unit_of_measure: 'KG',
  price_per_unit: '600.0000',
  package_size: 0,
  total_cost: '2400.0000',
  cycle_id: null,
  warranty_period_secs: 0,
  warranty_until: null,
  status: 'ACTIVE',
  blocked_at: new Date(0),
  create_tx: { tx_hash: 'tx', block_num: 42, locked_amount: '2400.0000', signed_at: '' },
} as any;

describe('заказ: дельта создания опережает запись create-flow', () => {
  it('отложенное состояние цепи применяется при записи строки — взнос не теряется', async () => {
    const { adapter, repo, order } = adapterWith();
    adapter.deferEarlyChainState(chainState(), 42, true);

    await adapter.persistAfterBlock(createInput);

    expect(order.updateFromBlockchain).toHaveBeenCalledWith(chainState(), 42, true);
    expect(repo.update).toHaveBeenCalledWith({ id: 'order-1' }, expect.objectContaining({ membership_fee: '720.0000' }));
    expect(adapter.takeEarlyChainState(HASH), 'отложенное забирается ровно один раз').toBeNull();
  });

  it('без отложенного состояния запись строки ничего из цепи не применяет', async () => {
    const { adapter, repo, order } = adapterWith();
    await adapter.persistAfterBlock(createInput);
    expect(order.updateFromBlockchain).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('более поздний блок того же заказа не вытесняется ранним, устаревшие отложенные вытесняются по сроку', () => {
    const { adapter } = adapterWith();
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    adapter.deferEarlyChainState(chainState({ membership_fee: '1.0000' } as any), 50, true);
    adapter.deferEarlyChainState(chainState({ membership_fee: '2.0000' } as any), 40, true);
    expect(adapter.takeEarlyChainState(HASH)?.blockNum).toBe(50);

    adapter.deferEarlyChainState(chainState(), 60, true);
    now.mockReturnValue(1_000 + 11 * 60 * 1000);
    const evicted = adapter.deferEarlyChainState(chainState({ order_hash: 'ef'.repeat(32) } as any), 70, true);
    expect(evicted).toEqual([HASH]);
    now.mockRestore();
  });

  it('зеркала цепи — принятая стоимость, состояние выплаты, уценка — записываются в базу', async () => {
    const { adapter, repo } = adapterWith();
    await adapter.update({
      id: 'order-1',
      accepted_cost: '2400.0000',
      payout_status: 'COMPLETED',
      markdown_cost: '0.0000',
    } as any);
    // Без них крон довоза выплат считал, что выплата в цепь не ушла, и повторял её.
    expect(repo.update).toHaveBeenCalledWith({ id: 'order-1' }, expect.objectContaining({
      accepted_cost: '2400.0000',
      payout_status: 'COMPLETED',
      markdown_cost: '0.0000',
    }));
  });

  it('синхронизация откладывает дельту, если строки ещё нет, и не создаёт её сама', async () => {
    const { adapter } = adapterWith();
    const repo = Object.assign(adapter, {
      findBySyncKey: jest.fn(async () => null),
      createIfNotExists: jest.fn(),
      update: jest.fn(),
    }) as unknown as MarketplaceOrderDomainRepository;
    const svc = new MarketplaceOrderSyncService(repo, {} as any, logger() as any, { emit: jest.fn() } as any, {} as any);

    const result = await svc.handleSyncDelta('order_hash', HASH, chainState(), 42, true);

    expect(result).toMatchObject({ created: false, updated: false });
    expect((repo as any).createIfNotExists).not.toHaveBeenCalled();
    expect(adapter.takeEarlyChainState(HASH)?.blockNum).toBe(42);
  });

  it('строка появилась, пока дельту откладывали, — дельта применяется синхронизацией обычным путём', async () => {
    const { adapter, order } = adapterWith();
    const findBySyncKey = jest.fn().mockResolvedValueOnce(null).mockResolvedValue(order);
    const repo = Object.assign(adapter, {
      findBySyncKey,
      createIfNotExists: jest.fn(),
      update: jest.fn(async () => undefined),
    }) as unknown as MarketplaceOrderDomainRepository;
    const svc = new MarketplaceOrderSyncService(repo, {} as any, logger() as any, { emit: jest.fn() } as any, {} as any);

    const result = await svc.handleSyncDelta('order_hash', HASH, chainState(), 42, true);

    expect(result).toMatchObject({ updated: true });
    expect(order.updateFromBlockchain).toHaveBeenCalledWith(chainState(), 42, true);
    expect(adapter.takeEarlyChainState(HASH), 'отложенное забрано').toBeNull();
  });
});
