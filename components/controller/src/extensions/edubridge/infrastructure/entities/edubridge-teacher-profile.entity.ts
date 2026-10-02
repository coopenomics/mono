import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Профиль преподавателя: что он рассказал о себе и какую ставку часа назвал
 * при подключении. Заполняется первым шагом подключения — до оферты и
 * договора, поэтому живёт отдельно от договора УХД: договора в этот момент
 * ещё нет.
 */
@Entity({ name: 'edubridge_teacher_profiles' })
@Index('IDX_edubridge_teacher_profiles_unique', ['coopname', 'teacher_username'], { unique: true })
export class EdubridgeTeacherProfileEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'varchar', length: 13 })
  public teacher_username!: string;

  /** О себе: чему и как учит, опыт, образование — текст для карточки преподавателя. */
  @Column({ type: 'text', default: '' })
  public about!: string;

  /**
   * Ставка часа, названная при подключении («1000.0000 RUB»). С подписью
   * договора она переходит в договор, и дальше её правит администратор —
   * источник правды о действующей ставке — договор, а не профиль.
   */
  @Column({ type: 'varchar', length: 64, default: '0.0000 RUB' })
  public hourly_rate!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
