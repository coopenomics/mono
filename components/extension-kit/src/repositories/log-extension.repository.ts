import { LogExtensionDomainEntity } from '../entities/log-extension.entity';
import type {
  LogExtensionFilter,
  LogExtensionPaginationOptions,
  LogExtensionPaginationResult,
} from '../entities/log-extension.entity';

export interface LogExtensionDomainRepository<TLog = any> {
  push(name: string, data: TLog): Promise<LogExtensionDomainEntity<TLog>>;
  get(): Promise<LogExtensionDomainEntity<TLog>[]>;
  getWithFilter(
    filter?: LogExtensionFilter,
    options?: LogExtensionPaginationOptions
  ): Promise<LogExtensionPaginationResult<TLog>>;
}

/** DI-токен журнала расширений. См. пояснение про `Symbol.for` в `EXTENSION_REPOSITORY`. */
export const LOG_EXTENSION_REPOSITORY = Symbol.for('ExtensionKit.Repository.LogExtension');
