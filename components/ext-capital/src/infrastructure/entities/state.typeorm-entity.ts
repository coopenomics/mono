import { Entity, Column, Index } from 'typeorm';
import type { IStateBlockchainData } from '../../domain/interfaces/state-blockchain.interface';
import { BaseTypeormEntity } from '~/shared/sync/entities/base-typeorm.entity';

export const EntityName = 'capital_state';
@Entity(EntityName)
@Index(`idx_${EntityName}_coopname`, ['coopname'])
@Index(`idx_${EntityName}_created_at`, ['_created_at'])
export class StateTypeormEntity extends BaseTypeormEntity {
  static getTableName(): string {
    return EntityName;
  }
  @Column({ type: 'integer', nullable: true, unique: true })
  id!: number;

  // Поля из блокчейна (state.hpp)
  @Column({ type: 'varchar', length: 12, unique: true })
  coopname!: string;

  @Column({ type: 'varchar' })
  global_available_invest_pool!: string;

  @Column({ type: 'varchar' })
  program_membership_funded!: string;

  @Column({ type: 'varchar' })
  program_membership_available!: string;

  @Column({ type: 'varchar' })
  program_membership_distributed!: string;

  @Column({ type: 'float' })
  program_membership_cumulative_reward_per_share!: number;

  @Column({ type: 'json' })
  config!: IStateBlockchainData['config'];
}
