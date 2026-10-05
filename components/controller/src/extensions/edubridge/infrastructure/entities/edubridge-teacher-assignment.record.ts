import { EduAssignmentStatus } from '../../domain/enums';

/**
 * Допуск преподавателя к курсу: курс, расписание, ожидаемый результат, период.
 * Рабочее назначение кооператива — документа и подписей не требует, условия
 * участия преподавателя определяет договор УХД.
 */
export class EdubridgeTeacherAssignmentRecord {
  public id!: string;

  public coopname!: string;

  public teacher_username!: string;

  public course_id!: string;

  public schedule!: string;

  public expected_result!: string;

  public period_from!: string;

  public period_to!: string;

  /**
   * Нагрузка преподавателя по курсу, часов в месяц. Сумма нагрузок по ставкам
   * назначенных преподавателей — факт себестоимости против планового расчёта курса.
   */
  public minutes_per_month!: number;

  public status!: EduAssignmentStatus;

  public created_at!: Date;

  public updated_at!: Date;
}
