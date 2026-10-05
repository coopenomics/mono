import { EdubridgeLevelRecord } from './edubridge-level.record';
import { EdubridgeSectionRecord } from './edubridge-section.record';
import { EduAccessCarrier, EduCourseDirection, EduCourseStatus } from '../../domain/enums';

/** Снимок объекта bucket'а `edubridge:images`; ссылка на чтение подписывается при отдаче. */
export interface EduCourseImage {
  bucket_key: string;
  content_hash: string;
  mime_type: string;
}

/** Курс каталога: раздел → уровень (справочник), карточка, привязка к курсу площадки. Off-chain. */
export class EdubridgeCourseRecord {
  public id!: string;

  public coopname!: string;

  /** Числовой идентификатор для цепи (uint64): таблицы контракта не знают uuid. */
  public chain_ref!: string;

  public title!: string;

  /** Раздел каталога — из справочника (`edubridge_sections`). */
  public section_id!: string | null;

  public section?: EdubridgeSectionRecord | null;

  /** Уровень внутри раздела — из справочника (`edubridge_levels`); пусто — без уровня. */
  public level_id!: string | null;

  public level?: EdubridgeLevelRecord | null;

  /**
   * Раздел строкой — до справочника (7DD-23). Только для переноса в
   * справочник при запуске; код его не читает. Колонку убрать, когда перенос
   * пройдёт на всех кооперативах.
   */
  public subject!: string | null;

  /** Уровень строкой — до справочника (7DD-23), см. `subject`. */
  public grade!: string | null;

  public description!: string;

  /** Учебная программа (markdown). */
  public syllabus!: string;

  public schedule!: string;

  /** Обложка карточки курса; `null` — без изображения. */
  public image!: EduCourseImage | null;

  /**
   * Преподаватели курса — учётные имена пайщиков с подписанным договором УХД.
   * Курс могут вести несколько; пустой список — ещё не назначены.
   */
  public teacher_usernames!: string[];

  /** Занятий в месяц по расписанию курса — основа месячного взноса. */
  public lessons_per_month!: number;

  /**
   * Занятий во всей программе курса. По ним считается доля использованного
   * при отказе от подписки и начисление преподавателю за проведённое занятие.
   */
  public lessons_total!: number;

  /** Длительность занятия, минут: расписание школы кратно минутам, не долям часа. */
  public lesson_minutes!: number;

  /**
   * Плановая ставка часа по программе — себестоимость курса, пока преподаватели
   * не названы. Ставки назначенных преподавателей сравниваются с ней как факт с планом.
   */
  public planned_hourly_rate!: string;

  /**
   * Дата активации курса — с неё начинаются занятия. До неё подписка считается
   * неактивированной: ученик отменяет её с полным возвратом. Администратор
   * может сдвинуть дату вперёд, пока группа не набрана.
   */
  public starts_at!: string | null;

  /**
   * Гарантийный срок на материалы занятия, дней. Заявление преподавателя о
   * паевом взносе держится этот срок и уходит в совет само; подтверждённая
   * рекламация за это время снимает его. У каждого курса срок свой.
   */
  public guarantee_days!: number;

  /**
   * Сколько сейчас лежит в резерве выплат преподавателям по этому курсу. Резерв
   * наполняется до обязательства перед преподавателями за оплаченное время
   * курса, всё сверх него остаётся свободными средствами программы.
   */
  public teacher_reserve_balance!: string | null;

  /** Сколько преподавателям курса уже выплачено из резерва (принятые результаты). */
  public teacher_settled_total!: string | null;

  /** Принимает ли кооператив взнос за весь курс разом; иначе взнос только помесячный. */
  public course_payment_enabled!: boolean;

  /** Скидка за взнос разом за весь курс, базисные пункты (100 = 1%); ограничена наценкой кооператива. */
  public course_discount_bp!: number;

  /**
   * Членский взнос за месяц — asset-строка цепи («1000.0000 RUB»). Считает его
   * сервер из параметров выше, руками он не задаётся. Взнос за весь курс разом
   * отдельно не хранится: это месячный за месяцы курса со скидкой.
   */
  public fee_month!: string;

  public direction!: EduCourseDirection;

  public carrier!: EduAccessCarrier;

  /** Идентификатор курса на площадке (для onsite — код заведения/группы). */
  public external_ref!: string;

  /** Название курса на площадке при последней сверке — для обнаружения рассогласования. */
  public external_title_seen!: string | null;

  /** Когда курс последний раз сверялся с площадкой (экспорт GetCourse лимитирован — сверка кэшируется). */
  public external_checked_at!: Date | null;

  public status!: EduCourseStatus;

  public sort_order!: number;

  public created_at!: Date;

  public updated_at!: Date;
}
