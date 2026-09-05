import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { RobotDecisionDomainEntity, RobotVoteRecord } from '../../domain/entities/robot-decision.entity';
import { RobotDecisionStage } from '../../domain/enums/robot-decision-stage.enum';

/** Журнал робота решений совета: одна запись на решение. */
@Entity('soviet_robot_decisions')
@Index(['coopname', 'decision_id'], { unique: true })
@Index(['coopname', 'stage'])
export class RobotDecisionTypeormEntity implements RobotDecisionDomainEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 13 })
  coopname!: string;

  @Column({ type: 'integer' })
  decision_id!: number;

  @Column({ type: 'varchar', length: 13 })
  decision_type!: string;

  @Column({ type: 'varchar', length: 64 })
  decision_hash!: string;

  @Column({ type: 'varchar', length: 13 })
  username!: string;

  @Column({ type: 'varchar', length: 32, default: RobotDecisionStage.NEW })
  stage!: RobotDecisionStage;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  votes!: RobotVoteRecord[];

  @Column({ type: 'varchar', length: 64, nullable: true })
  protocol_hash!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  tx_hashes!: string[];

  @Column({ type: 'text', nullable: true })
  last_error!: string | null;

  @Column({ type: 'integer', default: 0 })
  attempts!: number;

  @Column({ type: 'timestamptz', nullable: true })
  next_attempt_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
