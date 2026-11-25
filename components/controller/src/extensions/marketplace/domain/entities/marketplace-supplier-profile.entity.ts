import type { MarketplaceOfferImage } from './marketplace-offer.types';

export const MARKETPLACE_SUPPLIER_PROFILE_ABOUT_MAX = 4000;
export const MARKETPLACE_SUPPLIER_PROFILE_NAME_MAX = 200;

/**
 * Профиль поставщика: что он рассказывает о себе заказчикам (задача 598-61).
 * Один на учётную запись. Запись появляется при первом сохранении — до этого
 * страница поставщика показывает имя из сертификата и его предложения.
 */
export class MarketplaceSupplierProfileDomainEntity {
  public readonly id!: string;
  public readonly coopname!: string;
  public readonly supplier_account!: string;
  /** Название, которое поставщик задал сам; null — показывается имя из сертификата. */
  public readonly display_name!: string | null;
  public readonly about!: string;
  /** Обложка в хранилище изображений Стола заказов; null — обложки нет. */
  public readonly cover!: MarketplaceOfferImage | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  constructor(init: {
    id: string;
    coopname: string;
    supplier_account: string;
    display_name: string | null;
    about: string;
    cover: MarketplaceOfferImage | null;
    created_at: Date;
    updated_at: Date;
  }) {
    this.id = init.id;
    this.coopname = init.coopname;
    this.supplier_account = init.supplier_account;
    this.display_name = init.display_name;
    this.about = init.about;
    this.cover = init.cover;
    this.created_at = init.created_at;
    this.updated_at = init.updated_at;
  }
}
