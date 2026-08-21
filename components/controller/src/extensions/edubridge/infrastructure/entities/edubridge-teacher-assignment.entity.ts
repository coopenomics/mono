import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { EduAssignmentStatus } from '../../domain/enums';

/** Назначение преподавателю: курс, расписание, ожидаемый результат, период сдачи. Приложение к ДУХД (док. 3007). */
@Entity({ name: 'edubridge_teacher_assignments' })
@Index('IDX_edubridge_teacher_assignments_teacher', ['coopname', 'teacher_username'])
export class EdubridgeTeacherAssignmentEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'varchar', length: 13 })
  public teacher_username!: string;

  @Column({ type: 'uuid' })
  public course_id!: string;

  @Column({ type: 'text', default: '' })
  public schedule!: string;

  @Column({ type: 'text', default: '' })
  public expected_result!: string;

  @Column({ type: 'date' })
  public period_from!: string;

  @Column({ type: 'date' })
  public period_to!: string;

  /** Хеш подписанного приложения к ДУХД (док. 3007), lowercase; null — не подписано. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  public annex_hash!: string | null;

  @Column({ type: 'enum', enum: EduAssignmentStatus, default: EduAssignmentStatus.DRAFT })
  public status!: EduAssignmentStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
