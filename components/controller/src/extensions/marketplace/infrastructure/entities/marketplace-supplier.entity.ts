
/**
 * Реестр поставщиков «Стола заказов» (PG, без on-chain).
 *
 * Заменяет таблицу whitelist: теперь все поставщики проходят через реестр и
 * допускаются к публикации поставок только при `status='approved'`. Сам
 * кооператив (перепоставка остатков, FR5) поставщиком в реестре не числится —
 * его право публиковать выводится по равенству `member_account === coopname`
 * в `isOfferer`, отдельная запись не нужна.
 *
 * Договор поставщика — внешний документ (бумажный по членской модели /
 * электронный ДУХД по боевой). В записи держим реквизиты (номер + дата) и,
 * на будущее, ссылку на сам документ; в назначение платежа выплаты идёт
 * «Оплата по договору № <contract_number> от <contract_date>».
 */
export class MarketplaceSupplierEntity {
  public id!: string;

  public coopname!: string;

  public member_account!: string;

  public model!: string;

  public status!: string;

  public contract_number!: string | null;

  public contract_date!: string | null;

  public contract_document_url!: string | null;

  public requested_by!: string | null;

  public requested_at!: Date;

  public reviewed_by!: string | null;

  public reviewed_at!: Date | null;
}
