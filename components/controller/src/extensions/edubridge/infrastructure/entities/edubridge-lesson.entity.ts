import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Проведённое занятие: журнал курса. Преподаватель отчитывается после занятия
 * материалами — ими работа овеществляется, — и по этому отчёту считается его
 * взнос: часы занятия по его ставке. План занятий задан курсом, поэтому номер
 * занятия вне плана в журнал не попадает, а второй отчёт по тому же занятию
 * отклоняется.
 */
@Entity({ name: 'edubridge_lessons' })
@Index('IDX_edubridge_lessons_unique', ['coopname', 'course_id', 'lesson_number'], { unique: true })
@Index('IDX_edubridge_lessons_teacher', ['coopname', 'teacher_username'])
export class EdubridgeLessonEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'varchar', length: 13 })
  public teacher_username!: string;

  @Column({ type: 'uuid' })
  public course_id!: string;

  @Column({ type: 'uuid' })
  public assignment_id!: string;

  /** Номер занятия в программе курса — от единицы до числа занятий курса. */
  @Column({ type: 'int' })
  public lesson_number!: number;

  @Column({ type: 'timestamptz' })
  public held_at!: Date;

  /** Длительность занятия, минут: по умолчанию — из расписания курса. */
  @Column({ type: 'int' })
  public duration_minutes!: number;

  /** Материалы занятия: записи, конспекты, задания — ссылки на внешние хранилища. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  public materials!: string[];

  @Column({ type: 'text', default: '' })
  public topic!: string;

  /** Взнос, оформленный по этому занятию; null — отчёт без взноса. */
  @Column({ type: 'uuid', nullable: true })
  public contribution_id!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;
}
