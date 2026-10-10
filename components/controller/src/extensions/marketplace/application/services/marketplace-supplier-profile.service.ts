import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@coopenomics/extension-kit';
import { MarketplaceOfferStatuses, type MarketplaceOfferImage } from '../../domain/entities/marketplace-offer.types';
import {
  MARKETPLACE_SUPPLIER_PROFILE_ABOUT_MAX,
  MARKETPLACE_SUPPLIER_PROFILE_NAME_MAX,
  type MarketplaceSupplierProfileDomainEntity,
} from '../../domain/entities/marketplace-supplier-profile.entity';
import {
  MARKETPLACE_OFFER_REPOSITORY,
  type MarketplaceOfferDomainRepository,
} from '../../domain/repositories/marketplace-offer.repository';
import {
  MARKETPLACE_SUPPLIER_PROFILE_REPOSITORY,
  type MarketplaceSupplierProfileDomainRepository,
} from '../../domain/repositories/marketplace-supplier-profile.repository';
import { MarketplaceOfferImagesService } from './marketplace-offer-images.service';
import { MarketplaceOrderDisplayService } from './marketplace-order-display.service';
import { MarketplaceReviewService } from './marketplace-review.service';
import { MarketplaceSupplierRegistryService } from './marketplace-supplier-registry.service';

export interface SupplierProfileView {
  supplier_account: string;
  /** Имя на странице поставщика: заданное им название либо имя из сертификата. */
  display_name: string;
  /** Название, которое поставщик задал сам; null — используется имя из сертификата. */
  custom_display_name: string | null;
  about: string;
  cover: MarketplaceOfferImage | null;
  /** Профиль кооператива: он поставщик имущества со своего склада. */
  is_cooperative: boolean;
  /** Предложения, доступные к заказу в каталоге. */
  offers_count: number;
  rating_avg: number | null;
  reviews_count: number;
  updated_at: Date | null;
}

export interface SupplierProfileUpdate {
  about?: string | null;
  display_name?: string | null;
  /** Новая обложка: содержимое файла в base64 и его тип. */
  cover?: { base64: string; mime_type: string } | null;
  /** Убрать обложку. */
  remove_cover?: boolean | null;
}

/**
 * Профиль поставщика — страница, на которой заказчик видит, кто поставщик,
 * что он поставляет и что о нём говорят (задача 598-61).
 *
 * Профиль есть у каждого, кто поставляет имущество: у поставщика из реестра,
 * у кооператива (остаток его склада) и у учётной записи с предложениями.
 * Пока поставщик ничего о себе не написал, страница показывает имя из его
 * сертификата, его предложения и отзывы.
 */
@Injectable()
export class MarketplaceSupplierProfileService {
  constructor(
    @Inject(MARKETPLACE_SUPPLIER_PROFILE_REPOSITORY)
    private readonly profiles: MarketplaceSupplierProfileDomainRepository,
    @Inject(MARKETPLACE_OFFER_REPOSITORY)
    private readonly offers: MarketplaceOfferDomainRepository,
    private readonly registry: MarketplaceSupplierRegistryService,
    private readonly display: MarketplaceOrderDisplayService,
    private readonly images: MarketplaceOfferImagesService,
    private readonly reviews: MarketplaceReviewService
  ) {}

  async getProfile(coopname: string, supplier_account: string): Promise<SupplierProfileView> {
    const [profile, offers_count, summary] = await Promise.all([
      this.profiles.find(coopname, supplier_account),
      this.countCatalogOffers(coopname, supplier_account),
      this.reviews.summary(coopname, { supplier_account }),
    ]);

    if (!profile && offers_count === 0 && !(await this.registry.isOfferer(coopname, supplier_account))) {
      throw DomainError.notFound('MARKETPLACE_SUPPLIER_PROFILE_NOT_FOUND');
    }

    const custom_display_name = profile?.display_name?.trim() || null;
    return {
      supplier_account,
      display_name: custom_display_name ?? (await this.certificateName(supplier_account)),
      custom_display_name,
      about: profile?.about ?? '',
      cover: profile?.cover ?? null,
      is_cooperative: supplier_account === coopname,
      offers_count,
      rating_avg: summary.rating_avg,
      reviews_count: summary.reviews_count,
      updated_at: profile?.updated_at ?? null,
    };
  }

  /**
   * Поставщик правит свой профиль. Незаданное поле остаётся прежним; пустая
   * строка в названии возвращает имя из сертификата.
   */
  async updateProfile(
    coopname: string,
    supplier_account: string,
    update: SupplierProfileUpdate
  ): Promise<SupplierProfileView> {
    const current = await this.profiles.find(coopname, supplier_account);
    const about = nextAbout(update, current);
    const display_name = nextDisplayName(update, current);
    const cover = await this.nextCover(coopname, supplier_account, update, current?.cover ?? null);

    await this.profiles.save(coopname, supplier_account, { about, display_name, cover });
    return this.getProfile(coopname, supplier_account);
  }

  /** Ссылка на обложку для показа; обложки нет — null. */
  async coverUrl(cover: MarketplaceOfferImage | null): Promise<string | null> {
    return cover ? this.images.getReadUrl(cover.bucket_key) : null;
  }

  /** Имя из сертификата пайщика; сертификат не читается — учётная запись. */
  private async certificateName(supplier_account: string): Promise<string> {
    return (await this.display.resolveAccountName(supplier_account)) ?? supplier_account;
  }

  /** Обложка после правки: новая, прежняя либо никакой. */
  private async nextCover(
    coopname: string,
    supplier_account: string,
    update: SupplierProfileUpdate,
    current: MarketplaceOfferImage | null
  ): Promise<MarketplaceOfferImage | null> {
    if (update.cover) {
      // Файл обложки лежит рядом с изображениями предложений поставщика и
      // назван по содержимому: прежний файл не удаляется — то же изображение
      // может стоять и в его предложении.
      return this.images.putImage({
        bytes: Buffer.from(update.cover.base64, 'base64'),
        contentType: update.cover.mime_type,
        coopname,
        ownerAccount: supplier_account,
      });
    }
    return update.remove_cover ? null : current;
  }

  /** Число предложений поставщика, которые заказчик видит в каталоге. */
  private async countCatalogOffers(coopname: string, supplier_account: string): Promise<number> {
    const page = await this.offers.list(
      { coopname, supplier_account, status: MarketplaceOfferStatuses.ACTIVE, available_only: true },
      { page: 1, limit: 1, sortBy: 'created_at', sortOrder: 'DESC' }
    );
    return page.totalCount;
  }
}

/** Рассказ о себе после правки: не задан — прежний. */
function nextAbout(update: SupplierProfileUpdate, current: MarketplaceSupplierProfileDomainEntity | null): string {
  if (update.about === undefined) return current?.about ?? '';
  const about = (update.about ?? '').trim();
  if (about.length > MARKETPLACE_SUPPLIER_PROFILE_ABOUT_MAX) {
    throw DomainError.badRequest('MARKETPLACE_SUPPLIER_PROFILE_ABOUT_TOO_LONG', {
      max: MARKETPLACE_SUPPLIER_PROFILE_ABOUT_MAX,
    });
  }
  return about;
}

/** Название после правки: не задано — прежнее; пустая строка — названия нет. */
function nextDisplayName(
  update: SupplierProfileUpdate,
  current: MarketplaceSupplierProfileDomainEntity | null
): string | null {
  if (update.display_name === undefined) return current?.display_name ?? null;
  const display_name = (update.display_name ?? '').trim() || null;
  if (display_name && display_name.length > MARKETPLACE_SUPPLIER_PROFILE_NAME_MAX) {
    throw DomainError.badRequest('MARKETPLACE_SUPPLIER_PROFILE_NAME_TOO_LONG', {
      max: MARKETPLACE_SUPPLIER_PROFILE_NAME_MAX,
    });
  }
  return display_name;
}
