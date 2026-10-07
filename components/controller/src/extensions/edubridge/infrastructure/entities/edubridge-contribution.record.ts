import { EduContributionStatus, EduCouncilOutcome, EduRidType } from '../../domain/enums';

/** Паевой взнос преподавателя результатами работы (РИД). `rid_hash` — ключ записи в цепи (`edubridge::edurids`). */
export class EdubridgeContributionRecord {
  public id!: string;

  public coopname!: string;

  public teacher_username!: string;

  public assignment_id!: string;

  public rid_hash!: string;

  public rid_type!: EduRidType;

  /** Перечень ссылок на внешние хранилища. */
  public links!: string[];

  public description!: string;

  /** Сумма взноса — asset-строка цепи. */
  public amount!: string;

  public status!: EduContributionStatus;

  public statement_hash!: string | null;

  /** Акт передачи материалов на ответственное хранение (3012) — hash в цепи. */
  public storage_act_hash!: string | null;
  /** Тот же акт целиком с подписью преподавателя — для показа документом; у старых взносов пуст. */
  public storage_act_document!: Record<string, unknown> | null;

  /**
   * Подписанное заявление целиком: преподаватель подписывает его один раз
   * вместе с отчётом, а в совет оно уходит по истечении гарантийного срока —
   * повторных действий от него это не требует.
   */
  public statement_document!: Record<string, unknown> | null;

  /** До какой даты заявление держится расширением; null — гарантийного срока нет. */
  public hold_until!: Date | null;

  /** Занятие, по которому оформлен взнос; null — взнос вне журнала занятий. */
  public lesson_id!: string | null;

  public decision_hash!: string | null;

  public act_hash!: string | null;

  /** Акт с подписью преподавателя — председатель присоединяет свою к этому же документу. */
  public act_signed!: Record<string, unknown> | null;

  /**
   * Протокол совета (3009) с подписью председателя — приходит обратным вызовом
   * `onridauth`; им закрываются приём и отказ. У взносов, прошедших совет до
   * появления повестки контракта, пуст.
   */
  public decision_document!: Record<string, unknown> | null;

  public decline_reason!: string | null;

  /** Хеш проекта решения совета (правило отслеживания ядра). */
  public council_project_hash!: string | null;

  /**
   * Номер вопроса в повестке совета — по нему приходит отклонение и снятие
   * просроченного вопроса. Принятое решение пишется в `council_decision_id`.
   */
  public council_agenda_id!: string | null;

  /** Совет решения о приёме не принял: отклонил либо не уложился в срок. Материалы снимает председатель. */
  public council_outcome!: EduCouncilOutcome | null;

  /** Номер решения совета, когда принято. */
  public council_decision_id!: string | null;

  public decided_at!: Date | null;

  public created_at!: Date;

  public updated_at!: Date;
}
