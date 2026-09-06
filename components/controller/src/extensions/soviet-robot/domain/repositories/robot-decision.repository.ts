import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import type { RobotDecisionDomainEntity } from '../entities/robot-decision.entity';
import type { RobotDecisionStage } from '../enums/robot-decision-stage.enum';

export const ROBOT_DECISION_REPOSITORY = Symbol('RobotDecisionRepository');

export type RobotDecisionCreate = Pick<
  RobotDecisionDomainEntity,
  'coopname' | 'decision_id' | 'decision_type' | 'decision_hash' | 'username' | 'stage'
>;

export interface RobotDecisionRepository {
  findByDecision(coopname: string, decision_id: number): Promise<RobotDecisionDomainEntity | null>;
  /** Создать запись, если её ещё нет; существующую вернуть как есть. */
  createIfAbsent(data: RobotDecisionCreate): Promise<RobotDecisionDomainEntity>;
  save(entity: RobotDecisionDomainEntity): Promise<RobotDecisionDomainEntity>;
  /** Записи в незавершённых этапах, у которых подошло время повтора. */
  findDue(coopname: string, stages: RobotDecisionStage[], now: Date, limit: number): Promise<RobotDecisionDomainEntity[]>;
  findPaginated(coopname: string, options?: PaginationInputDTO): Promise<PaginationResult<RobotDecisionDomainEntity>>;
}
