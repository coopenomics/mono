import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Story 3.2/3.5: справочник baseline-категорий Стола заказов.
 * Сидируется bootstrap-v4 миграцией (`marketplace-bootstrap-v4`).
 *
 * Эпик 16: кооператив добавляет собственные категории поверх baseline —
 * строки с `mvp_baseline = false` и заполненным `coopname` (владелец).
 * baseline-строки общие (`coopname = NULL`), удалять их нельзя; кастомные
 * принадлежат конкретному кооперативу и редактируемы (создание/удаление).
 */
@Entity({ name: 'marketplace_category' })
@Index(['sort_order'])
@Index(['coopname'])
export class MarketplaceCategoryEntity {
  @PrimaryColumn({ type: 'integer' })
  public id!: number;

  @Column({ type: 'varchar', length: 200 })
  public display_name!: string;

  @Column({ type: 'integer' })
  public sort_order!: number;

  @Column({ type: 'boolean', default: true })
  public mvp_baseline!: boolean;

  /**
   * Владелец кастомной категории. NULL для общих baseline-категорий,
   * имя кооператива — для добавленных им собственных категорий.
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  public coopname?: string | null;
}
