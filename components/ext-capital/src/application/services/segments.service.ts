import { Injectable } from '@nestjs/common';
import { SegmentsInteractor } from '../use-cases/segments.interactor';
import { SegmentOutputDTO } from '../dto/segments/segment.dto';
import { SegmentFilterInputDTO } from '../dto/segments/segment-filter.input';
import { PaginationInputDTO, PaginationResult } from '~/application/common/dto/pagination.dto';
import type { PaginationInputDomainInterface } from '~/domain/common/interfaces/pagination.interface';
import type { RefreshSegmentDomainInput } from '../../domain/actions/refresh-segment-domain-input.interface';
import { SegmentMapper } from '../../infrastructure/mappers/segment.mapper';

/**
 * Сервис уровня приложения для управления сегментами CAPITAL
 * Обрабатывает запросы от SegmentsResolver
 */
@Injectable()
export class SegmentsService {
  constructor(private readonly segmentsInteractor: SegmentsInteractor, private readonly segmentMapper: SegmentMapper) {}

  /**
   * Получить все сегменты с пагинацией и фильтрацией
   */
  async getSegments(
    filter?: SegmentFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SegmentOutputDTO>> {
    // Конвертируем параметры пагинации в доменные
    const domainOptions: PaginationInputDomainInterface | undefined = options;

    // Получаем результат с пагинацией из домена
    const result = await this.segmentsInteractor.getSegments(filter, domainOptions);

    // Обогащаем документы в result для каждого сегмента
    const enrichedItems = await Promise.all(result.items.map((segment) => this.segmentMapper.toDTO(segment)));

    // Конвертируем результат в DTO
    return {
      items: enrichedItems,
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };
  }

  /**
   * Получить один сегмент по фильтрам
   */
  async getSegment(filter?: SegmentFilterInputDTO): Promise<SegmentOutputDTO | null> {
    // Получаем результат из домена
    const result = await this.segmentsInteractor.getSegment(filter);

    // Возвращаем null, если сегмент не найден
    if (!result) {
      return null;
    }

    // Обогащаем документы в result и конвертируем в DTO
    return await this.segmentMapper.toDTO(result);
  }

  /**
   * Обновление сегмента в CAPITAL контракте
   */
  async refreshSegment(data: RefreshSegmentDomainInput): Promise<SegmentOutputDTO | null> {
    // Получаем обновленный сегмент из домена
    const segmentEntity = await this.segmentsInteractor.refreshSegment(data);

    // Возвращаем null, если сегмент не найден
    if (!segmentEntity) {
      return null;
    }

    // Обогащаем документы в result и конвертируем в DTO
    return await this.segmentMapper.toDTO(segmentEntity);
  }
}
