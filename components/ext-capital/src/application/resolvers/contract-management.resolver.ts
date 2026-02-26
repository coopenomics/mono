import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { ContractManagementService } from '../services/contract-management.service';
import { SetConfigInputDTO } from '../dto/contract_management/set-config-input.dto';
import { GetCapitalConfigInputDTO } from '../dto/contract_management/get-config-input.dto';
import { StateOutputDTO } from '../dto/contract_management/config-output.dto';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { UseGuards } from '@nestjs/common';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { TransactionDTO } from '~/application/common/dto/transaction-result-response.dto';

/**
 * GraphQL резолвер для действий управления контрактом CAPITAL
 */
@Resolver()
export class ContractManagementResolver {
  constructor(private readonly contractManagementService: ContractManagementService) {}

  /**
   * Мутация для установки конфигурации CAPITAL контракта
   */
  @Mutation(() => TransactionDTO, {
    name: 'capitalSetConfig',
    description: 'Установка конфигурации CAPITAL контракта',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async setCapitalConfig(@Args('data', { type: () => SetConfigInputDTO }) data: SetConfigInputDTO): Promise<TransactionDTO> {
    const result = await this.contractManagementService.setConfig(data);
    return result;
  }

  /**
   * Запрос для получения полного состояния CAPITAL контракта
   */
  @Query(() => StateOutputDTO, {
    name: 'capitalState',
    description: 'Получение полного состояния CAPITAL контракта кооператива',
    nullable: true,
  })
  async getCapitalState(@Args('data') data: GetCapitalConfigInputDTO): Promise<StateOutputDTO | null> {
    const result = await this.contractManagementService.getState(data);
    return result;
  }
}
