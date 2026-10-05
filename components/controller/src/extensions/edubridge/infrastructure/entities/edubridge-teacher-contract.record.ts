import { EduContractStatus } from '../../domain/enums';

/**
 * Договор участия в хозяйственной деятельности (док. 3006): первая подпись —
 * преподаватель, вторая — председатель совета через одобрение; зеркало
 * записи `educontracts` контракта.
 */
export class EdubridgeTeacherContractRecord {
  public id!: string;

  public coopname!: string;

  public teacher_username!: string;

  public contract_hash!: string;

  public contract_number!: string;

  /**
   * Подписанный документ договора: с подписью преподавателя, после одобрения —
   * с подписью председателя. Пусто у договоров, подписанных до появления поля.
   */
  public contract_document!: Record<string, unknown> | null;

  /**
   * Ставка часа преподавателя («1000.0000 RUB»): по ней считается себестоимость
   * курса и взнос за проведённое занятие. Преподаватель называет её при
   * подключении, дальше правит только администратор — в документы она не попадает.
   */
  public hourly_rate!: string;

  public status!: EduContractStatus;

  /** Причина отказа председателя; пусто, пока отказа не было. */
  public decline_reason!: string;

  /** Подпись председателя (вторая). */
  public approved_at!: Date | null;

  public signed_at!: Date;

  public updated_at!: Date;
}
