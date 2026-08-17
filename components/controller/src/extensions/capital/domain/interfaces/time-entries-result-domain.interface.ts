import type { TimeEntryDomainEntity } from '../entities/time-entry.entity';
import type { PaginationResult } from '@coopenomics/extension-kit';

/**
 * Доменный интерфейс для результата пагинированных записей времени
 */
export type TimeEntriesResultDomainInterface = PaginationResult<TimeEntryDomainEntity>;
