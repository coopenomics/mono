/**
 * Возврат паевого взноса преподавателя, начатый со стола расчёта: сумма,
 * платёж шлюза и оба подписанных заявления. Состояние возврата живёт у
 * платежа (совет, выплата, отказ), здесь только связка с преподавателем.
 */
export class EdubridgeShareReturnRecord {
  public id!: string;

  public coopname!: string;

  public teacher_username!: string;

  public amount!: string;

  /** Хэш платежа шлюза: по нему читается состояние возврата. */
  public payment_hash!: string;

  /** Заявление о трансляции паевого взноса в Цифровой Кошелёк (3015). */
  public transfer_statement_document!: Record<string, unknown>;

  /** Заявление о возврате паевого взноса деньгами (900). */
  public return_statement_document!: Record<string, unknown>;

  public created_at!: Date;

  public updated_at!: Date;
}
