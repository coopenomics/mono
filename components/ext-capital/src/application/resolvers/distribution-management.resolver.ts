import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { DistributionManagementService } from '../services/distribution-management.service';
import { FundProgramInputDTO } from '../dto/distribution_management/fund-program-input.dto';
import { RefreshProgramInputDTO } from '../dto/distribution_management/refresh-program-input.dto';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { TransactionDTO } from '~/application/common/dto/transaction-result-response.dto';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { GenerationToMainWalletConvertStatementGenerateDocumentInputDTO } from '~/application/document/documents-dto/generation-to-main-wallet-convert-statement-document.dto';
import { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';
import { GenerateDocumentInputDTO } from '~/application/document/dto/generate-document-input.dto';

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
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
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
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async refreshCapitalProgram(
    @Args('data', { type: () => RefreshProgramInputDTO }) data: RefreshProgramInputDTO
  ): Promise<TransactionDTO> {
    const result = await this.distributionManagementService.refreshProgram(data);
    return result;
  }


  // ============ ГЕНЕРАЦИЯ ДОКУМЕНТОВ ============

  /**
   * Мутация для генерации заявления о конвертации из генерации в основной кошелек
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateGenerationToMainWalletConvertStatement',
    description: 'Сгенерировать заявление о конвертации из генерации в основной кошелек',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateGenerationToMainWalletConvertStatement(
    @Args('data', { type: () => GenerationToMainWalletConvertStatementGenerateDocumentInputDTO })
    data: GenerationToMainWalletConvertStatementGenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.distributionManagementService.generateGenerationToMainWalletConvertStatement(data, options);
  }

  /**
   * Мутация для генерации заявления о конвертации из генерации в проектный кошелек
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateGenerationToProjectConvertStatement',
    description: 'Сгенерировать заявление о конвертации из генерации в проектный кошелек',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateGenerationToProjectConvertStatement(
    @Args('data', { type: () => GenerateDocumentInputDTO })
    data: GenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.distributionManagementService.generateGenerationToProjectConvertStatement(data, options);
  }

  /**
   * Мутация для генерации заявления о конвертации из генерации в капитализацию
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateGenerationToCapitalizationConvertStatement',
    description: 'Сгенерировать заявление о конвертации из генерации в капитализацию',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateGenerationToCapitalizationConvertStatement(
    @Args('data', { type: () => GenerateDocumentInputDTO })
    data: GenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.distributionManagementService.generateGenerationToCapitalizationConvertStatement(data, options);
  }

  /**
   * Мутация для генерации заявления о конвертации из капитализации в основной кошелек
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateCapitalizationToMainWalletConvertStatement',
    description: 'Сгенерировать заявление о конвертации из капитализации в основной кошелек',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateCapitalizationToMainWalletConvertStatement(
    @Args('data', { type: () => GenerateDocumentInputDTO })
    data: GenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.distributionManagementService.generateCapitalizationToMainWalletConvertStatement(data, options);
  }
}
