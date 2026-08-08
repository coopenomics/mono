export const MARKETPLACE_SUPPLIER_SETTINGS_REPOSITORY = Symbol(
  'MARKETPLACE_SUPPLIER_SETTINGS_REPOSITORY'
);

/**
 * Хранилище выбора поставщика «выплаты получаю на…» — ссылка на платёжный
 * метод ядра (реквизиты пайщика). Сами реквизиты живут в ядре и здесь не
 * дублируются.
 */
export interface MarketplaceSupplierSettingsDomainRepository {
  getPayoutMethodId(coopname: string, username: string): Promise<string | null>;

  /** Upsert: одна запись на пару (coopname, username). */
  setPayoutMethodId(coopname: string, username: string, method_id: string): Promise<void>;
}
