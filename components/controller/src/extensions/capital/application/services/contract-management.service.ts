import { Injectable } from '@nestjs/common';
import { ContractManagementInteractor } from '../use-cases/contract-management.interactor';
import type { SetConfigInputDTO } from '../dto/contract_management/set-config-input.dto';
import type { GetCapitalConfigInputDTO } from '../dto/contract_management/get-config-input.dto';
import { StateOutputDTO } from '../dto/contract_management/config-output.dto';
import type { InnerTransactResult } from '@coopenomics/innercoop';

/**
 * Сервис уровня приложения для управления контрактом CAPITAL
 * Обрабатывает запросы от ContractManagementResolver
 */
@Injectable()
export class ContractManagementService {
  constructor(private readonly contractManagementInteractor: ContractManagementInteractor) {}

  /**
   * Установка конфигурации CAPITAL контракта
   */
  async setConfig(data: SetConfigInputDTO): Promise<InnerTransactResult> {
    return await this.contractManagementInteractor.setConfig(data);
  }

  /**
   * Получение полного состояния CAPITAL контракта
   */
  async getState(data: GetCapitalConfigInputDTO): Promise<StateOutputDTO | null> {
    return await this.contractManagementInteractor.getState(data);
  }
}
