import { Inject, Injectable } from '@nestjs/common';
import type {
  IAccountPort,
  InnerAccount,
  InnerGetAccountsFilter,
  InnerPaginatedAccounts,
  InnerPaginationOptions,
  InnerChainAccountRow,
} from '@coopenomics/innercoop';
import { ACCOUNT_DOMAIN_SERVICE, type AccountDomainService } from '~/domain/account/services/account-domain.service';
import { ACCOUNT_DATA_PORT, type AccountDataPort } from '~/domain/account/ports/account-data.port';

/**
 * Реализация `IAccountPort` для расширений.
 *
 * Тонкая обёртка над существующим `AccountDataPort` ядра: формы совпадают,
 * маппинга нет. Отдельный слой нужен ровно затем, чтобы расширение не называло
 * `AccountDomainEntity` — класс, тянущий cooptypes и пути `~/...`.
 */
@Injectable()
export class AccountInnercoopAdapter implements IAccountPort {
  constructor(
    @Inject(ACCOUNT_DATA_PORT) private readonly accountDataPort: AccountDataPort,
    @Inject(ACCOUNT_DOMAIN_SERVICE) private readonly accountDomainService: AccountDomainService
  ) {}

  async getAccount(username: string): Promise<InnerAccount> {
    return (await this.accountDataPort.getAccount(username)) as unknown as InnerAccount;
  }

  async getAccounts(
    filter: InnerGetAccountsFilter,
    options?: InnerPaginationOptions
  ): Promise<InnerPaginatedAccounts> {
    const result = await this.accountDataPort.getAccounts(filter as any, options as any);
    return result as unknown as InnerPaginatedAccounts;
  }

  async getDisplayName(username: string): Promise<string> {
    return this.accountDataPort.getDisplayName(username);
  }

  async getChainAccount(username: string): Promise<InnerChainAccountRow | null> {
    return this.accountDomainService.getUserAccount(username);
  }
}