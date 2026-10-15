
/**
 * Настройки выплат поставщика стола заказов: на какие реквизиты (платёжный
 * метод ядра, раздел «Реквизиты» стола пайщика) поставщик получает выплаты
 * по актам приёма-передачи.
 *
 * Выбор глобальный для поставщика, а не per-Offer: смена банковского счёта
 * делается в одном месте и действует на все будущие выплаты — без обхода
 * каждой опубликованной карточки.
 */
export class MarketplaceSupplierSettingsEntity {
  public id!: string;

  public coopname!: string;

  public username!: string;

  /** method_id платёжного метода ядра; null — поставщик выбор не делал. */
  public payout_method_id!: string | null;

  public created_at!: Date;

  public updated_at!: Date;
}
