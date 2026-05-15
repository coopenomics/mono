import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Story 3.2/3.5: справочник 10 baseline-категорий Стола заказов.
 * Сидируется bootstrap-v4 миграцией (`marketplace-bootstrap-v4`).
 */
@Entity({ name: 'marketplace_category' })
@Index(['sort_order'])
export class MarketplaceCategoryEntity {
  @PrimaryColumn({ type: 'integer' })
  public id!: number;

  @Column({ type: 'varchar', length: 200 })
  public display_name!: string;

  @Column({ type: 'integer' })
  public sort_order!: number;

  @Column({ type: 'boolean', default: true })
  public mvp_baseline!: boolean;
}
