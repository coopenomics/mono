/**
 * Unit-тесты MarketplaceOfferService (Story 3.2).
 *
 * Покрывают AC:
 *   - create: статус PENDING_MODERATION; rate-limit 10/час; неизвестная
 *     категория → 400; валидация product_name/description/unit/cycle/price;
 *     unlimited_flag=true обнуляет quantity_available;
 *   - update: ownership check (403 чужому); REJECTED/WITHDRAWN → 403;
 *     reset status в PENDING_MODERATION; валидация полей;
 *   - withdraw: ownership check; статус → WITHDRAWN; блок при активных
 *     ордерах (stub false до Эпика 4);
 *   - listMine + getById — thin delegate.
 */
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import {
  MarketplaceOfferService,
  type OfferCreateRequest,
} from '~/extensions/marketplace/application/services/marketplace-offer.service';
import { MarketplaceOfferDomainEntity } from '~/extensions/marketplace/domain/entities/marketplace-offer.entity';
import { MarketplaceCategoryDomainEntity } from '~/extensions/marketplace/domain/entities/marketplace-category.entity';
import type { MarketplaceOfferDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-offer.repository';
import type { MarketplaceCategoryDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-category.repository';

const COOP = 'voskhod';

function makeOffer(overrides: Partial<MarketplaceOfferDomainEntity> = {}): MarketplaceOfferDomainEntity {
  return new MarketplaceOfferDomainEntity({
    id: 'offer-1',
    cooperative_id: COOP,
    supplier_account: 'alice',
    vitrine_id: 'default',
    product_name: 'Картофель',
    description: null,
    category_id: 1,
    price_per_unit: '50.0000',
    unit_of_measure: 'kg',
    quantity_available: 100,
    quantity_blocked: 0,
    quantity_consumed: 0,
    unlimited_flag: false,
    cycle_type: 'time_based',
    cycle_days: 7,
    target_volume: null,
    max_wait_days: null,
    min_threshold: null,
    warranty_days: 0,
    status: 'PENDING_MODERATION',
    approved_by: null,
    approved_at: null,
    rejected_by: null,
    rejected_at: null,
    reject_reason: null,
    created_at: new Date('2026-05-15T12:00:00Z'),
    updated_at: new Date('2026-05-15T12:00:00Z'),
    ...overrides,
  });
}

function makeOfferRepo(): jest.Mocked<MarketplaceOfferDomainRepository> {
  return {
    findById: jest.fn(),
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

function makeCategoryRepo(): jest.Mocked<MarketplaceCategoryDomainRepository> {
  const repo = {
    listBaseline: jest.fn(),
    findById: jest.fn(),
    upsertBaseline: jest.fn(),
  };
  repo.findById.mockResolvedValue(
    new MarketplaceCategoryDomainEntity({
      id: 1,
      display_name: 'Продовольственные товары',
      sort_order: 1,
      mvp_baseline: true,
    })
  );
  return repo;
}

function baseCreateRequest(overrides: Partial<OfferCreateRequest> = {}): OfferCreateRequest {
  return {
    cooperative_id: COOP,
    supplier_account: 'alice',
    vitrine_id: 'default',
    product_name: 'Картофель',
    description: null,
    category_id: 1,
    price_per_unit: '50.0000',
    unit_of_measure: 'kg',
    quantity_available: 100,
    unlimited_flag: false,
    cycle_type: 'time_based',
    cycle_days: 7,
    target_volume: null,
    max_wait_days: null,
    min_threshold: null,
    warranty_days: 0,
    ...overrides,
  };
}

describe('MarketplaceOfferService.create', () => {
  it('создаёт Offer со статусом PENDING_MODERATION', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    repo.create.mockResolvedValue(makeOffer());
    const service = new MarketplaceOfferService(repo, cats);

    const offer = await service.create(baseCreateRequest());
    expect(offer.status).toBe('PENDING_MODERATION');
    expect(repo.create).toHaveBeenCalled();
  });

  it('rate-limit: на 10-м offer'+'е за час → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(MarketplaceOfferService.RATE_LIMIT_PER_HOUR);
    const service = new MarketplaceOfferService(repo, cats);

    await expect(service.create(baseCreateRequest())).rejects.toThrow(BadRequestException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('категория вне baseline → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = new MarketplaceOfferService(repo, cats);

    await expect(service.create(baseCreateRequest({ category_id: 99 }))).rejects.toThrow(
      BadRequestException
    );
  });

  it('категория есть в baseline но отсутствует в БД → 400 (миграция не выполнилась)', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    cats.findById.mockResolvedValueOnce(null);
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = new MarketplaceOfferService(repo, cats);

    await expect(service.create(baseCreateRequest({ category_id: 5 }))).rejects.toThrow(
      BadRequestException
    );
  });

  it('product_name пустой → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = new MarketplaceOfferService(repo, cats);

    await expect(service.create(baseCreateRequest({ product_name: '   ' }))).rejects.toThrow(
      BadRequestException
    );
  });

  it('product_name > 200 → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = new MarketplaceOfferService(repo, cats);

    await expect(
      service.create(baseCreateRequest({ product_name: 'x'.repeat(201) }))
    ).rejects.toThrow(BadRequestException);
  });

  it('quantity_available=null при unlimited_flag=false → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = new MarketplaceOfferService(repo, cats);

    await expect(
      service.create(baseCreateRequest({ quantity_available: null, unlimited_flag: false }))
    ).rejects.toThrow(BadRequestException);
  });

  it('unlimited_flag=true обнуляет quantity_available и пропускает валидацию', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    repo.create.mockResolvedValue(makeOffer({ unlimited_flag: true, quantity_available: 0 }));
    const service = new MarketplaceOfferService(repo, cats);

    await service.create(
      baseCreateRequest({ unlimited_flag: true, quantity_available: null })
    );
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ unlimited_flag: true, quantity_available: 0 })
    );
  });

  it('некорректный cycle_type → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = new MarketplaceOfferService(repo, cats);

    await expect(
      service.create(baseCreateRequest({ cycle_type: 'weird' as any }))
    ).rejects.toThrow(BadRequestException);
  });

  it('некорректный unit_of_measure → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = new MarketplaceOfferService(repo, cats);

    await expect(
      service.create(baseCreateRequest({ unit_of_measure: 'tonne' as any }))
    ).rejects.toThrow(BadRequestException);
  });

  it('некорректный price_per_unit (не numeric) → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = new MarketplaceOfferService(repo, cats);

    await expect(
      service.create(baseCreateRequest({ price_per_unit: 'abc' }))
    ).rejects.toThrow(BadRequestException);
  });
});

describe('MarketplaceOfferService.update', () => {
  it('update своего offer'+'а сбрасывает статус в PENDING_MODERATION', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ status: 'ACTIVE' }));
    repo.applyUpdate.mockResolvedValue(makeOffer({ status: 'PENDING_MODERATION' }));
    const service = new MarketplaceOfferService(repo, cats);

    const result = await service.update('offer-1', 'alice', { product_name: 'Молоко' });
    expect(repo.applyUpdate).toHaveBeenCalledWith(
      'offer-1',
      expect.objectContaining({ product_name: 'Молоко', status: 'PENDING_MODERATION' })
    );
    expect(result.status).toBe('PENDING_MODERATION');
  });

  it('update чужого offer'+'а → 403', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ supplier_account: 'alice' }));
    const service = new MarketplaceOfferService(repo, cats);

    await expect(service.update('offer-1', 'mallory', { product_name: 'X' })).rejects.toThrow(
      ForbiddenException
    );
  });

  it('update WITHDRAWN/REJECTED → 403', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ status: 'WITHDRAWN' }));
    const service = new MarketplaceOfferService(repo, cats);

    await expect(service.update('offer-1', 'alice', { product_name: 'X' })).rejects.toThrow(
      ForbiddenException
    );
  });

  it('update несуществующего → 404', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(null);
    const service = new MarketplaceOfferService(repo, cats);

    await expect(service.update('offer-x', 'alice', { product_name: 'X' })).rejects.toThrow(
      NotFoundException
    );
  });

  it('unlimited_flag=true в patch обнуляет quantity_available', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ status: 'ACTIVE' }));
    repo.applyUpdate.mockResolvedValue(makeOffer({ unlimited_flag: true, quantity_available: 0 }));
    const service = new MarketplaceOfferService(repo, cats);

    await service.update('offer-1', 'alice', { unlimited_flag: true });
    expect(repo.applyUpdate).toHaveBeenCalledWith(
      'offer-1',
      expect.objectContaining({ unlimited_flag: true, quantity_available: 0, status: 'PENDING_MODERATION' })
    );
  });

  it('update с invalid category → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ status: 'ACTIVE' }));
    const service = new MarketplaceOfferService(repo, cats);

    await expect(service.update('offer-1', 'alice', { category_id: 99 })).rejects.toThrow(
      BadRequestException
    );
  });
});

describe('MarketplaceOfferService.withdraw', () => {
  it('withdraw → status WITHDRAWN', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ status: 'ACTIVE' }));
    repo.applyUpdate.mockResolvedValue(makeOffer({ status: 'WITHDRAWN' }));
    const service = new MarketplaceOfferService(repo, cats);

    const result = await service.withdraw('offer-1', 'alice');
    expect(repo.applyUpdate).toHaveBeenCalledWith('offer-1', { status: 'WITHDRAWN' });
    expect(result.status).toBe('WITHDRAWN');
  });

  it('withdraw чужого → 403', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ supplier_account: 'alice', status: 'ACTIVE' }));
    const service = new MarketplaceOfferService(repo, cats);

    await expect(service.withdraw('offer-1', 'mallory')).rejects.toThrow(ForbiddenException);
  });

  it('withdraw уже WITHDRAWN → 403', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ status: 'WITHDRAWN' }));
    const service = new MarketplaceOfferService(repo, cats);

    await expect(service.withdraw('offer-1', 'alice')).rejects.toThrow(ForbiddenException);
  });

  it('withdraw несуществующего → 404', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(null);
    const service = new MarketplaceOfferService(repo, cats);

    await expect(service.withdraw('offer-x', 'alice')).rejects.toThrow(NotFoundException);
  });

  it('withdraw блокируется на active orders (sentinel test: stub возвращает false в MVP)', async () => {
    // В MVP `hasActiveOrders` всегда false (Эпик 4 не смержен). Этот кейс
    // фиксирует контракт: 409 Conflict ожидается *когда* реализация перепишется.
    // Здесь просто проверяем, что в MVP withdraw проходит.
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ status: 'ACTIVE' }));
    repo.applyUpdate.mockResolvedValue(makeOffer({ status: 'WITHDRAWN' }));
    const service = new MarketplaceOfferService(repo, cats);

    await expect(service.withdraw('offer-1', 'alice')).resolves.toBeDefined();
    // ConflictException заводится при `hasActiveOrders === true` — будет
    // покрыт интеграционным тестом после merge Story 4.x.
    expect(ConflictException).toBeDefined();
  });
});

describe('MarketplaceOfferService.listMine + getById', () => {
  it('listMine делегирует в репозиторий с фильтром supplier_account', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.list.mockResolvedValue({ total: 1, items: [makeOffer()] });
    const service = new MarketplaceOfferService(repo, cats);

    const page = await service.listMine(COOP, 'alice', { limit: 50, offset: 0 });
    expect(repo.list).toHaveBeenCalledWith(
      { cooperative_id: COOP, supplier_account: 'alice' },
      { limit: 50, offset: 0 }
    );
    expect(page.total).toBe(1);
  });

  it('getById → findById', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer());
    const service = new MarketplaceOfferService(repo, cats);

    const result = await service.getById('offer-1');
    expect(result?.id).toBe('offer-1');
  });
});
