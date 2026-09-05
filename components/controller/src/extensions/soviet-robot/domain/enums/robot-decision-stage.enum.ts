/**
 * Этапы решения в журнале робота. Каждый этап идемпотентен по паре
 * (кооператив, номер решения): повторная обработка события не даёт второго
 * голоса и второго протокола.
 */
export enum RobotDecisionStage {
  /** Повестка получена, голоса ещё не поданы. */
  NEW = 'new',
  /** Голоса делегировавших членов совета поданы, кворум ещё проверяется. */
  VOTED = 'voted',
  /** Голосов робота не хватает — ждём ручных голосов. */
  AWAITING_QUORUM = 'awaiting_quorum',
  /** Кворум есть, но председатель не делегировал подпись протоколов этого типа. */
  AWAITING_CHAIRMAN = 'awaiting_chairman',
  /** Кворум есть, протокол собирается и утверждается второй транзакцией. */
  AWAITING_PROTOCOL = 'awaiting_protocol',
  /** Решение утверждено и исполнено роботом. */
  EXECUTED = 'executed',
  /** Решение закрыто вне робота: исполнено вручную, отклонено или просрочено. */
  CLOSED = 'closed',
  /** Попытки исчерпаны, нужен ручной повтор администратором. */
  FAILED = 'failed',
}

/** Этапы, по которым сторож дожимает решение. */
export const ROBOT_ACTIVE_STAGES: RobotDecisionStage[] = [
  RobotDecisionStage.NEW,
  RobotDecisionStage.VOTED,
  RobotDecisionStage.AWAITING_QUORUM,
  RobotDecisionStage.AWAITING_CHAIRMAN,
  RobotDecisionStage.AWAITING_PROTOCOL,
];
