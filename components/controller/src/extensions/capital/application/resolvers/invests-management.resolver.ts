import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { InvestsManagementService } from '../services/invests-management.service';
import { CreateProjectInvestInputDTO } from '../dto/invests_management/create-project-invest-input.dto';
import { CreateProgramInvestInputDTO } from '../dto/invests_management/create-program-invest-input.dto';
import { AllocateFundsInputDTO } from '../dto/invests_management/allocate-funds.input';
import { DeallocateFundsInputDTO } from '../dto/invests_management/deallocate-funds.input';
import {
  DeallocationLimitInputDTO,
  DeallocationLimitOutputDTO,
} from '../dto/invests_management/deallocation-limit.dto';
import { GqlJwtAuthGuard, RolesGuard, AuthRoles, createPaginationResult, PaginationInputDTO, PaginationResult, CurrentUser, GeneratedDocumentDTO, GenerateDocumentOptionsInputDTO, TransactionDTO } from '@coopenomics/extension-kit';
import { UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InvestFilterInputDTO } from '../dto/invests_management/invest-filter.input';
import { GetInvestInputDTO } from '../dto/invests_management/get-invest-input.dto';
import { InvestOutputDTO } from '../dto/invests_management/invest.dto';
import { GenerateDocumentInputDTO } from '~/application/document/dto/generate-document-input.dto';
import type { IMonoAccount } from '@coopenomics/innercoop';

// Пагинированные результаты
const paginatedInvestsResult = createPaginationResult(InvestOutputDTO, 'PaginatedCapitalInvests');

/**
 * GraphQL резолвер для действий управления инвестициями CAPITAL контракта
 */
@Resolver()
export class InvestsManagementResolver {
  constructor(private readonly investsManagementService: InvestsManagementService) {}

  /**
   * Мутация для инвестирования в проект CAPITAL контракта
   */
  @Mutation(() => TransactionDTO, {
    name: 'capitalCreateProjectInvest',
    description: 'Инвестирование в проект CAPITAL контракта',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['participant'])
  async createCapitalProjectInvest(
    @Args('data', { type: () => CreateProjectInvestInputDTO }) data: CreateProjectInvestInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    const result = await this.investsManagementService.createProjectInvest(data, currentUser);
    return result;
  }

  /**
   * Мутация для программной денежной инвестиции (createpinv)
   */
  @Mutation(() => TransactionDTO, {
    name: 'capitalCreateProgramInvest',
    description: 'Инвестирование в программу благорост (денежная программная инвестиция)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['participant'])
  async createCapitalProgramInvest(
    @Args('data', { type: () => CreateProgramInvestInputDTO }) data: CreateProgramInvestInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<TransactionDTO> {
    return await this.investsManagementService.createProgramInvest(data, currentUser);
  }

  /**
   * Мутация для направления средств программы в проект или компонент (allocate)
   */
  @Mutation(() => TransactionDTO, {
    name: 'capitalAllocateFunds',
    description: 'Направление средств программы в проект или компонент',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async allocateFunds(
    @Args('data', { type: () => AllocateFundsInputDTO }) data: AllocateFundsInputDTO
  ): Promise<TransactionDTO> {
    return await this.investsManagementService.allocateFunds(data);
  }

  /**
   * Мутация для возврата средств из компонента в программу (diallocate)
   */
  @Mutation(() => TransactionDTO, {
    name: 'capitalDeallocateFunds',
    description: 'Возврат ранее направленных средств из компонента в программу',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async deallocateFunds(
    @Args('data', { type: () => DeallocateFundsInputDTO }) data: DeallocateFundsInputDTO
  ): Promise<TransactionDTO> {
    return await this.investsManagementService.deallocateFunds(data);
  }

  // ============ ЗАПРОСЫ ИНВЕСТИЦИЙ ============

  /**
   * Предел возврата средств из компонента в программу
   */
  @Query(() => DeallocationLimitOutputDTO, {
    name: 'capitalDeallocationLimit',
    description: 'Сколько средств можно вернуть из компонента в программу и чем сумма ограничена',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async getDeallocationLimit(
    @Args('data', { type: () => DeallocationLimitInputDTO }) data: DeallocationLimitInputDTO
  ): Promise<DeallocationLimitOutputDTO> {
    return await this.investsManagementService.getDeallocationLimit(data);
  }

  /**
   * Получение всех инвестиций с фильтрацией
   */
  @Query(() => paginatedInvestsResult, {
    name: 'capitalInvests',
    description: 'Получение списка инвестиций кооператива с фильтрацией',
  })
  async getInvests(
    @Args('filter', { nullable: true }) filter?: InvestFilterInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<InvestOutputDTO>> {
    return await this.investsManagementService.getInvests(filter, options);
  }

  /**
   * Получение инвестиции по ID
   */
  @Query(() => InvestOutputDTO, {
    name: 'capitalInvest',
    description: 'Получение инвестиции по внутреннему ID базы данных',
    nullable: true,
  })
  async getInvest(@Args('data') data: GetInvestInputDTO): Promise<InvestOutputDTO | null> {
    return await this.investsManagementService.getInvestById(data._id);
  }

  // ============ ГЕНЕРАЦИЯ ДОКУМЕНТОВ ============

  /**
   * Мутация для генерации заявления об инвестировании в благорост
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateCapitalizationMoneyInvestStatement',
    description: 'Сгенерировать заявление об инвестировании в благорост',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateCapitalizationMoneyInvestStatement(
    @Args('data', { type: () => GenerateDocumentInputDTO })
    data: GenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.investsManagementService.generateCapitalizationMoneyInvestStatement(data, options);
  }
}
