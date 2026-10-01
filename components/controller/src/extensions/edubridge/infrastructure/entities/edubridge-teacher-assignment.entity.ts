import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { EduAssignmentStatus } from '../../domain/enums';

/**
 * Допуск преподавателя к курсу: курс, расписание, ожидаемый результат, период.
 * Рабочее назначение кооператива — документа и подписей не требует, условия
 * участия преподавателя определяет договор УХД.
 */
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

  /**
   * Нагрузка преподавателя по курсу, часов в месяц. Сумма нагрузок по ставкам
   * назначенных преподавателей — факт себестоимости против планового расчёта курса.
   */
  @Column({ type: 'int', default: 0 })
  public minutes_per_month!: number;

  @Column({ type: 'enum', enum: EduAssignmentStatus, default: EduAssignmentStatus.ACTIVE })
  public status!: EduAssignmentStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
