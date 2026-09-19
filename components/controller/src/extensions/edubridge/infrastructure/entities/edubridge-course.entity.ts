import { Column, CreateDateColumn, Entity, Generated, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { EduAccessCarrier, EduCourseDirection, EduCourseStatus } from '../../domain/enums';

/** Снимок объекта bucket'а `edubridge:images`; ссылка на чтение подписывается при отдаче. */
export interface EduCourseImage {
  bucket_key: string;
  content_hash: string;
  mime_type: string;
}

/** Курс каталога: предмет → класс, карточка, привязка к курсу площадки. Off-chain. */
@Entity({ name: 'edubridge_courses' })
@Index('IDX_edubridge_courses_coop_status', ['coopname', 'status'])
export class EdubridgeCourseEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  /** Числовой идентификатор для цепи (uint64): таблицы контракта не знают uuid. */
  @Column({ type: 'bigint', unique: true })
  @Generated('increment')
  public chain_ref!: string;

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

  /** Обложка карточки курса; `null` — без изображения. */
  @Column({ type: 'jsonb', nullable: true })
  public image!: EduCourseImage | null;

  /**
   * Преподаватели курса — учётные имена пайщиков с подписанным договором УХД.
   * Курс могут вести несколько; пустой список — ещё не назначены.
   */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  public teacher_usernames!: string[];

  /** Занятий в месяц по расписанию курса — основа месячного взноса. */
  @Column({ type: 'int', default: 0 })
  public lessons_per_month!: number;

  /**
   * Занятий во всей программе курса. По ним считается доля использованного
   * при отказе от подписки и начисление преподавателю за проведённое занятие.
   */
  @Column({ type: 'int', default: 0 })
  public lessons_total!: number;

  /** Длительность занятия, минут: расписание школы кратно минутам, не долям часа. */
  @Column({ type: 'int', default: 60 })
  public lesson_minutes!: number;

  /**
   * Плановая ставка часа по программе — себестоимость курса, пока преподаватели
   * не названы. Ставки назначенных преподавателей сравниваются с ней как факт с планом.
   */
  @Column({ type: 'varchar', length: 64, default: '0.0000 RUB' })
  public planned_hourly_rate!: string;

  /**
   * Дата активации курса — с неё начинаются занятия. До неё подписка считается
   * неактивированной: ученик отменяет её с полным возвратом. Администратор
   * может сдвинуть дату вперёд, пока группа не набрана.
   */
  @Column({ type: 'date', nullable: true })
  public starts_at!: string | null;

  /**
   * Гарантийный срок на материалы занятия, дней. Заявление преподавателя о
   * паевом взносе держится этот срок и уходит в совет само; подтверждённая
   * рекламация за это время снимает его. У каждого курса срок свой.
   */
  @Column({ type: 'int', default: 14 })
  public guarantee_days!: number;

  /** Скидка за годовой объём, базисные пункты (100 = 1%); ограничена наценкой кооператива. */
  @Column({ type: 'int', default: 0 })
  public year_discount_bp!: number;

  /**
   * Членский взнос за месяц и за год — asset-строки цепи («1000.0000 RUB»).
   * Считает их сервер из параметров выше, руками они не задаются.
   */
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

  /** Когда курс последний раз сверялся с площадкой (экспорт GetCourse лимитирован — сверка кэшируется). */
  @Column({ type: 'timestamptz', nullable: true })
  public external_checked_at!: Date | null;

  @Column({ type: 'enum', enum: EduCourseStatus, default: EduCourseStatus.DRAFT })
  public status!: EduCourseStatus;

  @Column({ type: 'int', default: 0 })
  public sort_order!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
