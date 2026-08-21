/**
 * Куда девается недовыданное имущество.
 *
 * Пайщик забирает меньше, чем принято на склад по его заказу. Деньги за
 * невыданное ему возвращаются — это считает `issuanceDiff` и проверяет
 * `marketplace-discrepancy-matrix`. Но имущество никуда не исчезает: оно
 * остаётся на складе участка и перестаёт быть адресным — становится
 * обезличенным остатком кооператива, который можно предложить заново или
 * списать по решению совета.
 *
 * Здесь проверяется именно имущественная сторона: закрытие выдачи обязано
 * отделить остаток в собственность кооператива, и ровно по выданному
 * количеству. Ошибка тут не видна ни в деньгах, ни в интерфейсе заказа —
 * имущество просто остаётся числиться за пайщиком, который его не получал.
 */
import { MarketplaceIssuanceService } from '~/extensions/marketplace/application/services/marketplace-issuance.service';
import type { MarketplaceOrderDomainEntity } from '~/extensions/marketplace/domain/entities/marketplace-order.entity';
import type { MarketplaceOrderDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-order.repository';
import type { MarketplaceInventoryDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-inventory.repository';
import type { MarketplaceOfferDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-offer.repository';
import type { MarketplaceCanonicalBlockchainPort } from '~/extensions/marketplace/domain/ports/marketplace-canonical-blockchain.port';
import type { MarketplaceAssetConfig } from '~/extensions/marketplace/application/services/marketplace-asset.config';

const COOP = 'voskhod';
const ORDERER = 'ekaterina';

/** Заказ поставщика (не из остатка): 10 единиц, принято 9, выдаётся меньше. */
function buildOrder(actual_quantity: number): MarketplaceOrderDomainEntity {
  return {
    id: 'order-1',
    coopname: COOP,
    order_hash: 'h-order-1',
    orderer_account: ORDERER,
    offer_id: 'offer-1',
    supplier_account: 'supplier1',
    delivery_braname: 'krg',
    quantity: 10,
    unit_of_measure: 'piece',
    package_size: 0,
    price_per_unit: '250.0000',
    total_cost: '2500.0000',
    status: 'READY_TO_RECEIVE',
    chairman_account: 'chairkrg',
    orderer_signed_at: null,
    warranty_period_secs: 0,
    issuance_fact: {
      actual_quantity,
      fact_unit_price: '200.0000',
      fact_cost: (actual_quantity * 200).toFixed(4),
      diff_state: actual_quantity < 10 ? 'less' : 'equal',
    },
  } as unknown as MarketplaceOrderDomainEntity;
}

function buildService(actual_quantity: number) {
  const order = buildOrder(actual_quantity);

  const orderRepo = {
    findById: jest.fn().mockResolvedValue(order),
    applyIssuanceFinalized: jest.fn().mockResolvedValue(order),
  } as unknown as jest.Mocked<MarketplaceOrderDomainRepository>;

  const inventoryRepo = {
    sumReservedByOrders: jest
      .fn()
      .mockImplementation(async (_c: string, ids: string[]) => new Map(ids.map((id) => [id, 9]))),
    detachRemainderToStock: jest.fn().mockResolvedValue(9 - actual_quantity),
    finalizeReservedIssue: jest.fn().mockResolvedValue({ released: 0, issued_arrival_cost: '0.0000' }),
  } as unknown as jest.Mocked<MarketplaceInventoryDomainRepository>;

  const offerRepo = {
    findById: jest.fn().mockResolvedValue(null),
  } as unknown as jest.Mocked<MarketplaceOfferDomainRepository>;

  const chainPort = {
    signIss2: jest.fn().mockResolvedValue({ transaction: { id: 'tx-2' } }),
    markdown: jest.fn().mockResolvedValue({ transaction: { id: 'tx-3' } }),
  } as unknown as jest.Mocked<MarketplaceCanonicalBlockchainPort>;

  const assetConfig: MarketplaceAssetConfig = { symbol: 'RUB', decimals: 4 };

  const service = new MarketplaceIssuanceService(
    orderRepo,
    inventoryRepo,
    offerRepo,
    chainPort,
    assetConfig,
    { generateDocument: jest.fn().mockResolvedValue({ hash: 'doc-hash' }), buildDocumentAggregate: jest.fn() } as any,
    { checkRequired: jest.fn().mockResolvedValue({ passed: true, missing: [] }), getVerificationTypes: jest.fn().mockResolvedValue([]) } as any,
    { emit: jest.fn() } as any,
    { setContext: jest.fn(), debug: jest.fn(), log: jest.fn(), error: jest.fn(), warn: jest.fn() } as any
  );

  jest
    .spyOn(service as never as { verifyDocumentSignature: () => void }, 'verifyDocumentSignature')
    .mockImplementation(() => undefined);
  jest
    .spyOn(service as never as { extractTxHash: () => string }, 'extractTxHash')
    .mockReturnValue('tx-2');

  return { service, inventoryRepo };
}

const finalize = (service: MarketplaceIssuanceService) =>
  service.finalizeIssuance({
    coopname: COOP,
    orderer_account: ORDERER,
    order_id: 'order-1',
    signed_document: { signatures: [{ signer: ORDERER }] } as any,
  } as never);

describe('Недовыдача: имущество остаётся кооперативу, а не пайщику', () => {
  it('выдано меньше принятого — остаток отделяется в собственность кооператива', async () => {
    // Принято 9, выдано 8: одна единица обязана уйти в обезличенный остаток.
    const { service, inventoryRepo } = buildService(8);

    await finalize(service);

    expect(inventoryRepo.detachRemainderToStock).toHaveBeenCalledWith(
      COOP,
      'order-1',
      // Ключевой аргумент: отделяем по ВЫДАННОМУ количеству. Передать сюда
      // заказанное — и остаток не отделится вовсе, имущество останется
      // числиться за пайщиком, который его не получал.
      8,
      expect.any(String)
    );
  });

  it('выдано всё принятое — отделять нечего, но склад всё равно закрывается', async () => {
    // Вызов обязан быть и здесь: он же переводит выданные позиции в ISSUED.
    // Молчаливый пропуск оставил бы их «на складе» после выдачи.
    const { service, inventoryRepo } = buildService(9);

    await finalize(service);

    expect(inventoryRepo.detachRemainderToStock).toHaveBeenCalledWith(COOP, 'order-1', 9, expect.any(String));
  });

  it('сбой склада не срывает выдачу — деньги пайщика важнее сводного учёта', async () => {
    const { service, inventoryRepo } = buildService(8);
    (inventoryRepo.detachRemainderToStock as jest.Mock).mockRejectedValueOnce(new Error('склад недоступен'));

    // Акт уже подписан обеими сторонами и ушёл на цепь: откатывать его из-за
    // складской записи нельзя, расхождение разбирают ручной сверкой.
    await expect(finalize(service)).resolves.toBeDefined();
  });
});
