import type { PaginationResultDomainInterface } from '~/domain/common/interfaces/pagination.interface';
import type { TimeEntryDomainEntity } from '../entities/time-entry.entity';

/**
 * Доменный интерфейс для результата пагинированных записей времени
 */
export type TimeEntriesResultDomainInterface = PaginationResultDomainInterface<TimeEntryDomainEntity>;
