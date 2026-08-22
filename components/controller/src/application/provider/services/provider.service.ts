import { Injectable, Logger, BadRequestException, Inject } from '@nestjs/common';
import { RegistratorContract } from 'cooptypes';
import { ProviderSubscriptionDTO } from '../dto/provider-subscription.dto';
import { CurrentInstanceDTO } from '../dto/current-instance.dto';
import { CooperativeRegistryItemDTO } from '../dto/cooperative-registry-item.dto';
import { CooperativeChainStatus } from '~/domain/billing/enums/billing-statuses.enum';
import { InstanceStatus } from '~/domain/instance-status.enum';
import { Client, configureClient } from '@coopenomics/provider-client';
import { config } from '~/config';
import { BLOCKCHAIN_PORT, type BlockchainPort } from '~/domain/common/ports/blockchain.port';
import { ORGANIZATION_REPOSITORY, type OrganizationRepository } from '~/domain/common/repositories/organization.repository';

@Injectable()
export class ProviderService {
  private readonly logger = new Logger(ProviderService.name);

  constructor(
    @Inject(BLOCKCHAIN_PORT) private readonly blockchainPort: BlockchainPort,
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizationRepository: OrganizationRepository
  ) {
    // Проверяем наличие PROVIDER_BASE_URL
    const providerBaseUrl = config.provider_base_url;

    if (providerBaseUrl === '') {
      this.logger.warn('PROVIDER_BASE_URL не настроен - функционал провайдера недоступен');
      return;
    }

    // Получаем SERVER_SECRET для аутентификации
    const serverSecret = config.server_secret;

    // Инициализируем клиент провайдера с аутентификацией
    configureClient(providerBaseUrl, serverSecret);
  }

  /**
   * Проверяет доступность провайдера
   */
  isProviderAvailable(): boolean {
    return config.provider_base_url !== '';
  }

  /**
   * Реестр кооперативов для оператора: сводит on-chain список кооперативов
   * (registrator.coops) с данными провайдера (подписки/инстанс/биллинг по coopname).
   *
   * On-chain — источник истины по статусу кооператива (pending|active|blocked).
   * Provider — источник данных подписок; если провайдер не настроен или у кооператива
   * нет подписки, поле subscriptions остаётся пустым (кооператив всё равно в списке).
   */
  async getCooperativesRegistry(): Promise<CooperativeRegistryItemDTO[]> {
    const coops = (await this.blockchainPort.getAllRows(
      RegistratorContract.contractName.production,
      RegistratorContract.contractName.production,
      RegistratorContract.Tables.Cooperatives.tableName
    )) as RegistratorContract.Tables.Cooperatives.ICooperative[];

    const providerAvailable = this.isProviderAvailable();

    return Promise.all(
      coops.map(async (coop) => {
        const item = new CooperativeRegistryItemDTO();
        item.coopname = coop.username;
        item.name = await this.resolveOrganizationName(coop.username, coop.description);
        item.announce = coop.announce;
        item.status = coop.status as CooperativeChainStatus;
        item.created_at = coop.created_at;
        item.subscriptions = [];

        if (providerAvailable) {
          try {
            item.subscriptions = await this.getUserSubscriptions(coop.username);
          } catch (error: any) {
            // Провайдер недоступен или у кооператива нет подписок — не роняем весь реестр.
            this.logger.warn(`Не удалось получить подписки провайдера для ${coop.username}: ${error.message}`);
          }
        }

        item.has_provider_data = item.subscriptions.length > 0;
        return item;
      })
    );
  }

  /**
   * Извлечь человеко-читаемое наименование кооператива. Сначала пробуем
   * organization-запись в Mongo (short_name → full_name), потом on-chain
   * description; если и его нет — null, фронт сам отрисует coopname.
   */
  private async resolveOrganizationName(username: string, onChainDescription: string): Promise<string | undefined> {
    try {
      const organization = await this.organizationRepository.findByUsername(username);
      const name = organization?.short_name || organization?.full_name;
      if (name) return name;
    } catch {
      // organization ещё не зарегистрирована — fallback на on-chain
    }
    return onChainDescription || undefined;
  }

  /**
   * Получить подписки пользователя по username
   */
  async getUserSubscriptions(username: string): Promise<ProviderSubscriptionDTO[]> {
    // Проверяем доступность провайдера
    if (!this.isProviderAvailable()) {
      throw new Error('Провайдер не настроен');
    }

    try {
      this.logger.log(`Получаем подписки для пользователя: ${username}`);

      // Получаем подписки через provider-client (уже обогащенные данными)
      const subscriptions = await Client.SubscriptionsService.subscriptionControllerGetSubscriptionsByUsername(username);

      const result: ProviderSubscriptionDTO[] = [];

      for (const subscription of subscriptions) {
        // Провайдер уже возвращает обогащенные данные
        const providerSubscription = new ProviderSubscriptionDTO(subscription);
        result.push(providerSubscription);
      }

      return result;
    } catch (error: any) {
      this.logger.error(`Ошибка при получении подписок для ${username}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получить подписку по ID
   */
  async getSubscriptionById(id: number): Promise<ProviderSubscriptionDTO> {
    // Проверяем доступность провайдера
    if (!this.isProviderAvailable()) {
      throw new Error('Провайдер не настроен');
    }

    try {
      this.logger.log(`Получаем подписку по ID: ${id}`);

      const subscription = await Client.SubscriptionsService.subscriptionControllerGetSubscriptionById(id.toString());

      // Провайдер уже возвращает обогащенные данные
      return new ProviderSubscriptionDTO(subscription);
    } catch (error: any) {
      this.logger.error(`Ошибка при получении подписки ${id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получить текущий инстанс пользователя по username
   */
  async getCurrentInstance(username: string): Promise<CurrentInstanceDTO | null> {
    // Проверяем доступность провайдера
    if (!this.isProviderAvailable()) {
      throw new Error('Провайдер не настроен');
    }

    try {
      // Получаем инстанс через provider-client
      type InstanceResponse = Awaited<ReturnType<typeof Client.InstancesService.instanceControllerGetInstance>>;
      const instance: InstanceResponse = await Client.InstancesService.instanceControllerGetInstance(username);

      if (!instance) {
        return null;
      }

      // Преобразуем данные в сокращенный DTO (без IP и username)
      const currentInstance = new CurrentInstanceDTO();
      currentInstance.status = instance.instance.status as unknown as InstanceStatus;
      currentInstance.is_valid = instance.instance.is_valid;
      currentInstance.is_delegated = instance.instance.is_delegated;
      currentInstance.blockchain_status = instance.instance.blockchain_status;
      currentInstance.progress = instance.instance.progress;
      currentInstance.domain = instance.instance.domain;
      currentInstance.title = instance.instance.title;
      currentInstance.description = instance.instance.description;
      currentInstance.image = instance.instance.image;

      return currentInstance;
    } catch (error: any) {
      this.logger.error(`Ошибка при получении инстанса для ${username}: ${error.message}`);
      throw error;
    }
  }
}
