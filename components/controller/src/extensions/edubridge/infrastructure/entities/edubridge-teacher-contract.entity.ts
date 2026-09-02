import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { EduContractStatus } from '../../domain/enums';

/**
 * Договор участия в хозяйственной деятельности (док. 3006): первая подпись —
 * преподаватель, вторая — председатель совета через одобрение; зеркало
 * записи `educontracts` контракта.
 */
@Entity({ name: 'edubridge_teacher_contracts' })
@Index('IDX_edubridge_teacher_contracts_unique', ['coopname', 'teacher_username'], { unique: true })
export class EdubridgeTeacherContractEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'varchar', length: 13 })
  public teacher_username!: string;

  @Column({ type: 'varchar', length: 64 })
  public contract_hash!: string;

  @Column({ type: 'varchar', length: 32 })
  public contract_number!: string;

  @Column({ type: 'enum', enum: EduContractStatus, default: EduContractStatus.PENDING_APPROVAL })
  public status!: EduContractStatus;

  /** Причина отказа председателя; пусто, пока отказа не было. */
  @Column({ type: 'text', default: '' })
  public decline_reason!: string;

  /** Подпись председателя (вторая). */
  @Column({ type: 'timestamptz', nullable: true })
  public approved_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  public signed_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
