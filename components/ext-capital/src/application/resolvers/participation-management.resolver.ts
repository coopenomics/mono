import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { ParticipationManagementService } from '../services/participation-management.service';
import { ImportContributorInputDTO } from '../dto/participation_management/import-contributor-input.dto';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { TransactionDTO } from '~/application/common/dto/transaction-result-response.dto';
import { MakeClearanceInputDTO } from '../dto/participation_management/make-clearance-input.dto';
import { RegisterContributorInputDTO } from '../dto/participation_management/register-contributor-input.dto';
import { EditContributorInputDTO } from '../dto/participation_management/edit-contributor-input.dto';
import { ContributorOutputDTO } from '../dto/participation_management/contributor.dto';
import { ContributorFilterInputDTO } from '../dto/participation_management/contributor-filter.input';
import { GetContributorInputDTO } from '../dto/participation_management/get-contributor-input.dto';
import { createPaginationResult, PaginationInputDTO, PaginationResult } from '~/application/common/dto/pagination.dto';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';
import { GenerationContractGenerateDocumentInputDTO } from '~/application/document/documents-dto/generation-agreement-document.dto';
import { ProjectGenerationContractGenerateDocumentInputDTO } from '~/application/document/documents-dto/project-generation-agreement-document.dto';
import { ComponentGenerationContractGenerateDocumentInputDTO } from '~/application/document/documents-dto/component-generation-agreement-document.dto';
import { GenerateDocumentInputDTO } from '~/application/document/dto/generate-document-input.dto';
import { GenerateCapitalRegistrationDocumentsInputDTO } from '../dto/participation_management/generate-capital-registration-documents-input.dto';
import { GenerateCapitalRegistrationDocumentsOutputDTO } from '../dto/participation_management/generate-capital-registration-documents-output.dto';
import { CompleteCapitalRegistrationInputDTO } from '../dto/participation_management/complete-capital-registration-input.dto';

/**
 * GraphQL резолвер для действий управления участием в CAPITAL контракте
 */
// Пагинированные результаты
const paginatedContributorsResult = createPaginationResult(ContributorOutputDTO, 'PaginatedCapitalContributors');

/**
 * GraphQL резолвер для действий управления участием в CAPITAL контракте
 */
@Resolver()
export class ParticipationManagementResolver {
  constructor(private readonly participationManagementService: ParticipationManagementService) {}

  /**
   * Мутация для регистрации участника в CAPITAL контракте
   */
  @Mutation(() => TransactionDTO, {
    name: 'capitalRegisterContributor',
    description: 'Регистрация участника в CAPITAL контракте',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async registerCapitalContributor(
    @Args('data', { type: () => RegisterContributorInputDTO }) data: RegisterContributorInputDTO
  ): Promise<TransactionDTO> {
    const result = await this.participationManagementService.registerContributor(data);
    return result;
  }

  /**
   * Мутация для импорта участника в CAPITAL контракт
   */
  @Mutation(() => TransactionDTO, {
    name: 'capitalImportContributor',
    description: 'Импорт участника в CAPITAL контракт',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async importCapitalContributor(
    @Args('data', { type: () => ImportContributorInputDTO }) data: ImportContributorInputDTO
  ): Promise<TransactionDTO> {
    const result = await this.participationManagementService.importContributor(data);
    return result;
  }

  /**
   * Мутация для подписания приложения в CAPITAL контракте
   */
  @Mutation(() => TransactionDTO, {
    name: 'capitalMakeClearance',
    description: 'Подписание приложения в CAPITAL контракте',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async makeCapitalClearance(
    @Args('data', { type: () => MakeClearanceInputDTO }) data: MakeClearanceInputDTO
  ): Promise<TransactionDTO> {
    const result = await this.participationManagementService.makeClearance(data);
    return result;
  }

  /**
   * Мутация для редактирования участника в CAPITAL контракте
   */
  @Mutation(() => ContributorOutputDTO, {
    name: 'capitalEditContributor',
    description: 'Редактирование параметров участника в CAPITAL контракте',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async editCapitalContributor(
    @Args('data', { type: () => EditContributorInputDTO }) data: EditContributorInputDTO
  ): Promise<ContributorOutputDTO> {
    const result = await this.participationManagementService.editContributor(data);
    return result;
  }

  // ============ ЗАПРОСЫ ВКЛАДЧИКОВ ============

  /**
   * Получение всех участников с фильтрацией
   */
  @Query(() => paginatedContributorsResult, {
    name: 'capitalContributors',
    description: 'Получение списка участников кооператива с фильтрацией',
  })
  async getContributors(
    @Args('filter', { nullable: true }) filter?: ContributorFilterInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<ContributorOutputDTO>> {
    return await this.participationManagementService.getContributors(filter, options);
  }

  /**
   * Получение участника по критериям поиска
   */
  @Query(() => ContributorOutputDTO, {
    name: 'capitalContributor',
    description: 'Получение участника по ID, имени пользователя или хешу участника',
    nullable: true,
  })
  async getContributor(@Args('data') data: GetContributorInputDTO): Promise<ContributorOutputDTO | null> {
    return await this.participationManagementService.getContributorByCriteria({
      _id: data._id,
      username: data.username,
      contributor_hash: data.contributor_hash,
    });
  }

  // ============ ГЕНЕРАЦИЯ ДОКУМЕНТОВ ============

  /**
   * Мутация для генерации соглашения о капитализации
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateCapitalizationAgreement',
    description: 'Сгенерировать соглашение о капитализации',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateCapitalizationAgreement(
    @Args('data', { type: () => GenerateDocumentInputDTO })
    data: GenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.participationManagementService.generateCapitalizationAgreement(data, options);
  }

  /**
   * Мутация для генерации генерационного соглашения
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateGenerationContract',
    description: 'Сгенерировать генерационное соглашение',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateGenerationContract(
    @Args('data', { type: () => GenerationContractGenerateDocumentInputDTO })
    data: GenerationContractGenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.participationManagementService.generateGenerationContract(data, options);
  }

  /**
   * Мутация для генерации документа приложения к договору участия для проекта (1002)
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateProjectGenerationContract',
    description: 'Сгенерировать документ приложения к договору участия для проекта',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateProjectGenerationContract(
    @Args('data', { type: () => ProjectGenerationContractGenerateDocumentInputDTO })
    data: ProjectGenerationContractGenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.participationManagementService.generateProjectGenerationContract(data, options);
  }

  /**
   * Мутация для генерации документа дополнения к приложению для компонента (1003)
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateComponentGenerationContract',
    description: 'Сгенерировать документ дополнения к приложению для компонента',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateComponentGenerationContract(
    @Args('data', { type: () => ComponentGenerationContractGenerateDocumentInputDTO })
    data: ComponentGenerationContractGenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.participationManagementService.generateComponentGenerationContract(data, options);
  }

  /**
   * Мутация для генерации пачки документов завершения регистрации в Capital
   */
  @Mutation(() => GenerateCapitalRegistrationDocumentsOutputDTO, {
    name: 'capitalGenerateRegistrationDocuments',
    description: 'Генерация пачки документов для завершения регистрации в Capital (GenerationContract, StorageAgreement, BlagorostAgreement)',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateCapitalRegistrationDocuments(
    @Args('data', { type: () => GenerateCapitalRegistrationDocumentsInputDTO })
    data: GenerateCapitalRegistrationDocumentsInputDTO
  ): Promise<GenerateCapitalRegistrationDocumentsOutputDTO> {
    return this.participationManagementService.generateCapitalRegistrationDocuments(data);
  }

  /**
   * Мутация для завершения регистрации в Capital через отправку документов в блокчейн
   */
  @Mutation(() => TransactionDTO, {
    name: 'capitalCompleteRegistration',
    description: 'Завершение регистрации в Capital через отправку документов в блокчейн (regcontrib)',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async completeCapitalRegistration(
    @Args('data', { type: () => CompleteCapitalRegistrationInputDTO })
    data: CompleteCapitalRegistrationInputDTO
  ): Promise<TransactionDTO> {
    return this.participationManagementService.completeCapitalRegistration(data);
  }
}
