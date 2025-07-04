import { AccountDomainEntity } from '../entities/account-domain.entity';
import config from '~/config/config';
import { AccountDomainService } from '~/domain/account/services/account-domain.service';
import { Inject, Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { tokenService, userService } from '~/services';
import type { MonoAccountDomainInterface } from '../interfaces/mono-account-domain.interface';
import type { GetAccountsInputDomainInterface } from '../interfaces/get-accounts-input.interface';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { QueryResultLegacy } from '~/domain/common/interfaces/query-result-legacy-domain.interface';
import type { RegisterAccountDomainInterface } from '../interfaces/register-account-input.interface';
import type { RegisteredAccountDomainInterface } from '../interfaces/registeted-account.interface';
import type { UpdateAccountDomainInterface } from '../interfaces/update-account-input.interface';
import { AccountType } from '~/modules/account/enum/account-type.enum';
import { ORGANIZATION_REPOSITORY, OrganizationRepository } from '~/domain/common/repositories/organization.repository';
import { INDIVIDUAL_REPOSITORY, IndividualRepository } from '~/domain/common/repositories/individual.repository';
import { ENTREPRENEUR_REPOSITORY, EntrepreneurRepository } from '~/domain/common/repositories/entrepreneur.repository';
import {
  SEARCH_PRIVATE_ACCOUNTS_REPOSITORY,
  SearchPrivateAccountsRepository,
} from '~/domain/common/repositories/search-private-accounts.repository';
import { IndividualDomainEntity } from '~/domain/branch/entities/individual-domain.entity';
import { OrganizationDomainEntity } from '~/domain/branch/entities/organization-domain.entity';
import { EntrepreneurDomainEntity } from '~/domain/branch/entities/entrepreneur-domain.entity';
import { ACCOUNT_BLOCKCHAIN_PORT, AccountBlockchainPort } from '../interfaces/account-blockchain.port';
import { CANDIDATE_REPOSITORY, CandidateRepository } from '../repository/candidate.repository';
import { userStatus } from '~/types/user.types';
import { sha256 } from '~/utils/sha256';
import type {
  SearchPrivateAccountsInputDomainInterface,
  PrivateAccountSearchResultDomainInterface,
} from '~/domain/common/interfaces/search-private-accounts-domain.interface';

@Injectable()
export class AccountDomainInteractor {
  constructor(
    private readonly accountDomainService: AccountDomainService,
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizationRepository: OrganizationRepository,
    @Inject(INDIVIDUAL_REPOSITORY) private readonly individualRepository: IndividualRepository,
    @Inject(ENTREPRENEUR_REPOSITORY) private readonly entrepreneurRepository: EntrepreneurRepository,
    @Inject(SEARCH_PRIVATE_ACCOUNTS_REPOSITORY)
    private readonly searchPrivateAccountsRepository: SearchPrivateAccountsRepository,
    @Inject(ACCOUNT_BLOCKCHAIN_PORT) private readonly accountBlockchainPort: AccountBlockchainPort,
    @Inject(CANDIDATE_REPOSITORY) private readonly candidateRepository: CandidateRepository
  ) {}

  private readonly logger = new Logger(AccountDomainInteractor.name);

  async updateAccount(data: UpdateAccountDomainInterface): Promise<AccountDomainEntity> {
    this.logger.log(`Начало обновления аккаунта ${data.username}`);

    let user;
    if (data.individual_data) {
      const email = data.individual_data.email;
      user = await userService.updateUserByUsername(data.username, { email });
      this.individualRepository.create({ ...data.individual_data, username: data.username });
    } else if (data.organization_data) {
      const email = data.organization_data.email;
      user = await userService.updateUserByUsername(data.username, { email });
      this.organizationRepository.create({ ...data.organization_data, username: data.username });
    } else if (data.entrepreneur_data) {
      const email = data.entrepreneur_data.email;
      user = await userService.updateUserByUsername(data.username, { email });
      this.entrepreneurRepository.create({ ...data.entrepreneur_data, username: data.username });
    } else {
      throw new Error('Не получены входные данные для обновления');
    }

    // Синхронизируем обновленные данные с системой уведомлений
    await this.accountDomainService.syncAccountWithNotifications(user.username);

    // Получаем финальный аккаунт после синхронизации
    const account = await this.getAccount(user.username);

    this.logger.log(`Успешно обновлен аккаунт ${data.username}`);

    const result = new AccountDomainEntity(account);
    return result;
  }

  async deleteAccount(username: string): Promise<void> {
    await userService.deleteUserByUsername(username);
  }

  async getUserProfile(
    username: string,
    accountType: AccountType
  ): Promise<IndividualDomainEntity | OrganizationDomainEntity | EntrepreneurDomainEntity> {
    switch (accountType) {
      case AccountType.individual:
        return new IndividualDomainEntity(await this.individualRepository.findByUsername(username));
      case AccountType.organization:
        return new OrganizationDomainEntity(await this.organizationRepository.findByUsername(username));
      case AccountType.entrepreneur:
        return new EntrepreneurDomainEntity(await this.entrepreneurRepository.findByUsername(username));
      default:
        throw new Error(`Неизвестный тип аккаунта: ${accountType}`);
    }
  }

  async registerAccount(data: RegisterAccountDomainInterface): Promise<RegisteredAccountDomainInterface> {
    //TODO refactor after migrate from mongo
    const user = await userService.createUser({ ...data, role: 'user' });
    const tokens = await tokenService.generateAuthTokens(user);

    // Создаем нового кандидата в репозитории
    const now = new Date();
    await this.candidateRepository.create({
      username: data.username,
      coopname: config.coopname,
      braname: '', // Может быть задано позже
      status: 'pending', // Начальный статус
      type: data.type, // Используем тип из входных данных
      created_at: now,
      documents: {
        statement: undefined, // Документы будут добавлены позже
        wallet_agreement: undefined,
        signature_agreement: undefined,
        privacy_agreement: undefined,
        user_agreement: undefined,
      },
      referer: data.referer,
      public_key: data.public_key,
      meta: JSON.stringify({}),
      registration_hash: sha256(data.username), // Будет установлен при обработке платежа
    });

    this.logger.log(`Создан новый кандидат: ${data.username}, тип: ${data.type}`);

    const account = await this.getAccount(data.username);

    const result: RegisteredAccountDomainInterface = {
      account,
      tokens,
    };

    return result;
  }

  async getAccount(username: string): Promise<AccountDomainEntity> {
    return await this.accountDomainService.getAccount(username);
  }

  async getAccounts(
    data: GetAccountsInputDomainInterface = {},
    options: PaginationInputDomainInterface = { page: 1, limit: 10, sortOrder: 'DESC' }
  ): Promise<PaginationResultDomainInterface<AccountDomainEntity>> {
    const provider_accounts = (await userService.queryUsers(data, options)) as QueryResultLegacy<MonoAccountDomainInterface>;

    const result: PaginationResultDomainInterface<AccountDomainEntity> = {
      items: [],
      totalCount: provider_accounts.totalResults,
      totalPages: provider_accounts.totalPages,
      currentPage: provider_accounts.page,
    };

    for (const account of provider_accounts.results) {
      const item = await this.accountDomainService.getAccount(account.username);
      result.items.push(item);
    }

    return result;
  }

  /**
   * Регистрирует аккаунт в блокчейне.
   * @param username - Имя пользователя
   */
  async registerBlockchainAccount(username: string): Promise<void> {
    this.logger.log(`Начало регистрации аккаунта ${username} в блокчейне`);

    // Получаем кандидата из репозитория
    const candidate = await this.candidateRepository.findByUsername(username);
    if (!candidate) {
      throw new HttpException(`Кандидат с именем ${username} не найден`, HttpStatus.NOT_FOUND);
    }

    try {
      // Вызываем порт для регистрации в блокчейне, передавая объект кандидата целиком
      await this.accountBlockchainPort.registerBlockchainAccount(candidate);

      // Обновляем статус пользователя
      await userService.updateUserByUsername(username, {
        status: userStatus['4_Registered'],
        is_registered: true,
        has_account: true,
      });

      this.logger.log(`Успешная регистрация аккаунта ${username} в блокчейне`);
    } catch (error: any) {
      this.logger.error(`Ошибка при регистрации аккаунта ${username} в блокчейне: ${error.message}`, error.stack);
      throw new HttpException(`Ошибка при регистрации в блокчейне: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Поиск приватных аккаунтов по запросу
   * @param input Входные данные для поиска
   * @returns Массив результатов поиска
   */
  async searchPrivateAccounts(
    input: SearchPrivateAccountsInputDomainInterface
  ): Promise<PrivateAccountSearchResultDomainInterface[]> {
    this.logger.log(`Поиск приватных аккаунтов по запросу: "${input.query}"`);

    const results = await this.searchPrivateAccountsRepository.searchPrivateAccounts(input);

    this.logger.log(`Найдено ${results.length} приватных аккаунтов`);

    return results;
  }
}
