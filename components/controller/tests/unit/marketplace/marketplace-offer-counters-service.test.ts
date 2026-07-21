/**
 * Unit-тесты MarketplaceOfferCountersService (Story 3.4).
 *
 * Тесты покрывают service-уровень (валидация qty + интерпретация
 * результата от репозитория + emit на bus). Атомарность SQL UPDATE
 * с CAS-условием — тестируется на интеграционном уровне (Эпик 4,
 * after merge #375 + testcontainers PG).
 *
 * Покрывают AC:
 *   - onOrderBlocked happy → возвращает обновлённый Offer + emit;
 *   - onOrderUnblocked happy;
 *   - onOrderConsumed happy;
 *   - onOrderAdjusted делегирует в unblock;
 *   - qty <= 0 → 400 BadRequest;
 *   - insufficient_available → 400 BadRequest;
 *   - insufficient_blocked → 400;
 *   - offer_not_active → 400;
 *   - offer_not_found → 404.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { MarketplaceOfferCountersService } from '~/extensions/marketplace/application/services/marketplace-offer-counters.service';
import { MarketplaceOfferDomainEntity } from '~/extensions/marketplace/domain/entities/marketplace-offer.entity';
import type { MarketplaceOfferDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-offer.repository';

function makeOffer(overrides: Partial<MarketplaceOfferDomainEntity> = {}): MarketplaceOfferDomainEntity {
  return new MarketplaceOfferDomainEntity({
    id: 'offer-1',
    coopname: 'voskhod',
    supplier_account: 'alice',
    vitrine_id: 'default',
    product_name: 'Картофель',
    description: null,
    category_id: 1,
    price_per_unit: '50.0000',
    unit_of_measure: 'kg',
    quantity_available: 90,
    quantity_blocked: 10,
    quantity_consumed: 0,
    unlimited_flag: false,
    delivery_points: [{ braname: 'krasnogorsk', min_supply_volume: 1 }],
    warranty_days: 0,
    barcode_strategy: 'PER_ORDER',
    pack_size: null,
    stock_braname: null,
    stock_origin_offer_id: null,
    images: [],
    status: 'ACTIVE',
    approved_by: 'chair',
    approved_at: new Date(),
    rejected_by: null,
    rejected_at: null,
    reject_reason: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });
}

function makeRepo(): jest.Mocked<MarketplaceOfferDomainRepository> {
  return {
    findById: jest.fn(),
    findByIds: jest.fn(),
    list: jest.fn(),
    countByCategory: jest.fn(),
    countRecentCreatedBy: jest.fn(),
    create: jest.fn(),
    applyUpdate: jest.fn(),
    applyBlockDelta: jest.fn(),
    applyUnblockDelta: jest.fn(),
    applyConsumeDelta: jest.fn(),
    applyRollbackDelta: jest.fn(),
  };
}

function makeBus(): EventEmitter2 {
  return { emit: jest.fn() } as unknown as EventEmitter2;
}

describe('MarketplaceOfferCountersService', () => {
  it('onOrderBlocked: happy → returns offer + emit changed', async () => {
    const repo = makeRepo();
    const bus = makeBus();
    repo.applyBlockDelta.mockResolvedValue({ ok: true, offer: makeOffer({ quantity_blocked: 15 }) });
    const service = new MarketplaceOfferCountersService(repo, bus);

    const result = await service.onOrderBlocked('offer-1', 5);
    expect(repo.applyBlockDelta).toHaveBeenCalledWith('offer-1', 5);
    expect(result.quantity_blocked).toBe(15);
    expect(bus.emit).toHaveBeenCalledWith(
      MarketplaceOfferCountersService.EVENT_CHANGED,
      expect.objectContaining({ offer_id: 'offer-1', op: 'block', qty: 5 })
    );
  });

  it('onOrderUnblocked: happy', async () => {
    const repo = makeRepo();
    repo.applyUnblockDelta.mockResolvedValue({
      ok: true,
      offer: makeOffer({ quantity_available: 95, quantity_blocked: 5 }),
    });
    const service = new MarketplaceOfferCountersService(repo, makeBus());

    const result = await service.onOrderUnblocked('offer-1', 5);
    expect(repo.applyUnblockDelta).toHaveBeenCalledWith('offer-1', 5);
    expect(result.quantity_available).toBe(95);
  });

  it('onOrderConsumed: happy', async () => {
    const repo = makeRepo();
    repo.applyConsumeDelta.mockResolvedValue({
      ok: true,
      offer: makeOffer({ quantity_blocked: 5, quantity_consumed: 5 }),
    });
    const service = new MarketplaceOfferCountersService(repo, makeBus());

    const result = await service.onOrderConsumed('offer-1', 5);
    expect(repo.applyConsumeDelta).toHaveBeenCalledWith('offer-1', 5);
    expect(result.quantity_consumed).toBe(5);
  });

  it('onOrderRolledBack (ADR-005 ForkRegistry handler) → applyRollbackDelta + emit op:rollback', async () => {
    const repo = makeRepo();
    const bus = makeBus();
    repo.applyRollbackDelta.mockResolvedValue({
      ok: true,
      offer: makeOffer({ quantity_available: 95, quantity_blocked: 5 }),
    });
    const service = new MarketplaceOfferCountersService(repo, bus);

    const result = await service.onOrderRolledBack('offer-1', 5);
    expect(repo.applyRollbackDelta).toHaveBeenCalledWith('offer-1', 5);
    expect(result.quantity_available).toBe(95);
    expect(bus.emit).toHaveBeenCalledWith(
      MarketplaceOfferCountersService.EVENT_CHANGED,
      expect.objectContaining({ op: 'rollback', qty: 5 })
    );
  });

  it('onOrderAdjusted делегирует в onOrderUnblocked', async () => {
    const repo = makeRepo();
    repo.applyUnblockDelta.mockResolvedValue({
      ok: true,
      offer: makeOffer({ quantity_available: 92, quantity_blocked: 8 }),
    });
    const service = new MarketplaceOfferCountersService(repo, makeBus());

    await service.onOrderAdjusted('offer-1', 2);
    expect(repo.applyUnblockDelta).toHaveBeenCalledWith('offer-1', 2);
  });

  it('qty <= 0 → 400 BadRequest', async () => {
    const repo = makeRepo();
    const service = new MarketplaceOfferCountersService(repo, makeBus());

    await expect(service.onOrderBlocked('offer-1', 0)).rejects.toThrow(BadRequestException);
    await expect(service.onOrderBlocked('offer-1', -1)).rejects.toThrow(BadRequestException);
    await expect(service.onOrderBlocked('offer-1', 1.5)).rejects.toThrow(BadRequestException);
    expect(repo.applyBlockDelta).not.toHaveBeenCalled();
  });

  it('insufficient_available → 400', async () => {
    const repo = makeRepo();
    repo.applyBlockDelta.mockResolvedValue({ ok: false, reason: 'insufficient_available' });
    const service = new MarketplaceOfferCountersService(repo, makeBus());

    await expect(service.onOrderBlocked('offer-1', 100)).rejects.toThrow(BadRequestException);
    await expect(service.onOrderBlocked('offer-1', 100)).rejects.toThrow(
      /Недостаточно свободного количества/
    );
  });

  it('insufficient_blocked → 400', async () => {
    const repo = makeRepo();
    repo.applyUnblockDelta.mockResolvedValue({ ok: false, reason: 'insufficient_blocked' });
    const service = new MarketplaceOfferCountersService(repo, makeBus());

    await expect(service.onOrderUnblocked('offer-1', 100)).rejects.toThrow(BadRequestException);
    await expect(service.onOrderUnblocked('offer-1', 100)).rejects.toThrow(
      /Недостаточно зарезервированного количества/
    );
  });

  it('offer_not_active → 400 (например, WITHDRAWN)', async () => {
    const repo = makeRepo();
    repo.applyBlockDelta.mockResolvedValue({ ok: false, reason: 'offer_not_active' });
    const service = new MarketplaceOfferCountersService(repo, makeBus());

    await expect(service.onOrderBlocked('offer-1', 5)).rejects.toThrow(BadRequestException);
    await expect(service.onOrderBlocked('offer-1', 5)).rejects.toThrow(/Предложение неактивно/);
  });

  it('offer_not_found → 404', async () => {
    const repo = makeRepo();
    repo.applyBlockDelta.mockResolvedValue({ ok: false, reason: 'offer_not_found' });
    const service = new MarketplaceOfferCountersService(repo, makeBus());

    await expect(service.onOrderBlocked('ghost', 5)).rejects.toThrow(NotFoundException);
  });

  it('emit не вызывается при ошибке', async () => {
    const repo = makeRepo();
    const bus = makeBus();
    repo.applyBlockDelta.mockResolvedValue({ ok: false, reason: 'insufficient_available' });
    const service = new MarketplaceOfferCountersService(repo, bus);

    await expect(service.onOrderBlocked('offer-1', 5)).rejects.toThrow();
    expect(bus.emit).not.toHaveBeenCalled();
  });
});

describe('MarketplaceOfferCountersService invariant (для не-unlimited Offer\'ов)', () => {
  // Service-уровневый smoke-тест: при последовательности block→unblock→consume
  // суммарное изменение available+blocked+consumed = 0 (см. mathematical
  // formula в JSDoc сервиса). Реальный invariant проверяется в SQL CAS
  // на интеграционном уровне.
  it('block 10 + unblock 3 + consume 7 → net 0 (math invariant)', async () => {
    const repo = makeRepo();
    repo.applyBlockDelta.mockResolvedValue({
      ok: true,
      offer: makeOffer({ quantity_available: 80, quantity_blocked: 20, quantity_consumed: 0 }),
    });
    repo.applyUnblockDelta.mockResolvedValue({
      ok: true,
      offer: makeOffer({ quantity_available: 83, quantity_blocked: 17, quantity_consumed: 0 }),
    });
    repo.applyConsumeDelta.mockResolvedValue({
      ok: true,
      offer: makeOffer({ quantity_available: 83, quantity_blocked: 10, quantity_consumed: 7 }),
    });
    const service = new MarketplaceOfferCountersService(repo, makeBus());

    const o1 = await service.onOrderBlocked('offer-1', 10);
    const o2 = await service.onOrderUnblocked('offer-1', 3);
    const o3 = await service.onOrderConsumed('offer-1', 7);

    // lifetime_published = 100 (initial available 90 + blocked 10 в моках).
    expect(o1.quantity_available + o1.quantity_blocked + o1.quantity_consumed).toBe(100);
    expect(o2.quantity_available + o2.quantity_blocked + o2.quantity_consumed).toBe(100);
    expect(o3.quantity_available + o3.quantity_blocked + o3.quantity_consumed).toBe(100);
  });
});
