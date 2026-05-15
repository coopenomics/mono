import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * Story 3.1: whitelist пайщиков-поставщиков.
 *
 * Записи:
 *   `role='auto-coop'` — сам кооператив (неудаляемая, ставится bootstrap-v3
 *     afterMigrate, нужна для FR5 — перепоставка остатков самим коопом);
 *   `role='manual'`    — пайщик, добавленный админом mutation'ом
 *     `marketplaceAddToWhitelist`.
 *
 * Семантика whitelist (Story 3.1 + Story 1.6):
 *   - если в whitelist есть хотя бы одна `manual`-запись → витрина «по
 *     whitelist», marketplace-role `offerer` выдаётся только пайщикам из
 *     whitelist;
 *   - если whitelist содержит только `auto-coop` → витрина «открытая»,
 *     `offerer` выдаётся всем `User`.
 */
@Entity({ name: 'marketplace_whitelist' })
@Unique('uq_marketplace_whitelist_member', ['cooperative_id', 'member_account'])
@Index(['cooperative_id'])
export class MarketplaceWhitelistEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public cooperative_id!: string;

  @Column({ type: 'varchar', length: 13 })
  public member_account!: string;

  @Column({ type: 'varchar', length: 32 })
  public role!: 'auto-coop' | 'manual';

  @Column({ type: 'varchar', length: 13, nullable: true })
  public added_by!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  public added_at!: Date;
}
