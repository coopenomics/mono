import type { IStateBlockchainData } from '../../domain/interfaces/state-blockchain.interface';
import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const EntityName = 'capital_state';
export class StateTypeormEntity extends ChainRecord {
  static getTableName(): string {
    return EntityName;
  }
  id!: number;

  // Поля из блокчейна (state.hpp)
  coopname!: string;

  global_available_invest_pool!: string;

  program_membership_funded!: string;

  program_membership_available!: string;

  program_membership_distributed!: string;

  program_membership_cumulative_reward_per_share!: number;

  config!: IStateBlockchainData['config'];
}
