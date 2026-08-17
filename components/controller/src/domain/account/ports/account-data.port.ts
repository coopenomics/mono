import { AccountDomainEntity } from '~/domain/account/entities/account-domain.entity';
import { PaginationInputDTO } from '@coopenomics/extension-kit';
import { PaginationResultDomainInterface } from '~/domain/common/interfaces/pagination.interface';
import type { GetAccountsInputDomainInterface } from '~/domain/account/interfaces/get-accounts-input.interface';

/**
 * Доменный порт для получения данных аккаунтов
 * Используется расширениями для доступа к данным пользователей
 */
export interface AccountDataPort {
  getAccounts(
    data: GetAccountsInputDomainInterface,
    options?: PaginationInputDTO
  ): Promise<PaginationResultDomainInterface<AccountDomainEntity>>;

  getAccount(username: string): Promise<AccountDomainEntity>;

  getDisplayName(username: string): Promise<string>;
}

export const ACCOUNT_DATA_PORT = Symbol('AccountDataPort');
