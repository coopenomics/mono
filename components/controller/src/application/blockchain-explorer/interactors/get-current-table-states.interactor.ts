import { Injectable, Inject } from '@nestjs/common';
import type { DeltaRepositoryPort } from '~/domain/parser/ports/delta-repository.port';
import { DELTA_REPOSITORY_PORT } from '~/domain/parser/ports/delta-repository.port';
import type { TableStateDomainInterface } from '~/domain/parser/interfaces/table-state-domain.interface';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
/**
 * Интерактор приложения для получения текущих состояний таблиц из дельт
 */
@Injectable()
export class GetCurrentTableStatesInteractor {
  constructor(
    @Inject(DELTA_REPOSITORY_PORT)
    private readonly deltaRepository: DeltaRepositoryPort
  ) {}
  /**
   * Получить текущие состояния таблиц с пагинацией
   * Использует эффективный SQL запрос с пагинацией на уровне базы данных
   */
  async execute(
    filters: {
      code?: string;
      scope?: string;
      table?: string;
    } = {},
    pagination: PaginationInputDTO = { page: 1, limit: 10, sortOrder: 'DESC' }
  ): Promise<PaginationResult<TableStateDomainInterface>> {
    // Получаем пагинированные результаты напрямую из репозитория
    const result = await this.deltaRepository.findCurrentTableStatesPaginated(filters, pagination.page, pagination.limit);

    return {
      items: result.results,
      totalCount: result.total,
      totalPages: Math.ceil(result.total / pagination.limit),
      currentPage: pagination.page,
    };
  }
}
