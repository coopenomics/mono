/**
 * Уценка при выдаче заказа из обезличенного остатка кооператива.
 *
 * Остаток лежит на складе по цене прибытия, а перепредлагают его обычно
 * дешевле. Разница между стоимостью прибытия выданного и фактической суммой
 * выбывает прочим расходом (`markdown` → o.mkt.loss, Дт 91 / Кт 10): вместе
 * со списанием себестоимости это даёт выбытие по полной стоимости прибытия,
 * и на складе не зависает непокрытая разница.
 *
 * Отправка расхода — best-effort: сбой не роняет выдачу, а только пишет
 * предупреждение в лог. Именно поэтому расхождение здесь молчаливое, и
 * проверять расчёт нужно прицельно.
 */
import { MarketplaceIssuanceService } from '~/extensions/marketplace/application/services/marketplace-issuance.service';
import type { MarketplaceOrderDomainEntity } from '~/extensions/marketplace/domain/entities/marketplace-order.entity';
import type { MarketplaceOrderDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-order.repository';
import type { MarketplaceInventoryDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-inventory.repository';
import type { MarketplaceOfferDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-offer.repository';
import type { MarketplaceCanonicalBlockchainPort } from '~/extensions/marketplace/domain/ports/marketplace-canonical-blockchain.port';
import type { MarketplaceAssetConfig } from '~/extensions/marketplace/application/services/marketplace-asset.config';

const COOP = 'voskhod';

/**
 * Заказ из остатка отличается от обычного одним признаком: поставщик — сам
 * кооператив (`isStockOrder`). Здесь 4 единицы по 200 ₽ — цена публикации.
 */
function buildStockOrder(
  overrides: Partial<MarketplaceOrderDomainEntity> = {}
): MarketplaceOrderDomainEntity {
  return {
    id: 'order-stock-1',
    coopname: COOP,
    order_hash: 'h-order-stock-1',
    orderer_account: 'orderer2',
    offer_id: 'offer-coop-1',
    supplier_account: COOP,
    delivery_braname: 'krg',
    quantity: 4,
    unit_of_measure: 'piece',
    package_size: 0,
    price_per_unit: '200.0000',
    total_cost: '800.0000',
    status: 'ACCEPTED_TO_COOP',
    ready_announced_at: null,
    chairman_signed_at: null,
    warranty_period_secs: 0,
    ...overrides,
  } as MarketplaceOrderDomainEntity;
}

/**
 * `issued_arrival_cost` — во сколько выданное обошлось кооперативу по ценам
 * прибытия; именно от него считается уценка.
 */
function buildService(reserved: number, issued_arrival_cost: string) {
  const orderRepo = {
    findById: jest.fn().mockImplementation(async (id: string) => buildStockOrder({ id })),
    applyIssuanceOpened: jest.fn().mockImplementation(async (id: string) => buildStockOrder({ id })),
  } as unknown as jest.Mocked<MarketplaceOrderDomainRepository>;

  const inventoryRepo = {
    sumReservedByOrders: jest
      .fn()
      .mockImplementation(async (_coopname: string, ids: string[]) => new Map(ids.map((id) => [id, reserved]))),
    finalizeReservedIssue: jest.fn().mockResolvedValue({ released: 0, issued_arrival_cost }),
  } as unknown as jest.Mocked<MarketplaceInventoryDomainRepository>;

  const offerRepo = {
    findById: jest.fn().mockResolvedValue(null),
  } as unknown as jest.Mocked<MarketplaceOfferDomainRepository>;

  const chainPort = {
    signIss1: jest.fn().mockResolvedValue({ transaction: { id: 'tx-1' } }),
    markdown: jest.fn().mockResolvedValue({ transaction: { id: 'tx-2' } }),
  } as unknown as jest.Mocked<MarketplaceCanonicalBlockchainPort>;

  const assetConfig: MarketplaceAssetConfig = { symbol: 'RUB', decimals: 4 };

  const logger = {
    setContext: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  } as any;

  const service = new MarketplaceIssuanceService(
    orderRepo,
    inventoryRepo,
    offerRepo,
    chainPort,
    assetConfig,
    { generateDocument: jest.fn().mockResolvedValue({ hash: 'doc-hash' }), buildDocumentAggregate: jest.fn() } as any,
    { emit: jest.fn() } as any,
    logger
  );

  // Подпись акта и сериализация в формат контракта проверяются отдельно —
  // до арифметики уценки иначе не добраться.
  jest
    .spyOn(service as never as { verifyDocumentSignature: () => void }, 'verifyDocumentSignature')
    .mockImplementation(() => undefined);
  jest
    .spyOn(service as never as { extractTxHash: () => string }, 'extractTxHash')
    .mockReturnValue('tx-1');

  return { service, chainPort, inventoryRepo, logger };
}

async function issue(
  service: MarketplaceIssuanceService,
  actual_quantity: number,
  actual_unit_price: string
) {
  await service.openIssuance({
    coopname: COOP,
    order_id: 'order-stock-1',
    chairman_account: 'chairkrg',
    actual_quantity,
    actual_unit_price,
    signed_document: { signatures: [] } as any,
  } as never);
}

describe('Выдача остатка кооператива: уценка выбывает прочим расходом', () => {
  it('продано дешевле цены прибытия — разница уходит в расход', async () => {
    // Прибытие 4 × 250 = 1000 ₽, продано 4 × 200 = 800 ₽ → уценка 200 ₽.
    const { service, chainPort } = buildService(4, '1000.0000');

    await issue(service, 4, '200.0000');

    expect(chainPort.markdown).toHaveBeenCalledWith(
      expect.objectContaining({ coopname: COOP, amount: '200.0000 RUB' })
    );
  });

  it('уценка считается от выданного, а не от всего резерва', async () => {
    // Выдали 2 из 4: прибытие выданного 2 × 250 = 500 ₽, продано 2 × 200 = 400 ₽.
    const { service, chainPort } = buildService(4, '500.0000');

    await issue(service, 2, '200.0000');

    expect(chainPort.markdown).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '100.0000 RUB' })
    );
  });

  it('продано по цене прибытия — расхода нет', async () => {
    const { service, chainPort } = buildService(4, '800.0000');

    await issue(service, 4, '200.0000');

    expect(chainPort.markdown).not.toHaveBeenCalled();
  });

  it('сбой отправки расхода не роняет выдачу, но оставляет след в логе', async () => {
    const { service, chainPort, logger } = buildService(4, '1000.0000');
    (chainPort.markdown as jest.Mock).mockRejectedValueOnce(new Error('цепь недоступна'));

    // Выдача обязана закрыться: деньги пайщика важнее бухгалтерии остатка.
    await expect(issue(service, 4, '200.0000')).resolves.toBeDefined();
    // Молчаливой потери быть не должно — разница названа в предупреждении.
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('200.0000'));
  });
});
