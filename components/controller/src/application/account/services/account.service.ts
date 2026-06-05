import { Injectable } from '@nestjs/common';
import { AccountDTO } from '../dto/account.dto';
import { AccountInteractor } from '../interactors/account.interactor';
import type { GetAccountsInputDTO } from '../dto/get-accounts-input.dto';
import type { PaginationInputDTO } from '~/application/common/dto/pagination.dto';
import type { PaginationResultDomainInterface } from '~/domain/common/interfaces/pagination.interface';
import type { RegisterAccountInputDTO } from '../dto/register-account-input.dto';
import { RegisteredAccountDTO } from '../dto/registered-account.dto';
import type { DeleteAccountInputDTO } from '../dto/delete-account-input.dto';
import type { UpdateAccountInputDTO } from '../dto/update-account-input.dto';
import type { SearchPrivateAccountsInputDTO } from '../dto/search-private-accounts-input.dto';
import { PrivateAccountSearchResultDTO } from '../dto/search-private-accounts-result.dto';

@Injectable()
export class AccountService {
  constructor(private readonly accountInteractor: AccountInteractor) {}

  public async updateAccount(data: UpdateAccountInputDTO): Promise<AccountDTO> {
    const result = await this.accountInteractor.updateAccount(data);
    return new AccountDTO(result);
  }

  public async deleteAccount(data: DeleteAccountInputDTO): Promise<void> {
    await this.accountInteractor.deleteAccount(data.username_for_delete);
  }

  public async getAccount(username: string): Promise<AccountDTO> {
    const account = await this.accountInteractor.getAccount(username);

    return new AccountDTO(account);
  }

  public async resetRegistration(username: string): Promise<AccountDTO> {
    const account = await this.accountInteractor.resetRegistration(username);

    return new AccountDTO(account);
  }

  public async getAccounts(
    data?: GetAccountsInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResultDomainInterface<AccountDTO>> {
    const result = await this.accountInteractor.getAccounts(data, options);

    return {
      ...result,
      items: result.items.map((account) => new AccountDTO(account)),
    };
  }

  public async registerAccount(data: RegisterAccountInputDTO): Promise<RegisteredAccountDTO> {
    const result = await this.accountInteractor.registerAccount(data);
    return new RegisteredAccountDTO(result);
  }

  /**
   * Поиск приватных аккаунтов
   * @param data Входные данные для поиска
   * @returns Массив результатов поиска
   */
  public async searchPrivateAccounts(data: SearchPrivateAccountsInputDTO): Promise<PrivateAccountSearchResultDTO[]> {
    const results = await this.accountInteractor.searchPrivateAccounts(data);

    return results.map((result) => new PrivateAccountSearchResultDTO(result));
  }
}
