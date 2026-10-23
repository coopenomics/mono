
/**
 * Story 3.2/3.5: справочник baseline-категорий Стола заказов.
 * Сидируется bootstrap-v4 миграцией (`marketplace-bootstrap-v4`).
 *
 * Эпик 16: кооператив добавляет собственные категории поверх baseline —
 * строки с `mvp_baseline = false` и заполненным `coopname` (владелец).
 * baseline-строки общие (`coopname = NULL`), удалять их нельзя; кастомные
 * принадлежат конкретному кооперативу и редактируемы (создание/удаление).
 */
export class MarketplaceCategoryEntity {
  public id!: number;

  public display_name!: string;

  public sort_order!: number;

  public mvp_baseline!: boolean;

  /**
   * Владелец кастомной категории. NULL для общих baseline-категорий,
   * имя кооператива — для добавленных им собственных категорий.
   */
  public coopname?: string | null;
}
