import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { PropertyManagementService } from '../services/property-management.service';
import { CreateProjectPropertyInputDTO } from '../dto/property_management/create-project-property-input.dto';
import { CreateProgramPropertyInputDTO } from '../dto/property_management/create-program-property-input.dto';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { TransactionDTO } from '~/application/common/dto/transaction-result-response.dto';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { GenerateDocumentInputDTO } from '~/application/document/dto/generate-document-input.dto';
import { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';

/**
 * GraphQL резолвер для действий управления имущественными взносами CAPITAL контракта
 */
@Resolver()
export class PropertyManagementResolver {
  constructor(private readonly propertyManagementService: PropertyManagementService) {}

  /**
   * Мутация для создания проектного имущественного взноса в CAPITAL контракте
   */
  @Mutation(() => TransactionDTO, {
    name: 'capitalCreateProjectProperty',
    description: 'Создание проектного имущественного взноса в CAPITAL контракте',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['participant'])
  async createCapitalProjectProperty(
    @Args('data', { type: () => CreateProjectPropertyInputDTO }) data: CreateProjectPropertyInputDTO
  ): Promise<TransactionDTO> {
    const result = await this.propertyManagementService.createProjectProperty(data);
    return result;
  }

  /**
   * Мутация для создания программного имущественного взноса в CAPITAL контракте
   */
  @Mutation(() => TransactionDTO, {
    name: 'capitalCreateProgramProperty',
    description: 'Создание программного имущественного взноса в CAPITAL контракте',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['participant'])
  async createCapitalProgramProperty(
    @Args('data', { type: () => CreateProgramPropertyInputDTO }) data: CreateProgramPropertyInputDTO
  ): Promise<TransactionDTO> {
    const result = await this.propertyManagementService.createProgramProperty(data);
    return result;
  }

  // ============ ГЕНЕРАЦИЯ ДОКУМЕНТОВ ============

  /**
   * Мутация для генерации заявления об инвестировании имуществом в генерацию
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateGenerationPropertyInvestStatement',
    description: 'Сгенерировать заявление об инвестировании имуществом в генерацию',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateGenerationPropertyInvestStatement(
    @Args('data', { type: () => GenerateDocumentInputDTO })
    data: GenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.propertyManagementService.generateGenerationPropertyInvestStatement(data, options);
  }

  /**
   * Мутация для генерации решения об инвестировании имуществом в генерацию
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateGenerationPropertyInvestDecision',
    description: 'Сгенерировать решение об инвестировании имуществом в генерацию',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateGenerationPropertyInvestDecision(
    @Args('data', { type: () => GenerateDocumentInputDTO })
    data: GenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.propertyManagementService.generateGenerationPropertyInvestDecision(data, options);
  }

  /**
   * Мутация для генерации акта об инвестировании имуществом в генерацию
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateGenerationPropertyInvestAct',
    description: 'Сгенерировать акт об инвестировании имуществом в генерацию',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateGenerationPropertyInvestAct(
    @Args('data', { type: () => GenerateDocumentInputDTO })
    data: GenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.propertyManagementService.generateGenerationPropertyInvestAct(data, options);
  }

  /**
   * Мутация для генерации заявления об инвестировании имуществом в капитализацию
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateCapitalizationPropertyInvestStatement',
    description: 'Сгенерировать заявление об инвестировании имуществом в капитализацию',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateCapitalizationPropertyInvestStatement(
    @Args('data', { type: () => GenerateDocumentInputDTO })
    data: GenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.propertyManagementService.generateCapitalizationPropertyInvestStatement(data, options);
  }

  /**
   * Мутация для генерации решения об инвестировании имуществом в капитализацию
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateCapitalizationPropertyInvestDecision',
    description: 'Сгенерировать решение об инвестировании имуществом в капитализацию',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateCapitalizationPropertyInvestDecision(
    @Args('data', { type: () => GenerateDocumentInputDTO })
    data: GenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.propertyManagementService.generateCapitalizationPropertyInvestDecision(data, options);
  }

  /**
   * Мутация для генерации акта об инвестировании имуществом в капитализацию
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateCapitalizationPropertyInvestAct',
    description: 'Сгенерировать акт об инвестировании имуществом в капитализацию',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateCapitalizationPropertyInvestAct(
    @Args('data', { type: () => GenerateDocumentInputDTO })
    data: GenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.propertyManagementService.generateCapitalizationPropertyInvestAct(data, options);
  }
}
