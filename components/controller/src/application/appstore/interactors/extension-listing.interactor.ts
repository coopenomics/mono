import { Injectable } from '@nestjs/common';
import { ExtensionDomainListingService } from '~/domain/extension/services/extension-listing-domain.service';
import { ExtensionDTO } from '~/application/appstore/dto/extension-graphql.dto';
import { GetExtensionsGraphQLInput } from '~/application/appstore/dto/get-extensions-input.dto';

@Injectable()
export class ExtensionListingInteractor<TConfig = any> {
  constructor(private readonly listingService: ExtensionDomainListingService<TConfig>) {}

  /**
   * Возвращает список доступных/установленных расширений, с фильтрами
   */
  async getCombinedAppList(filter?: GetExtensionsGraphQLInput): Promise<ExtensionDTO<TConfig>[]> {
    return this.listingService.getCombinedAppList(filter);
  }

  /**
   * Возвращает DTO одного расширения
   */
  async getCombinedApp(name: string): Promise<ExtensionDTO<TConfig> | null> {
    return this.listingService.getCombinedApp(name);
  }

  /**
   * Проверить конфиг по схеме
   */
  validateConfig(name: string, config: any): void {
    return this.listingService.validateConfig(name, config);
  }

  /**
   * Проверить, что расширение вообще открыто для установки в этой сети
   */
  assertInstallable(name: string): void {
    return this.listingService.assertInstallable(name);
  }
}
