import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { DistributionManagementService } from '../services/distribution-management.service';
import { FundProgramInputDTO } from '../dto/distribution_management/fund-program-input.dto';
import { RefreshProgramInputDTO } from '../dto/distribution_management/refresh-program-input.dto';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { TransactionDTO } from '~/application/common/dto/transaction-result-response.dto';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { GenerationConvertStatementGenerateDocumentInputDTO } from '~/application/document/documents-dto/generation-convert-statement-document.dto';
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
   * Мутация для генерации заявления о конвертации целевого паевого взноса
   * (универсальный шаблон: в Цифровой Кошелёк и/или в программу «Благорост»)
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateGenerationConvertStatement',
    description: 'Сгенерировать заявление о конвертации целевого паевого взноса (в Цифровой Кошелёк и/или в программу «Благорост»)',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateGenerationConvertStatement(
    @Args('data', { type: () => GenerationConvertStatementGenerateDocumentInputDTO })
    data: GenerationConvertStatementGenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
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
