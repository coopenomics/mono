import { Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn, Index, Unique } from 'typeorm';

/**
 * Ручные корректировки балансов прошлых периодов для БУХБАЛАНСа.
 * Пара чисел на каждый счёт: `balance_previous` (год N-1) и
 * `balance_pre_previous` (год N-2), где N — `year` отчётности.
 * Используется для предзаполнения формы при повторной генерации.
 *
 * Ключ upsert — (coopname, year, account_display_id).
 */
@Entity('balance_corrections')
@Unique('uq_balance_corrections_coop_year_account', ['coopname', 'year', 'account_display_id'])
@Index(['coopname', 'year'])
export class BalanceCorrectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  coopname!: string;

  @Column({ type: 'int' })
  year!: number;

  @Column({ type: 'varchar', length: 20 })
  account_display_id!: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  balance_previous!: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  balance_pre_previous!: string;

  @Column({ type: 'varchar', length: 255 })
  updated_by!: string;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}
