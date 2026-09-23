import { Column, CreateDateColumn, Entity, Generated, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { EdubridgeLevelEntity } from './edubridge-level.entity';
import { EdubridgeSectionEntity } from './edubridge-section.entity';
import { EduAccessCarrier, EduCourseDirection, EduCourseStatus } from '../../domain/enums';

/** Снимок объекта bucket'а `edubridge:images`; ссылка на чтение подписывается при отдаче. */
export interface EduCourseImage {
  bucket_key: string;
  content_hash: string;
  mime_type: string;
}

/** Курс каталога: раздел → уровень (справочник), карточка, привязка к курсу площадки. Off-chain. */
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

  /** Раздел каталога — из справочника (`edubridge_sections`). */
  @Column({ type: 'uuid', nullable: true })
  public section_id!: string | null;

  @ManyToOne(() => EdubridgeSectionEntity, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'section_id' })
  public section?: EdubridgeSectionEntity | null;

  /** Уровень внутри раздела — из справочника (`edubridge_levels`); пусто — без уровня. */
  @Column({ type: 'uuid', nullable: true })
  public level_id!: string | null;

  @ManyToOne(() => EdubridgeLevelEntity, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'level_id' })
  public level?: EdubridgeLevelEntity | null;

  /**
   * Раздел строкой — до справочника (7DD-23). Только для переноса в
   * справочник при запуске; код его не читает. Колонку убрать, когда перенос
   * пройдёт на всех кооперативах.
   */
  @Column({ name: 'subject', type: 'varchar', length: 120, nullable: true, default: '' })
  public legacy_subject!: string | null;

  /** Уровень строкой — до справочника (7DD-23), см. `legacy_subject`. */
  @Column({ name: 'grade', type: 'varchar', length: 60, nullable: true, default: '' })
  public legacy_grade!: string | null;

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

  /**
   * Сколько сейчас лежит в резерве выплат преподавателям по этому курсу. Резерв
   * наполняется до обязательства перед преподавателями за оплаченное время
   * курса, всё сверх него остаётся свободными средствами программы.
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  public teacher_reserve_balance!: string | null;

  /** Сколько преподавателям курса уже выплачено из резерва (принятые результаты). */
  @Column({ type: 'varchar', length: 64, nullable: true })
  public teacher_settled_total!: string | null;

  /** Принимает ли кооператив взнос за весь курс разом; иначе взнос только помесячный. */
  @Column({ type: 'boolean', default: false })
  public course_payment_enabled!: boolean;

  /** Скидка за взнос разом за весь курс, базисные пункты (100 = 1%); ограничена наценкой кооператива. */
  @Column({ type: 'int', default: 0 })
  public course_discount_bp!: number;

  /**
   * Членский взнос за месяц — asset-строка цепи («1000.0000 RUB»). Считает его
   * сервер из параметров выше, руками он не задаётся. Взнос за весь курс разом
   * отдельно не хранится: это месячный за месяцы курса со скидкой.
   */
  @Column({ type: 'varchar', length: 64 })
  public fee_month!: string;

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
