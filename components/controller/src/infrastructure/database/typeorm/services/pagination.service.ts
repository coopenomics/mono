import { Injectable } from '@nestjs/common';
import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';

@Injectable()
export class PaginationService {
  /**
   * Применяет параметры пагинации и сортировки к QueryBuilder.
   *
   * @param queryBuilder - QueryBuilder для формирования запроса.
   * @param paginationInput - Параметры пагинации и сортировки.
   * @returns {Promise<PaginationResult<T>>} - Результат пагинации.
   */
  async paginate<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    paginationInput: PaginationInputDTO
  ): Promise<PaginationResult<T>> {
    const { page, limit, sortBy, sortOrder } = paginationInput;

    // Применение сортировки, если указан `sortBy`
    if (sortBy) {
      queryBuilder.orderBy(sortBy, sortOrder.toUpperCase() as 'ASC' | 'DESC');
    }

    // Подсчёт общего количества элементов
    const [items, totalCount] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    };
  }
}
