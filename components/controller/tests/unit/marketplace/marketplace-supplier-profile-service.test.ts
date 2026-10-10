/**
 * Профиль поставщика (задача 598-61, случаи mkt.profile.* в
 * test-registry/marketplace.reviews.yaml).
 *
 * Инварианты:
 *   - профиль есть у поставщика из реестра, у кооператива и у учётной записи с
 *     предложениями — даже когда о себе он ещё ничего не написал;
 *   - имя — заданное поставщиком название, иначе имя из сертификата;
 *   - правка не трогает поля, которые в запросе не названы.
 */
import { MarketplaceSupplierProfileService } from '~/extensions/marketplace/application/services/marketplace-supplier-profile.service';
import { MarketplaceOfferStatuses } from '~/extensions/marketplace/domain/entities/marketplace-offer.types';
import {
  MARKETPLACE_SUPPLIER_PROFILE_ABOUT_MAX,
  MARKETPLACE_SUPPLIER_PROFILE_NAME_MAX,
  MarketplaceSupplierProfileDomainEntity,
} from '~/extensions/marketplace/domain/entities/marketplace-supplier-profile.entity';
import type { SupplierProfilePatch } from '~/extensions/marketplace/domain/repositories/marketplace-supplier-profile.repository';

const COOP = 'voskhod';
const NOW = new Date('2026-10-10T10:00:00Z');
const COVER = { bucket_key: 'offers/voskhod/sup1/abc.jpg', content_hash: 'abc', mime_type: 'image/jpeg' };

function makeProfile(over: Partial<MarketplaceSupplierProfileDomainEntity> = {}): MarketplaceSupplierProfileDomainEntity {
  return new MarketplaceSupplierProfileDomainEntity({
    id: 'p1',
    coopname: COOP,
    supplier_account: 'sup1',
    display_name: 'Ферма «Заря»',
    about: 'Молоко и сыр',
    cover: COVER,
    created_at: NOW,
    updated_at: NOW,
    ...over,
  });
}

function build(world: { profile?: MarketplaceSupplierProfileDomainEntity | null; offers?: number; offerer?: boolean } = {}) {
  let stored = world.profile ?? null;
  const profiles = {
    find: jest.fn(async () => stored),
    save: jest.fn(async (_coopname: string, supplier_account: string, patch: SupplierProfilePatch) => {
      stored = makeProfile({ supplier_account, ...patch });
      return stored;
    }),
  };
  const offers = { list: jest.fn().mockResolvedValue({ items: [], totalCount: world.offers ?? 0, totalPages: 1, currentPage: 1 }) };
  const registry = { isOfferer: jest.fn().mockResolvedValue(world.offerer ?? false) };
  const display = { resolveAccountName: jest.fn().mockResolvedValue('Иванов Иван Иванович') };
  const images = {
    putImage: jest.fn().mockResolvedValue({ bucket_key: 'offers/voskhod/sup1/new.png', content_hash: 'new', mime_type: 'image/png' }),
    getReadUrl: jest.fn(async (key: string) => `https://files.test/${key}`),
  };
  const reviews = {
    summary: jest.fn().mockResolvedValue({ rating_avg: 4.8, reviews_count: 12, stars_breakdown: [] }),
  };
  const service = new MarketplaceSupplierProfileService(
    profiles as any,
    offers as any,
    registry as any,
    display as any,
    images as any,
    reviews as any
  );
  return { service, profiles, offers, registry, display, images, reviews };
}

describe('чтение профиля поставщика', () => {
  // mkt.profile.happy.01
  it('профиль с названием, рассказом, числом предложений каталога и сводной оценкой', async () => {
    const { service, offers, reviews, display } = build({ profile: makeProfile(), offers: 3 });

    const view = await service.getProfile(COOP, 'sup1');

    expect(view).toMatchObject({
      supplier_account: 'sup1',
      display_name: 'Ферма «Заря»',
      custom_display_name: 'Ферма «Заря»',
      about: 'Молоко и сыр',
      cover: COVER,
      is_cooperative: false,
      offers_count: 3,
      rating_avg: 4.8,
      reviews_count: 12,
      updated_at: NOW,
    });
    // Считаются те же предложения, что заказчик видит в каталоге.
    expect(offers.list).toHaveBeenCalledWith(
      { coopname: COOP, supplier_account: 'sup1', status: MarketplaceOfferStatuses.ACTIVE, available_only: true },
      expect.objectContaining({ page: 1, limit: 1 })
    );
    expect(reviews.summary).toHaveBeenCalledWith(COOP, { supplier_account: 'sup1' });
    // Название задано — сертификат не читается.
    expect(display.resolveAccountName).not.toHaveBeenCalled();
  });

  // mkt.profile.happy.02
  it('поставщик о себе ничего не писал: имя из сертификата, рассказ пуст, страница открывается', async () => {
    const { service } = build({ profile: null, offers: 2 });

    const view = await service.getProfile(COOP, 'sup1');

    expect(view).toMatchObject({
      display_name: 'Иванов Иван Иванович',
      custom_display_name: null,
      about: '',
      cover: null,
      offers_count: 2,
      updated_at: null,
    });
  });

  // mkt.profile.happy.03
  it('кооператив — поставщик имущества со своего склада: профиль помечен и открывается без предложений', async () => {
    const { service } = build({ profile: null, offers: 0, offerer: true });

    const view = await service.getProfile(COOP, COOP);

    expect(view.is_cooperative).toBe(true);
    expect(view.offers_count).toBe(0);
  });

  // mkt.profile.side.01
  it('поставщик из реестра без предложений и без профиля — страница открывается', async () => {
    const { service, registry } = build({ profile: null, offers: 0, offerer: true });

    await expect(service.getProfile(COOP, 'sup1')).resolves.toMatchObject({ supplier_account: 'sup1' });
    expect(registry.isOfferer).toHaveBeenCalledWith(COOP, 'sup1');
  });

  // mkt.profile.side.02
  it('учётная запись без профиля, без предложений и вне реестра — «не найдено»', async () => {
    const { service } = build({ profile: null, offers: 0, offerer: false });

    await expect(service.getProfile(COOP, 'nobody')).rejects.toMatchObject({
      code: 'MARKETPLACE_SUPPLIER_PROFILE_NOT_FOUND',
    });
  });

  // mkt.profile.side.03
  it('сертификат не читается — имя заменяет учётная запись', async () => {
    const { service, display } = build({ profile: null, offers: 1 });
    display.resolveAccountName.mockResolvedValue(null);

    await expect(service.getProfile(COOP, 'sup1')).resolves.toMatchObject({ display_name: 'sup1' });
  });
});

describe('правка профиля', () => {
  // mkt.profile.happy.04
  it('первое сохранение создаёт профиль: текст обрезается по краям, обложка уходит в хранилище', async () => {
    const { service, profiles, images } = build({ profile: null, offerer: true });

    const view = await service.updateProfile(COOP, 'sup1', {
      about: '  Овощи с грядки  ',
      display_name: ' Огород ',
      cover: { base64: Buffer.from('png-bytes').toString('base64'), mime_type: 'image/png' },
    });

    expect(images.putImage).toHaveBeenCalledWith({
      bytes: Buffer.from('png-bytes'),
      contentType: 'image/png',
      coopname: COOP,
      ownerAccount: 'sup1',
    });
    expect(profiles.save).toHaveBeenCalledWith(COOP, 'sup1', {
      about: 'Овощи с грядки',
      display_name: 'Огород',
      cover: { bucket_key: 'offers/voskhod/sup1/new.png', content_hash: 'new', mime_type: 'image/png' },
    });
    expect(view.display_name).toBe('Огород');
  });

  // mkt.profile.happy.05
  it('правка одного поля остальные не трогает', async () => {
    const { service, profiles, images } = build({ profile: makeProfile(), offers: 1 });

    await service.updateProfile(COOP, 'sup1', { about: 'Новый рассказ' });

    expect(profiles.save).toHaveBeenCalledWith(COOP, 'sup1', {
      about: 'Новый рассказ',
      display_name: 'Ферма «Заря»',
      cover: COVER,
    });
    expect(images.putImage).not.toHaveBeenCalled();
  });

  // mkt.profile.happy.06
  it('пустое название возвращает имя из сертификата, «убрать обложку» её снимает', async () => {
    const { service, profiles } = build({ profile: makeProfile(), offers: 1 });

    const view = await service.updateProfile(COOP, 'sup1', { display_name: '   ', remove_cover: true });

    expect(profiles.save).toHaveBeenCalledWith(COOP, 'sup1', { about: 'Молоко и сыр', display_name: null, cover: null });
    expect(view.display_name).toBe('Иванов Иван Иванович');
  });

  // mkt.profile.side.04
  it('рассказ и название длиннее предела — отказ, профиль не пишется', async () => {
    const { service, profiles } = build({ profile: makeProfile() });

    await expect(
      service.updateProfile(COOP, 'sup1', { about: 'а'.repeat(MARKETPLACE_SUPPLIER_PROFILE_ABOUT_MAX + 1) })
    ).rejects.toMatchObject({ code: 'MARKETPLACE_SUPPLIER_PROFILE_ABOUT_TOO_LONG' });
    await expect(
      service.updateProfile(COOP, 'sup1', { display_name: 'а'.repeat(MARKETPLACE_SUPPLIER_PROFILE_NAME_MAX + 1) })
    ).rejects.toMatchObject({ code: 'MARKETPLACE_SUPPLIER_PROFILE_NAME_TOO_LONG' });
    expect(profiles.save).not.toHaveBeenCalled();
  });

  // mkt.profile.break.01
  it('хранилище отвергло файл обложки — профиль не пишется', async () => {
    const { service, profiles, images } = build({ profile: makeProfile() });
    images.putImage.mockRejectedValue(Object.assign(new Error('type'), { code: 'MARKETPLACE_OFFER_IMAGE_TYPE_UNSUPPORTED' }));

    await expect(
      service.updateProfile(COOP, 'sup1', { cover: { base64: 'AAAA', mime_type: 'image/gif' } })
    ).rejects.toMatchObject({ code: 'MARKETPLACE_OFFER_IMAGE_TYPE_UNSUPPORTED' });
    expect(profiles.save).not.toHaveBeenCalled();
  });

  // mkt.profile.happy.07
  it('ссылка на обложку подписывается хранилищем; обложки нет — ссылки нет', async () => {
    const { service } = build();

    await expect(service.coverUrl(COVER)).resolves.toBe(`https://files.test/${COVER.bucket_key}`);
    await expect(service.coverUrl(null)).resolves.toBeNull();
  });
});
