import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { EduReturnStatus } from '../../domain/enums';

/**
 * Заявка пайщика на возврат остатка кошелька программы в паевой взнос.
 * Положение ЦПП «Образование» (пп. 4.2.4, 4.2.5) требует заявления Участника и
 * согласования Общества: заявка ждёт решения кооператива, и только после него
 * подписанное заявление уходит в цепь.
 */
@Entity({ name: 'edubridge_return_requests' })
@Index('IDX_edubridge_return_requests_member', ['coopname', 'member_username', 'status'])
@Index('IDX_edubridge_return_requests_statement', ['statement_hash'], { unique: true })
export class EdubridgeReturnRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'varchar', length: 13 })
  public member_username!: string;

  /** Сумма возврата с валютой («1250.0000 RUB») — та же, что в заявлении. */
  @Column({ type: 'varchar', length: 64 })
  public amount!: string;

  @Column({ type: 'varchar', length: 64 })
  public statement_hash!: string;

  /** Подписанное заявление 3013: в цепь оно уходит после согласования. */
  @Column({ type: 'jsonb' })
  public statement_document!: Record<string, unknown>;

  @Column({ type: 'enum', enum: EduReturnStatus, default: EduReturnStatus.PENDING })
  public status!: EduReturnStatus;

  @Column({ type: 'varchar', length: 512, default: '' })
  public decline_reason!: string;

  /** Кто согласовал либо отклонил заявку. */
  @Column({ type: 'varchar', length: 13, nullable: true })
  public decided_by!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  public decided_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
