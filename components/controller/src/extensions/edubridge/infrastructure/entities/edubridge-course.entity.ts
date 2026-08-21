import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { EduAccessCarrier, EduCourseDirection, EduCourseStatus } from '../../domain/enums';

/** Курс каталога: предмет → класс, карточка, привязка к курсу площадки. Off-chain. */
@Entity({ name: 'edubridge_courses' })
@Index('IDX_edubridge_courses_coop_status', ['coopname', 'status'])
export class EdubridgeCourseEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'varchar', length: 255 })
  public title!: string;

  @Column({ type: 'varchar', length: 120 })
  public subject!: string;

  /** Класс/уровень (например «7 класс»); свободная строка для сортировки в иерархии. */
  @Column({ type: 'varchar', length: 60 })
  public grade!: string;

  @Column({ type: 'text', default: '' })
  public description!: string;

  /** Учебная программа (markdown). */
  @Column({ type: 'text', default: '' })
  public syllabus!: string;

  @Column({ type: 'text', default: '' })
  public schedule!: string;

  /** Преподаватель (username пайщика); null — не назначен. */
  @Column({ type: 'varchar', length: 13, nullable: true })
  public teacher_username!: string | null;

  /** Членский взнос за месяц и за год — asset-строки цепи («1000.0000 RUB»). */
  @Column({ type: 'varchar', length: 64 })
  public fee_month!: string;

  @Column({ type: 'varchar', length: 64 })
  public fee_year!: string;

  @Column({ type: 'enum', enum: EduCourseDirection, default: EduCourseDirection.ONLINE_PLATFORM })
  public direction!: EduCourseDirection;

  @Column({ type: 'enum', enum: EduAccessCarrier })
  public carrier!: EduAccessCarrier;

  /** Идентификатор курса на площадке (для onsite — код заведения/группы). */
  @Column({ type: 'varchar', length: 255, default: '' })
  public external_ref!: string;

  /** Название курса на площадке при последней сверке — для обнаружения рассогласования. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  public external_title_seen!: string | null;

  @Column({ type: 'enum', enum: EduCourseStatus, default: EduCourseStatus.DRAFT })
  public status!: EduCourseStatus;

  @Column({ type: 'int', default: 0 })
  public sort_order!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
