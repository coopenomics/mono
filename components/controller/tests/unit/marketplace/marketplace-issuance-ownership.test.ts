/**
 * Принадлежность заказа при закрытии выдачи.
 *
 * У стойки выдачи оператор проверяет код получателя, но интерфейс — это
 * подсказка, а не правило: код можно назвать чужой, показать чужой телефон,
 * ошибиться строкой в списке. Правило живёт на сервере и звучит так:
 * закрывающую подпись акта выдачи несёт ключ ЗАКАЗЧИКА-ВЛАДЕЛЬЦА заказа.
 * Чужая подпись — отказ, независимо от того, что ввёл оператор.
 *
 * Проверяется именно подпись, а не JWT отправителя: акт подписывает пайщик
 * своим ключом на своём устройстве, а отправляет запрос оператор.
 */
import { ForbiddenException } from '@nestjs/common';
import { MarketplaceIssuanceService } from '~/extensions/marketplace/application/services/marketplace-issuance.service';
import type { MarketplaceOrderDomainEntity } from '~/extensions/marketplace/domain/entities/marketplace-order.entity';
import type { MarketplaceOrderDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-order.repository';
import type { MarketplaceInventoryDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-inventory.repository';
import type { MarketplaceOfferDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-offer.repository';
import type { MarketplaceCanonicalBlockchainPort } from '~/extensions/marketplace/domain/ports/marketplace-canonical-blockchain.port';
import type { MarketplaceAssetConfig } from '~/extensions/marketplace/application/services/marketplace-asset.config';

const COOP = 'voskhod';
/** Владелец заказа: только его ключ вправе закрыть выдачу. */
const OWNER = 'ekaterina';
/** Другой пайщик того же кооператива — посторонний этому заказу. */
const STRANGER = 'orderer2';

function buildOrder(): MarketplaceOrderDomainEntity {
  return {
    id: 'order-1',
    coopname: COOP,
    order_hash: 'h-order-1',
    orderer_account: OWNER,
    offer_id: 'offer-1',
    supplier_account: 'supplier1',
    delivery_braname: 'krg',
    quantity: 10,
    unit_of_measure: 'piece',
    package_size: 0,
    price_per_unit: '250.0000',
    total_cost: '2500.0000',
    // Заказ готов к получению и ещё не закрыт: проверки статуса и повторной
    // подписи стоят ПОСЛЕ проверки принадлежности, и если бы они падали
    // раньше, тест проходил бы «ни о чём».
    status: 'READY_TO_RECEIVE',
    chairman_account: 'chairkrg',
    orderer_signed_at: null,
    warranty_period_secs: 0,
    issuance_fact: {
      actual_quantity: 10,
      fact_unit_price: '250.0000',
      fact_cost: '2500.0000',
      diff_state: 'equal',
    },
  } as unknown as MarketplaceOrderDomainEntity;
}

function buildService() {
  const order = buildOrder();

  const orderRepo = {
    findById: jest.fn().mockResolvedValue(order),
    applyIssuanceFinalized: jest.fn().mockResolvedValue(order),
  } as unknown as jest.Mocked<MarketplaceOrderDomainRepository>;

  const inventoryRepo = {
    sumReservedByOrders: jest
      .fn()
      .mockImplementation(async (_coopname: string, ids: string[]) => new Map(ids.map((id) => [id, 10]))),
    finalizeReservedIssue: jest.fn().mockResolvedValue({ released: 0, issued_arrival_cost: '2500.0000' }),
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

  // Криптопроверка подписи и разбор ответа цепи проверяются отдельно: здесь
  // важно, ЧЬЯ подпись стоит в акте, а не насколько она валидна.
  jest
    .spyOn(service as never as { verifyDocumentSignature: () => void }, 'verifyDocumentSignature')
    .mockImplementation(() => undefined);
  jest
    .spyOn(service as never as { extractTxHash: () => string }, 'extractTxHash')
    .mockReturnValue('tx-2');

  return { service, chainPort };
}

/** Закрытие выдачи актом, подписанным перечисленными пайщиками. */
async function finalize(service: MarketplaceIssuanceService, signers: string[]) {
  return service.finalizeIssuance({
    coopname: COOP,
    orderer_account: OWNER,
    order_id: 'order-1',
    signed_document: { signatures: signers.map((signer) => ({ signer })) } as any,
  } as never);
}

describe('Выдача: закрыть заказ вправе только его владелец', () => {
  it('акт подписан другим пайщиком — отказ, на цепь ничего не уходит', async () => {
    const { service, chainPort } = buildService();

    await expect(finalize(service, [STRANGER])).rejects.toBeInstanceOf(ForbiddenException);
    // Главное последствие: чужая подпись не должна двигать деньги и имущество.
    expect(chainPort.signIss2).not.toHaveBeenCalled();
  });

  it('подписей нет вовсе — отказ', async () => {
    const { service, chainPort } = buildService();

    await expect(finalize(service, [])).rejects.toBeInstanceOf(ForbiddenException);
    expect(chainPort.signIss2).not.toHaveBeenCalled();
  });

  it('акт подписан владельцем — выдача закрывается', async () => {
    const { service, chainPort } = buildService();

    await expect(finalize(service, [OWNER])).resolves.toBeDefined();
    expect(chainPort.signIss2).toHaveBeenCalledWith(
      expect.objectContaining({ coopname: COOP, orderer: OWNER })
    );
  });

  it('подпись владельца рядом с чужой принимается — акт может нести несколько подписей', async () => {
    // Оператор кооператива тоже подписывает акт; наличие его подписи не должно
    // ни отменять требование подписи владельца, ни мешать ему.
    const { service, chainPort } = buildService();

    await expect(finalize(service, ['chairkrg', OWNER])).resolves.toBeDefined();
    expect(chainPort.signIss2).toHaveBeenCalled();
  });
});
