import './i18n';

import { Inject, Module } from '@nestjs/common';
import { z } from 'zod';
import {
  BaseExtensionModule,
  describeConfigField,
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
  type InnerEntrepreneurLookupRecord,
  type InnerOrganizationLookupRecord,
} from '@coopenomics/innercoop';
import { partyToEntrepreneur, partyToOrganization, type DadataParty } from './domain/party-to-organization';
import { t } from './i18n';

// Значения ключей наружу не уходят: форма получает метку «задано» и прячет её
// под точками пароля; неизменённая метка при сохранении оставляет ключ на месте.
export const Schema = z.object({
  api_key: z.string().describe(
    describeConfigField({
      label: t('dadata.config.apiKeyLabel'),
      note: t('dadata.config.apiKeyNote'),
      password: true,
    }),
  ),
  secret_key: z.string().describe(
    describeConfigField({
      label: t('dadata.config.secretKeyLabel'),
      note: t('dadata.config.secretKeyNote'),
      password: true,
    }),
  ),
  // Адрес сервиса скрыт из формы: его подменяет только внешний слой тестов,
  // направляя запросы на подставной узел стенда. Пусто — настоящий DaData.
  api_url: z
    .string()
    .optional()
    .describe(describeConfigField({ label: t('dadata.config.apiUrlLabel'), visible: false })),
});

export const defaultConfig = {
  api_key: '',
  secret_key: '',
};

export type IConfig = z.infer<typeof Schema>;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ILog {}

/** Адрес API подсказок DaData; карточка организации или ИП по ИНН — `/findById/party`. */
const DADATA_API_URL = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs';

/** Вид субъекта в запросе DaData: анкета организации не должна найти ИП, и наоборот. */
enum DadataPartyType {
  LEGAL = 'LEGAL',
  INDIVIDUAL = 'INDIVIDUAL',
}

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
    const party = await this.findParty(inn, DadataPartyType.LEGAL);
    return party ? partyToOrganization(party, inn) : null;
  }

  async findEntrepreneurByInn(inn: string): Promise<InnerEntrepreneurLookupRecord | null> {
    const party = await this.findParty(inn, DadataPartyType.INDIVIDUAL);
    return party ? partyToEntrepreneur(party, inn) : null;
  }

  private async findParty(inn: string, type: DadataPartyType): Promise<DadataParty | null> {
    const response = await fetch(this.findPartyUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Token ${this.apiKey()}`,
      },
      // Филиалы делят ИНН с головной организацией; анкета нужна головной.
      body: JSON.stringify({ query: inn, type, branch_type: 'MAIN', count: 1 }),
    });

    if (!response.ok) {
      // i18n-ignore: причина сбоя сервиса уходит в журнал узла, пайщику анкета отвечает «сведения не найдены»
      throw new Error(`DaData ответила ${response.status}`);
    }

    const body = (await response.json()) as { suggestions?: { data?: DadataParty }[] };
    return body.suggestions?.[0]?.data ?? null;
  }

  private findPartyUrl(): string {
    const base = this.extension?.config?.api_url?.trim() || DADATA_API_URL;
    return `${base.replace(/\/$/, '')}/findById/party`;
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
