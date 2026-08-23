import { Entity, Column, Index, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export const EntityName = 'expense_requisite_snapshots';

/**
 * Снимок реквизитов получателя по строке расхода — фиксируется в момент
 * создания СЗ (как payment_details в gateway-платежах): последующее изменение
 * или удаление платёжного метода пайщиком не меняет то, куда платить по уже
 * поданной смете. Источник реквизитов для поручения бухгалтеру (payexp).
 */
@Entity(EntityName)
@Index(`uq_${EntityName}_item`, ['coopname', 'proposal_hash', 'item_hash'], { unique: true })
@Index(`idx_${EntityName}_proposal`, ['coopname', 'proposal_hash'])
export class ExpenseRequisiteSnapshotTypeormEntity {
  static getTableName(): string {
    return EntityName;
  }

  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar' })
  coopname!: string;

  @Column({ type: 'varchar' })
  proposal_hash!: string;

  @Column({ type: 'varchar' })
  item_hash!: string;

  @Column({ type: 'varchar', comment: 'Получатель платежа (username пайщика или имя организации)' })
  recipient!: string;

  @Column({ type: 'varchar', nullable: true, comment: 'Идентификатор платёжного метода получателя (для пайщиков)' })
  method_id!: string | null;

  @Column({ type: 'varchar', nullable: true, comment: 'Тип метода (sbp / bank_transfer)' })
  method_type!: string | null;

  @Column({ type: 'jsonb', nullable: true, comment: 'Снимок данных платёжного метода на момент создания СЗ' })
  data!: Record<string, unknown> | null;

  @Column({ type: 'text', comment: 'Реквизиты строкой — как в документе СЗ' })
  requisites!: string;

  @Column({ type: 'text', nullable: true, comment: 'Назначение платежа (оплата по счёту) — для поручения кассиру' })
  payment_purpose!: string | null;

  @CreateDateColumn()
  created_at!: Date;
}
