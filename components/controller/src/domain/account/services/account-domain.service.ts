import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import type { BlockchainAccountInterface } from '~/types/shared';
import { ACCOUNT_BLOCKCHAIN_PORT, type AccountBlockchainPort } from '../interfaces/account-blockchain.port';
import type { RegistratorContract, SovietContract } from 'cooptypes';
import config from '~/config/config';
import { AccountDomainEntity } from '../entities/account-domain.entity';
import type { MonoAccountDomainInterface } from '../interfaces/mono-account-domain.interface';
import { userService } from '~/services';
import type { RegisterAccountDomainInterface } from '../interfaces/register-account-input.interface';
import { userStatus } from '~/types';
import { ENTREPRENEUR_REPOSITORY, EntrepreneurRepository } from '~/domain/common/repositories/entrepreneur.repository';
import { ORGANIZATION_REPOSITORY, OrganizationRepository } from '~/domain/common/repositories/organization.repository';
import { INDIVIDUAL_REPOSITORY, IndividualRepository } from '~/domain/common/repositories/individual.repository';
import type { PrivateAccountDomainInterface } from '../interfaces/private-account-domain.interface';
import { AccountType } from '~/modules/account/enum/account-type.enum';
import type { IndividualDomainInterface } from '~/domain/common/interfaces/individual-domain.interface';
import type { OrganizationDomainInterface } from '~/domain/common/interfaces/organization-domain.interface';
import type { EntrepreneurDomainInterface } from '~/domain/common/interfaces/entrepreneur-domain.interface';
import { generateSubscriberId, generateSubscriberHash } from '~/utils/novu.utils';
import {
  NOTIFICATION_DOMAIN_SERVICE,
  NotificationDomainService,
} from '~/domain/notification/services/notification-domain.service';

@Injectable()
export class AccountDomainService {
  private readonly logger = new Logger(AccountDomainService.name);

  constructor(
    @Inject(ACCOUNT_BLOCKCHAIN_PORT) private readonly accountBlockchainPort: AccountBlockchainPort,
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizationRepository: OrganizationRepository,
    @Inject(INDIVIDUAL_REPOSITORY) private readonly individualRepository: IndividualRepository,
    @Inject(ENTREPRENEUR_REPOSITORY) private readonly entrepreneurRepository: EntrepreneurRepository,
    @Inject(NOTIFICATION_DOMAIN_SERVICE) private readonly notificationDomainService: NotificationDomainService
  ) {}

  async addProviderAccount(data: RegisterAccountDomainInterface): Promise<MonoAccountDomainInterface> {
    //TODO refactor it after migrate from mongo
    const user = await userService.createUser({ ...data, role: 'user' });
    user.status = userStatus['4_Registered'];
    user.is_registered = true;
    user.has_account = true;

    await user.save();
    return user as unknown as MonoAccountDomainInterface;
  }

  async addParticipantAccount(data: RegistratorContract.Actions.AddUser.IAddUser): Promise<void> {
    try {
      await this.accountBlockchainPort.addParticipantAccount(data);
    } catch (e: any) {
      // удаляем аккаунт провайдера если транзакция в блокчейн не прошла (для возможности повтора)
      await userService.deleteUserByUsername(data.username);
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
      });
    }

    const user_account = await this.getUserAccount(username);
    const blockchain_account = await this.getBlockchainAccount(username);
    const participant_account = await this.getParticipantAccount(config.coopname, username);

    const provider_account = (await userService.findUser(username)) as unknown as MonoAccountDomainInterface;

    // Генерируем subscriber_id и subscriber_hash если их нет
    if (provider_account && (!provider_account.subscriber_id || !provider_account.subscriber_hash)) {
      const subscriberId = generateSubscriberId(config.coopname);
      const subscriberHash = generateSubscriberHash(subscriberId);

      // Обновляем пользователя в базе данных
      await userService.updateUserByUsername(username, {
        subscriber_id: subscriberId,
        subscriber_hash: subscriberHash,
      });

      // Безопасно обновляем поля объекта
      Object.assign(provider_account, {
        subscriber_id: subscriberId,
        subscriber_hash: subscriberHash,
      });

      // Создаем подписчика в NOVU после успешного обновления данных
      try {
        const account = new AccountDomainEntity({
          username,
          user_account: null,
          blockchain_account: null,
          provider_account,
          participant_account: null,
          private_account: null,
        });

        await this.notificationDomainService.createSubscriberFromAccount(account);
      } catch (error: any) {
        // Логируем ошибку, но не прерываем выполнение основной логики
        this.logger.error(`Ошибка создания подписчика NOVU для ${username}: ${error.message}`, error.stack);
      }
    }

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

    // Создаем/обновляем подписчика NOVU с полными данными
    const finalAccount = new AccountDomainEntity({
      username,
      user_account,
      blockchain_account,
      provider_account: provider_account,
      participant_account,
      private_account,
    });

    // Асинхронно обновляем подписчика в фоне
    // if (provider_account?.subscriber_id) {
    //   setImmediate(async () => {
    //     try {
    //       await this.notificationDomainService.createSubscriberFromAccount(finalAccount);
    //     } catch (error: any) {
    //       this.logger.error(`Ошибка обновления подписчика NOVU для ${username}: ${error.message}`, error.stack);
    //     }
    //   });
    // }

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
   * Синхронизирует аккаунт с системой уведомлений после обновления данных
   * @param username Имя пользователя
   */
  async syncAccountWithNotifications(username: string): Promise<void> {
    this.logger.log(`Начало синхронизации аккаунта ${username} с системой уведомлений`);

    try {
      const account = await this.getAccount(username);

      // Синхронизируем подписчика с обновленными данными
      if (account.provider_account?.subscriber_id) {
        await this.notificationDomainService.createSubscriberFromAccount(account);
        this.logger.log(`Успешно синхронизирован аккаунт ${username} с системой уведомлений`);
      } else {
        this.logger.warn(`Нет subscriber_id для аккаунта ${username}, пропускаем синхронизацию`);
      }
    } catch (error: any) {
      // Логируем ошибку, но не прерываем выполнение основной логики
      this.logger.error(`Ошибка синхронизации аккаунта ${username} с системой уведомлений: ${error.message}`, error.stack);
      // Не пробрасываем ошибку, чтобы не нарушить основной процесс обновления
    }
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
}

export const ACCOUNT_DOMAIN_SERVICE = Symbol('ACCOUNT_DOMAIN_SERVICE');
