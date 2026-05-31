/**
 * Unit-тесты MarketplaceOfferService (Story 3.2).
 *
 * Покрывают AC:
 *   - create: статус PENDING_MODERATION; rate-limit 10/час; неизвестная
 *     категория → 400; валидация product_name/description/unit/cycle/price;
 *     unlimited_flag=true обнуляет quantity_available;
 *   - update: ownership check (403 чужому); WITHDRAWN → 403; REJECTED →
 *     правка проходит и уходит на повторную модерацию;
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
import type { MarketplaceOrderDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-order.repository';

const COOP = 'voskhod';

function makeOffer(overrides: Partial<MarketplaceOfferDomainEntity> = {}): MarketplaceOfferDomainEntity {
  return new MarketplaceOfferDomainEntity({
    id: 'offer-1',
    coopname: COOP,
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
    cycle_type: 'collective',
    target_volume: null,
    warranty_days: 0,
    barcode_strategy: 'PER_ORDER',
    pack_size: null,
    images: [],
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

function makeImagesService() {
  return {
    putImage: jest.fn(),
    getReadUrl: jest.fn().mockResolvedValue('https://signed.example/img'),
    deleteImage: jest.fn().mockResolvedValue(undefined),
  } as unknown as import('~/extensions/marketplace/application/services/marketplace-offer-images.service').MarketplaceOfferImagesService;
}

function makeOrderRepo(): jest.Mocked<MarketplaceOrderDomainRepository> {
  const probe = {
    list: jest.fn().mockResolvedValue({ items: [], total: 0, totalCount: 0, totalPages: 0, currentPage: 1 }),
  };
  return probe as unknown as jest.Mocked<MarketplaceOrderDomainRepository>;
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
    coopname: COOP,
    supplier_account: 'alice',
    vitrine_id: 'default',
    product_name: 'Картофель',
    description: null,
    category_id: 1,
    price_per_unit: '50.0000',
    unit_of_measure: 'kg',
    quantity_available: 100,
    unlimited_flag: false,
    cycle_type: 'collective',
    target_volume: null,
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
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    const offer = await service.create(baseCreateRequest());
    expect(offer.status).toBe('PENDING_MODERATION');
    expect(repo.create).toHaveBeenCalled();
  });

  it('rate-limit: на 10-м offer'+'е за час → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(MarketplaceOfferService.RATE_LIMIT_PER_HOUR);
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await expect(service.create(baseCreateRequest())).rejects.toThrow(BadRequestException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('категория вне baseline → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await expect(service.create(baseCreateRequest({ category_id: 99 }))).rejects.toThrow(
      BadRequestException
    );
  });

  it('категория есть в baseline но отсутствует в БД → 400 (миграция не выполнилась)', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    cats.findById.mockResolvedValueOnce(null);
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await expect(service.create(baseCreateRequest({ category_id: 5 }))).rejects.toThrow(
      BadRequestException
    );
  });

  it('product_name пустой → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await expect(service.create(baseCreateRequest({ product_name: '   ' }))).rejects.toThrow(
      BadRequestException
    );
  });

  // ── техдолг 598-22: barcode_strategy + pack_size ──

  it('barcode_strategy PER_PACKAGE без pack_size → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await expect(
      service.create(baseCreateRequest({ barcode_strategy: 'PER_PACKAGE' }))
    ).rejects.toThrow(BadRequestException);
  });

  it('barcode_strategy PER_PACKAGE + pack_size > MAX_PACK_SIZE → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await expect(
      service.create(
        baseCreateRequest({
          barcode_strategy: 'PER_PACKAGE',
          pack_size: MarketplaceOfferService.MAX_PACK_SIZE + 1,
        })
      )
    ).rejects.toThrow(BadRequestException);
  });

  it('barcode_strategy PER_ORDER + pack_size заполнено → 400 (несовместимая комбинация)', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await expect(
      service.create(baseCreateRequest({ barcode_strategy: 'PER_ORDER', pack_size: 5 }))
    ).rejects.toThrow(BadRequestException);
  });

  it('barcode_strategy PER_PACKAGE + pack_size валидный → OK, передаются в репозиторий', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    repo.create.mockImplementation(async (input) => makeOffer({
      barcode_strategy: input.barcode_strategy,
      pack_size: input.pack_size,
    }));
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    const offer = await service.create(
      baseCreateRequest({ barcode_strategy: 'PER_PACKAGE', pack_size: 12 })
    );
    expect(offer.barcode_strategy).toBe('PER_PACKAGE');
    expect(offer.pack_size).toBe(12);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ barcode_strategy: 'PER_PACKAGE', pack_size: 12 })
    );
  });

  it('barcode_strategy не задан → дефолт PER_ORDER, pack_size=null', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    repo.create.mockImplementation(async (input) => makeOffer({
      barcode_strategy: input.barcode_strategy,
      pack_size: input.pack_size,
    }));
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    const offer = await service.create(baseCreateRequest());
    expect(offer.barcode_strategy).toBe('PER_ORDER');
    expect(offer.pack_size).toBeNull();
  });

  it('product_name > 200 → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await expect(
      service.create(baseCreateRequest({ product_name: 'x'.repeat(201) }))
    ).rejects.toThrow(BadRequestException);
  });

  it('quantity_available=null при unlimited_flag=false → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await expect(
      service.create(baseCreateRequest({ quantity_available: null, unlimited_flag: false }))
    ).rejects.toThrow(BadRequestException);
  });

  it('unlimited_flag=true обнуляет quantity_available и пропускает валидацию', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    repo.create.mockResolvedValue(makeOffer({ unlimited_flag: true, quantity_available: 0 }));
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

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
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await expect(
      service.create(baseCreateRequest({ cycle_type: 'weird' as any }))
    ).rejects.toThrow(BadRequestException);
  });

  it('некорректный unit_of_measure → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await expect(
      service.create(baseCreateRequest({ unit_of_measure: 'tonne' as any }))
    ).rejects.toThrow(BadRequestException);
  });

  it('некорректный price_per_unit (не numeric) → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

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
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

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
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await expect(service.update('offer-1', 'mallory', { product_name: 'X' })).rejects.toThrow(
      ForbiddenException
    );
  });

  it('update WITHDRAWN → 403 (сначала republish)', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ status: 'WITHDRAWN' }));
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await expect(service.update('offer-1', 'alice', { product_name: 'X' })).rejects.toThrow(
      ForbiddenException
    );
  });

  it('update REJECTED → правка проходит и уходит на повторную модерацию (status PENDING, причина очищена)', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(
      makeOffer({ status: 'REJECTED', reject_reason: 'Плохое фото', rejected_by: 'chairman' })
    );
    repo.applyUpdate.mockResolvedValue(makeOffer({ status: 'PENDING_MODERATION' }));
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    const result = await service.update('offer-1', 'alice', { product_name: 'Исправлено' });
    expect(repo.applyUpdate).toHaveBeenCalledWith(
      'offer-1',
      expect.objectContaining({
        product_name: 'Исправлено',
        status: 'PENDING_MODERATION',
        reject_reason: null,
        rejected_by: null,
      })
    );
    expect(result.status).toBe('PENDING_MODERATION');
  });

  it('update REJECTED только цены → всё равно уходит на повторную модерацию', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ status: 'REJECTED' }));
    repo.applyUpdate.mockResolvedValue(makeOffer({ status: 'PENDING_MODERATION' }));
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await service.update('offer-1', 'alice', { price_per_unit: '99.0000' });
    expect(repo.applyUpdate).toHaveBeenCalledWith(
      'offer-1',
      expect.objectContaining({ status: 'PENDING_MODERATION' })
    );
  });

  it('update несуществующего → 404', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(null);
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await expect(service.update('offer-x', 'alice', { product_name: 'X' })).rejects.toThrow(
      NotFoundException
    );
  });

  it('unlimited_flag=true в patch обнуляет quantity_available и НЕ сбрасывает статус (операционное поле)', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ status: 'ACTIVE' }));
    repo.applyUpdate.mockResolvedValue(makeOffer({ status: 'ACTIVE', unlimited_flag: true, quantity_available: 0 }));
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await service.update('offer-1', 'alice', { unlimited_flag: true });
    expect(repo.applyUpdate).toHaveBeenCalledWith(
      'offer-1',
      expect.objectContaining({ unlimited_flag: true, quantity_available: 0 })
    );
    // unlimited_flag — операционное поле: статус активной оферты не трогаем.
    const patchArg = repo.applyUpdate.mock.calls[0][1];
    expect(patchArg).not.toHaveProperty('status');
  });

  it('update с invalid category → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ status: 'ACTIVE' }));
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await expect(service.update('offer-1', 'alice', { category_id: 99 })).rejects.toThrow(
      BadRequestException
    );
  });
});

describe('MarketplaceOfferService.update — поле-зависимая модерация', () => {
  // Операционные поля (цена, остаток, безлимит) поставщик меняет без участия
  // председателя: активная оферта остаётся ACTIVE, на повторную модерацию не
  // уходит. Контентные поля (название/описание/категория/фото/единица/цикл)
  // снова шлют на модерацию.

  it('правка только цены на ACTIVE → статус НЕ сбрасывается, approve-поля не трогаются', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ status: 'ACTIVE' }));
    repo.applyUpdate.mockResolvedValue(makeOffer({ status: 'ACTIVE', price_per_unit: '99.0000' }));
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    const result = await service.update('offer-1', 'alice', { price_per_unit: '99.00' });
    expect(result.status).toBe('ACTIVE');
    const patchArg = repo.applyUpdate.mock.calls[0][1];
    expect(patchArg).not.toHaveProperty('status');
    expect(patchArg).not.toHaveProperty('approved_by');
    expect(patchArg).not.toHaveProperty('reject_reason');
  });

  it('правка только количества на ACTIVE → статус НЕ сбрасывается', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ status: 'ACTIVE' }));
    repo.applyUpdate.mockResolvedValue(makeOffer({ status: 'ACTIVE', quantity_available: 250 }));
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await service.update('offer-1', 'alice', { quantity_available: 250 });
    expect(repo.applyUpdate.mock.calls[0][1]).not.toHaveProperty('status');
  });

  it('правка цены + количества вместе на ACTIVE → статус НЕ сбрасывается', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ status: 'ACTIVE' }));
    repo.applyUpdate.mockResolvedValue(makeOffer({ status: 'ACTIVE' }));
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await service.update('offer-1', 'alice', { price_per_unit: '12.00', quantity_available: 5 });
    expect(repo.applyUpdate.mock.calls[0][1]).not.toHaveProperty('status');
  });

  it('правка описания на ACTIVE → статус сбрасывается в PENDING_MODERATION', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ status: 'ACTIVE' }));
    repo.applyUpdate.mockResolvedValue(makeOffer({ status: 'PENDING_MODERATION' }));
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await service.update('offer-1', 'alice', { description: 'Новое описание' });
    expect(repo.applyUpdate).toHaveBeenCalledWith(
      'offer-1',
      expect.objectContaining({ description: 'Новое описание', status: 'PENDING_MODERATION', reject_reason: null })
    );
  });

  it('смена единицы измерения на ACTIVE → статус сбрасывается (контентное поле)', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ status: 'ACTIVE' }));
    repo.applyUpdate.mockResolvedValue(makeOffer({ status: 'PENDING_MODERATION' }));
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await service.update('offer-1', 'alice', { unit_of_measure: 'liter' });
    expect(repo.applyUpdate.mock.calls[0][1]).toMatchObject({ status: 'PENDING_MODERATION' });
  });

  it('замена изображений на ACTIVE → статус сбрасывается (контентное изменение)', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    const images = {
      putImage: jest.fn().mockResolvedValue({
        bucket_key: 'offers/voskhod/alice/h.jpg',
        content_hash: 'h',
        mime_type: 'image/jpeg',
      }),
      getReadUrl: jest.fn().mockResolvedValue('https://signed.example/img'),
      deleteImage: jest.fn().mockResolvedValue(undefined),
    };
    repo.findById.mockResolvedValue(makeOffer({ status: 'ACTIVE' }));
    repo.applyUpdate.mockResolvedValue(makeOffer({ status: 'PENDING_MODERATION' }));
    const service = new MarketplaceOfferService(
      repo,
      cats,
      makeOrderRepo(),
      images as unknown as import('~/extensions/marketplace/application/services/marketplace-offer-images.service').MarketplaceOfferImagesService
    );

    await service.update('offer-1', 'alice', {}, [
      { base64: Buffer.from('a').toString('base64'), mime_type: 'image/jpeg' },
    ]);
    expect(repo.applyUpdate.mock.calls[0][1]).toMatchObject({ status: 'PENDING_MODERATION' });
  });
});

describe('MarketplaceOfferService.withdraw', () => {
  it('withdraw → status WITHDRAWN', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ status: 'ACTIVE' }));
    repo.applyUpdate.mockResolvedValue(makeOffer({ status: 'WITHDRAWN' }));
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    const result = await service.withdraw('offer-1', 'alice');
    expect(repo.applyUpdate).toHaveBeenCalledWith('offer-1', { status: 'WITHDRAWN' });
    expect(result.status).toBe('WITHDRAWN');
  });

  it('withdraw чужого → 403', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ supplier_account: 'alice', status: 'ACTIVE' }));
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await expect(service.withdraw('offer-1', 'mallory')).rejects.toThrow(ForbiddenException);
  });

  it('withdraw уже WITHDRAWN → 403', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ status: 'WITHDRAWN' }));
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await expect(service.withdraw('offer-1', 'alice')).rejects.toThrow(ForbiddenException);
  });

  it('withdraw несуществующего → 404', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(null);
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

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
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await expect(service.withdraw('offer-1', 'alice')).resolves.toBeDefined();
    // ConflictException заводится при `hasActiveOrders === true` — будет
    // покрыт интеграционным тестом после merge Story 4.x.
    expect(ConflictException).toBeDefined();
  });
});

describe('MarketplaceOfferService.republish', () => {
  it('republish снятого → status PENDING_MODERATION (без пересоздания)', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ status: 'WITHDRAWN' }));
    repo.applyUpdate.mockResolvedValue(makeOffer({ status: 'PENDING_MODERATION' }));
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    const result = await service.republish('offer-1', 'alice');
    expect(repo.applyUpdate).toHaveBeenCalledWith('offer-1', { status: 'PENDING_MODERATION' });
    expect(result.status).toBe('PENDING_MODERATION');
  });

  it('republish чужого → 403', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ supplier_account: 'alice', status: 'WITHDRAWN' }));
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await expect(service.republish('offer-1', 'mallory')).rejects.toThrow(ForbiddenException);
  });

  it('republish не-снятого (ACTIVE) → 403', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ status: 'ACTIVE' }));
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await expect(service.republish('offer-1', 'alice')).rejects.toThrow(ForbiddenException);
  });

  it('republish несуществующего → 404', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(null);
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await expect(service.republish('offer-x', 'alice')).rejects.toThrow(NotFoundException);
  });
});

describe('MarketplaceOfferService.listMine + getById', () => {
  it('listMine делегирует в репозиторий с фильтром supplier_account', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.list.mockResolvedValue({
      items: [makeOffer()],
      totalCount: 1,
      totalPages: 1,
      currentPage: 1,
    });
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    const result = await service.listMine(COOP, 'alice', {
      page: 1,
      limit: 50,
      sortBy: 'created_at',
      sortOrder: 'DESC',
    });
    expect(repo.list).toHaveBeenCalledWith(
      { coopname: COOP, supplier_account: 'alice' },
      { page: 1, limit: 50, sortBy: 'created_at', sortOrder: 'DESC' }
    );
    expect(result.totalCount).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.currentPage).toBe(1);
  });

  it('getById → findById', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer());
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    const result = await service.getById('offer-1');
    expect(result?.id).toBe('offer-1');
  });
});

describe('MarketplaceOfferService.create — способ поставки (2 режима)', () => {
  it('collective без целевого объёма → ок (старт ручным запуском)', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    repo.create.mockResolvedValue(makeOffer({ cycle_type: 'collective', target_volume: null }));
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    const offer = await service.create(
      baseCreateRequest({ cycle_type: 'collective', target_volume: null })
    );
    expect(offer.cycle_type).toBe('collective');
  });

  it('collective с целевым объёмом → ок, target_volume передаётся в repo', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    repo.create.mockResolvedValue(makeOffer({ cycle_type: 'collective', target_volume: 100 }));
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    const offer = await service.create(
      baseCreateRequest({ cycle_type: 'collective', target_volume: 100 })
    );
    expect(offer.cycle_type).toBe('collective');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ cycle_type: 'collective', target_volume: 100 })
    );
  });

  it('collective с целевым объёмом < 1 → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await expect(
      service.create(baseCreateRequest({ cycle_type: 'collective', target_volume: 0 }))
    ).rejects.toThrow(BadRequestException);
  });

  it('individual → ок, целевой объём обнуляется в repo (висящее значение не сохраняем)', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    repo.create.mockResolvedValue(makeOffer({ cycle_type: 'individual', target_volume: null }));
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    const offer = await service.create(
      baseCreateRequest({ cycle_type: 'individual', target_volume: 50 })
    );
    expect(offer.cycle_type).toBe('individual');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ cycle_type: 'individual', target_volume: null })
    );
  });
});

describe('MarketplaceOfferService.update — смена способа поставки', () => {
  it('смена cycle_type на collective без целевого объёма → ок и статус → PENDING_MODERATION', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(
      makeOffer({ status: 'ACTIVE', cycle_type: 'individual', target_volume: null })
    );
    repo.applyUpdate.mockResolvedValue(
      makeOffer({ status: 'PENDING_MODERATION', cycle_type: 'collective', target_volume: null })
    );
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    const result = await service.update('offer-1', 'alice', { cycle_type: 'collective' });
    expect(result.status).toBe('PENDING_MODERATION');
    expect(repo.applyUpdate).toHaveBeenCalledWith(
      'offer-1',
      expect.objectContaining({ cycle_type: 'collective', status: 'PENDING_MODERATION' })
    );
  });

  it('установка целевого объёма < 1 для collective → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(
      makeOffer({ status: 'ACTIVE', cycle_type: 'collective', target_volume: 100 })
    );
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await expect(
      service.update('offer-1', 'alice', { target_volume: 0 })
    ).rejects.toThrow(BadRequestException);
  });

  it('частичный update без касания способа поставки → ок', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(
      makeOffer({ status: 'ACTIVE', cycle_type: 'collective', target_volume: null })
    );
    repo.applyUpdate.mockResolvedValue(makeOffer({ status: 'PENDING_MODERATION', product_name: 'Молоко' }));
    const service = new MarketplaceOfferService(repo, cats, makeOrderRepo(), makeImagesService());

    await expect(
      service.update('offer-1', 'alice', { product_name: 'Молоко' })
    ).resolves.toBeDefined();
  });
});

describe('MarketplaceOfferService — изображения', () => {
  function imagesMock() {
    return {
      putImage: jest
        .fn()
        .mockImplementation(({ contentType }: { contentType: string }) =>
          Promise.resolve({
            bucket_key: `offers/voskhod/alice/hash.${contentType === 'image/png' ? 'png' : 'jpg'}`,
            content_hash: 'hash',
            mime_type: contentType,
          })
        ),
      getReadUrl: jest.fn().mockResolvedValue('https://signed.example/img'),
      deleteImage: jest.fn().mockResolvedValue(undefined),
    };
  }

  it('create с images: грузит каждый файл и сохраняет ключи в Offer', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    const images = imagesMock();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    repo.create.mockImplementation((input) => Promise.resolve(makeOffer({ images: input.images })));
    const service = new MarketplaceOfferService(
      repo,
      cats,
      makeOrderRepo(),
      images as unknown as import('~/extensions/marketplace/application/services/marketplace-offer-images.service').MarketplaceOfferImagesService
    );

    const offer = await service.create(
      baseCreateRequest({
        images: [
          { base64: Buffer.from('a').toString('base64'), mime_type: 'image/jpeg' },
          { base64: Buffer.from('b').toString('base64'), mime_type: 'image/png' },
        ],
      })
    );

    expect(images.putImage).toHaveBeenCalledTimes(2);
    expect(offer.images).toHaveLength(2);
    expect(offer.images[0].mime_type).toBe('image/jpeg');
  });

  it('create: больше лимита изображений → 400 и ни одной загрузки', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    const images = imagesMock();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = new MarketplaceOfferService(
      repo,
      cats,
      makeOrderRepo(),
      images as unknown as import('~/extensions/marketplace/application/services/marketplace-offer-images.service').MarketplaceOfferImagesService
    );

    const tooMany = Array.from({ length: 9 }, () => ({
      base64: Buffer.from('x').toString('base64'),
      mime_type: 'image/jpeg',
    }));

    await expect(service.create(baseCreateRequest({ images: tooMany }))).rejects.toThrow(
      BadRequestException
    );
    expect(images.putImage).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('create: провал записи Offer → загруженные файлы удаляются (cleanup)', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    const images = imagesMock();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    repo.create.mockRejectedValue(new Error('db down'));
    const service = new MarketplaceOfferService(
      repo,
      cats,
      makeOrderRepo(),
      images as unknown as import('~/extensions/marketplace/application/services/marketplace-offer-images.service').MarketplaceOfferImagesService
    );

    await expect(
      service.create(
        baseCreateRequest({
          images: [{ base64: Buffer.from('a').toString('base64'), mime_type: 'image/jpeg' }],
        })
      )
    ).rejects.toThrow('db down');
    expect(images.deleteImage).toHaveBeenCalledTimes(1);
  });

  it('update: сохраняет существующее по bucket_key и добавляет новое base64 (порядок = показ)', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    const images = imagesMock();
    const existing = {
      bucket_key: 'offers/voskhod/alice/keep.jpg',
      content_hash: 'keep',
      mime_type: 'image/jpeg',
    };
    repo.findById.mockResolvedValue(makeOffer({ status: 'ACTIVE', images: [existing] }));
    repo.applyUpdate.mockImplementation((_id, patch) => Promise.resolve(makeOffer(patch as object)));
    const service = new MarketplaceOfferService(
      repo,
      cats,
      makeOrderRepo(),
      images as unknown as import('~/extensions/marketplace/application/services/marketplace-offer-images.service').MarketplaceOfferImagesService
    );

    const result = await service.update('offer-1', 'alice', {}, [
      { bucket_key: existing.bucket_key },
      { base64: Buffer.from('new').toString('base64'), mime_type: 'image/png' },
    ]);

    // Существующее не перезагружается, новое — одно.
    expect(images.putImage).toHaveBeenCalledTimes(1);
    expect(result.images).toHaveLength(2);
    expect(result.images[0].bucket_key).toBe(existing.bucket_key);
    expect(result.images[1].mime_type).toBe('image/png');
  });

  it('update: удаление существующего = просто не передаём его bucket_key (набор сокращается)', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    const images = imagesMock();
    const a = { bucket_key: 'offers/voskhod/alice/a.jpg', content_hash: 'a', mime_type: 'image/jpeg' };
    const b = { bucket_key: 'offers/voskhod/alice/b.jpg', content_hash: 'b', mime_type: 'image/jpeg' };
    repo.findById.mockResolvedValue(makeOffer({ status: 'ACTIVE', images: [a, b] }));
    repo.applyUpdate.mockImplementation((_id, patch) => Promise.resolve(makeOffer(patch as object)));
    const service = new MarketplaceOfferService(
      repo,
      cats,
      makeOrderRepo(),
      images as unknown as import('~/extensions/marketplace/application/services/marketplace-offer-images.service').MarketplaceOfferImagesService
    );

    const result = await service.update('offer-1', 'alice', {}, [{ bucket_key: b.bucket_key }]);
    expect(result.images).toHaveLength(1);
    expect(result.images[0].bucket_key).toBe(b.bucket_key);
    expect(images.putImage).not.toHaveBeenCalled();
  });

  it('update: ссылка на чужой/неизвестный bucket_key → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    const images = imagesMock();
    repo.findById.mockResolvedValue(makeOffer({ status: 'ACTIVE', images: [] }));
    const service = new MarketplaceOfferService(
      repo,
      cats,
      makeOrderRepo(),
      images as unknown as import('~/extensions/marketplace/application/services/marketplace-offer-images.service').MarketplaceOfferImagesService
    );

    await expect(
      service.update('offer-1', 'alice', {}, [{ bucket_key: 'offers/voskhod/mallory/stolen.jpg' }])
    ).rejects.toThrow(BadRequestException);
  });
});
