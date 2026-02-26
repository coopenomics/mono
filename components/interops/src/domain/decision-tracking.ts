/**
 * Порты отслеживания решений
 */

export interface ITrackingRuleDomain {
  entity_type: string;
  entity_id: string;
  coopname: string;
  decision_type: string;
  on_approve_action?: string;
  on_reject_action?: string;
  metadata?: Record<string, any>;
}

export interface IDecisionTrackingPort {
  createRule(rule: ITrackingRuleDomain): Promise<void>;
  findRules(entityType: string, entityId: string): Promise<ITrackingRuleDomain[]>;
  deleteRule(id: string): Promise<void>;
}

export const DECISION_TRACKING_PORT = Symbol('DecisionTrackingPort');
