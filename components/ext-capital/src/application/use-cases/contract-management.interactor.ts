import { Injectable, Inject } from '@nestjs/common';
import { CapitalBlockchainPort, CAPITAL_BLOCKCHAIN_PORT } from '../../domain/interfaces/capital-blockchain.port';
import type { TransactResult } from '@wharfkit/session';
import type { SetConfigDomainInput } from '../../domain/actions/set-config-domain-input.interface';
import type { GetCapitalConfigInputDTO } from '../dto/contract_management/get-config-input.dto';
import { StateOutputDTO, ConfigDTO } from '../dto/contract_management/config-output.dto';

/**
 * Интерактор домена для управления контрактом CAPITAL
 * Обрабатывает действия связанные с настройкой и созданием проектов
 */
@Injectable()
export class ContractManagementInteractor {
  constructor(
    @Inject(CAPITAL_BLOCKCHAIN_PORT)
    private readonly capitalBlockchainPort: CapitalBlockchainPort
  ) {}

  /**
   * Установка конфигурации CAPITAL контракта
   */
  async setConfig(data: SetConfigDomainInput): Promise<TransactResult> {
    return await this.capitalBlockchainPort.setConfig(data);
  }

  /**
   * Получение состояния CAPITAL контракта (включая конфигурацию)
   */
  async getState(data: GetCapitalConfigInputDTO): Promise<StateOutputDTO | null> {
    // Получаем состояние из блокчейна (включая конфигурацию)
    const blockchainState = await this.capitalBlockchainPort.getConfig(data.coopname);

    if (!blockchainState) {
      return null;
    }

    // Конвертируем конфигурацию в DTO
    const configDto: ConfigDTO = {
      coordinator_bonus_percent: blockchainState.config.coordinator_bonus_percent,
      expense_pool_percent: blockchainState.config.expense_pool_percent,
      coordinator_invite_validity_days: blockchainState.config.coordinator_invite_validity_days,
      voting_period_in_days: blockchainState.config.voting_period_in_days,
      authors_voting_percent: blockchainState.config.authors_voting_percent,
      creators_voting_percent: blockchainState.config.creators_voting_percent,
      energy_decay_rate_per_day: blockchainState.config.energy_decay_rate_per_day,
      level_depth_base: Number(blockchainState.config.level_depth_base),
      level_growth_coefficient: blockchainState.config.level_growth_coefficient,
      energy_gain_coefficient: blockchainState.config.energy_gain_coefficient,
    };

    // Возвращаем полный state
    return {
      coopname: blockchainState.coopname,
      global_available_invest_pool: blockchainState.global_available_invest_pool,
      program_membership_funded: blockchainState.program_membership_funded,
      program_membership_available: blockchainState.program_membership_available,
      program_membership_distributed: blockchainState.program_membership_distributed,
      program_membership_cumulative_reward_per_share: blockchainState.program_membership_cumulative_reward_per_share,
      config: configDto,
      _id: '',
      present: true,
      _created_at: new Date(),
      _updated_at: new Date(),
    };
  }
}
