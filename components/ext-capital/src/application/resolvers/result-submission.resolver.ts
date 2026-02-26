import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { ResultSubmissionService } from '../services/result-submission.service';
import { PushResultInputDTO } from '../dto/result_submission/push-result-input.dto';
import { ConvertSegmentInputDTO } from '../dto/result_submission/convert-segment-input.dto';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { ResultOutputDTO } from '../dto/result_submission/result.dto';
import { ResultFilterInputDTO } from '../dto/result_submission/result-filter.input';
import { GetResultInputDTO } from '../dto/result_submission/get-result-input.dto';
import { SignActAsContributorInputDTO } from '../dto/result_submission/sign-act-as-contributor-input.dto';
import { SignActAsChairmanInputDTO } from '../dto/result_submission/sign-act-as-chairman-input.dto';
import { createPaginationResult, PaginationInputDTO, PaginationResult } from '~/application/common/dto/pagination.dto';
import { ResultContributionStatementGenerateInputDTO } from '../dto/result_submission/generate-result-contribution-statement-input.dto';
import { ResultContributionDecisionGenerateInputDTO } from '../dto/result_submission/generate-result-contribution-decision-input.dto';
import { ResultContributionActGenerateInputDTO } from '../dto/result_submission/generate-result-contribution-act-input.dto';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { SegmentOutputDTO } from '../dto/segments/segment.dto';

// Пагинированные результаты
const paginatedResultsResult = createPaginationResult(ResultOutputDTO, 'PaginatedCapitalResults');

/**
 * GraphQL резолвер для действий подведения результатов CAPITAL контракта
 */
@Resolver()
export class ResultSubmissionResolver {
  constructor(private readonly resultSubmissionService: ResultSubmissionService) {}

  /**
   * Мутация для внесения результата в CAPITAL контракте
   */
  @Mutation(() => SegmentOutputDTO, {
    name: 'capitalPushResult',
    description: 'Внесение результата в CAPITAL контракте',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async pushCapitalResult(
    @Args('data', { type: () => PushResultInputDTO }) data: PushResultInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<SegmentOutputDTO> {
    const result = await this.resultSubmissionService.pushResult(data, currentUser);
    return result;
  }

  /**
   * Мутация для конвертации сегмента в CAPITAL контракте
   */
  @Mutation(() => SegmentOutputDTO, {
    name: 'capitalConvertSegment',
    description: 'Конвертация сегмента в CAPITAL контракте',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async convertCapitalSegment(
    @Args('data', { type: () => ConvertSegmentInputDTO }) data: ConvertSegmentInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<SegmentOutputDTO> {
    const result = await this.resultSubmissionService.convertSegment(data, currentUser);
    return result;
  }

  // ============ ЗАПРОСЫ РЕЗУЛЬТАТОВ ============

  /**
   * Получение всех результатов с фильтрацией
   */
  @Query(() => paginatedResultsResult, {
    name: 'capitalResults',
    description: 'Получение списка результатов кооператива с фильтрацией',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async getResults(
    @Args('filter', { nullable: true }) filter?: ResultFilterInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<ResultOutputDTO>> {
    return await this.resultSubmissionService.getResults(filter, options);
  }

  /**
   * Получение результата по ID
   */
  @Query(() => ResultOutputDTO, {
    name: 'capitalResult',
    description: 'Получение результата по внутреннему ID базы данных',
    nullable: true,
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async getResult(@Args('data') data: GetResultInputDTO): Promise<ResultOutputDTO | null> {
    return await this.resultSubmissionService.getResultById(data._id);
  }

  // ============ ГЕНЕРАЦИЯ ДОКУМЕНТОВ ============

  /**
   * Мутация для генерации заявления о вкладе результатов
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateResultContributionStatement',
    description: 'Сгенерировать заявление о вкладе результатов',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateResultContributionStatement(
    @Args('data', { type: () => ResultContributionStatementGenerateInputDTO })
    data: ResultContributionStatementGenerateInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<GeneratedDocumentDTO> {
    return this.resultSubmissionService.generateResultContributionStatement(data, options, currentUser);
  }

  /**
   * Мутация для генерации решения о вкладе результатов
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateResultContributionDecision',
    description: 'Сгенерировать решение о вкладе результатов',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateResultContributionDecision(
    @Args('data', { type: () => ResultContributionDecisionGenerateInputDTO })
    data: ResultContributionDecisionGenerateInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<GeneratedDocumentDTO> {
    return this.resultSubmissionService.generateResultContributionDecision(data, options, currentUser);
  }

  /**
   * Мутация для генерации акта о вкладе результатов
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateResultContributionAct',
    description: 'Сгенерировать акт о вкладе результатов',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateResultContributionAct(
    @Args('data', { type: () => ResultContributionActGenerateInputDTO })
    data: ResultContributionActGenerateInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<GeneratedDocumentDTO> {
    return this.resultSubmissionService.generateResultContributionAct(data, options, currentUser);
  }

  // ============ ПОДПИСАНИЕ АКТОВ ============

  /**
   * Мутация для подписания акта участником
   */
  @Mutation(() => SegmentOutputDTO, {
    name: 'capitalSignActAsContributor',
    description: 'Подписание акта о вкладе результатов участником',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async signActAsContributor(
    @Args('data', { type: () => SignActAsContributorInputDTO }) data: SignActAsContributorInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<SegmentOutputDTO> {
    const result = await this.resultSubmissionService.signActAsContributor(data, currentUser);
    return result;
  }

  /**
   * Мутация для подписания акта председателем
   */
  @Mutation(() => SegmentOutputDTO, {
    name: 'capitalSignActAsChairman',
    description: 'Подписание акта о вкладе результатов председателем',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async signActAsChairman(
    @Args('data', { type: () => SignActAsChairmanInputDTO }) data: SignActAsChairmanInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<SegmentOutputDTO> {
    const result = await this.resultSubmissionService.signActAsChairman(data, currentUser);
    return result;
  }
}
