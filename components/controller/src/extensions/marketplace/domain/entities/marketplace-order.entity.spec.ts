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
    membership_fee: null,
    cycle_id: null,
    checkout_id: null,
    shipment_id: null,
    warranty_period_secs: 7 * 86_400,
    warranty_until: null,
    status: 'ACTIVE',
    last_status_reason: null,
    blocked_at: new Date('2026-05-15T10:00:00Z'),
    accepted_at: null,
    received_at: null,
    cancelled_at: null,
    create_tx: null,
    current_warehouse_braname: null,
    issuance_fact: null,
    ready_announced_at: null,
    chairman_signed_at: null,
    chairman_account: null,
    signiss1_tx_hash: null,
    issue_act_signiss1_document: null,
    orderer_signed_at: null,
    delivery_signer_account: null,
    signiss2_tx_hash: null,
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
          membership_fee: null,
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
        membership_fee: null,
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

  // Monotonic state machine: backend cycle-hook продвигает status forward
  // сразу после submit'а, delta от парсера приходит позже с on-chain
  // status'ом — sync не должен «откатывать» backend forward в обратную
  // сторону.
  describe('updateFromBlockchain — monotonic status', () => {
    it('применяет forward-переход (ACTIVE → ACCEPTED)', () => {
      const order = new MarketplaceOrderDomainEntity(buildProps({ status: 'ACTIVE' }));

      order.updateFromBlockchain(
        { order_hash: 'a'.repeat(64), on_chain_id: '10', status: 'ACCEPTED', membership_fee: null },
        2_000_000,
        true
      );

      expect(order.status).toBe('ACCEPTED');
    });

    it('игнорирует backward-откат (ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL ← ACTIVE)', () => {
      const order = new MarketplaceOrderDomainEntity(
        buildProps({ status: 'ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL' })
      );

      order.updateFromBlockchain(
        { order_hash: 'a'.repeat(64), on_chain_id: '11', status: 'ACTIVE', membership_fee: null },
        2_100_000,
        true
      );

      expect(order.status).toBe('ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL');
      expect(order.on_chain_id).toBe('11');
      expect(order.on_chain_block_num).toBe(2_100_000);
    });

    it('игнорирует backward-откат (ACCEPTED ← ACTIVE)', () => {
      const order = new MarketplaceOrderDomainEntity(buildProps({ status: 'ACCEPTED' }));

      order.updateFromBlockchain(
        { order_hash: 'a'.repeat(64), on_chain_id: '12', status: 'ACTIVE', membership_fee: null },
        2_200_000,
        true
      );

      expect(order.status).toBe('ACCEPTED');
    });

    it('применяет терминальный CANCELLED_BY_ORDERER поверх любого forward-статуса', () => {
      const order = new MarketplaceOrderDomainEntity(buildProps({ status: 'ACCEPTED' }));

      order.updateFromBlockchain(
        { order_hash: 'a'.repeat(64), on_chain_id: '13', status: 'CANCELLED_BY_ORDERER', membership_fee: null },
        2_300_000,
        false
      );

      expect(order.status).toBe('CANCELLED_BY_ORDERER');
      expect(order.on_chain_present).toBe(false);
    });

    // Regression: отклонённый заказ стирается из chain-RAM (decline = erase).
    // Парсер на erase шлёт present=false с последним «живым» value строки
    // ('active'). Без terminal-guard'а это перетирало backend-статус
    // CANCELLED_BY_SUPPLIER обратно в ACTIVE — заказ «воскресал» в списке
    // «Ждут акцепта», а повторный decline падал «не найден по хэшу».
    it('НЕ воскрешает терминальный CANCELLED_BY_SUPPLIER erase-дельтой с active', () => {
      const order = new MarketplaceOrderDomainEntity(
        buildProps({ status: 'CANCELLED_BY_SUPPLIER' })
      );

      order.updateFromBlockchain(
        { order_hash: 'a'.repeat(64), on_chain_id: '20', status: 'ACTIVE', membership_fee: null },
        2_500_000,
        false
      );

      expect(order.status).toBe('CANCELLED_BY_SUPPLIER'); // не воскрешён
      expect(order.on_chain_present).toBe(false); // строка стёрта on-chain
    });

    it('НЕ воскрешает терминальный RETURNED erase-дельтой с received', () => {
      const order = new MarketplaceOrderDomainEntity(buildProps({ status: 'RETURNED' }));

      order.updateFromBlockchain(
        { order_hash: 'a'.repeat(64), on_chain_id: '21', status: 'RECEIVED', membership_fee: null },
        2_600_000,
        false
      );

      expect(order.status).toBe('RETURNED');
    });

    it('применяет тот же ранг (ACCEPTED_PENDING_SUPPLIER ↔ ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL)', () => {
      const order = new MarketplaceOrderDomainEntity(
        buildProps({ status: 'ACCEPTED_PENDING_SUPPLIER' })
      );

      order.updateFromBlockchain(
        {
          order_hash: 'a'.repeat(64),
          on_chain_id: '14',
          status: 'ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL',
          membership_fee: null,
        },
        2_400_000,
        true
      );

      expect(order.status).toBe('ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL');
    });
  });
});
