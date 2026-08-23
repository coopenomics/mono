import { Inject, Injectable } from '@nestjs/common';
import { AccountDataPort } from '~/domain/account/ports/account-data.port';
import { AccountInteractor } from '~/application/account/interactors/account.interactor';
import { AccountDomainEntity } from '~/domain/account/entities/account-domain.entity';
import { PaginationInputDTO } from '@coopenomics/extension-kit';
import { PaginationResultDomainInterface } from '~/domain/common/interfaces/pagination.interface';
import type { GetAccountsInputDomainInterface } from '~/domain/account/interfaces/get-accounts-input.interface';

@Injectable()
export class AccountDataAdapter implements AccountDataPort {
  constructor(@Inject(AccountInteractor) private readonly accountInteractor: AccountInteractor) {}

  async getAccounts(
    data: GetAccountsInputDomainInterface = {},
    options?: PaginationInputDTO
  ): Promise<PaginationResultDomainInterface<AccountDomainEntity>> {
    return this.accountInteractor.getAccounts(data, options);
  }

  async getAccount(username: string): Promise<AccountDomainEntity> {
    return this.accountInteractor.getAccount(username);
  }

  async getDisplayName(username: string): Promise<string> {
    return this.accountInteractor.getDisplayName(username);
  }
}
