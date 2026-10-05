import { EduReturnStatus } from '../../domain/enums';

/**
 * Заявка пайщика на возврат остатка кошелька программы в паевой взнос.
 * Положение ЦПП «Образование» (пп. 4.2.4, 4.2.5) требует заявления Участника и
 * согласования Общества: заявка ждёт решения кооператива, и только после него
 * подписанное заявление уходит в цепь.
 */
export class EdubridgeReturnRequestRecord {
  public id!: string;

  public coopname!: string;

  public member_username!: string;

  /** Сумма возврата с валютой («1250.0000 RUB») — та же, что в заявлении. */
  public amount!: string;

  public statement_hash!: string;

  /** Подписанное заявление об аннулировании соглашения (190): в цепь оно уходит после согласования. */
  public statement_document!: Record<string, unknown>;

  public status!: EduReturnStatus;

  public decline_reason!: string;

  /** Кто согласовал либо отклонил заявку. */
  public decided_by!: string | null;

  public decided_at!: Date | null;

  public created_at!: Date;

  public updated_at!: Date;
}
