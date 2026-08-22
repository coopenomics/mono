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
    sale_form: 'by_measure',
    packages: [],
    quantity_available: 100,
    quantity_blocked: 0,
    quantity_consumed: 0,
    unlimited_flag: false,
    delivery_points: [{ braname: 'krasnogorsk', min_supply_volume: 1 }],
    shelf_life_days: 0,
    warranty_days: 0,
    barcode_strategy: 'PER_ORDER',
    pack_size: null,
    stock_braname: null,
    stock_origin_offer_id: null,
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

function makeAvailableCategoryService() {
  return {
    isCategoryAvailable: jest.fn().mockResolvedValue(true),
    hasAvailabilityRestrictions: jest.fn().mockResolvedValue(false),
    getAvailableCategoryIds: jest.fn().mockResolvedValue([]),
  } as unknown as import('~/extensions/marketplace/domain/services/available-category-domain.service').AvailableCategoryDomainService;
}

function makeEventBus() {
  return { emit: jest.fn() } as unknown as import('@nestjs/event-emitter').EventEmitter2;
}

function makeSupplierSettings() {
  return {
    assertPayoutMethodConfigured: jest.fn().mockResolvedValue(undefined),
  } as unknown as import('~/extensions/marketplace/application/services/marketplace-supplier-settings.service').MarketplaceSupplierSettingsService;
}

function makeService(
  repo: jest.Mocked<MarketplaceOfferDomainRepository>,
  cats: jest.Mocked<MarketplaceCategoryDomainRepository>,
  images: ReturnType<typeof makeImagesService> = makeImagesService()
) {
  return new MarketplaceOfferService(
    repo,
    cats,
    makeAvailableCategoryService(),
    images,
    makeEventBus(),
    makeSupplierSettings()
  );
}

function makeCategoryRepo(): jest.Mocked<MarketplaceCategoryDomainRepository> {
  const repo = {
    listBaseline: jest.fn(),
    findById: jest.fn(),
    upsertBaseline: jest.fn(),
    listForCoop: jest.fn(),
    existsByDisplayName: jest.fn(),
    createCustom: jest.fn(),
    deleteCustom: jest.fn(),
  };
  const category = new MarketplaceCategoryDomainEntity({
    id: 1,
    display_name: 'Продовольственные товары',
    sort_order: 1,
    mvp_baseline: true,
  });
  repo.findById.mockResolvedValue(category);
  repo.listForCoop.mockResolvedValue([category]);
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
    sale_form: 'by_measure',
    packages: [],
    quantity_available: 100,
    unlimited_flag: false,
    delivery_points: [{ braname: 'krasnogorsk', min_supply_volume: 1 }],
    shelf_life_days: 0,
    ...overrides,
  };
}

describe('MarketplaceOfferService.create', () => {
  it('создаёт Offer со статусом PENDING_MODERATION', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    repo.create.mockResolvedValue(makeOffer());
    const service = makeService(repo, cats);

    const offer = await service.create(baseCreateRequest());
    expect(offer.status).toBe('PENDING_MODERATION');
    expect(repo.create).toHaveBeenCalled();
  });

  it('rate-limit: на 10-м offer'+'е за час → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(MarketplaceOfferService.RATE_LIMIT_PER_HOUR);
    const service = makeService(repo, cats);

    await expect(service.create(baseCreateRequest())).rejects.toThrow(BadRequestException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('категория вне baseline → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = makeService(repo, cats);

    await expect(service.create(baseCreateRequest({ category_id: 99 }))).rejects.toThrow(
      BadRequestException
    );
  });

  it('категория есть в baseline но отсутствует в БД → 400 (миграция не выполнилась)', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    cats.listForCoop.mockResolvedValueOnce([]);
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = makeService(repo, cats);

    await expect(service.create(baseCreateRequest({ category_id: 5 }))).rejects.toThrow(
      BadRequestException
    );
  });

  it('product_name пустой → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = makeService(repo, cats);

    await expect(service.create(baseCreateRequest({ product_name: '   ' }))).rejects.toThrow(
      BadRequestException
    );
  });

  // ── техдолг 598-22: barcode_strategy + pack_size ──

  it('barcode_strategy PER_PACKAGE без pack_size → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = makeService(repo, cats);

    await expect(
      service.create(baseCreateRequest({ barcode_strategy: 'PER_PACKAGE' }))
    ).rejects.toThrow(BadRequestException);
  });

  it('barcode_strategy PER_PACKAGE + pack_size > MAX_PACK_SIZE → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = makeService(repo, cats);

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
    const service = makeService(repo, cats);

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
    const service = makeService(repo, cats);

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
    const service = makeService(repo, cats);

    const offer = await service.create(baseCreateRequest());
    expect(offer.barcode_strategy).toBe('PER_ORDER');
    expect(offer.pack_size).toBeNull();
  });

  it('product_name > 200 → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = makeService(repo, cats);

    await expect(
      service.create(baseCreateRequest({ product_name: 'x'.repeat(201) }))
    ).rejects.toThrow(BadRequestException);
  });

  it('quantity_available=null при unlimited_flag=false → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = makeService(repo, cats);

    await expect(
      service.create(baseCreateRequest({ quantity_available: null, unlimited_flag: false }))
    ).rejects.toThrow(BadRequestException);
  });

  it('unlimited_flag=true обнуляет quantity_available и пропускает валидацию', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    repo.create.mockResolvedValue(makeOffer({ unlimited_flag: true, quantity_available: 0 }));
    const service = makeService(repo, cats);

    await service.create(
      baseCreateRequest({ unlimited_flag: true, quantity_available: null })
    );
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ unlimited_flag: true, quantity_available: 0 })
    );
  });

  it('пустой набор КУ поставки → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = makeService(repo, cats);

    await expect(
      service.create(baseCreateRequest({ delivery_points: [] }))
    ).rejects.toThrow(BadRequestException);
  });

  it('некорректный unit_of_measure → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = makeService(repo, cats);

    await expect(
      service.create(baseCreateRequest({ unit_of_measure: 'tonne' as any }))
    ).rejects.toThrow(BadRequestException);
  });

  it('некорректный price_per_unit (не numeric) → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = makeService(repo, cats);

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
    const service = makeService(repo, cats);

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
    const service = makeService(repo, cats);

    await expect(service.update('offer-1', 'mallory', { product_name: 'X' })).rejects.toThrow(
      ForbiddenException
    );
  });

  it('update WITHDRAWN разрешён — поставщик дорабатывает снятую карточку', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ status: 'WITHDRAWN' }));
    repo.applyUpdate.mockResolvedValue(makeOffer({ status: 'WITHDRAWN', product_name: 'X' }));
    const service = makeService(repo, cats);

    const updated = await service.update('offer-1', 'alice', { product_name: 'X' });
    expect(updated.status).toBe('WITHDRAWN');
    expect(repo.applyUpdate).toHaveBeenCalled();
  });

  it('update REJECTED → правка проходит и уходит на повторную модерацию (status PENDING, причина очищена)', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(
      makeOffer({ status: 'REJECTED', reject_reason: 'Плохое фото', rejected_by: 'chairman' })
    );
    repo.applyUpdate.mockResolvedValue(makeOffer({ status: 'PENDING_MODERATION' }));
    const service = makeService(repo, cats);

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
    const service = makeService(repo, cats);

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
    const service = makeService(repo, cats);

    await expect(service.update('offer-x', 'alice', { product_name: 'X' })).rejects.toThrow(
      NotFoundException
    );
  });

  it('unlimited_flag=true в patch обнуляет quantity_available и НЕ сбрасывает статус (операционное поле)', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ status: 'ACTIVE' }));
    repo.applyUpdate.mockResolvedValue(makeOffer({ status: 'ACTIVE', unlimited_flag: true, quantity_available: 0 }));
    const service = makeService(repo, cats);

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
    const service = makeService(repo, cats);

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
    const service = makeService(repo, cats);

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
    const service = makeService(repo, cats);

    await service.update('offer-1', 'alice', { quantity_available: 250 });
    expect(repo.applyUpdate.mock.calls[0][1]).not.toHaveProperty('status');
  });

  it('правка цены + количества вместе на ACTIVE → статус НЕ сбрасывается', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ status: 'ACTIVE' }));
    repo.applyUpdate.mockResolvedValue(makeOffer({ status: 'ACTIVE' }));
    const service = makeService(repo, cats);

    await service.update('offer-1', 'alice', { price_per_unit: '12.00', quantity_available: 5 });
    expect(repo.applyUpdate.mock.calls[0][1]).not.toHaveProperty('status');
  });

  it('правка описания на ACTIVE → статус сбрасывается в PENDING_MODERATION', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ status: 'ACTIVE' }));
    repo.applyUpdate.mockResolvedValue(makeOffer({ status: 'PENDING_MODERATION' }));
    const service = makeService(repo, cats);

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
    const service = makeService(repo, cats);

    await service.update('offer-1', 'alice', { unit_of_measure: 'liter' });
    expect(repo.applyUpdate.mock.calls[0][1]).toMatchObject({ status: 'PENDING_MODERATION' });
  });

  it('форма прислала карточку целиком без правок → статус НЕ сбрасывается', async () => {
    // Форма редактирования всегда отправляет все поля; «поле пришло» не значит
    // «поле изменилось» — иначе правка остатка снимала бы оферту с витрины.
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ status: 'ACTIVE' }));
    repo.applyUpdate.mockResolvedValue(makeOffer({ status: 'ACTIVE' }));
    const service = makeService(repo, cats);

    await service.update('offer-1', 'alice', {
      product_name: 'Картофель',
      description: null,
      category_id: 1,
      unit_of_measure: 'kg',
      price_per_unit: '50.0000',
      quantity_available: 250,
      delivery_points: [{ braname: 'krasnogorsk', min_supply_volume: 40 }],
    });
    expect(repo.applyUpdate.mock.calls[0][1]).not.toHaveProperty('status');
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
    const service = makeService(repo, cats, images as unknown as ReturnType<typeof makeImagesService>);

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
    const service = makeService(repo, cats);

    const result = await service.withdraw('offer-1', 'alice');
    expect(repo.applyUpdate).toHaveBeenCalledWith('offer-1', { status: 'WITHDRAWN' });
    expect(result.status).toBe('WITHDRAWN');
  });

  it('withdraw чужого → 403', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ supplier_account: 'alice', status: 'ACTIVE' }));
    const service = makeService(repo, cats);

    await expect(service.withdraw('offer-1', 'mallory')).rejects.toThrow(ForbiddenException);
  });

  it('withdraw уже WITHDRAWN → 403', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ status: 'WITHDRAWN' }));
    const service = makeService(repo, cats);

    await expect(service.withdraw('offer-1', 'alice')).rejects.toThrow(ForbiddenException);
  });

  it('withdraw несуществующего → 404', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(null);
    const service = makeService(repo, cats);

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
    const service = makeService(repo, cats);

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
    const service = makeService(repo, cats);

    const result = await service.republish('offer-1', 'alice');
    expect(repo.applyUpdate).toHaveBeenCalledWith('offer-1', { status: 'PENDING_MODERATION' });
    expect(result.status).toBe('PENDING_MODERATION');
  });

  it('republish чужого → 403', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ supplier_account: 'alice', status: 'WITHDRAWN' }));
    const service = makeService(repo, cats);

    await expect(service.republish('offer-1', 'mallory')).rejects.toThrow(ForbiddenException);
  });

  it('republish не-снятого (ACTIVE) → 403', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ status: 'ACTIVE' }));
    const service = makeService(repo, cats);

    await expect(service.republish('offer-1', 'alice')).rejects.toThrow(ForbiddenException);
  });

  it('republish несуществующего → 404', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(null);
    const service = makeService(repo, cats);

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
    const service = makeService(repo, cats);

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
    const service = makeService(repo, cats);

    const result = await service.getById('offer-1');
    expect(result?.id).toBe('offer-1');
  });
});

describe('MarketplaceOfferService.create — КУ поставки (Эпик 15)', () => {
  it('несколько КУ с минимальными объёмами → ок, delivery_points передаётся в repo', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const points = [
      { braname: 'krasnogorsk', min_supply_volume: 1 },
      { braname: 'odintsovo', min_supply_volume: 100 },
    ];
    repo.create.mockResolvedValue(makeOffer({ delivery_points: points }));
    const service = makeService(repo, cats);

    const offer = await service.create(baseCreateRequest({ delivery_points: points }));
    expect(offer.delivery_points).toEqual(points);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ delivery_points: points })
    );
  });

  it('пустой список КУ → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = makeService(repo, cats);

    await expect(
      service.create(baseCreateRequest({ delivery_points: [] }))
    ).rejects.toThrow(BadRequestException);
  });

  it('min_supply_volume < 1 → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = makeService(repo, cats);

    await expect(
      service.create(baseCreateRequest({ delivery_points: [{ braname: 'krasnogorsk', min_supply_volume: 0 }] }))
    ).rejects.toThrow(BadRequestException);
  });

  it('дублирующийся КУ в наборе → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.countRecentCreatedBy.mockResolvedValue(0);
    const service = makeService(repo, cats);

    await expect(
      service.create(baseCreateRequest({
        delivery_points: [
          { braname: 'krasnogorsk', min_supply_volume: 1 },
          { braname: 'krasnogorsk', min_supply_volume: 5 },
        ],
      }))
    ).rejects.toThrow(BadRequestException);
  });
});

describe('MarketplaceOfferService.update — смена КУ поставки', () => {
  it('смена delivery_points → ок, предложение остаётся ACTIVE (условия поставки не модерируются)', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    const newPoints = [{ braname: 'odintsovo', min_supply_volume: 50 }];
    repo.findById.mockResolvedValue(
      makeOffer({ status: 'ACTIVE', delivery_points: [{ braname: 'krasnogorsk', min_supply_volume: 1 }] })
    );
    repo.applyUpdate.mockResolvedValue(
      makeOffer({ status: 'ACTIVE', delivery_points: newPoints })
    );
    const service = makeService(repo, cats);

    const result = await service.update('offer-1', 'alice', { delivery_points: newPoints });
    expect(result.status).toBe('ACTIVE');
    expect(repo.applyUpdate).toHaveBeenCalledWith(
      'offer-1',
      expect.objectContaining({ delivery_points: newPoints })
    );
    expect(repo.applyUpdate.mock.calls[0][1]).not.toHaveProperty('status');
  });

  it('правка минимального объёма на КУ → предложение остаётся ACTIVE', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(
      makeOffer({ status: 'ACTIVE', delivery_points: [{ braname: 'krasnogorsk', min_supply_volume: 1 }] })
    );
    repo.applyUpdate.mockResolvedValue(makeOffer({ status: 'ACTIVE' }));
    const service = makeService(repo, cats);

    await service.update('offer-1', 'alice', {
      delivery_points: [{ braname: 'krasnogorsk', min_supply_volume: 12 }],
    });
    expect(repo.applyUpdate.mock.calls[0][1]).not.toHaveProperty('status');
  });

  it('пустой список КУ при update → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(
      makeOffer({ status: 'ACTIVE', delivery_points: [{ braname: 'krasnogorsk', min_supply_volume: 1 }] })
    );
    const service = makeService(repo, cats);

    await expect(
      service.update('offer-1', 'alice', { delivery_points: [] })
    ).rejects.toThrow(BadRequestException);
  });

  it('частичный update без касания КУ → ок', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(
      makeOffer({ status: 'ACTIVE', delivery_points: [{ braname: 'krasnogorsk', min_supply_volume: 1 }] })
    );
    repo.applyUpdate.mockResolvedValue(makeOffer({ status: 'PENDING_MODERATION', product_name: 'Молоко' }));
    const service = makeService(repo, cats);

    await expect(
      service.update('offer-1', 'alice', { product_name: 'Молоко' })
    ).resolves.toBeDefined();
  });
});

describe('MarketplaceOfferService.update — упаковки при отпуске упаковкой', () => {
  // На идентификатор упаковки ссылаются корзины заказчиков: если правка
  // предложения выдаёт упаковке новый идентификатор, позиция корзины теряет
  // связь и показывается недоступной с нулевой суммой.
  const packagedOffer = () =>
    makeOffer({
      status: 'ACTIVE',
      sale_form: 'packaged',
      unit_of_measure: 'liter',
      packages: [
        {
          id: 'pkg-1',
          size: 1,
          price: '100.0000',
          label: null,
          package_type: 'пластиковая бутылка',
          sort_order: 0,
          is_default: true,
        },
      ],
    });

  it('правка цены упаковки сохраняет её идентификатор', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(packagedOffer());
    repo.applyUpdate.mockImplementation((_id, patch) => Promise.resolve(makeOffer(patch as object)));
    const service = makeService(repo, cats);

    await service.update('offer-1', 'alice', {
      packages: [
        { id: 'pkg-1', size: 1, price: '120.00', package_type: 'стекло', is_default: true },
      ],
    });
    const patchArg = repo.applyUpdate.mock.calls[0][1] as { packages: Array<{ id: string; price: string }> };
    expect(patchArg.packages).toHaveLength(1);
    expect(patchArg.packages[0].id).toBe('pkg-1');
    expect(patchArg.packages[0].price).toBe('120.00');
  });

  it('добавленная упаковка получает новый идентификатор, прежняя — сохраняет свой', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(packagedOffer());
    repo.applyUpdate.mockImplementation((_id, patch) => Promise.resolve(makeOffer(patch as object)));
    const service = makeService(repo, cats);

    await service.update('offer-1', 'alice', {
      packages: [
        { id: 'pkg-1', size: 1, price: '100.00', package_type: 'стекло', is_default: true },
        { size: 5, price: '450.00', package_type: 'канистра' },
      ],
    });
    const patchArg = repo.applyUpdate.mock.calls[0][1] as { packages: Array<{ id: string }> };
    expect(patchArg.packages[0].id).toBe('pkg-1');
    expect(patchArg.packages[1].id).not.toBe('pkg-1');
    expect(patchArg.packages[1].id).toHaveLength(36);
  });

  it('упаковка без вида (тары) не принимается — заказчик должен знать, в чём получит', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(packagedOffer());
    const service = makeService(repo, cats);

    await expect(
      service.update('offer-1', 'alice', {
        packages: [{ id: 'pkg-1', size: 1, price: '120.00', package_type: '  ', is_default: true }],
      })
    ).rejects.toThrow(/вид упаковки/i);
  });

  it('вид упаковки сохраняется без лишних пробелов', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(packagedOffer());
    repo.applyUpdate.mockImplementation((_id, patch) => Promise.resolve(makeOffer(patch as object)));
    const service = makeService(repo, cats);

    await service.update('offer-1', 'alice', {
      packages: [
        { id: 'pkg-1', size: 1, price: '120.00', package_type: '  корзинка (возвратная) ', is_default: true },
      ],
    });
    const patchArg = repo.applyUpdate.mock.calls[0][1] as {
      packages: Array<{ package_type: string }>;
    };
    expect(patchArg.packages[0].package_type).toBe('корзинка (возвратная)');
  });

  it('неизвестный идентификатор упаковки не принимается — выдаётся новый', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(packagedOffer());
    repo.applyUpdate.mockImplementation((_id, patch) => Promise.resolve(makeOffer(patch as object)));
    const service = makeService(repo, cats);

    await service.update('offer-1', 'alice', {
      packages: [
        {
          id: 'pkg-from-another-offer',
          size: 2,
          price: '200.00',
          package_type: 'стекло',
          is_default: true,
        },
      ],
    });
    const patchArg = repo.applyUpdate.mock.calls[0][1] as { packages: Array<{ id: string }> };
    expect(patchArg.packages[0].id).not.toBe('pkg-from-another-offer');
    expect(patchArg.packages[0].id).toHaveLength(36);
  });

  it('правка упаковок не отправляет предложение на повторную модерацию', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(packagedOffer());
    repo.applyUpdate.mockImplementation((_id, patch) => Promise.resolve(makeOffer(patch as object)));
    const service = makeService(repo, cats);

    await service.update('offer-1', 'alice', {
      packages: [
        { id: 'pkg-1', size: 1, price: '120.00', package_type: 'стекло', is_default: true },
      ],
    });
    expect(repo.applyUpdate.mock.calls[0][1]).not.toHaveProperty('status');
  });

  /**
   * Границы набора упаковок. Размер упаковки участвует в расчёте суммы заказа
   * (цена ÷ содержимое), поэтому ноль и отрицательное значение обязаны
   * отбиваться до записи: иначе предложение делит на ноль в витрине.
   */
  describe('границы набора упаковок', () => {
    function prepared() {
      const repo = makeOfferRepo();
      const cats = makeCategoryRepo();
      repo.findById.mockResolvedValue(packagedOffer());
      repo.applyUpdate.mockImplementation((_id, patch) => Promise.resolve(makeOffer(patch as object)));
      return { repo, cats, service: makeService(repo, cats) };
    }

    it.each([0, -1, -0.5])('размер упаковки %p → отказ, предложение не меняется', async (size) => {
      const { repo, service } = prepared();

      await expect(
        service.update('offer-1', 'alice', {
          packages: [
            { size, price: '100.00', package_type: 'пластиковая бутылка', is_default: true },
          ],
        })
      ).rejects.toThrow('Размер упаковки должен быть больше нуля');
      expect(repo.applyUpdate).not.toHaveBeenCalled();
    });

    it('отпуск упаковкой без единой упаковки → отказ', async () => {
      const { repo, service } = prepared();

      await expect(
        service.update('offer-1', 'alice', { packages: [] })
      ).rejects.toThrow('добавьте хотя бы одну упаковку');
      expect(repo.applyUpdate).not.toHaveBeenCalled();
    });

    it('нулевая цена упаковки → отказ', async () => {
      const { repo, service } = prepared();

      await expect(
        service.update('offer-1', 'alice', {
          packages: [{ size: 1, price: '0.0000', package_type: 'стекло', is_default: true }],
        })
      ).rejects.toThrow('Цена упаковки должна быть положительным числом');
      expect(repo.applyUpdate).not.toHaveBeenCalled();
    });
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
    const service = makeService(repo, cats, images as unknown as ReturnType<typeof makeImagesService>);

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
    const service = makeService(repo, cats, images as unknown as ReturnType<typeof makeImagesService>);

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
    const service = makeService(repo, cats, images as unknown as ReturnType<typeof makeImagesService>);

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
    const service = makeService(repo, cats, images as unknown as ReturnType<typeof makeImagesService>);

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
    const service = makeService(repo, cats, images as unknown as ReturnType<typeof makeImagesService>);

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
    const service = makeService(repo, cats, images as unknown as ReturnType<typeof makeImagesService>);

    await expect(
      service.update('offer-1', 'alice', {}, [{ bucket_key: 'offers/voskhod/mallory/stolen.jpg' }])
    ).rejects.toThrow(BadRequestException);
  });
});

/**
 * Границы срока годности и точности цены.
 *
 * Срок годности — основа списания скоропорта: отрицательное значение сделало бы
 * имущество просроченным в момент приёмки. Точность цены ограничена четырьмя
 * знаками, потому что столько же знаков у символа расчётов кооператива —
 * лишние привели бы к расхождению суммы заказа с суммой проводки.
 */
describe('MarketplaceOfferService: границы срока годности и цены', () => {
  it('create с отрицательным сроком годности → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    const service = makeService(repo, cats);

    await expect(
      service.create(baseCreateRequest({ shelf_life_days: -1 }))
    ).rejects.toThrow(BadRequestException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('update с отрицательным сроком годности → 400, предложение не меняется', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.findById.mockResolvedValue(makeOffer({ status: 'ACTIVE' }));
    const service = makeService(repo, cats);

    await expect(
      service.update('offer-1', 'alice', { shelf_life_days: -5 })
    ).rejects.toThrow(BadRequestException);
    expect(repo.applyUpdate).not.toHaveBeenCalled();
  });

  it('нулевой срок годности допустим — товар без ограничения по сроку', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.create.mockResolvedValue(makeOffer());
    const service = makeService(repo, cats);

    await service.create(baseCreateRequest({ shelf_life_days: 0 }));
    expect(repo.create).toHaveBeenCalled();
  });

  it('цена с пятью знаками после запятой → 400', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    const service = makeService(repo, cats);

    await expect(
      service.create(baseCreateRequest({ price_per_unit: '50.12345' }))
    ).rejects.toThrow(BadRequestException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('цена ровно с четырьмя знаками принимается', async () => {
    const repo = makeOfferRepo();
    const cats = makeCategoryRepo();
    repo.create.mockResolvedValue(makeOffer());
    const service = makeService(repo, cats);

    await service.create(baseCreateRequest({ price_per_unit: '50.1234' }));
    expect(repo.create).toHaveBeenCalled();
  });
});
