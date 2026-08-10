/**
 * Расхождения количества и цены на выдаче — денежная сторона.
 *
 * Заказ и факт расходятся тремя способами, и они комбинируются:
 *  - недоприём: поставщик привёз меньше заказанного, на складе меньше заказа;
 *  - недовыдача: заказчик забрал меньше принятого;
 *  - корректировка цены: имущество приняли/выдали по другой цене.
 *
 * Гарды количества уже проверены в `marketplace-issuance.service.spec.ts`
 * (выдать больше принятого нельзя). Здесь проверяется то, что считается
 * деньгами: снапшот факта — количество, цена, стоимость и признак расхождения
 * `diff_state`. Именно `diff_state` определяет ветку возврата или доплаты при
 * закрытии выдачи, поэтому ошибка в нём — это ошибка в деньгах пайщика.
 *
 * Ключевой случай — взаимная компенсация: выдали меньше, но дороже, и
 * стоимость совпала с заказом. Расхождение по количеству при этом есть, а
 * доплачивать или возвращать нечего.
 */
import { MarketplaceIssuanceService } from '~/extensions/marketplace/application/services/marketplace-issuance.service';
import type { MarketplaceOrderDomainEntity } from '~/extensions/marketplace/domain/entities/marketplace-order.entity';
import type { MarketplaceOrderDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-order.repository';
import type { MarketplaceInventoryDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-inventory.repository';
import type { MarketplaceOfferDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-offer.repository';
import type { MarketplaceCanonicalBlockchainPort } from '~/extensions/marketplace/domain/ports/marketplace-canonical-blockchain.port';
import type { MarketplaceAssetConfig } from '~/extensions/marketplace/application/services/marketplace-asset.config';

const COOP = 'voskhod';

/** Заказ: 10 единиц по 100 ₽ на 1000 ₽. Все расхождения считаются от него. */
function buildOrder(
  overrides: Partial<MarketplaceOrderDomainEntity> = {}
): MarketplaceOrderDomainEntity {
  return {
    id: 'order-1',
    coopname: COOP,
    order_hash: 'h-order-1',
    orderer_account: 'orderer1',
    offer_id: 'offer-1',
    supplier_account: 'supplier1',
    delivery_braname: 'kubra',
    quantity: 10,
    unit_of_measure: 'piece',
    package_size: 0,
    price_per_unit: '100.0000',
    total_cost: '1000.0000',
    status: 'ACCEPTED_TO_COOP',
    ready_announced_at: null,
    chairman_signed_at: null,
    warranty_period_secs: 0,
    ...overrides,
  } as MarketplaceOrderDomainEntity;
}

/**
 * `accepted` — сколько физически принято на склад по заказу. Недоприём
 * задаётся именно им: заказ остаётся на 10, а на складе, скажем, 9.
 */
function buildService(accepted: number, orderOverrides: Partial<MarketplaceOrderDomainEntity> = {}) {
  const orderRepo = {
    findById: jest.fn().mockImplementation(async (id: string) => buildOrder({ id, ...orderOverrides })),
    applyIssuanceOpened: jest.fn().mockImplementation(async (id: string) => buildOrder({ id })),
  } as unknown as jest.Mocked<MarketplaceOrderDomainRepository>;

  const inventoryRepo = {
    sumOnWarehouseByOrders: jest
      .fn()
      .mockImplementation(async (_coopname: string, ids: string[]) => new Map(ids.map((id) => [id, accepted]))),
  } as unknown as jest.Mocked<MarketplaceInventoryDomainRepository>;

  const offerRepo = {
    findById: jest.fn().mockResolvedValue(null),
  } as unknown as jest.Mocked<MarketplaceOfferDomainRepository>;

  const chainPort = {
    signIss1: jest.fn().mockResolvedValue({ transaction: { id: 'tx-1' } }),
  } as unknown as jest.Mocked<MarketplaceCanonicalBlockchainPort>;

  const assetConfig: MarketplaceAssetConfig = { symbol: 'RUB', decimals: 4 };

  const documentDomainService = {
    generateDocument: jest.fn().mockResolvedValue({ hash: 'doc-hash' }),
    buildDocumentAggregate: jest.fn(),
  } as any;

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
    documentDomainService,
    { emit: jest.fn() } as any,
    logger
  );

  return { service, orderRepo };
}

/**
 * Подпись документа проверяется отдельно и здесь не участвует: подсовываем
 * акт с пустым списком подписей и глушим проверку, иначе к арифметике факта
 * не добраться.
 */
const signedActStub = { signatures: [] } as any;

function stubSignatureCheck(service: MarketplaceIssuanceService) {
  jest.spyOn(service as never as { verifyDocumentSignature: () => void }, 'verifyDocumentSignature')
    .mockImplementation(() => undefined);
  // Сериализация акта в формат контракта требует настоящего документа —
  // подменяем весь вызов цепи, факт от него не зависит.
  jest.spyOn(service as never as { extractTxHash: () => string }, 'extractTxHash')
    .mockReturnValue('tx-1');
}

async function openWith(
  accepted: number,
  actual_quantity: number,
  actual_unit_price: string,
  orderOverrides: Partial<MarketplaceOrderDomainEntity> = {}
) {
  const { service, orderRepo } = buildService(accepted, orderOverrides);
  stubSignatureCheck(service);
  await service.openIssuance({
    coopname: COOP,
    order_id: 'order-1',
    chairman_account: 'chairman1',
    actual_quantity,
    actual_unit_price,
    signed_document: signedActStub,
  } as never);
  const [, patch] = (orderRepo.applyIssuanceOpened as jest.Mock).mock.calls[0];
  return patch.issuance_fact as {
    actual_quantity: number;
    fact_unit_price: string;
    fact_cost: string;
    diff_state: string;
  };
}

describe('Расхождения на выдаче: количество и цена по отдельности', () => {
  it('выдано ровно заказанное по цене заказа → расхождения нет', async () => {
    const fact = await openWith(10, 10, '100.0000');

    expect(fact.fact_cost).toBe('1000.0000');
    expect(fact.diff_state).toBe('equal');
  });

  it('недовыдача: принято 10, выдано 9 → стоимость меньше заказа', async () => {
    const fact = await openWith(10, 9, '100.0000');

    expect(fact.actual_quantity).toBe(9);
    expect(fact.fact_cost).toBe('900.0000');
    expect(fact.diff_state).toBe('less');
  });

  it('недоприём: принято 9 из 10 — выдать можно только принятое', async () => {
    const fact = await openWith(9, 9, '100.0000');

    expect(fact.fact_cost).toBe('900.0000');
    expect(fact.diff_state).toBe('less');
  });

  it('цена снижена при том же количестве → стоимость меньше заказа', async () => {
    const fact = await openWith(10, 10, '90.0000');

    expect(fact.fact_unit_price).toBe('90.0000');
    expect(fact.fact_cost).toBe('900.0000');
    expect(fact.diff_state).toBe('less');
  });

  it('цена повышена при том же количестве → стоимость больше заказа', async () => {
    const fact = await openWith(10, 10, '110.0000');

    expect(fact.fact_cost).toBe('1100.0000');
    expect(fact.diff_state).toBe('more');
  });
});

describe('Расхождения на выдаче: количество и цена одновременно', () => {
  it('недовыдача и снижение цены складываются в одну сторону', async () => {
    const fact = await openWith(10, 9, '90.0000');

    expect(fact.fact_cost).toBe('810.0000');
    expect(fact.diff_state).toBe('less');
  });

  it('недоприём и снижение цены: считается от принятого, не от заказа', async () => {
    const fact = await openWith(9, 9, '90.0000');

    expect(fact.actual_quantity).toBe(9);
    expect(fact.fact_cost).toBe('810.0000');
    expect(fact.diff_state).toBe('less');
  });

  it('выдано меньше, но дороже — стоимость всё ещё ниже заказа', async () => {
    const fact = await openWith(10, 9, '105.0000');

    expect(fact.fact_cost).toBe('945.0000');
    expect(fact.diff_state).toBe('less');
  });

  it('взаимная компенсация: 9 по 111,1111 ₽ — расхождение по количеству есть, по деньгам нет', async () => {
    // 9 × 111,1111 = 999,9999 — до стоимости заказа не хватает одной сотой
    // копейки, и это «меньше», а не «поровну»: сравнение идёт по стоимости с
    // точностью символа, без округления в пользу равенства.
    const almost = await openWith(10, 9, '111.1111');
    expect(almost.fact_cost).toBe('999.9999');
    expect(almost.diff_state).toBe('less');

    // Ровная компенсация: 8 по 125 ₽ = 1000 ₽ — количество разошлось, деньги
    // сошлись, и ни возврата, ни доплаты быть не должно.
    const exact = await openWith(10, 8, '125.0000');
    expect(exact.actual_quantity).toBe(8);
    expect(exact.fact_cost).toBe('1000.0000');
    expect(exact.diff_state).toBe('equal');
  });
});

describe('Отпуск упаковкой: цена относится к упаковке, а не к содержимому', () => {
  // Эпик 18: `actual_quantity` идёт в базовой единице (килограммах), а цена —
  // за упаковку. Умножение цены на базовое количество занижало бы сумму в
  // разы, поэтому стоимость считается от числа упаковок.
  const packageOrder = {
    unit_of_measure: 'kg',
    package_size: 0.5,
    quantity: 5,
    price_per_unit: '100.0000',
    total_cost: '1000.0000',
  } as Partial<MarketplaceOrderDomainEntity>;

  it('недовыдача упаковками: 4 упаковки вместо 10 → 400 ₽', async () => {
    const fact = await openWith(5, 2, '100.0000', packageOrder);

    expect(fact.fact_cost).toBe('400.0000');
    expect(fact.diff_state).toBe('less');
  });
});
