import { MarketplaceOrderDomainEntity } from './marketplace-order.entity';
import type { MarketplaceOrderProps } from './marketplace-order.types';

function buildProps(overrides: Partial<MarketplaceOrderProps> = {}): MarketplaceOrderProps {
  return {
    id: 'order-uuid-1',
    coopname: 'voskhod',
    order_hash: 'a'.repeat(64),
    orderer_account: 'orderer1',
    offer_id: 'offer-uuid-1',
    offer_hash: 'b'.repeat(64),
    supplier_account: 'supplier1',
    delivery_braname: 'ku.krasn.1',
    quantity: 3,
    price_per_unit: '150.0000',
    total_cost: '450.0000',
    cycle_type: 'time_based',
    cycle_id: null,
    warranty_period_secs: 7 * 86_400,
    warranty_until: null,
    status: 'ACTIVE',
    last_status_reason: null,
    blocked_at: new Date('2026-05-15T10:00:00Z'),
    accepted_at: null,
    received_at: null,
    cancelled_at: null,
    create_tx: null,
    on_chain_id: null,
    on_chain_block_num: null,
    on_chain_present: false,
    created_at: new Date('2026-05-15T10:00:00Z'),
    updated_at: new Date('2026-05-15T10:00:00Z'),
    ...overrides,
  };
}

describe('MarketplaceOrderDomainEntity', () => {
  // (1) Конструктор с backend-полями (db-only) → валиден.
  it('создаётся с backend-полями без on-chain снапшота (db-only)', () => {
    const order = new MarketplaceOrderDomainEntity(buildProps());

    expect(order.id).toBe('order-uuid-1');
    expect(order.coopname).toBe('voskhod');
    expect(order.order_hash).toBe('a'.repeat(64));
    expect(order.status).toBe('ACTIVE');
    expect(order.on_chain_id).toBeNull();
    expect(order.on_chain_block_num).toBeNull();
    expect(order.on_chain_present).toBe(false);
    expect(order.getBlockNum()).toBeUndefined();
    expect(order.getPrimaryKey()).toBe('order-uuid-1');
    expect(order.getSyncKey()).toBe('order_hash');
  });

  // (2) Конструктор с db + bc → entity полная.
  it('создаётся с on-chain снапшотом (db + bc)', () => {
    const order = new MarketplaceOrderDomainEntity(
      buildProps({
        on_chain_id: '42',
        on_chain_block_num: 1_234_567,
        on_chain_present: true,
      })
    );

    expect(order.on_chain_id).toBe('42');
    expect(order.on_chain_block_num).toBe(1_234_567);
    expect(order.on_chain_present).toBe(true);
    expect(order.getBlockNum()).toBe(1_234_567);
  });

  // (3) Sync-key mismatch при updateFromBlockchain → throw.
  it('бросает на mismatch sync-key при updateFromBlockchain', () => {
    const order = new MarketplaceOrderDomainEntity(buildProps());

    expect(() =>
      order.updateFromBlockchain(
        {
          order_hash: 'c'.repeat(64), // другой hash
          on_chain_id: '99',
          status: 'ACTIVE',
        },
        1_000_000,
        true
      )
    ).toThrow(/sync-key mismatch/);
  });

  // (4) updateFromBlockchain мутирует только bc-зеркало (не backend-поля).
  it('updateFromBlockchain обновляет только bc-зеркало и status', () => {
    const order = new MarketplaceOrderDomainEntity(buildProps({ blocked_at: new Date('2026-05-15T10:00:00Z') }));
    const beforeBlockedAt = order.blocked_at;
    const beforeCreatedAt = order.created_at;
    const beforeQty = order.quantity;

    order.updateFromBlockchain(
      {
        order_hash: 'a'.repeat(64),
        on_chain_id: '101',
        status: 'ACCEPTED',
      },
      2_000_000,
      true
    );

    expect(order.status).toBe('ACCEPTED');
    expect(order.on_chain_id).toBe('101');
    expect(order.on_chain_block_num).toBe(2_000_000);
    expect(order.on_chain_present).toBe(true);
    expect(order.blocked_at).toEqual(beforeBlockedAt); // не тронуто
    expect(order.created_at).toEqual(beforeCreatedAt);
    expect(order.quantity).toBe(beforeQty);
  });

  // (5) Derived флаги детерминированы и согласованы со статусами.
  it('derived `is_in_block_state` / `is_terminal` / `can_be_cancelled_by_orderer` согласованы', () => {
    const active = new MarketplaceOrderDomainEntity(buildProps({ status: 'ACTIVE' }));
    expect(active.is_active).toBe(true);
    expect(active.is_in_block_state).toBe(true);
    expect(active.is_terminal).toBe(false);
    expect(active.can_be_cancelled_by_orderer).toBe(true);

    const accepted = new MarketplaceOrderDomainEntity(buildProps({ status: 'ACCEPTED' }));
    expect(accepted.is_in_block_state).toBe(true);
    expect(accepted.can_be_cancelled_by_orderer).toBe(false); // batch уже принят, отмена через Эпик 7

    const cancelled = new MarketplaceOrderDomainEntity(buildProps({ status: 'CANCELLED_BY_ORDERER' }));
    expect(cancelled.is_in_block_state).toBe(false);
    expect(cancelled.is_terminal).toBe(true);

    const received = new MarketplaceOrderDomainEntity(buildProps({ status: 'RECEIVED' }));
    expect(received.is_in_block_state).toBe(false); // BLOCK уже снят consume в Эпике 6
    expect(received.is_terminal).toBe(false); // RECEIVED — не terminal (ещё возможен RETURNED)
  });

  it('нормализует order_hash в lowercase', () => {
    const order = new MarketplaceOrderDomainEntity(
      buildProps({ order_hash: 'A'.repeat(64), offer_hash: 'B'.repeat(64) })
    );
    expect(order.order_hash).toBe('a'.repeat(64));
    expect(order.offer_hash).toBe('b'.repeat(64));
  });

  it('бросает на некорректный order_hash (не 64-hex)', () => {
    expect(() => new MarketplaceOrderDomainEntity(buildProps({ order_hash: 'short' }))).toThrow(
      /order_hash должен быть 64-символьным/
    );
  });
});
