import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';
import { PropertyManagementService } from '../services/property-management.service';
import { CreateProjectPropertyInputDTO } from '../dto/property_management/create-project-property-input.dto';
import { CreateProgramPropertyInputDTO } from '../dto/property_management/create-program-property-input.dto';
import { SignProgramPropertyActInputDTO } from '../dto/property_management/sign-program-property-act-input.dto';
import { GenerateProgramPropertyActInputDTO } from '../dto/property_management/generate-program-property-act-input.dto';
import { ProgramPropertyFilterInputDTO } from '../dto/property_management/program-property-filter.input';
import { ProgramPropertyOutputDTO } from '../dto/property_management/program-property.dto';
import {
  CapitalizationPropertyInvestDecisionGenerateDocumentInputDTO,
  CapitalizationPropertyInvestStatementGenerateDocumentInputDTO,
} from '../documents-dto/capitalization-property-invest-document.dto';
import {
  GqlJwtAuthGuard,
  GeneratedDocumentDTO,
  GenerateDocumentOptionsInputDTO,
  TransactionDTO,
  GenerateDocumentInputDTO,
  RequireRight,
  RightsGuard,
  DOCUMENT_GENERATION_THROTTLE,
  PaginationInputDTO,
  createPaginationResult,
  type PaginationResult,
} from '@coopenomics/extension-kit';
import { UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
const paginatedProgramPropertiesResult = createPaginationResult(ProgramPropertyOutputDTO, 'PaginatedCapitalProgramProperties');

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
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Property', 'create:own', { owner: 'data.username' })
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
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Property', 'create:own', { owner: 'data.username' })
  async createCapitalProgramProperty(
    @Args('data', { type: () => CreateProgramPropertyInputDTO }) data: CreateProgramPropertyInputDTO
  ): Promise<TransactionDTO> {
    const result = await this.propertyManagementService.createProgramProperty(data);
    return result;
  }

  /**
   * Подпись пайщиком акта приёма-передачи имущества в «Благорост»
   */
  @Mutation(() => TransactionDTO, {
    name: 'capitalSignProgramPropertyAct',
    description: 'Подписать акт приёма-передачи имущества, вносимого паевым взносом в программу «Благорост»',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Property', 'sign:own', { owner: 'data.username' })
  async signProgramPropertyAct(
    @Args('data', { type: () => SignProgramPropertyActInputDTO }) data: SignProgramPropertyActInputDTO
  ): Promise<TransactionDTO> {
    return await this.propertyManagementService.signProgramPropertyAct(data);
  }

  /**
   * Паевые взносы имуществом в «Благорост»: свои — пайщику, все — совету
   */
  @Query(() => paginatedProgramPropertiesResult, {
    name: 'capitalProgramProperties',
    description: 'Список паевых взносов имуществом в программу «Благорост» с документами процесса',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Property', ['read:own', 'read'], { owner: 'filter.username' })
  async getProgramProperties(
    @Args('filter', { nullable: true }) filter?: ProgramPropertyFilterInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<ProgramPropertyOutputDTO>> {
    return await this.propertyManagementService.getProgramProperties(filter, options);
  }

  // ============ ГЕНЕРАЦИЯ ДОКУМЕНТОВ ============

  /**
   * Мутация для генерации заявления об инвестировании имуществом в генерацию
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateGenerationPropertyInvestStatement',
    description: 'Сгенерировать заявление об инвестировании имуществом в генерацию',
  })
  @Throttle(DOCUMENT_GENERATION_THROTTLE)
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Property', ['generate:own', 'generate'], { owner: 'data.username' })
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
  @Throttle(DOCUMENT_GENERATION_THROTTLE)
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Property', ['generate:own', 'generate'], { owner: 'data.username' })
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
  @Throttle(DOCUMENT_GENERATION_THROTTLE)
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Property', ['generate:own', 'generate'], { owner: 'data.username' })
  async generateGenerationPropertyInvestAct(
    @Args('data', { type: () => GenerateDocumentInputDTO })
    data: GenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.propertyManagementService.generateGenerationPropertyInvestAct(data, options);
  }

  /**
   * Мутация для генерации заявления об инвестировании имуществом в благорост
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateCapitalizationPropertyInvestStatement',
    description: 'Сгенерировать заявление о паевом взносе имуществом в программу «Благорост»',
  })
  @Throttle(DOCUMENT_GENERATION_THROTTLE)
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Property', ['generate:own', 'generate'], { owner: 'data.username' })
  async generateCapitalizationPropertyInvestStatement(
    @Args('data', { type: () => CapitalizationPropertyInvestStatementGenerateDocumentInputDTO })
    data: CapitalizationPropertyInvestStatementGenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.propertyManagementService.generateCapitalizationPropertyInvestStatement(data, options);
  }

  /**
   * Мутация для генерации решения об инвестировании имуществом в благорост
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateCapitalizationPropertyInvestDecision',
    description: 'Сгенерировать протокол совета о приёме паевого взноса имуществом в программу «Благорост»',
  })
  @Throttle(DOCUMENT_GENERATION_THROTTLE)
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Property', ['generate:own', 'generate'], { owner: 'data.username' })
  async generateCapitalizationPropertyInvestDecision(
    @Args('data', { type: () => CapitalizationPropertyInvestDecisionGenerateDocumentInputDTO })
    data: CapitalizationPropertyInvestDecisionGenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.propertyManagementService.generateCapitalizationPropertyInvestDecision(data, options);
  }

  /**
   * Мутация для генерации акта об инвестировании имуществом в благорост
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateCapitalizationPropertyInvestAct',
    description: 'Сгенерировать акт приёма-передачи имущества по паевому взносу в программу «Благорост»',
  })
  @Throttle(DOCUMENT_GENERATION_THROTTLE)
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Property', ['generate:own', 'generate'], { owner: 'data.username' })
  async generateCapitalizationPropertyInvestAct(
    @Args('data', { type: () => GenerateProgramPropertyActInputDTO })
    data: GenerateProgramPropertyActInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.propertyManagementService.generateCapitalizationPropertyInvestAct(data, options);
  }
}
