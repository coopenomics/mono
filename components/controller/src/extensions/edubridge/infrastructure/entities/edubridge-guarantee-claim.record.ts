import { EduGuaranteeClaimStatus } from '../../domain/enums/guarantee-claim-status.enum';

/**
 * Заявление участника об аннулировании подписки по гарантийным условиям
 * (док. 3013, п. 4.4.2 Положения о ЦПП). Рассматривает совет; на подписку —
 * одно заявление.
 */
export class EdubridgeGuaranteeClaimRecord {
  public id!: string;

  public coopname!: string;

  public member_username!: string;

  public enrollment_id!: string;

  public course_id!: string;

  /** Идентификатор заявления: постоянен для подписки, его начало — номер заявления в документах. */
  public claim_hash!: string;

  public reason!: string;

  /** Ссылки на материалы, подтверждающие причину. */
  public links!: string[];

  /** Стоимость подписки, списанная к моменту подачи: её совет возвращает целиком. */
  public amount!: string;

  public status!: EduGuaranteeClaimStatus;

  public statement_document!: Record<string, unknown>;

  /** Проект решения совета по заявлению; пусто, пока вопрос не вынесен. */
  public council_project_hash!: string | null;

  /** Номер вопроса в повестке совета — по нему приходит отклонение и снятие по сроку. */
  public council_agenda_id!: string | null;

  public council_decision_id!: string | null;

  /** Хэш протокола решения совета (док. 3014). */
  public decision_hash!: string | null;

  public decided_at!: Date | null;

  public created_at!: Date;

  public updated_at!: Date;
}
