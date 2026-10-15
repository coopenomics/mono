import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { DistributionManagementService } from '../services/distribution-management.service';
import { FundProgramInputDTO } from '../dto/distribution_management/fund-program-input.dto';
import { RefreshProgramInputDTO } from '../dto/distribution_management/refresh-program-input.dto';
import {
  GqlJwtAuthGuard,
  CurrentUser,
  GeneratedDocumentDTO,
  GenerateDocumentOptionsInputDTO,
  TransactionDTO,
  GenerateDocumentInputDTO,
  RequireRight,
  RightsGuard,
} from '@coopenomics/extension-kit';
import { UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { GenerationConvertStatementGenerateDocumentInputDTO } from '../documents-dto/generation-convert-statement-document.dto';

/**
 * GraphQL резолвер для действий распределения средств CAPITAL контракта
 */
@Resolver()
export class DistributionManagementResolver {
  constructor(private readonly distributionManagementService: DistributionManagementService) {}

  /**
   * Мутация для финансирования программы CAPITAL контракта
   */
  @Mutation(() => TransactionDTO, {
    name: 'capitalFundProgram',
    description: 'Финансирование программы CAPITAL контракта',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('CapitalProgram', 'fund')
  async fundCapitalProgram(
    @Args('data', { type: () => FundProgramInputDTO }) data: FundProgramInputDTO
  ): Promise<TransactionDTO> {
    const result = await this.distributionManagementService.fundProgram(data);
    return result;
  }


  /**
   * Мутация для обновления CRPS пайщика в программе CAPITAL контракта
   */
  @Mutation(() => TransactionDTO, {
    name: 'capitalRefreshProgram',
    description: 'Обновление CRPS пайщика в программе CAPITAL контракта',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('CapitalProgram', ['refresh:own', 'refresh'], { owner: 'data.username' })
  async refreshCapitalProgram(
    @Args('data', { type: () => RefreshProgramInputDTO }) data: RefreshProgramInputDTO
  ): Promise<TransactionDTO> {
    const result = await this.distributionManagementService.refreshProgram(data);
    return result;
  }


  // ============ ГЕНЕРАЦИЯ ДОКУМЕНТОВ ============

  /**
   * Мутация для генерации заявления о конвертации целевого паевого взноса
   * (универсальный шаблон: в Цифровой Кошелёк и/или в программу «Благорост»)
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateGenerationConvertStatement',
    description: 'Сгенерировать заявление о конвертации целевого паевого взноса (в Цифровой Кошелёк и/или в программу «Благорост»)',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('CapitalProgram', ['generate:own', 'generate'], { owner: 'data.username' })
  async generateGenerationConvertStatement(
    @Args('data', { type: () => GenerationConvertStatementGenerateDocumentInputDTO })
    data: GenerationConvertStatementGenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<GeneratedDocumentDTO> {
    return this.distributionManagementService.generateGenerationConvertStatement(data, options, currentUser);
  }

  /**
   * Мутация для генерации заявления о конвертации из благороста в основной кошелек
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateCapitalizationToMainWalletConvertStatement',
    description: 'Сгенерировать заявление о конвертации из благороста в основной кошелек',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('CapitalProgram', ['generate:own', 'generate'], { owner: 'data.username' })
  async generateCapitalizationToMainWalletConvertStatement(
    @Args('data', { type: () => GenerateDocumentInputDTO })
    data: GenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.distributionManagementService.generateCapitalizationToMainWalletConvertStatement(data, options);
  }
}
