/**
 * Возврат снятого предложения в каталог.
 *
 * Поставщик снимает предложение с публикации (кончился товар, уехал в отпуск)
 * и позже возвращает обратно. Если оно уже проходило модерацию, второй раз
 * дёргать администратора незачем: содержимое не менялось, решение о допуске
 * в каталог уже принято. Такое предложение возвращается сразу ACTIVE, и
 * витрине уходит тот же сигнал «появилось в каталоге», что и при одобрении.
 *
 * Если же одобрения не было (сняли, не дождавшись модерации), возврат обязан
 * встать в очередь модерации — иначе непроверенная карточка попала бы в
 * каталог самим фактом «снял и вернул».
 *
 * Различает эти два случая ровно один признак — `approved_at`.
 */
import { MarketplaceOfferService } from '~/extensions/marketplace/application/services/marketplace-offer.service';
import {
  MARKETPLACE_OFFER_APPROVED_EVENT,
  MARKETPLACE_OFFER_MODERATION_REQUESTED_EVENT,
} from '~/extensions/marketplace/application/events/marketplace-notification.events';
import { MarketplaceOfferStatuses } from '~/extensions/marketplace/domain/entities/marketplace-offer.types';
import type { MarketplaceOfferDomainEntity } from '~/extensions/marketplace/domain/entities/marketplace-offer.entity';
import type { MarketplaceOfferDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-offer.repository';
import type { MarketplaceCategoryDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-category.repository';

const COOP = 'voskhod';
const SUPPLIER = 'alice';

function buildOffer(overrides: Partial<MarketplaceOfferDomainEntity> = {}): MarketplaceOfferDomainEntity {
  return {
    id: 'offer-1',
    coopname: COOP,
    supplier_account: SUPPLIER,
    category_id: 'cat-1',
    product_name: 'Берёзовый сок',
    status: MarketplaceOfferStatuses.WITHDRAWN,
    approved_at: new Date('2026-08-01T10:00:00Z'),
    approved_by: 'chairman-acc',
    ...overrides,
  } as unknown as MarketplaceOfferDomainEntity;
}

function buildService(offer: MarketplaceOfferDomainEntity) {
  const repo = {
    findById: jest.fn().mockResolvedValue(offer),
    // Возвращаем сущность с уже применённым статусом — сервис отдаёт её наружу
    // и от неё же строит событие.
    applyUpdate: jest
      .fn()
      .mockImplementation(async (_id: string, patch: Partial<MarketplaceOfferDomainEntity>) => ({
        ...offer,
        ...patch,
      })),
  } as unknown as jest.Mocked<MarketplaceOfferDomainRepository>;

  const eventBus = { emit: jest.fn() };

  const service = new MarketplaceOfferService(
    repo,
    {} as unknown as jest.Mocked<MarketplaceCategoryDomainRepository>,
    {
      isCategoryAvailable: jest.fn().mockResolvedValue(true),
      hasAvailabilityRestrictions: jest.fn().mockResolvedValue(false),
      getAvailableCategoryIds: jest.fn().mockResolvedValue([]),
    } as never,
    { getReadUrl: jest.fn(), putImage: jest.fn(), deleteImage: jest.fn() } as never,
    eventBus as never,
    { assertPayoutMethodConfigured: jest.fn().mockResolvedValue(undefined) } as never
  );

  return { service, repo, eventBus };
}

/** Эмитился ли сигнал «встало в очередь модерации». */
const askedForModeration = (eventBus: { emit: jest.Mock }) =>
  eventBus.emit.mock.calls.some(
    ([channel]) => channel === MARKETPLACE_OFFER_MODERATION_REQUESTED_EVENT
  );

describe('Возврат снятого предложения в каталог', () => {
  it('ранее одобренное возвращается сразу в каталог, минуя модерацию', async () => {
    const { service, repo, eventBus } = buildService(buildOffer());

    const updated = await service.republish('offer-1', SUPPLIER);

    expect(repo.applyUpdate).toHaveBeenCalledWith(
      'offer-1',
      expect.objectContaining({ status: MarketplaceOfferStatuses.ACTIVE })
    );
    expect(updated.status).toBe(MarketplaceOfferStatuses.ACTIVE);
    // Витрина обязана узнать о вернувшемся предложении — тем же сигналом, что и
    // при одобрении.
    expect(eventBus.emit).toHaveBeenCalledWith(
      MARKETPLACE_OFFER_APPROVED_EVENT,
      expect.objectContaining({ offer_id: 'offer-1', supplier_account: SUPPLIER })
    );
    // И ни одного сигнала модерации: администратора дёргать не за чем.
    expect(askedForModeration(eventBus)).toBe(false);
  });

  it('не проходившее модерацию встаёт в очередь модерации, а не в каталог', async () => {
    const { service, repo, eventBus } = buildService(buildOffer({ approved_at: null } as never));

    const updated = await service.republish('offer-1', SUPPLIER);

    expect(repo.applyUpdate).toHaveBeenCalledWith(
      'offer-1',
      expect.objectContaining({ status: MarketplaceOfferStatuses.PENDING_MODERATION })
    );
    expect(updated.status).toBe(MarketplaceOfferStatuses.PENDING_MODERATION);
    // Сигнала «появилось в каталоге» быть не должно: карточку ещё не смотрели.
    expect(eventBus.emit).not.toHaveBeenCalledWith(
      MARKETPLACE_OFFER_APPROVED_EVENT,
      expect.anything()
    );
    expect(askedForModeration(eventBus)).toBe(true);
  });

});
