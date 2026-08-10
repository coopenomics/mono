/**
 * Допуск к проекту Capital (подтверждённый appendix / makeClearance).
 * Реализация — расширение capital; токен INTER_PROJECT_CAPITAL_CLEARANCE в InterCommunicationBridgeModule.
 */
export interface InterProjectCapitalClearancePort {
  listUsernamesWithConfirmedProjectClearance(projectHash: string): Promise<string[]>;

  /**
   * Вправе ли пайщик читать переписку и записи звонков проекта.
   * Решение принимает матрица доступа capital (действие «чтение переписки проекта»):
   * по умолчанию это совет и ведущий проекта, допуск к проекту переписку не открывает.
   */
  canReadProjectCommunication(input: {
    username: string;
    /** Системная роль в кооперативе: chairman / member / user */
    role?: string;
    projectHash: string;
  }): Promise<boolean>;
}
