
/**
 * Проведённое занятие: журнал курса. Преподаватель отчитывается после занятия
 * материалами — ими работа овеществляется, — и по этому отчёту считается его
 * взнос: часы занятия по его ставке. План занятий задан курсом, поэтому номер
 * занятия вне плана в журнал не попадает, а второй отчёт по тому же занятию
 * отклоняется.
 */
export class EdubridgeLessonEntity {
  public id!: string;

  public coopname!: string;

  public teacher_username!: string;

  public course_id!: string;

  public assignment_id!: string;

  /** Номер занятия в программе курса — от единицы до числа занятий курса. */
  public lesson_number!: number;

  public held_at!: Date;

  /** Длительность занятия, минут: по умолчанию — из расписания курса. */
  public duration_minutes!: number;

  /** Материалы занятия: записи, конспекты, задания — ссылки на внешние хранилища. */
  public materials!: string[];

  public topic!: string;

  /** Взнос, оформленный по этому занятию; null — отчёт без взноса. */
  public contribution_id!: string | null;

  public created_at!: Date;
}
