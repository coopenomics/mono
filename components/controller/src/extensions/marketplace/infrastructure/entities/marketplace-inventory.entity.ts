import type {
  MarketplaceBarcodeFormat,
  MarketplaceInventoryOwnership,
  MarketplaceInventoryStatus,
  MarketplaceInventoryOrigin,
} from '../../domain/entities/marketplace-inventory.types';
import {
  MarketplaceUnitsOfMeasure,
  type MarketplaceUnitOfMeasure,
} from '../../domain/entities/marketplace-offer.types';

/**
 * TypeORM-сущность склада КУ. Запись рождается на приёмке кооперативом по акту
 * (`ACCEPTED_TO_COOP`), статус стартует `RECEIVED`; маркировка наклеивает
 * штрих-код (`LABELED`), выдача/возврат/списание — Эпики 6/7/8.
 *
 * Hot-path индексы:
 *   - `(coopname, barcode_value)` unique — поиск сканером при выдаче
 *     (NULL допускает множество непромаркированных позиций — NULL ≠ NULL в PG);
 *   - `(coopname, order_id, status)` — позиции per-Order;
 *   - `(coopname, braname, status)` — стол склада КУ (Эпик 9);
 *   - `(coopname, shipment_id)` — журнал per-партия.
 */
// Story 8.3: cron сканирует позиции на складе (RECEIVED/LABELED) с приближающимся expiry_date.
// requirement 76: обезличенный остаток КУ (вкладка склада) и резерв под заказ из остатка.
// Эпик 19: содержимое ячейки — сетка склада и гард «непустую не деактивировать».
export class MarketplaceInventoryEntity {
  public id!: string;

  public coopname!: string;

  // Штрих-код опционален: позиция лежит на складе и без маркировки.
  public barcode_value!: string | null;

  public barcode_format!: MarketplaceBarcodeFormat | null;

  public order_id!: string;

  public shipment_id!: string;

  public braname!: string;

  public status!: MarketplaceInventoryStatus;

  public product_name_snapshot!: string;

  public quantity_per_label!: number;

  public orderer_account_snapshot!: string;

  /**
   * @deprecated Эпик 19 — прежняя полка свободной строкой. Код её больше не
   * читает и не пишет: адрес переехал в `cell_id` (ячейка) / `container_id`
   * (бокс). Колонка оставлена объявленной до подтверждения бэкфилла на проде —
   * `synchronize:true` дропнул бы её на старте, раньше чем миграция v13
   * успеет перенести адреса. Снимается отдельной миграцией следующим релизом.
   */
  public shelf!: string | null;

  // Ячейка хранения, если позиция лежит на складе напрямую (негабарит).
  // Взаимоисключающа с `container_id`; обе NULL — место ещё не назначено.
  public cell_id!: string | null;

  // Бокс, в котором лежит позиция — основной путь размещения.
  // Взаимоисключающ с `cell_id`; ячейка выводится через сам бокс.
  public container_id!: string | null;

  // Момент и оператор приёмки кооперативом по акту. nullable — synchronize
  // добавляет колонку без backfill для исторических записей.
  public received_at!: Date | null;

  public received_by_operator_account!: string | null;

  // Момент/оператор маркировки штрих-кодом; NULL — позиция не промаркирована.
  public labeled_at!: Date | null;

  public labeled_by_operator_account!: string | null;

  /**
   * Story 8.3: срок годности (received_at + Offer.warranty_days * 86400);
   * nullable для бессрочных Offer'ов и legacy-записей без warranty_days.
   */
  public expiry_date!: Date | null;

  // requirement 76: принадлежность позиции — адресная под заказ (ORDER) либо
  // обезличенный остаток кооператива (COOP). Default — для legacy-записей.
  public ownership!: MarketplaceInventoryOwnership;

  // 99D-13: происхождение позиции — приёмка от поставщика либо гарантийный
  // возврат пайщика, принятый по решению совета. Возвращённое лежит в остатке
  // как обычное имущество, но оператор видит пометку. Default — для legacy.
  public origin!: MarketplaceInventoryOrigin;

  public return_claim_id!: string | null;

  // Цена прибытия за ЕДИНИЦУ ОТПУСКА (закупочная из акта приёмки) — база
  // публикации остатка. По мере — за базовую единицу, упаковкой — за упаковку
  // (см. package_size ниже и канон единицы отпуска в README расширения).
  // nullable: synchronize добавляет колонку без backfill.
  public arrival_price!: string | null;

  /**
   * Содержимое упаковки в базовой единице — снапшот фасовки, в которой
   * имущество принято на склад (Эпик 18). 0 = отпуск по мере (`arrival_price`
   * за базовую единицу); >0 = упаковкой (`arrival_price` за упаковку,
   * `quantity_per_label` кратно `package_size`).
   *
   * Без этого поля цена и количество позиции разной размерности, и любое
   * `arrival_price × quantity_per_label` завышает сумму в `package_size` раз
   * (инцидент 2026-08-12: списание десятка яиц ушло в совет на 1500 ₽ вместо
   * 150 ₽). `synchronize:true` создаёт колонку с default 0.
   */
  public package_size!: number;

  /**
   * Базовая единица измерения имущества (штука/килограмм/литр), снапшот с
   * приёмки. Денормализована вместе с фасовкой: без неё размерность цены и
   * количества позиции приходилось восстанавливать окольным путём — через
   * заказ и оферту, по запросу на каждую партию склада.
   */
  public unit_of_measure!: MarketplaceUnitOfMeasure;

  // Оффер кооператива, которым остаток опубликован в каталоге; NULL — нет.
  public published_offer_id!: string | null;

  // Заказ из остатка, под который позиция зарезервирована; NULL — свободна.
  public reserved_order_id!: string | null;

  public created_at!: Date;

  public updated_at!: Date;
}
