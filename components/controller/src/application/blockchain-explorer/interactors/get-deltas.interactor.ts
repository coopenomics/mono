import { Injectable, Inject } from '@nestjs/common';
import type { DeltaRepositoryPort } from '~/domain/parser/ports/delta-repository.port';
import { DELTA_REPOSITORY_PORT } from '~/domain/parser/ports/delta-repository.port';
import type { DeltaFilterDomainInterface } from '~/domain/parser/interfaces/parser-config-domain.interface';
import type { DeltaDomainInterface } from '~/domain/parser/interfaces/delta-domain.interface';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';

/**
 * Интерактор приложения для получения дельт с фильтрацией и пагинацией
 */
@Injectable()
export class GetDeltasInteractor {
  constructor(
    @Inject(DELTA_REPOSITORY_PORT)
    private readonly deltaRepository: DeltaRepositoryPort
  ) {}

  /**
   * Получить дельты с фильтрацией и пагинацией
   */
  async execute(
    filters: DeltaFilterDomainInterface = {},
    pagination: PaginationInputDTO = { page: 1, limit: 10, sortOrder: 'DESC' }
  ): Promise<PaginationResult<DeltaDomainInterface>> {
    const result = await this.deltaRepository.findMany(filters, pagination.page, pagination.limit);

    return {
      items: result.results,
      totalCount: result.total,
      totalPages: Math.ceil(result.total / pagination.limit),
      currentPage: pagination.page,
    };
  }
}
