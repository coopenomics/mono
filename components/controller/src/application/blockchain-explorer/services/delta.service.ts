import { Injectable } from '@nestjs/common';
import { GetDeltasInteractor } from '../interactors/get-deltas.interactor';
import type { DeltaFilterDomainInterface } from '~/domain/parser/interfaces/parser-config-domain.interface';
import type { DeltaDomainInterface } from '~/domain/parser/interfaces/delta-domain.interface';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import type { DeltaDTO } from '../dto/delta.dto';
import type { DeltaFiltersInputDTO } from '../dto/delta-filters-input.dto';

/**
 * Сервис приложения для работы с дельтами
 */
@Injectable()
export class DeltaService {
  constructor(private readonly getDeltasInteractor: GetDeltasInteractor) {}

  /**
   * Получить дельты с фильтрацией и пагинацией
   */
  async getDeltas(
    filters: DeltaFiltersInputDTO = {},
    pagination: PaginationInputDTO = { page: 1, limit: 10, sortOrder: 'DESC' }
  ): Promise<PaginationResult<DeltaDTO>> {
    // Преобразование входных DTO в доменные интерфейсы
    const domainFilters: DeltaFilterDomainInterface = {
      code: filters.code,
      scope: filters.scope,
      table: filters.table,
      block_num: filters.block_num,
      primary_key: filters.primary_key,
      present: filters.present,
    };

    const result = await this.getDeltasInteractor.execute(domainFilters, pagination);

    // Преобразование результатов в DTO
    const items = result.items.map((delta) => this.mapToDTO(delta));

    return {
      items,
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };
  }

  /**
   * Преобразование доменной сущности в DTO
   */
  private mapToDTO(delta: DeltaDomainInterface): DeltaDTO {
    return {
      id: delta.id,
      chain_id: delta.chain_id,
      block_num: delta.block_num,
      block_id: delta.block_id,
      present: delta.present,
      code: delta.code,
      scope: delta.scope,
      table: delta.table,
      primary_key: delta.primary_key,
      value: delta.value,
      created_at: delta.created_at,
    };
  }
}
