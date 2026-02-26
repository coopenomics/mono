/**
 * Порты свободных решений
 */

export interface IFreeDecisionPort {
  publishProjectFreeDecision(data: any): Promise<any>;
}

export const FREE_DECISION_PORT = Symbol('FreeDecisionPort');
