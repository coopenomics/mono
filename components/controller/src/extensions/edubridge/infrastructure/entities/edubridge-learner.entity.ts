import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { EduRecipientType } from '../../domain/enums';

/**
 * Обучающийся — сам пайщик или его ребёнок. В приложение не заходит.
 * Контакт (`recipient_value`) — персональные данные: наружу только владельцу,
 * площадке уходит только он и ничего больше.
 */
@Entity({ name: 'edubridge_learners' })
@Index('IDX_edubridge_learners_member', ['coopname', 'member_username'])
export class EdubridgeLearnerEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  /** Пайщик-родитель (или сам обучающийся). */
  @Column({ type: 'varchar', length: 13 })
  public member_username!: string;

  @Column({ type: 'varchar', length: 255 })
  public display_name!: string;

  @Column({ type: 'enum', enum: EduRecipientType, default: EduRecipientType.EMAIL })
  public recipient_type!: EduRecipientType;

  /** Почта / telegram / код пропуска — по типу. */
  @Column({ type: 'varchar', length: 255 })
  public recipient_value!: string;

  @Column({ type: 'boolean', default: false })
  public is_self!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
