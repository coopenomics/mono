import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { EduContributionStatus, EduRidType } from '../../domain/enums';

/** Паевой взнос преподавателя результатами работы (РИД). `rid_hash` — ключ записи в цепи (`edubridge::edurids`). */
@Entity({ name: 'edubridge_contributions' })
@Index('IDX_edubridge_contributions_rid_hash', ['rid_hash'], { unique: true })
@Index('IDX_edubridge_contributions_teacher', ['coopname', 'teacher_username', 'status'])
export class EdubridgeContributionEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'varchar', length: 13 })
  public teacher_username!: string;

  @Column({ type: 'uuid' })
  public assignment_id!: string;

  @Column({ type: 'varchar', length: 64 })
  public rid_hash!: string;

  @Column({ type: 'enum', enum: EduRidType })
  public rid_type!: EduRidType;

  /** Перечень ссылок на внешние хранилища. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  public links!: string[];

  @Column({ type: 'text', default: '' })
  public description!: string;

  /** Сумма взноса — asset-строка цепи. */
  @Column({ type: 'varchar', length: 64 })
  public amount!: string;

  @Column({ type: 'enum', enum: EduContributionStatus, default: EduContributionStatus.DRAFT })
  public status!: EduContributionStatus;

  @Column({ type: 'varchar', length: 64, nullable: true })
  public statement_hash!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  public decision_hash!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  public act_hash!: string | null;

  /** Акт с подписью преподавателя — председатель присоединяет свою к этому же документу. */
  @Column({ type: 'jsonb', nullable: true })
  public act_signed!: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  public decline_reason!: string | null;

  /** Хеш проекта решения совета (правило отслеживания ядра). */
  @Column({ type: 'varchar', length: 64, nullable: true })
  public council_project_hash!: string | null;

  /** Номер решения совета, когда принято. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  public council_decision_id!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  public decided_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
