import type { SegmentDomainEntity } from '../entities/segment.entity';
import type { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
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
   * Найти все сегменты одного компонента без постраничного вывода.
   *
   * Нужен там, где ответ считается по всем участникам сразу и любой предел
   * выборки исказил бы результат — например, при расчёте предела возврата
   * средств из компонента.
   */
  findAllByProjectHash(coopname: string, project_hash: string): Promise<SegmentDomainEntity[]>;

  /**
   * Найти один сегмент по фильтрам
   */
  findOne(filter?: SegmentFilterInputDTO): Promise<SegmentDomainEntity | null>;

  /**
   * Установить флаг завершения конвертации для сегмента
   */
  markAsCompleted(coopname: string, project_hash: string, username: string): Promise<SegmentDomainEntity | null>;
}
