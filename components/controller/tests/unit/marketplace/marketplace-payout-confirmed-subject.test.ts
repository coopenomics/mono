/**
 * Уведомление поставщику о подтверждённой выплате говорит, за что заплачено:
 * имущество, принятое количество с единицей продажи и дата акта приёмки
 * (слово владельца 17.11.2026). Идентификаторы акта и транзакции поставщику
 * ни о чём не говорят. Сбой чтения состава уведомление не блокирует.
 */
import { MarketplacePayoutSyncService } from '~/extensions/marketplace/application/services/marketplace-payout-sync.service';
import { MARKETPLACE_SUPPLIER_PAYMENT_CONFIRMED_EVENT } from '~/extensions/marketplace/application/events/marketplace-notification.events';

const logger = { setContext: jest.fn(), info: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;

function make(opts: { orderFails?: boolean } = {}) {
  const request = {
    id: 'PR1', coopname: 'voskhod', apl_reception_id: 'R1', order_id: 'O1', payee_account: 'sidorov',
    amount: '100000.0000', symbol: 'RUB', core_payment_id: null,
  };
  const paymentRepo = { applyCompletion: jest.fn(async () => request) } as any;
  const coreGateway = { setPaymentStatus: jest.fn() } as any;
  const eventBus = { emit: jest.fn() } as any;
  const orderRepo = {
    findById: jest.fn(async () => {
      if (opts.orderFails) throw new Error('база недоступна');
      return { id: 'O1', offer_id: 'F1', quantity: 1200, unit_of_measure: 'L', package_size: 1 };
    }),
  } as any;
  const offerRepo = { findById: jest.fn(async () => ({ id: 'F1', product_name: 'Молоко' })) } as any;
  const receptionRepo = {
    findById: jest.fn(async () => ({
      id: 'R1',
      fact_quantity_per_order: [{ order_id: 'O1', fact_quantity: 1000 }],
      chairman_signed_at: new Date('2026-11-17T14:12:00Z'),
      created_at: new Date('2026-11-17T14:00:00Z'),
    })),
  } as any;
  const service = new MarketplacePayoutSyncService(paymentRepo, coreGateway, eventBus, logger, orderRepo, offerRepo, receptionRepo);
  const action = { data: { coopname: 'voskhod', outcome_hash: 'ABC' }, transaction_id: 'EA00502' } as any;
  return { service, eventBus, action };
}

describe('mkt.payouts.side.06 — уведомление о выплате: за что заплачено', () => {
  it('событие несёт имущество, принятое по акту количество с единицей и дату акта', async () => {
    const { service, eventBus, action } = make();
    await service.handlePayConfirm(action);
    const [name, event] = eventBus.emit.mock.calls[0];
    expect(name).toBe(MARKETPLACE_SUPPLIER_PAYMENT_CONFIRMED_EVENT);
    expect(event.item_name).toBe('Молоко');
    // Количество — принятое по акту (1000), а не заказанное (1200).
    expect(event.quantity).toMatch(/^1000 /);
    expect(event.act_date).toBe('17.11.2026');
    expect(event.amount).toBe('100000.0000 RUB');
  });

  it('состав не прочитан — уведомление всё равно отправляется с суммой', async () => {
    const { service, eventBus, action } = make({ orderFails: true });
    await service.handlePayConfirm(action);
    const [, event] = eventBus.emit.mock.calls[0];
    expect(event.amount).toBe('100000.0000 RUB');
    expect(event.item_name).toBeUndefined();
  });
});
