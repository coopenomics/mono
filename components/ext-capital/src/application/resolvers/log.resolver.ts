import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { LogInteractor } from '../use-cases/log.interactor';
import { LogOutputDTO } from '../dto/logs/log.dto';
import { GetLogsInputDTO } from '../dto/logs/get-logs.input';
import { GetIssueLogsInputDTO } from '../dto/logs/get-issue-logs.input';
import { createPaginationResult, PaginationInputDTO, PaginationResult } from '~/application/common/dto/pagination.dto';

// Пагинированные результаты
const paginatedLogsResult = createPaginationResult(LogOutputDTO, 'PaginatedCapitalLogs');

/**
 * GraphQL резолвер для работы с логами событий
 */
@Resolver(() => LogOutputDTO)
@UseGuards(GqlJwtAuthGuard)
export class LogResolver {
  constructor(private readonly logInteractor: LogInteractor) {}

  /**
   * Получение логов по проекту с фильтрацией и пагинацией
   */
  @Query(() => paginatedLogsResult, {
    name: 'getCapitalProjectLogs',
    description: 'Получить логи событий по проекту с фильтрацией и пагинацией',
  })
  async getLogs(@Args('data') data: GetLogsInputDTO): Promise<PaginationResult<LogOutputDTO>> {
    return await this.logInteractor.getLogs(data);
  }

  /**
   * Получение логов по задаче с пагинацией
   */
  @Query(() => paginatedLogsResult, {
    name: 'getCapitalIssueLogs',
    description: 'Получить логи событий по задаче',
  })
  async getIssueLogs(
    @Args('data') data: GetIssueLogsInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<LogOutputDTO>> {
    return await this.logInteractor.getLogsByIssueHash(data.issue_hash, options);
  }
}
