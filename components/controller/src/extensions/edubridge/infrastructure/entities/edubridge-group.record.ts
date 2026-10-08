import { EduGroupStatus } from '../../domain/enums';

/**
 * Группа (набор) курса — единица расчёта. Курс — программа с условиями по
 * умолчанию; участники записываются в группу, и деньги с занятиями считаются
 * внутри неё: свои подписки, свои занятия, свой резерв преподавателям и свои
 * возвраты. Группы одного курса идут одновременно и не пересекаются.
 *
 * Условия группы — снимок условий курса на день её открытия: по ним участники
 * вносят взнос, и после открытия они не меняются. Новые условия курса
 * действуют для следующих групп.
 */
export class EdubridgeGroupRecord {
  public id!: string;

  public coopname!: string;

  /** Числовой номер группы для цепи (uint64): условия, учёт средств, занятия и подписки в контракте идут под ним. */
  public chain_ref!: string;

  public course_id!: string;

  /** Название набора: «Группа 2», «Набор, январь 2027». */
  public title!: string;

  public status!: EduGroupStatus;

  /** Набор в группу открыт: новые участники записываются в неё. */
  public enrollment_open!: boolean;

  /** Привязка к площадке — курс и, если есть, группа площадки; доступ выдаётся туда. */
  public external_ref!: string;

  /** Дата начала занятий группы; `null` — ещё не назначена. */
  public starts_at!: string | null;

  public lessons_per_month!: number;

  public lessons_total!: number;

  public lesson_minutes!: number;

  /** Плановая ставка часа, заложенная во взнос каждого участника группы. */
  public planned_hourly_rate!: string;

  /** Взнос преподавателя за занятие считается за каждого участника; иначе фиксированный за занятие. */
  public pay_per_learner!: boolean;

  public guarantee_days!: number;

  public course_payment_enabled!: boolean;

  public course_discount_bp!: number;

  public fee_month!: string;

  /** Остаток резерва преподавателям по группе — копия учёта в цепи. */
  public teacher_reserve_balance!: string | null;

  /** Выплачено преподавателям по группе — копия учёта в цепи. */
  public teacher_settled_total!: string | null;

  public created_at!: Date;

  public updated_at!: Date;
}
