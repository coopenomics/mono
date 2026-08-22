import { Injectable, Inject } from '@nestjs/common';
import type { ActionRepositoryPort } from '~/domain/parser/ports/action-repository.port';
import { ACTION_REPOSITORY_PORT } from '~/domain/parser/ports/action-repository.port';
import type { ActionFilterDomainInterface } from '~/domain/parser/interfaces/parser-config-domain.interface';
import type { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';

/**
 * Интерактор приложения для получения действий с фильтрацией и пагинацией
 */
@Injectable()
export class GetActionsInteractor {
  constructor(
    @Inject(ACTION_REPOSITORY_PORT)
    private readonly actionRepository: ActionRepositoryPort
  ) {}

  /**
   * Получить действия с фильтрацией и пагинацией
   */
  async execute(
    filters: ActionFilterDomainInterface = {},
    pagination: PaginationInputDTO = { page: 1, limit: 10, sortOrder: 'DESC' }
  ): Promise<PaginationResult<ActionDomainInterface>> {
    const result = await this.actionRepository.findMany(filters, pagination.page, pagination.limit);

    return {
      items: result.results,
      totalCount: result.total,
      totalPages: Math.ceil(result.total / pagination.limit),
      currentPage: pagination.page,
    };
  }
}
