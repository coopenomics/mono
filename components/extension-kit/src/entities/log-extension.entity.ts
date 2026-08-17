/** Запись журнала расширения: произвольные данные `TLog`, привязанные к установленному расширению. */
export interface LogExtensionDomainInterface<TLog = any> {
  id: number;
  name: string;
  extension_local_id: number;
  data: TLog;
  created_at: Date;
  updated_at: Date;
}

export interface LogExtensionFilter {
  name?: string;
  createdFrom?: Date;
  createdTo?: Date;
}

export interface LogExtensionPaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export class LogExtensionDomainEntity<TLog = any> implements LogExtensionDomainInterface {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly extension_local_id: number,
    public readonly data: TLog,
    public readonly created_at: Date,
    public readonly updated_at: Date
  ) {}
}

export interface LogExtensionPaginationResult<TLog = any> {
  items: LogExtensionDomainEntity<TLog>[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}
