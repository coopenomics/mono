/**
 * Unit-тесты MarketplaceModerationService (Story 3.3).
 *
 * Покрывают AC:
 *   - approve: PENDING → ACTIVE, approved_by/at заполнены, лог append,
 *     событие EVENT_APPROVED отправлено;
 *   - reject: PENDING → REJECTED + reason, лог append, EVENT_REJECTED;
 *   - reject без reason → 400;
 *   - reject слишком длинный reason → 400;
 *   - approve/reject Offer'а не в PENDING → 409 Conflict;
 *   - approve/reject несуществующего → 404;
 *   - listPending → repo.list с filter status=PENDING_MODERATION + paging;
 *   - listLog → repo.listByOffer.
 */
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { MarketplaceModerationService } from '~/extensions/marketplace/application/services/marketplace-moderation.service';
import { MarketplaceOfferDomainEntity } from '~/extensions/marketplace/domain/entities/marketplace-offer.entity';
import { MarketplaceModerationLogDomainEntity } from '~/extensions/marketplace/domain/entities/marketplace-moderation-log.entity';
import type { MarketplaceOfferDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-offer.repository';
import type { MarketplaceModerationLogDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-moderation-log.repository';
import type { MarketplaceOfferStatus } from '~/extensions/marketplace/domain/entities/marketplace-offer.types';

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

function makeLog(overrides: Partial<MarketplaceModerationLogDomainEntity> = {}): MarketplaceModerationLogDomainEntity {
  return new MarketplaceModerationLogDomainEntity({
    id: 'log-1',
    offer_id: 'offer-1',
    action: 'approve',
    by_account: 'chair',
    reason: null,
    created_at: new Date(),
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

function makeLogRepo(): jest.Mocked<MarketplaceModerationLogDomainRepository> {
  return {
    append: jest.fn(),
    listByOffer: jest.fn(),
  };
}

function makeEventBus(): EventEmitter2 {
  return { emit: jest.fn() } as unknown as EventEmitter2;
}

describe('MarketplaceModerationService.approve', () => {
  it('PENDING → ACTIVE + approved_by/at + log append + event emit', async () => {
    const offerRepo = makeOfferRepo();
    const logRepo = makeLogRepo();
    const bus = makeEventBus();
    offerRepo.findById.mockResolvedValue(makeOffer());
    offerRepo.applyUpdate.mockResolvedValue(
      makeOffer({ status: 'ACTIVE' as MarketplaceOfferStatus, approved_by: 'chair' })
    );
    logRepo.append.mockResolvedValue(makeLog());
    const service = new MarketplaceModerationService(offerRepo, logRepo, bus);

    const updated = await service.approve('offer-1', 'chair', 30);
    expect(updated.status).toBe('ACTIVE');
    expect(offerRepo.applyUpdate).toHaveBeenCalledWith(
      'offer-1',
      expect.objectContaining({
        status: 'ACTIVE',
        warranty_days: 30,
        approved_by: 'chair',
        rejected_by: null,
        reject_reason: null,
      })
    );
    expect(logRepo.append).toHaveBeenCalledWith({
      offer_id: 'offer-1',
      action: 'approve',
      by_account: 'chair',
      reason: null,
    });
    expect(bus.emit).toHaveBeenCalledWith(
      MarketplaceModerationService.EVENT_APPROVED,
      expect.objectContaining({ offer_id: 'offer-1', supplier_account: 'alice', approved_by: 'chair' })
    );
  });

  it('approve Offer\'а в ACTIVE → 409 Conflict', async () => {
    const offerRepo = makeOfferRepo();
    offerRepo.findById.mockResolvedValue(makeOffer({ status: 'ACTIVE' as MarketplaceOfferStatus }));
    const service = new MarketplaceModerationService(offerRepo, makeLogRepo(), makeEventBus());

    await expect(service.approve('offer-1', 'chair', 30)).rejects.toThrow(ConflictException);
  });

  it('approve несуществующего → 404', async () => {
    const offerRepo = makeOfferRepo();
    offerRepo.findById.mockResolvedValue(null);
    const service = new MarketplaceModerationService(offerRepo, makeLogRepo(), makeEventBus());

    await expect(service.approve('offer-x', 'chair', 30)).rejects.toThrow(NotFoundException);
  });
});

describe('MarketplaceModerationService.reject', () => {
  it('PENDING → REJECTED + reason + log + event', async () => {
    const offerRepo = makeOfferRepo();
    const logRepo = makeLogRepo();
    const bus = makeEventBus();
    offerRepo.findById.mockResolvedValue(makeOffer());
    offerRepo.applyUpdate.mockResolvedValue(
      makeOffer({
        status: 'REJECTED' as MarketplaceOfferStatus,
        rejected_by: 'chair',
        reject_reason: 'Не соответствует политике',
      })
    );
    logRepo.append.mockResolvedValue(makeLog({ action: 'reject', reason: 'Не соответствует политике' }));
    const service = new MarketplaceModerationService(offerRepo, logRepo, bus);

    const updated = await service.reject('offer-1', 'chair', 'Не соответствует политике');
    expect(updated.status).toBe('REJECTED');
    expect(updated.reject_reason).toBe('Не соответствует политике');
    expect(logRepo.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'reject', reason: 'Не соответствует политике' })
    );
    expect(bus.emit).toHaveBeenCalledWith(
      MarketplaceModerationService.EVENT_REJECTED,
      expect.objectContaining({ offer_id: 'offer-1', reason: 'Не соответствует политике' })
    );
  });

  it('reject без reason → 400', async () => {
    const service = new MarketplaceModerationService(
      makeOfferRepo(),
      makeLogRepo(),
      makeEventBus()
    );

    await expect(service.reject('offer-1', 'chair', '')).rejects.toThrow(BadRequestException);
    await expect(service.reject('offer-1', 'chair', '   ')).rejects.toThrow(BadRequestException);
  });

  it('reject reason > 1000 → 400', async () => {
    const service = new MarketplaceModerationService(
      makeOfferRepo(),
      makeLogRepo(),
      makeEventBus()
    );

    await expect(service.reject('offer-1', 'chair', 'x'.repeat(1001))).rejects.toThrow(
      BadRequestException
    );
  });

  it('reject Offer\'а уже REJECTED → 409', async () => {
    const offerRepo = makeOfferRepo();
    offerRepo.findById.mockResolvedValue(makeOffer({ status: 'REJECTED' as MarketplaceOfferStatus }));
    const service = new MarketplaceModerationService(offerRepo, makeLogRepo(), makeEventBus());

    await expect(service.reject('offer-1', 'chair', 'reason')).rejects.toThrow(ConflictException);
  });

  it('reject reason обрезается trim перед записью', async () => {
    const offerRepo = makeOfferRepo();
    const logRepo = makeLogRepo();
    offerRepo.findById.mockResolvedValue(makeOffer());
    offerRepo.applyUpdate.mockResolvedValue(makeOffer({ status: 'REJECTED' as MarketplaceOfferStatus }));
    logRepo.append.mockResolvedValue(makeLog({ action: 'reject', reason: 'reason' }));
    const service = new MarketplaceModerationService(offerRepo, logRepo, makeEventBus());

    await service.reject('offer-1', 'chair', '  reason  ');
    expect(offerRepo.applyUpdate).toHaveBeenCalledWith(
      'offer-1',
      expect.objectContaining({ reject_reason: 'reason' })
    );
  });
});

describe('MarketplaceModerationService.listPending + listLog', () => {
  it('listPending: filter status=PENDING_MODERATION, paging', async () => {
    const offerRepo = makeOfferRepo();
    offerRepo.list.mockResolvedValue({ items: [], totalCount: 0, totalPages: 0, currentPage: 1 });
    const service = new MarketplaceModerationService(offerRepo, makeLogRepo(), makeEventBus());

    await service.listPending(COOP, {
      page: 1,
      limit: 25,
      sortBy: 'created_at',
      sortOrder: 'DESC',
    });
    expect(offerRepo.list).toHaveBeenCalledWith(
      { coopname: COOP, status: 'PENDING_MODERATION' },
      { page: 1, limit: 25, sortBy: 'created_at', sortOrder: 'DESC' }
    );
  });

  it('listLog → logRepo.listByOffer', async () => {
    const logRepo = makeLogRepo();
    logRepo.listByOffer.mockResolvedValue([makeLog()]);
    const service = new MarketplaceModerationService(makeOfferRepo(), logRepo, makeEventBus());

    const result = await service.listLog('offer-1');
    expect(result).toHaveLength(1);
    expect(logRepo.listByOffer).toHaveBeenCalledWith('offer-1');
  });
});
