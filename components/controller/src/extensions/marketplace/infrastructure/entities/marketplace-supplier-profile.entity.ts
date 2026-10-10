import type { MarketplaceOfferImage } from '../../domain/entities/marketplace-offer.types';

/** Запись таблицы `marketplace_supplier_profile` — профиль поставщика, один на учётную запись. */
export class MarketplaceSupplierProfileEntity {
  public id!: string;

  public coopname!: string;

  public supplier_account!: string;

  public display_name!: string | null;

  public about!: string;

  public cover!: MarketplaceOfferImage | null;

  public created_at!: Date;

  public updated_at!: Date;
}
