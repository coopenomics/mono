import { Injectable, Logger, BadRequestException, Inject } from '@nestjs/common';
import axios from 'axios';
import { RegistratorContract } from 'cooptypes';
import { ProviderSubscriptionDTO } from '../dto/provider-subscription.dto';
import { CurrentInstanceDTO } from '../dto/current-instance.dto';
import { CooperativeRegistryItemDTO } from '../dto/cooperative-registry-item.dto';
import { ProviderConnectionCatalogDTO } from '../dto/provider-catalog.dto';
import { CooperativeChainStatus } from '~/domain/billing/enums/billing-statuses.enum';
import { InstanceStatus } from '~/domain/instance-status.enum';
import { Client, configureClient } from '@coopenomics/provider-client';
import { config } from '~/config';
import { BLOCKCHAIN_PORT, type BlockchainPort } from '~/domain/common/ports/blockchain.port';
import { ORGANIZATION_REPOSITORY, type OrganizationRepository } from '~/domain/common/repositories/organization.repository';
import { CooperativeCharterService } from './cooperative-charter.service';
import { CooperativeCharterOutputDTO } from '../dto/cooperative-charter.output';

@Injectable()
export class ProviderService {
  private readonly logger = new Logger(ProviderService.name);

  constructor(
    @Inject(BLOCKCHAIN_PORT) private readonly blockchainPort: BlockchainPort,
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizationRepository: OrganizationRepository,
    private readonly charters: CooperativeCharterService
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
   * Epic 28 (форм-фактор §7): каталог витрины подключения — живой
   * GET /v1/subscription-types провайдера (Bearer, read-only). Витрина
   * степпера показывает конфигурации сервера с отпускной ценой и триалом
   * вместо хардкода; закупку и наценку провайдер наружу не отдаёт.
   */
  async getConnectionCatalog(coopname?: string): Promise<ProviderConnectionCatalogDTO> {
    if (!this.isProviderAvailable()) {
      throw new BadRequestException('Провайдер не настроен (PROVIDER_BASE_URL)');
    }
    const token = config.provider_bearer_token;
    if (!token) {
      throw new BadRequestException('Витрина провайдера не настроена (PROVIDER_BEARER_TOKEN)');
    }
    try {
      const response = await axios.get(`${config.provider_base_url}/v1/subscription-types`, {
        headers: { Authorization: `Bearer ${token}` },
        params: coopname ? { coopname } : undefined,
        timeout: 10_000,
      });
      const data = response.data ?? {};
      return {
        types: Array.isArray(data.types) ? data.types : [],
        server_options: Array.isArray(data.server_options) ? data.server_options : [],
      };
    } catch (error: any) {
      this.logger.error(`Каталог витрины провайдера недоступен: ${error?.message || error}`);
      throw new BadRequestException('Каталог тарифов провайдера временно недоступен, попробуйте позже');
    }
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

    // Уставы — одним запросом на весь реестр: заявка читается вместе с
    // документом, и ходить в хранилище на каждую строку незачем.
    const charters = await this.charters.listLatestFor(
      config.coopname,
      coops.map((coop) => coop.username)
    );

    return Promise.all(
      coops.map(async (coop) => {
        const item = new CooperativeRegistryItemDTO();
        item.coopname = coop.username;
        item.name = await this.resolveOrganizationName(coop.username);
        item.announce = coop.announce;
        item.description = coop.description || undefined;
        const charter = charters.get(coop.username);
        item.charter = charter ? CooperativeCharterOutputDTO.fromDomain(charter) : undefined;
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
   * Извлечь человеко-читаемое наименование кооператива из organization-записи
   * в Mongo (short_name → full_name); если её ещё нет — undefined, и фронт
   * отрисует coopname.
   *
   * On-chain `description` в качестве запасного имени больше не годится: с
   * мастера подключения туда пишется рассказ кооператива о своей деятельности,
   * и в заголовке строки реестра он выглядел бы абзацем текста. Само описание
   * приходит отдельным полем.
   */
  private async resolveOrganizationName(username: string): Promise<string | undefined> {
    try {
      const organization = await this.organizationRepository.findByUsername(username);
      const name = organization?.short_name || organization?.full_name;
      if (name) return name;
    } catch {
      // organization ещё не зарегистрирована — имени пока нет
    }
    return undefined;
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
        // Порог докупки пакета знает хаб, а не провайдер: пакетная услуга
        // платится по расходу ресурса, и без этого числа кооперативу неоткуда
        // понять, когда именно спишется следующие деньги.
        if (providerSubscription.kind === 'package') {
          providerSubscription.package_low_water_axon = config.billing.package_low_water_axon;
        }
        result.push(providerSubscription);
      }

      return result;
    } catch (error: any) {
      this.logger.error(`Ошибка при получении подписок для ${username}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Смена тарифа сервера по решению кооператива: команда уходит провайдеру
   * server-secret каналом (POST /instances/:username/change-plan). Цена
   * применяется немедленно с зачётом неиспользованного остатка, дальше идёт
   * перенос на сервер новой конфигурации — система кооператива уходит в
   * технические работы примерно на час. Даунгрейд провайдер отклоняет.
   */
  async changeHostingPlan(
    username: string,
    instanceTypeId: number,
  ): Promise<{ migration_state: string; new_price: number }> {
    if (!this.isProviderAvailable()) {
      throw new BadRequestException('Провайдер не настроен (PROVIDER_BASE_URL)');
    }
    try {
      const response = await axios.post(
        `${config.provider_base_url}/instances/${username}/change-plan`,
        { instance_type_id: instanceTypeId },
        { headers: { 'server-secret': config.server_secret }, timeout: 30_000 },
      );
      return response.data;
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'неизвестная ошибка';
      this.logger.error(`Смена тарифа для ${username} не прошла: ${message}`);
      throw new BadRequestException(`Не удалось сменить тариф: ${message}`);
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
      // Состояние поставки, по которому фронт отличает первичную установку от
      // возврата в строй (после освобождения сервера за неоплату) и объясняет
      // пайщику, что данные вернутся из резервной копии. Типы provider-client
      // отстают от REST-ответа провайдера, поэтому поля читаются мягко.
      const raw = instance.instance as unknown as Record<string, unknown>;
      currentInstance.maintenance_mode = raw.maintenance_mode === true;
      currentInstance.is_restoring = raw.redeploy_restore === true;
      currentInstance.is_released = raw.release_state === 'done';

      return currentInstance;
    } catch (error: any) {
      this.logger.error(`Ошибка при получении инстанса для ${username}: ${error.message}`);
      throw error;
    }
  }
}
