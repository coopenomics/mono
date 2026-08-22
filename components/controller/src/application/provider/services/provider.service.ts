import { Injectable, Logger, BadRequestException, Inject } from '@nestjs/common';
import { RegistratorContract } from 'cooptypes';
import { ProviderSubscriptionDTO } from '../dto/provider-subscription.dto';
import { CurrentInstanceDTO } from '../dto/current-instance.dto';
import { CooperativeRegistryItemDTO } from '../dto/cooperative-registry-item.dto';
import { InstanceStatus } from '~/domain/instance-status.enum';
import { Client, configureClient } from '@coopenomics/provider-client';
import { config } from '~/config';
import { BLOCKCHAIN_PORT, type BlockchainPort } from '~/domain/common/ports/blockchain.port';
import { ORGANIZATION_REPOSITORY, type OrganizationRepository } from '~/domain/common/repositories/organization.repository';
import { DocumentDomainService } from '~/domain/document/services/document-domain.service';
import { ConvertToAxonStatementGenerateDocumentInputDTO } from '~/application/document/documents-dto/convert-to-axon-statement-document.dto';
import { GenerateDocumentOptionsInputDTO, GeneratedDocumentDTO, AmountFormatterUtils } from '@coopenomics/extension-kit';
import { ProcessConvertToAxonStatementInputDTO } from '../dto/process-convert-to-axon-statement-input.dto';
import { SystemBlockchainPort, SYSTEM_BLOCKCHAIN_PORT } from '~/domain/system/interfaces/system-blockchain.port';
import { AmountComparisonUtils } from '~/shared/utils/amount-comparison.utils';

@Injectable()
export class ProviderService {
  private readonly logger = new Logger(ProviderService.name);

  constructor(
    private readonly documentDomainService: DocumentDomainService,
    @Inject(SYSTEM_BLOCKCHAIN_PORT) private readonly systemBlockchainPort: SystemBlockchainPort,
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
        item.status = coop.status;
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

  /**
   * Генерирует заявление на конвертацию паевого взноса в членский взнос
   */
  async generateConvertToAxonStatement(
    data: ConvertToAxonStatementGenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    // Устанавливаем registry_id для ConvertToAxonStatement
    data.registry_id = 51;
    // Форматируем сумму в читаемый формат (1000.0000 RUB -> 1 000,00 RUB)
    data.convert_amount = AmountFormatterUtils.formatAmount(data.convert_amount);
    const document = await this.documentDomainService.generateDocument({ data, options });
    // TODO: чтобы избавиться от unknown необходимо строго типизировать ответ фабрики документов
    return document as unknown as GeneratedDocumentDTO;
  }

  /**
   * Обрабатывает подписанное заявление на конвертацию и выполняет блокчейн-транзакцию
   */
  async processConvertToAxonStatement(data: ProcessConvertToAxonStatementInputDTO): Promise<boolean> {
    // Извлекаем документ из реестра по хэшу для проверки целостности
    const storedDocument = await this.documentDomainService.getDocumentByHash(data.signedDocument.doc_hash);

    if (!storedDocument) {
      throw new BadRequestException('Документ не найден в реестре');
    }

    // Проверяем совпадение хэшей
    if (storedDocument.hash !== data.signedDocument.doc_hash) {
      throw new BadRequestException('Хэш документа не совпадает с хранимым');
    }

    // Проверяем совпадение сумм (число и валюта)
    AmountComparisonUtils.validateAmountsMatch(data.signedDocument.meta.convert_amount, data.convertAmount);

    // Вызываем блокчейн-транзакцию для конвертации
    await this.systemBlockchainPort.convertToAxon({
      coopname: config.coopname,
      username: data.username,
      document: data.signedDocument,
      convert_amount: data.convertAmount,
    });

    this.logger.log(`Успешно обработано заявление на конвертацию для пользователя ${data.username}`);
    return true;
  }
}
