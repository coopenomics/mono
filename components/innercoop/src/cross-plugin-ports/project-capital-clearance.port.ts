/**
 * Допуск к проекту Capital (подтверждённый appendix / makeClearance).
 * Реализация — расширение capital; токен PROJECT_CAPITAL_CLEARANCE_PORT в InnercoopBridgeModule.
 */
export interface IProjectCapitalClearancePort {
  listUsernamesWithConfirmedProjectClearance(projectHash: string): Promise<string[]>;
}

// ─── DI-токен ──────────────────────────────────────────────────────────────────

/**
 * Пайщики с подтверждённым допуском к проекту. Провайдер — capital.
 * Реализацию подставляет composition root (`InnercoopBridgeModule`).
 */
export const PROJECT_CAPITAL_CLEARANCE_PORT = Symbol.for('Innercoop.CrossPlugin.ProjectCapitalClearance');
