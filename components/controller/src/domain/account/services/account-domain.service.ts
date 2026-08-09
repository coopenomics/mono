import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import type { BlockchainAccountInterface } from '~/types/shared';
import { ACCOUNT_BLOCKCHAIN_PORT, type AccountBlockchainPort } from '../interfaces/account-blockchain.port';
import type { RegistratorContract, SovietContract } from 'cooptypes';
import config from '~/config/config';
import { AccountDomainEntity } from '../entities/account-domain.entity';
import type { MonoAccountDomainInterface } from '../interfaces/mono-account-domain.interface';
import { GENERATOR_PORT, GeneratorPort } from '~/domain/document/ports/generator.port';
import type { RegisterAccountDomainInterface } from '../interfaces/register-account-input.interface';
import { ENTREPRENEUR_REPOSITORY, EntrepreneurRepository } from '~/domain/common/repositories/entrepreneur.repository';
import { ORGANIZATION_REPOSITORY, OrganizationRepository } from '~/domain/common/repositories/organization.repository';
import { INDIVIDUAL_REPOSITORY, IndividualRepository } from '~/domain/common/repositories/individual.repository';
import type { IndividualDomainInterface } from '~/domain/common/interfaces/individual-domain.interface';
import type { OrganizationDomainInterface } from '~/domain/common/interfaces/organization-domain.interface';
import type { EntrepreneurDomainInterface } from '~/domain/common/interfaces/entrepreneur-domain.interface';
import { generateSubscriberHash } from '~/utils/subscriber-hash.util';
import { UserDomainService, USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import { HttpApiError } from '~/utils/httpApiError';
import httpStatus from 'http-status';
import { USER_REPOSITORY, UserRepository } from '~/domain/user/repositories/user.repository';
import { randomUUID } from 'crypto';
import type { Cooperative } from 'cooptypes';
import { userStatus } from '~/types';
import type { PrivateAccountDomainInterface } from '../interfaces/private-account-domain.interface';
import { AccountType } from '~/application/account/enum/account-type.enum';
import { AccountKind } from '~/application/account/enum/account-kind.enum';
import { BRANCH_BLOCKCHAIN_PORT, type BranchBlockchainPort } from '~/domain/branch/interfaces/branch-blockchain.port';
import { normalizeUserEmail } from '~/utils/normalize-user-email';

@Injectable()
export class AccountDomainService {
  private readonly logger = new Logger(AccountDomainService.name);

  constructor(
    @Inject(ACCOUNT_BLOCKCHAIN_PORT) private readonly accountBlockchainPort: AccountBlockchainPort,
    @Inject(BRANCH_BLOCKCHAIN_PORT) private readonly branchBlockchainPort: BranchBlockchainPort,
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizationRepository: OrganizationRepository,
    @Inject(INDIVIDUAL_REPOSITORY) private readonly individualRepository: IndividualRepository,
    @Inject(ENTREPRENEUR_REPOSITORY) private readonly entrepreneurRepository: EntrepreneurRepository,
    @Inject(GENERATOR_PORT) private readonly generatorPort: GeneratorPort,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(USER_DOMAIN_SERVICE) private readonly userDomainService: UserDomainService
  ) {}

  /**
   * Создает пользователя с соответствующими данными в генераторе документов
   */
  private async createUser(userBody: any) {
    userBody.email = normalizeUserEmail(userBody.email);
    // Проверяем на существование пользователя
    // допускаем обновление личных данных, если пользователь находится в статусе 'created'
    const exist = await this.userRepository.findByEmail(userBody.email);

    if (exist && exist.status !== 'created') {
      if (await this.userRepository.isEmailTaken(userBody.email)) {
        throw new HttpApiError(httpStatus.BAD_REQUEST, 'Пользователь с указанным EMAIL уже зарегистрирован');
      }
    }

    // Валидация входных данных
    if (userBody.type === 'individual') {
      if (!userBody.individual_data) throw new HttpApiError(httpStatus.BAD_REQUEST, 'Individual data is required');
      else userBody.individual_data.email = userBody.email;
    }

    if (userBody.type === 'organization') {
      if (!userBody.organization_data) throw new HttpApiError(httpStatus.BAD_REQUEST, 'Organization data is required');
      else userBody.organization_data.email = userBody.email;
    }

    if (userBody.type === 'entrepreneur') {
      if (!userBody.entrepreneur_data) throw new HttpApiError(httpStatus.BAD_REQUEST, 'Entrepreneur data is required');
      else userBody.entrepreneur_data.email = userBody.email;
    }

    // Сохраняем данные в соответствующие коллекции генератора
    if (userBody.type === 'individual' && userBody.individual_data) {
      await this.generatorPort.save('individual', { username: userBody.username, ...userBody.individual_data });
    }

    if (userBody.type === 'organization' && userBody.organization_data) {
      const { bank_account, ...userData } = userBody.organization_data || {};

      const paymentMethod: Cooperative.Payments.IPaymentData = {
        username: userBody.username,
        method_id: randomUUID(),
        method_type: 'bank_transfer',
        is_default: true,
        data: bank_account,
      };

      await this.generatorPort.save('organization', { username: userBody.username, ...userData });
      await this.generatorPort.save('paymentMethod', paymentMethod);
    }

    if (userBody.type === 'entrepreneur' && userBody.entrepreneur_data) {
      const { bank_account, ...userData } = userBody.entrepreneur_data || {};

      const paymentMethod: Cooperative.Payments.IPaymentData = {
        username: userBody.username,
        method_id: randomUUID(),
        method_type: 'bank_transfer',
        is_default: true,
        data: bank_account,
      };

      await this.generatorPort.save('entrepreneur', { username: userBody.username, ...userData });
      await this.generatorPort.save('paymentMethod', paymentMethod);
    }

    // Создаем или обновляем пользователя
    if (exist) {
      await this.userRepository.updateByUsername(exist.username, userBody);
      return await this.userRepository.findByUsername(exist.username);
    } else {
      return await this.userRepository.create(userBody);
    }
  }

  /**
   * Настраивает identity получателя уведомлений: генерирует immutable `subscriber_id`
   * (адресация Центра уведомлений) и `subscriber_hash`, сохраняет в профиль пользователя.
   * @param username Имя пользователя
   * @param context Контекст для логирования (например, "регистрации", "обновления")
   */
  async setupNotificationSubscriber(username: string, context = 'пользователя'): Promise<void> {
    this.logger.log(`Настройка identity получателя уведомлений для ${context} ${username}`);

    try {
      const subscriberId = await this.userDomainService.generateSubscriberId(config.coopname);
      const subscriberHash = generateSubscriberHash(subscriberId);

      await this.userRepository.updateByUsername(username, {
        subscriber_id: subscriberId,
        subscriber_hash: subscriberHash,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Ошибка настройки identity получателя для ${context} ${username}: ${message}`, stack);
      throw error;
    }
  }

  async addProviderAccount(data: RegisterAccountDomainInterface): Promise<MonoAccountDomainInterface> {
    // Создаем пользователя
    const user = await this.createUser({ ...data, role: 'user' });
    if (!user) {
      throw new HttpApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Не удалось создать пользователя');
    }

    // Обновляем статус пользователя
    const updatedUser = await this.userRepository.updateByUsername(user.username, {
      status: userStatus['4_Registered'],
      is_registered: true,
      has_account: true,
    });

    if (!updatedUser) {
      throw new HttpApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Не удалось обновить пользователя');
    }

    return {
      username: updatedUser.username,
      status: updatedUser.status as any,
      message: updatedUser.message,
      is_registered: updatedUser.is_registered,
      has_account: updatedUser.has_account,
      type: updatedUser.type,
      public_key: updatedUser.public_key,
      referer: updatedUser.referer,
      email: updatedUser.email,
      role: updatedUser.role,
      is_email_verified: updatedUser.is_email_verified,
      subscriber_id: updatedUser.subscriber_id,
      subscriber_hash: updatedUser.subscriber_hash,
    } as MonoAccountDomainInterface;
  }

  async addParticipantAccount(data: RegistratorContract.Actions.AddUser.IAddUser): Promise<void> {
    try {
      await this.accountBlockchainPort.addParticipantAccount(data);
    } catch (e: any) {
      // удаляем аккаунт провайдера если транзакция в блокчейн не прошла (для возможности повтора)
      await this.userDomainService.deleteUserByUsername(data.username);
      throw new BadRequestException(e.message);
    }
  }

  async getAccount(username: string): Promise<AccountDomainEntity> {
    // Исключение для организации-кооператива
    // Очень плохие решения из за того что мы содержим ТРИ разных репозитория под приватные данные и не знаем наверняка в каком искать данные заранее!
    if (config.coopname === username) {
      const user_account = await this.getUserAccount(username);
      const blockchain_account = await this.getBlockchainAccount(username);
      const participant_account = await this.getParticipantAccount(config.coopname, username);
      const organization_data = await this.organizationRepository.findByUsername(username);
      const private_account: PrivateAccountDomainInterface = {
        type: AccountType.organization,
        individual_data: undefined,
        organization_data,
        entrepreneur_data: undefined,
      };
      return new AccountDomainEntity({
        username,
        user_account,
        blockchain_account,
        provider_account: null,
        participant_account,
        private_account,
        account_kind: AccountKind.cooperative,
      });
    }

    const user_account = await this.getUserAccount(username);
    const blockchain_account = await this.getBlockchainAccount(username);
    const participant_account = await this.getParticipantAccount(config.coopname, username);

    const user = await this.userRepository.findByUsername(username);
    const provider_account = user
      ? ({
          username: user.username,
          status: user.status as any,
          message: user.message,
          is_registered: user.is_registered,
          has_account: user.has_account,
          type: user.type,
          public_key: user.public_key,
          referer: user.referer,
          email: user.email,
          role: user.role,
          is_email_verified: user.is_email_verified,
          subscriber_id: user.subscriber_id,
          subscriber_hash: user.subscriber_hash,
        } as MonoAccountDomainInterface)
      : null;

    let individual_data, organization_data, entrepreneur_data;
    if (provider_account && provider_account.type == 'individual') {
      individual_data = await this.individualRepository.findByUsername(username);
    } else if (provider_account && provider_account.type == 'organization') {
      organization_data = await this.organizationRepository.findByUsername(username);
    } else if (provider_account && provider_account.type == 'entrepreneur') {
      entrepreneur_data = await this.entrepreneurRepository.findByUsername(username);
    }
    let private_account: PrivateAccountDomainInterface | null = null;

    if (provider_account) {
      private_account = {
        type: provider_account.type as AccountType,
        individual_data,
        organization_data,
        entrepreneur_data,
      };
    }

    let account_kind: AccountKind = provider_account ? AccountKind.participant : AccountKind.unknown;

    // Кооперативный участок (КУ): это реальный аккаунт-подразделение кооператива
    // без учётной записи пайщика (нет provider_account), его орг-данные хранятся
    // в том же organizationRepository по braname (как у самого кооператива выше).
    // Признак КУ — наличие записи в реестре участков. Резолвим имя через
    // private_account.organization_data, чтобы getDisplayName/сертификаты/фронт
    // получали человеческое имя участка тем же каналом, что и у организаций —
    // без отдельной ветки у каждого потребителя.
    if (!provider_account) {
      const branch = await this.branchBlockchainPort.getBranch(config.coopname, username);
      if (branch) {
        const branch_organization_data = await this.organizationRepository.findByUsername(username);
        private_account = {
          type: AccountType.organization,
          individual_data: undefined,
          organization_data: branch_organization_data,
          entrepreneur_data: undefined,
        };
        account_kind = AccountKind.branch;
      }
    }

    const finalAccount = new AccountDomainEntity({
      username,
      user_account,
      blockchain_account,
      provider_account: provider_account,
      participant_account,
      private_account,
      account_kind,
    });

    return finalAccount;
  }

  async getBlockchainAccount(username: string): Promise<BlockchainAccountInterface | null> {
    return await this.accountBlockchainPort.getBlockchainAccount(username);
  }

  async getCooperatorAccount(username: string): Promise<RegistratorContract.Tables.Cooperatives.ICooperative | null> {
    return await this.accountBlockchainPort.getCooperatorAccount(username);
  }

  async getParticipantAccount(
    coopname: string,
    username: string
  ): Promise<SovietContract.Tables.Participants.IParticipants | null> {
    return await this.accountBlockchainPort.getParticipantAccount(coopname, username);
  }

  async getUserAccount(username: string): Promise<RegistratorContract.Tables.Accounts.IAccount | null> {
    return await this.accountBlockchainPort.getUserAccount(username);
  }

  /**
   * Извлекает данные подписанта из приватного аккаунта пользователя
   * @param username Имя пользователя
   * @returns Данные подписанта (физ. лицо, организация или ИП)
   */
  async getPrivateAccount(
    username: string
  ): Promise<IndividualDomainInterface | OrganizationDomainInterface | EntrepreneurDomainInterface | null> {
    const account = await this.getAccount(username);

    if (!account.private_account) {
      return null;
    }

    if (account.private_account.type === 'individual' && account.private_account.individual_data) {
      return account.private_account.individual_data;
    }

    if (account.private_account.type === 'organization' && account.private_account.organization_data) {
      return account.private_account.organization_data;
    }

    if (account.private_account.type === 'entrepreneur' && account.private_account.entrepreneur_data) {
      return account.private_account.entrepreneur_data;
    }

    return null;
  }

  /**
   * Извлекает отображаемое имя из аккаунта пользователя
   * @param username Имя пользователя
   * @returns Отображаемое имя (ФИО или название организации)
   */
  async getDisplayName(username: string): Promise<string> {
    const account = await this.getAccount(username);
    const privateAccount = account.private_account;

    if (!privateAccount) {
      throw new Error(`Private account not found for user ${username}`);
    }

    // Определяем тип аккаунта и извлекаем соответствующее имя
    if (privateAccount.type === 'individual' && privateAccount.individual_data) {
      const { first_name, last_name, middle_name } = privateAccount.individual_data;
      return `${last_name} ${first_name} ${middle_name || ''}`.trim();
    } else if (privateAccount.type === 'organization' && privateAccount.organization_data) {
      return privateAccount.organization_data.short_name;
    } else if (privateAccount.type === 'entrepreneur' && privateAccount.entrepreneur_data) {
      const { first_name, last_name, middle_name } = privateAccount.entrepreneur_data;
      return `${last_name} ${first_name} ${middle_name || ''}`.trim();
    }

    throw new Error(`Invalid account type for user ${username}`);
  }
}

export const ACCOUNT_DOMAIN_SERVICE = Symbol('ACCOUNT_DOMAIN_SERVICE');
