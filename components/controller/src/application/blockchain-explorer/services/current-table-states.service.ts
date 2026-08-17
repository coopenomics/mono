import { Injectable } from '@nestjs/common';
import { GetCurrentTableStatesInteractor } from '../interactors/get-current-table-states.interactor';
import type { CurrentTableStateDTO } from '../dto/current-table-state.dto';
import type { CurrentTableStatesFiltersInputDTO } from '../dto/current-table-states-filters-input.dto';
import type { TableStateDomainInterface } from '~/domain/parser/interfaces/table-state-domain.interface';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';

/**
 * Сервис приложения для работы с текущими состояниями таблиц
 */
@Injectable()
export class CurrentTableStatesService {
  constructor(private readonly getCurrentTableStatesInteractor: GetCurrentTableStatesInteractor) {}

  /**
   * Получить текущие состояния таблиц с фильтрами и пагинацией
   */
  async getCurrentTableStates(
    filters: CurrentTableStatesFiltersInputDTO = {},
    pagination: PaginationInputDTO = { page: 1, limit: 10, sortOrder: 'DESC' }
  ): Promise<PaginationResult<CurrentTableStateDTO>> {
    const result = await this.getCurrentTableStatesInteractor.execute(filters, pagination);

    return {
      items: result.items.map((state) => this.mapToDTO(state)),
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };
  }

  /**
   * Преобразование результата интерактора в DTO
   */
  private mapToDTO(state: TableStateDomainInterface): CurrentTableStateDTO {
    return {
      code: state.code,
      scope: state.scope,
      table: state.table,
      primary_key: state.primary_key,
      value: state.value,
      block_num: state.block_num,
      created_at: state.created_at,
    };
  }
}
