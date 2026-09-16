import type { RobotDecisionStage } from '../enums/robot-decision-stage.enum';

/** Голос, поданный роботом от имени члена совета. */
export interface RobotVoteRecord {
  member: string;
  permission: string;
  tx_id: string;
  at: string;
}

/** Запись журнала робота по одному решению совета. */
export interface RobotDecisionDomainEntity {
  id: string;
  coopname: string;
  decision_id: number;
  decision_type: string;
  decision_hash: string;
  /** Кто подал повестку. */
  username: string;
  stage: RobotDecisionStage;
  votes: RobotVoteRecord[];
  /** Чьих голосов ждут повторяющие за ними члены совета. */
  waiting_for: string[];
  protocol_hash: string | null;
  tx_hashes: string[];
  last_error: string | null;
  attempts: number;
  next_attempt_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
