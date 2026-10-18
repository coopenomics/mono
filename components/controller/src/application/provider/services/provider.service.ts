import { Injectable, Logger, Inject } from '@nestjs/common';
import { DomainError } from '@coopenomics/extension-kit';
import axios from 'axios';
import { RegistratorContract } from 'cooptypes';
import { ProviderSubscriptionDTO } from '../dto/provider-subscription.dto';
import { CurrentInstanceDTO } from '../dto/current-instance.dto';
import { CooperativeRegistryItemDTO } from '../dto/cooperative-registry-item.dto';
import { ProviderConnectionCatalogDTO } from '../dto/provider-catalog.dto';
import {
  ChangeProviderTariffResultDTO,
  ProviderBillingPeriod,
  SelectProviderTariffResultDTO,
} from '../dto/select-provider-tariff.dto';
import { CooperativeChainStatus } from '~/domain/billing/enums/billing-statuses.enum';
import { InstanceStatus } from '~/domain/instance-status.enum';
import { Client, configureClient } from '@coopenomics/provider-client';
import { config } from '~/config';
import { BLOCKCHAIN_PORT, type BlockchainPort } from '~/domain/common/ports/blockchain.port';
import { ORGANIZATION_REPOSITORY, type OrganizationRepository } from '~/domain/common/repositories/organization.repository';
import { CooperativeCharterService } from './cooperative-charter.service';
import { CooperativeCharterOutputDTO } from '../dto/cooperative-charter.output';
import { t } from '~/i18n';

const listOf = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/**
 * Ответ провайдера → каталог витрины. Кривой ответ даёт пустые списки, а не
 * падение витрины. Провайдер до тарифной сетки (16.10.2026) не отдаёт tariffs
 * и annual_billing: пустая сетка и выключенная годовая оплата.
 */
function toConnectionCatalog(data: any): ProviderConnectionCatalogDTO {
  return {
    types: listOf(data.types),
    server_options: listOf(data.server_options),
    tariffs: listOf(data.tariffs),
    current_tariff: data.current_tariff ?? null,
    annual_billing: {
      enabled: data.annual_billing?.enabled === true,
      discount_percent: Number(data.annual_billing?.discount_percent ?? 0),
    },
  };
}

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
      throw DomainError.badRequest('PROVIDER_BASE_URL_MISSING');
    }
    const token = config.provider_bearer_token;
    if (!token) {
      throw DomainError.badRequest('PROVIDER_CATALOG_TOKEN_MISSING');
    }
    try {
      const response = await axios.get(`${config.provider_base_url}/v1/subscription-types`, {
        headers: { Authorization: `Bearer ${token}` },
        params: coopname ? { coopname } : undefined,
        timeout: 10_000,
      });
      return toConnectionCatalog(response.data ?? {});
    } catch (error: any) {
      this.logger.error(`Каталог витрины провайдера недоступен: ${error?.message || error}`);
      throw DomainError.badRequest('PROVIDER_CATALOG_UNAVAILABLE');
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

    // Тариф каждой заявки — двумя запросами на весь реестр: сетка тарифов и
    // список выборов. Провайдер без сетки или недоступный — реестр без тарифов.
    const tariffs = providerAvailable ? await this.loadRegistryTariffs() : new Map();

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

        const selected = tariffs.get(coop.username);
        if (selected) {
          item.tariff = selected.tariff;
          item.tariff_billing_period = selected.billing_period;
        }

        item.has_provider_data = item.subscriptions.length > 0;
        return item;
      })
    );
  }

  /** Выбранные кооперативами тарифы: coopname → тариф сетки и период оплаты. */
  private async loadRegistryTariffs(): Promise<
    Map<string, { tariff: ProviderConnectionCatalogDTO['tariffs'][number]; billing_period: ProviderBillingPeriod }>
  > {
    const result = new Map<string, { tariff: ProviderConnectionCatalogDTO['tariffs'][number]; billing_period: ProviderBillingPeriod }>();
    const token = config.provider_bearer_token;
    if (!token) return result;
    try {
      const [catalog, selections] = await Promise.all([
        this.getConnectionCatalog(),
        axios.get(`${config.provider_base_url}/v1/subscription-types/selections`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10_000,
        }),
      ]);
      const byCode = new Map(catalog.tariffs.map((tariff) => [tariff.code, tariff]));
      for (const row of listOf<{ coopname: string; tariff_code: string; billing_period: string }>(selections.data)) {
        const tariff = byCode.get(row.tariff_code);
        if (!tariff) continue;
        result.set(row.coopname, {
          tariff,
          billing_period: row.billing_period === 'year' ? ProviderBillingPeriod.year : ProviderBillingPeriod.month,
        });
      }
    } catch (error: any) {
      // Тарифы — подсказка совету, а не основа реестра: без них реестр работает.
      this.logger.warn(`Тарифы кооперативов для реестра не получены: ${error?.message || error}`);
    }
    return result;
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
      throw DomainError.internal('PROVIDER_NOT_CONFIGURED');
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
      throw DomainError.badRequest('PROVIDER_BASE_URL_MISSING');
    }
    try {
      const response = await axios.post(
        `${config.provider_base_url}/instances/${username}/change-plan`,
        { instance_type_id: instanceTypeId },
        { headers: { 'server-secret': config.server_secret }, timeout: 30_000 },
      );
      return response.data;
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || t('provider.hostingPlan.unknownError');
      this.logger.error(`Смена тарифа для ${username} не прошла: ${message}`);
      throw DomainError.badRequest('PROVIDER_HOSTING_PLAN_CHANGE_FAILED', { reason: message });
    }
  }

  /**
   * Тариф, выбранный кооперативом в мастере подключения (тарифная сетка,
   * 16.10.2026). Уходит провайдеру тем же server-secret каналом, что и смена
   * тарифа, до заявки в цепь: провайдер по нему заказывает сервер и заводит
   * подписки. Имя кооператива берётся из сессии вызывающего.
   */
  async selectTariff(
    username: string,
    tariffCode: string,
    billingPeriod: ProviderBillingPeriod,
  ): Promise<SelectProviderTariffResultDTO> {
    if (!this.isProviderAvailable()) {
      throw DomainError.badRequest('PROVIDER_BASE_URL_MISSING');
    }
    try {
      const response = await axios.put(
        `${config.provider_base_url}/instances/${username}/tariff`,
        { tariff_code: tariffCode, billing_period: billingPeriod },
        { headers: { 'server-secret': config.server_secret }, timeout: 10_000 },
      );
      return {
        tariff_code: response.data?.tariff_code ?? tariffCode,
        billing_period: (response.data?.billing_period as ProviderBillingPeriod) ?? billingPeriod,
      };
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || t('provider.hostingPlan.unknownError');
      this.logger.error(`Выбор тарифа ${tariffCode} для ${username} не принят: ${message}`);
      throw DomainError.badRequest('PROVIDER_TARIFF_SELECT_FAILED', { reason: message });
    }
  }

  /**
   * Смена тарифа сетки по решению кооператива: провайдер переоценивает
   * подписки с зачётом остатка и, если тарифу нужен другой сервер, запускает
   * перенос. Тот же server-secret канал, что и смена конфигурации сервера.
   */
  async changeTariff(username: string, tariffCode: string): Promise<ChangeProviderTariffResultDTO> {
    if (!this.isProviderAvailable()) {
      throw DomainError.badRequest('PROVIDER_BASE_URL_MISSING');
    }
    try {
      const response = await axios.post(
        `${config.provider_base_url}/instances/${username}/change-tariff`,
        { tariff_code: tariffCode },
        { headers: { 'server-secret': config.server_secret }, timeout: 30_000 },
      );
      return {
        migration_state: String(response.data?.migration_state ?? 'none'),
        monthly_total: Number(response.data?.monthly_total ?? 0),
        annual_total: response.data?.annual_total ?? null,
      };
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || t('provider.hostingPlan.unknownError');
      this.logger.error(`Смена тарифа ${tariffCode} для ${username} не прошла: ${message}`);
      throw DomainError.badRequest('PROVIDER_TARIFF_CHANGE_FAILED', { reason: message });
    }
  }

  /**
   * Получить подписку по ID
   */
  async getSubscriptionById(id: number): Promise<ProviderSubscriptionDTO> {
    // Проверяем доступность провайдера
    if (!this.isProviderAvailable()) {
      throw DomainError.internal('PROVIDER_NOT_CONFIGURED');
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
      throw DomainError.internal('PROVIDER_NOT_CONFIGURED');
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
      // Ход установки: по доле выполненных задач стол показывает процент в
      // диапазоне плейбука, пока веха провайдера стоит на месте.
      currentInstance.playbook_step = typeof raw.playbook_step === 'number' ? raw.playbook_step : null;
      currentInstance.playbook_total_steps =
        typeof raw.playbook_total_steps === 'number' ? raw.playbook_total_steps : null;

      return currentInstance;
    } catch (error: any) {
      this.logger.error(`Ошибка при получении инстанса для ${username}: ${error.message}`);
      throw error;
    }
  }
}
