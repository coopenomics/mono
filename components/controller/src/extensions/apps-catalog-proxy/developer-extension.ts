/**
 * Расширение «developer» (487-27): два стола поверх прокси каталога.
 *
 *  - `developer` — «Стол разработчика» председателя: пакеты, релизы,
 *    модерация, издатели, pricing. Право `Developer:manage`.
 *  - `publisher` — «Мои приложения» пайщика-издателя: свои пакеты и ключи
 *    каталога. Право `Publisher:manage` есть только у аккаунтов из
 *    `apps_publishers`; остальным стол не показывается.
 *
 * Права — `application/access/developer-rights.ts`. Состояние расширения —
 * таблица `apps_publishers` (миграции — `apps-catalog-proxy.database-migrations.ts`).
 * Конфига нет: адреса каталога берутся из env контроллера.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  BaseExtensionModule,
  EXTENSION_REPOSITORY,
  type ExtensionDomainEntity,
  type ExtensionDomainRepository,
} from '@coopenomics/extension-kit';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { z } from 'zod';

export const Schema = z.object({});
export type IConfig = z.infer<typeof Schema>;
export const defaultConfig: IConfig = {};

@Injectable()
export class DeveloperExtension extends BaseExtensionModule {
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
  ) {
    super();
    this.logger.setContext(DeveloperExtension.name);
  }

  name = 'developer';
  extension!: ExtensionDomainEntity<IConfig>;
  public configSchemas = Schema;
  public defaultConfig = defaultConfig;

  async initialize(): Promise<void> {
    // таблицу назначений создаёт миграция расширения, настраивать при запуске нечего
  }
}
