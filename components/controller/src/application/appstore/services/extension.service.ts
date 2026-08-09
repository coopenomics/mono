// ./modules/appstore/app-management.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { ExtensionDTO } from '../dto/extension-graphql.dto';
import { ExtensionGraphQLInput } from '../dto/extension-graphql-input.dto';
import { GetExtensionsGraphQLInput } from '../dto/get-extensions-input.dto';
import { UninstallExtensionGraphQLInput } from '../dto/uninstall-extension-input.dto';
import { ExtensionLogDTO } from '../dto/extension-log.dto';
import { GetExtensionLogsInputDTO } from '../dto/get-extension-logs-input.dto';
import { ExtensionInteractor } from '~/application/appstore/interactors/extension.interactor';
import { ExtensionListingInteractor } from '~/application/appstore/interactors/extension-listing.interactor';
import {
  LOG_EXTENSION_REPOSITORY,
  LogExtensionDomainRepository,
} from '~/domain/extension/repositories/log-extension-domain.repository';
import type {
  LogExtensionFilter,
  LogExtensionPaginationOptions,
  LogExtensionPaginationResult,
} from '~/domain/extension/interfaces/log-extension-domain.interface';
import { PaginationInputDTO } from '~/application/common/dto/pagination.dto';

/**
 * Application-слой, который:
 *  1) делегирует установку/удаление в старый интерактор
 *  2) для объединённого списка вызывает новый listingInterator
 */
@Injectable()
export class AppManagementService<TConfig = any> {
  constructor(
    private readonly extensionInteractor: ExtensionInteractor<TConfig>,
    private readonly listingInteractor: ExtensionListingInteractor<TConfig>,
    @Inject(LOG_EXTENSION_REPOSITORY) private readonly logExtensionRepository: LogExtensionDomainRepository<any>
  ) {}

  // Установка
  async installApp(data: ExtensionGraphQLInput<TConfig>): Promise<ExtensionDTO<TConfig>> {
    // Приложение должно быть открыто для установки в текущей сети
    this.listingInteractor.assertInstallable(data.name);
    // Валидируем конфиг
    this.listingInteractor.validateConfig(data.name, data.config);
    // Устанавливаем
    await this.extensionInteractor.installApp(data);
    // Собираем DTO из нового listingInteractor
    const app = await this.listingInteractor.getCombinedApp(data.name);
    if (!app) throw new Error('Не удалось собрать данные о расширении');
    return app;
  }

  // Удаление
  async uninstallApp(data: UninstallExtensionGraphQLInput): Promise<boolean> {
    return this.extensionInteractor.uninstallApp(data);
  }

  // Обновление
  async updateApp(data: ExtensionGraphQLInput<TConfig>): Promise<ExtensionDTO<TConfig>> {
    this.listingInteractor.validateConfig(data.name, data.config);
    await this.extensionInteractor.updateApp(data);

    const app = await this.listingInteractor.getCombinedApp(data.name);
    if (!app) throw new Error('Не удалось собрать данные о расширении');
    return app;
  }

  // Получить "один" расширение (DTO)
  async getCombinedApp(name: string): Promise<ExtensionDTO<TConfig> | null> {
    return this.listingInteractor.getCombinedApp(name);
  }

  // Получить список (DTO)
  async getCombinedAppList(filter?: GetExtensionsGraphQLInput): Promise<ExtensionDTO<TConfig>[]> {
    return this.listingInteractor.getCombinedAppList(filter);
  }

  // Получить логи расширений с фильтрацией и пагинацией
  async getExtensionLogs(
    filter?: GetExtensionLogsInputDTO,
    options?: PaginationInputDTO
  ): Promise<{ items: ExtensionLogDTO[]; totalCount: number; totalPages: number; currentPage: number }> {
    const domainFilter: LogExtensionFilter = {
      name: filter?.name,
      createdFrom: filter?.createdFrom,
      createdTo: filter?.createdTo,
    };

    const domainOptions: LogExtensionPaginationOptions = {
      page: options?.page,
      limit: options?.limit,
      sortBy: options?.sortBy,
      sortOrder: options?.sortOrder,
    };

    const result: LogExtensionPaginationResult = await this.logExtensionRepository.getWithFilter(
      domainFilter,
      domainOptions
    );

    return {
      items: result.items.map((entity) => new ExtensionLogDTO(entity)),
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };
  }
}
