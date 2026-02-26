import type { SegmentDomainEntity } from '../entities/segment.entity';
import type { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { SegmentFilterInputDTO } from '../../application/dto/segments/segment-filter.input';

export const SEGMENT_REPOSITORY = Symbol('SEGMENT_REPOSITORY');

/**
 * Интерфейс репозитория сегментов
 */
export interface SegmentRepository extends IBlockchainSyncRepository<SegmentDomainEntity> {
  /**
   * Найти все сегменты с пагинацией и фильтрацией
   */
  findAllPaginated(
    filter?: SegmentFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<SegmentDomainEntity>>;

  /**
   * Найти один сегмент по фильтрам
   */
  findOne(filter?: SegmentFilterInputDTO): Promise<SegmentDomainEntity | null>;

  /**
   * Установить флаг завершения конвертации для сегмента
   */
  markAsCompleted(coopname: string, project_hash: string, username: string): Promise<SegmentDomainEntity | null>;
}
