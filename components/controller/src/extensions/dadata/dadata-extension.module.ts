import './i18n';

import { Inject, Module } from '@nestjs/common';
import { z } from 'zod';
import {
  BaseExtensionModule,
  DomainError,
  EXTENSION_REPOSITORY,
  type ExtensionDomainEntity,
  type ExtensionDomainRepository,
} from '@coopenomics/extension-kit';
import {
  LOGGER_PORT,
  type ILoggerPort,
  ORGANIZATION_LOOKUP_REGISTRY_PORT,
  type IOrganizationLookupHook,
  type IOrganizationLookupRegistryPort,
  type InnerOrganizationLookupRecord,
} from '@coopenomics/innercoop';
import { partyToOrganization, type DadataParty } from './domain/party-to-organization';

export const Schema = z.object({
  api_key: z.string(),
});

export const defaultConfig = {
  api_key: '',
};

export type IConfig = z.infer<typeof Schema>;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ILog {}

/** Карточка организации по ИНН или ОГРН. */
const FIND_PARTY_URL = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party';

/**
 * Коннектор реестра организаций России через DaData.
 *
 * Анкета вступления спрашивает ИНН, ядро зовёт `findByInn`, коннектор берёт
 * карточку головной организации и отдаёт поля анкеты. Без ключа коннектор в
 * реестр не встаёт, и анкета заполняется вручную. Ключ кооператива наружу не
 * уходит: запрос к DaData делает сервер.
 */
export class DadataExtension extends BaseExtensionModule implements IOrganizationLookupHook {
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    @Inject(ORGANIZATION_LOOKUP_REGISTRY_PORT) private readonly lookupRegistry: IOrganizationLookupRegistryPort
  ) {
    super();
    this.logger.setContext(DadataExtension.name);
  }

  name = 'dadata';
  readonly extensionName = 'dadata';
  readonly country = 'Russia';

  extension!: ExtensionDomainEntity<IConfig>;
  public configSchemas = Schema;
  public defaultConfig = defaultConfig;

  async initialize(): Promise<void> {
    const extensionData = await this.extensionRepository.findByName(this.name);
    if (!extensionData) throw DomainError.internal('DADATA_CONFIG_NOT_FOUND');
    this.extension = extensionData;

    if (!this.apiKey()) {
      this.logger.warn('Ключ DaData не задан — анкета организации заполняется вручную');
      return;
    }

    this.lookupRegistry.register(this);
    this.logger.info('Анкета организации заполняется по ИНН из DaData');
  }

  async findByInn(inn: string): Promise<InnerOrganizationLookupRecord | null> {
    const response = await fetch(FIND_PARTY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Token ${this.apiKey()}`,
      },
      // Филиалы делят ИНН с головной организацией; анкета нужна головной.
      body: JSON.stringify({ query: inn, branch_type: 'MAIN', count: 1 }),
    });

    if (!response.ok) {
      throw new Error(`DaData ответила ${response.status}`);
    }

    const body = (await response.json()) as { suggestions?: { data?: DadataParty }[] };
    const party = body.suggestions?.[0]?.data;
    return party ? partyToOrganization(party, inn) : null;
  }

  private apiKey(): string {
    return this.extension?.config?.api_key?.trim() ?? '';
  }
}

@Module({
  providers: [DadataExtension],
  exports: [DadataExtension],
})
export class DadataExtensionModule {
  constructor(private readonly dadataExtension: DadataExtension) {}

  async initialize() {
    await this.dadataExtension.initialize();
  }
}
