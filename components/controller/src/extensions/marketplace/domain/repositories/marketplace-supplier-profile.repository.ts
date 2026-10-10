import type { MarketplaceOfferImage } from '../entities/marketplace-offer.types';
import type { MarketplaceSupplierProfileDomainEntity } from '../entities/marketplace-supplier-profile.entity';

export const MARKETPLACE_SUPPLIER_PROFILE_REPOSITORY = Symbol('MARKETPLACE_SUPPLIER_PROFILE_REPOSITORY');

export interface SupplierProfilePatch {
  display_name: string | null;
  about: string;
  cover: MarketplaceOfferImage | null;
}

/** Хранилище профилей поставщиков: одна запись на пару (кооператив, учётная запись). */
export interface MarketplaceSupplierProfileDomainRepository {
  find(coopname: string, supplier_account: string): Promise<MarketplaceSupplierProfileDomainEntity | null>;

  /** Создаёт профиль либо переписывает существующий целиком. */
  save(
    coopname: string,
    supplier_account: string,
    patch: SupplierProfilePatch
  ): Promise<MarketplaceSupplierProfileDomainEntity>;
}
